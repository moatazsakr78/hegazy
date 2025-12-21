import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth.config'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'elfaroukgroup'
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
)

// Types for better type safety
interface SaleItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number | null
  products?: {
    name: string
    product_code: string | null
    main_image_url: string | null
  }
}

interface Sale {
  id: string
  invoice_number: string
  total_amount: number
  tax_amount: number | null
  discount_amount: number | null
  payment_method: string
  notes: string | null
  created_at: string
  time: string | null
  invoice_type: string | null
  records?: {
    name: string
  } | null
  sale_items?: SaleItem[]
}

interface CustomerPayment {
  id: string
  amount: number
  payment_method: string | null
  notes: string | null
  payment_date: string | null
  created_at: string
  records?: {
    name: string
  } | null
}

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  governorate: string | null
  account_balance: number | null
  loyalty_points: number | null
  rank: string | null
  created_at: string | null
}

export async function GET(request: Request) {
  try {
    // Get session from NextAuth
    const session = await auth()

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login to view your invoices' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const userEmail = session.user.email

    // Parse query parameters for filtering and pagination
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const tab = searchParams.get('tab') || 'invoices' // invoices, payments, statement
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // First, try to get the customer record linked to this user by user_id
    let { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, name, phone, email, address, city, governorate, account_balance, loyalty_points, rank, created_at')
      .eq('user_id', userId)
      .single()

    // If not found by user_id, try to find by email and link them
    if ((customerError || !customer) && userEmail) {
      const { data: customerByEmail, error: emailError } = await supabaseAdmin
        .from('customers')
        .select('id, name, phone, email, address, city, governorate, account_balance, loyalty_points, rank, created_at')
        .eq('email', userEmail)
        .is('user_id', null)
        .single()

      if (customerByEmail && !emailError) {
        // Link the customer to this user
        await supabaseAdmin
          .from('customers')
          .update({ user_id: userId })
          .eq('id', customerByEmail.id)

        customer = customerByEmail
        customerError = null
      }
    }

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer account not found. Please contact support.' },
        { status: 404 }
      )
    }

    // Build date filter
    let dateFilter = {}
    if (startDate) {
      dateFilter = { ...dateFilter, gte: startDate }
    }
    if (endDate) {
      dateFilter = { ...dateFilter, lte: endDate + 'T23:59:59' }
    }

    // Response data based on tab
    let responseData: {
      customer: Customer
      invoices?: Sale[]
      payments?: CustomerPayment[]
      statement?: Array<{
        id: string
        date: string
        time: string | null
        type: string
        description: string
        invoiceValue: number
        paidAmount: number
        balance: number
        record: string | null
      }>
      statistics?: {
        totalInvoices: number
        totalInvoicesAmount: number
        totalPayments: number
        averageOrderValue: number
        lastInvoiceDate: string | null
      }
      pagination?: {
        page: number
        limit: number
        total: number
        hasMore: boolean
      }
    } = {
      customer: customer as Customer
    }

    if (tab === 'invoices' || tab === 'statement') {
      // Fetch sales/invoices for this customer
      let salesQuery = supabaseAdmin
        .from('sales')
        .select(`
          id,
          invoice_number,
          total_amount,
          tax_amount,
          discount_amount,
          payment_method,
          notes,
          created_at,
          time,
          invoice_type,
          records:record_id (name),
          sale_items (
            id,
            product_id,
            quantity,
            unit_price,
            discount,
            products:product_id (name, product_code, main_image_url)
          )
        `, { count: 'exact' })
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })

      // Apply date filter if provided
      if (startDate) {
        salesQuery = salesQuery.gte('created_at', startDate)
      }
      if (endDate) {
        salesQuery = salesQuery.lte('created_at', endDate + 'T23:59:59')
      }

      // Apply pagination only for invoices tab
      if (tab === 'invoices') {
        salesQuery = salesQuery.range(offset, offset + limit - 1)
      }

      const { data: sales, error: salesError, count: salesCount } = await salesQuery

      if (salesError) {
        console.error('Sales fetch error:', salesError)
        return NextResponse.json(
          { error: 'Failed to fetch invoices' },
          { status: 500 }
        )
      }

      // Transform sales data to match our types
      responseData.invoices = (sales || []).map((sale: any) => ({
        ...sale,
        records: sale.records ? (Array.isArray(sale.records) ? sale.records[0] : sale.records) : null,
        sale_items: sale.sale_items?.map((item: any) => ({
          ...item,
          products: item.products ? (Array.isArray(item.products) ? item.products[0] : item.products) : null
        }))
      })) as Sale[]

      if (tab === 'invoices') {
        responseData.pagination = {
          page,
          limit,
          total: salesCount || 0,
          hasMore: (salesCount || 0) > offset + limit
        }
      }
    }

    if (tab === 'payments' || tab === 'statement') {
      // Fetch payments for this customer
      let paymentsQuery = supabaseAdmin
        .from('customer_payments')
        .select(`
          id,
          amount,
          payment_method,
          notes,
          payment_date,
          created_at,
          records:safe_id (name)
        `, { count: 'exact' })
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })

      // Apply date filter if provided
      if (startDate) {
        paymentsQuery = paymentsQuery.gte('created_at', startDate)
      }
      if (endDate) {
        paymentsQuery = paymentsQuery.lte('created_at', endDate + 'T23:59:59')
      }

      // Apply pagination only for payments tab
      if (tab === 'payments') {
        paymentsQuery = paymentsQuery.range(offset, offset + limit - 1)
      }

      const { data: payments, error: paymentsError, count: paymentsCount } = await paymentsQuery

      if (paymentsError) {
        console.error('Payments fetch error:', paymentsError)
        return NextResponse.json(
          { error: 'Failed to fetch payments' },
          { status: 500 }
        )
      }

      // Transform payments data to match our types
      responseData.payments = (payments || []).map((payment: any) => ({
        ...payment,
        records: payment.records ? (Array.isArray(payment.records) ? payment.records[0] : payment.records) : null
      })) as CustomerPayment[]

      if (tab === 'payments') {
        responseData.pagination = {
          page,
          limit,
          total: paymentsCount || 0,
          hasMore: (paymentsCount || 0) > offset + limit
        }
      }
    }

    // Build account statement
    if (tab === 'statement') {
      const statement: Array<{
        id: string
        date: string
        time: string | null
        type: string
        description: string
        invoiceValue: number
        paidAmount: number
        balance: number
        record: string | null
      }> = []

      // Combine invoices and payments
      const allTransactions: Array<{
        id: string
        date: string
        time: string | null
        type: 'invoice' | 'payment'
        description: string
        amount: number
        record: string | null
      }> = []

      // Add invoices
      if (responseData.invoices) {
        responseData.invoices.forEach(invoice => {
          allTransactions.push({
            id: invoice.id,
            date: invoice.created_at?.split('T')[0] || '',
            time: invoice.time,
            type: 'invoice',
            description: `${invoice.invoice_type === 'فاتورة بيع' ? 'فاتورة بيع' : invoice.invoice_type || 'فاتورة بيع'} - ${invoice.invoice_number}`,
            amount: Number(invoice.total_amount) || 0,
            record: (invoice.records as { name: string } | null)?.name || null
          })
        })
      }

      // Add payments
      if (responseData.payments) {
        responseData.payments.forEach(payment => {
          allTransactions.push({
            id: payment.id,
            date: payment.payment_date || payment.created_at?.split('T')[0] || '',
            time: payment.created_at?.split('T')[1]?.substring(0, 5) || null,
            type: 'payment',
            description: payment.notes || 'سلفة',
            amount: Number(payment.amount) || 0,
            record: (payment.records as { name: string } | null)?.name || null
          })
        })
      }

      // Sort by date descending
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date + (a.time ? 'T' + a.time : ''))
        const dateB = new Date(b.date + (b.time ? 'T' + b.time : ''))
        return dateB.getTime() - dateA.getTime()
      })

      // Calculate running balance (start from oldest)
      let runningBalance = Number(customer.account_balance) || 0

      // Calculate the total of all invoices and payments to get starting balance
      const totalInvoices = allTransactions
        .filter(t => t.type === 'invoice')
        .reduce((sum, t) => sum + t.amount, 0)
      const totalPayments = allTransactions
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + t.amount, 0)

      // Work backwards from current balance
      const reversedTransactions = [...allTransactions].reverse()
      let calculatedBalance = runningBalance

      reversedTransactions.forEach(transaction => {
        if (transaction.type === 'invoice') {
          calculatedBalance -= transaction.amount
        } else {
          calculatedBalance += transaction.amount
        }
      })

      // Now build statement with correct running balance
      let currentBalance = calculatedBalance
      allTransactions.reverse().forEach(transaction => {
        if (transaction.type === 'invoice') {
          currentBalance += transaction.amount
        } else {
          currentBalance -= transaction.amount
        }

        statement.unshift({
          id: transaction.id,
          date: transaction.date,
          time: transaction.time,
          type: transaction.type === 'invoice' ? 'فاتورة بيع' : 'سلفة',
          description: transaction.description,
          invoiceValue: transaction.type === 'invoice' ? transaction.amount : 0,
          paidAmount: transaction.type === 'payment' ? transaction.amount : 0,
          balance: currentBalance,
          record: transaction.record
        })
      })

      // Apply pagination to statement
      const paginatedStatement = statement.slice(offset, offset + limit)
      responseData.statement = paginatedStatement
      responseData.pagination = {
        page,
        limit,
        total: statement.length,
        hasMore: statement.length > offset + limit
      }
    }

    // Calculate statistics (only fetch counts if not already fetched)
    if (tab === 'invoices' || !responseData.statistics) {
      const { count: totalInvoices } = await supabaseAdmin
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)

      const { data: statsData } = await supabaseAdmin
        .from('sales')
        .select('total_amount, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const { data: allSalesForStats } = await supabaseAdmin
        .from('sales')
        .select('total_amount')
        .eq('customer_id', customer.id)

      const totalInvoicesAmount = allSalesForStats?.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0) || 0

      const { data: allPaymentsForStats } = await supabaseAdmin
        .from('customer_payments')
        .select('amount')
        .eq('customer_id', customer.id)

      const totalPaymentsAmount = allPaymentsForStats?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0

      responseData.statistics = {
        totalInvoices: totalInvoices || 0,
        totalInvoicesAmount,
        totalPayments: totalPaymentsAmount,
        averageOrderValue: (totalInvoices && totalInvoices > 0) ? totalInvoicesAmount / totalInvoices : 0,
        lastInvoiceDate: statsData?.[0]?.created_at?.split('T')[0] || null
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error in invoices API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
