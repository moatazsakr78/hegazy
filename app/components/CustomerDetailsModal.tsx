'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, PencilSquareIcon, TrashIcon, TableCellsIcon, CalendarDaysIcon, PrinterIcon, DocumentIcon, ArrowDownTrayIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import ResizableTable from './tables/ResizableTable'
import { supabase } from '../lib/supabase/client'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import SimpleDateFilterModal, { DateFilter } from './SimpleDateFilterModal'
import AddPaymentModal from './AddPaymentModal'
import { useSystemCurrency, useFormatPrice } from '@/lib/hooks/useCurrency'

interface CustomerDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  customer: any
}

type ViewMode = 'split' | 'invoices-only' | 'details-only'

export default function CustomerDetailsModal({ isOpen, onClose, customer }: CustomerDetailsModalProps) {
  const systemCurrency = useSystemCurrency();
  const formatPrice = useFormatPrice();
  const [selectedTransaction, setSelectedTransaction] = useState(0) // First row selected (index 0)
  const [showCustomerDetails, setShowCustomerDetails] = useState(true)
  const [activeTab, setActiveTab] = useState('invoices') // 'invoices', 'payments', 'statement'
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [dividerPosition, setDividerPosition] = useState(50) // Percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Tablet Detection
  const [isTabletDevice, setIsTabletDevice] = useState(false)

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const width = window.innerWidth

      const isMobile = /mobile|android.*mobile|webos|blackberry|opera mini|iemobile/.test(userAgent)
      const isTablet = (/tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(userAgent) ||
        (width >= 768 && width <= 1280 && !isMobile))

      setIsTabletDevice(isTablet)

      // Auto-hide customer details on tablet for better space
      if (isTablet) {
        setShowCustomerDetails(false)
      }
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  // Real-time state for sales and sale items
  const [sales, setSales] = useState<any[]>([])
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  // Customer balance state - independent of date filter
  const [customerBalance, setCustomerBalance] = useState(0)

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null)

  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'all' })

  // Add Payment Modal state
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false)
  const [paymentType, setPaymentType] = useState<'payment' | 'loan'>('payment')

  // Customer payments state
  const [customerPayments, setCustomerPayments] = useState<any[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [showDeletePaymentModal, setShowDeletePaymentModal] = useState(false)
  const [isDeletingPayment, setIsDeletingPayment] = useState(false)

  // Context menu state for payments
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; payment: any } | null>(null)

  // Account statement state
  const [accountStatements, setAccountStatements] = useState<any[]>([])
  const [isLoadingStatements, setIsLoadingStatements] = useState(false)

  // Statement invoice details state
  const [showStatementInvoiceDetails, setShowStatementInvoiceDetails] = useState(false)
  const [selectedStatementInvoice, setSelectedStatementInvoice] = useState<any>(null)
  const [statementInvoiceItems, setStatementInvoiceItems] = useState<any[]>([])
  const [isLoadingStatementInvoiceItems, setIsLoadingStatementInvoiceItems] = useState(false)

  // Save dropdown state
  const [showSaveDropdown, setShowSaveDropdown] = useState(false)
  const [showSaveDropdownStatement, setShowSaveDropdownStatement] = useState(false)
  const saveDropdownRef = useRef<HTMLDivElement>(null)
  const saveDropdownStatementRef = useRef<HTMLDivElement>(null)

  // Column manager state
  const [showColumnManager, setShowColumnManager] = useState(false)
  const [columnManagerTab, setColumnManagerTab] = useState<'invoices' | 'details' | 'print'>('invoices')

  // Visible columns state - default all visible
  const [visibleInvoiceColumns, setVisibleInvoiceColumns] = useState<string[]>([
    'index', 'invoice_number', 'created_at', 'time', 'invoice_type',
    'customer_name', 'customer_phone', 'total_amount', 'payment_method', 'notes'
  ])
  const [visibleDetailsColumns, setVisibleDetailsColumns] = useState<string[]>([
    'index', 'category', 'productName', 'quantity', 'barcode',
    'unit_price', 'discount', 'total', 'notes'
  ])
  const [visiblePrintColumns, setVisiblePrintColumns] = useState<string[]>([
    'index', 'productName', 'category', 'quantity', 'unit_price', 'discount', 'total'
  ])

  // Column definitions for the manager
  const allInvoiceColumnDefs = [
    { id: 'index', label: '#', required: true },
    { id: 'invoice_number', label: 'رقم الفاتورة', required: true },
    { id: 'created_at', label: 'التاريخ', required: false },
    { id: 'time', label: 'الوقت', required: false },
    { id: 'invoice_type', label: 'نوع الفاتورة', required: false },
    { id: 'customer_name', label: 'العميل', required: false },
    { id: 'customer_phone', label: 'الهاتف', required: false },
    { id: 'total_amount', label: 'المبلغ الإجمالي', required: true },
    { id: 'payment_method', label: 'طريقة الدفع', required: false },
    { id: 'notes', label: 'البيان', required: false }
  ]

  const allDetailsColumnDefs = [
    { id: 'index', label: '#', required: true },
    { id: 'category', label: 'المجموعة', required: false },
    { id: 'productName', label: 'اسم المنتج', required: true },
    { id: 'quantity', label: 'الكمية', required: true },
    { id: 'barcode', label: 'الباركود', required: false },
    { id: 'unit_price', label: 'السعر', required: true },
    { id: 'discount', label: 'خصم', required: false },
    { id: 'total', label: 'الإجمالي', required: true },
    { id: 'notes', label: 'ملاحظات', required: false }
  ]

  const allPrintColumnDefs = [
    { id: 'index', label: '#', required: true },
    { id: 'productName', label: 'اسم المنتج', required: true },
    { id: 'category', label: 'المجموعة', required: false },
    { id: 'quantity', label: 'الكمية', required: true },
    { id: 'barcode', label: 'الباركود', required: false },
    { id: 'unit_price', label: 'السعر', required: true },
    { id: 'discount', label: 'الخصم', required: false },
    { id: 'total', label: 'الإجمالي', required: true }
  ]

  // Toggle column visibility
  const toggleColumn = (columnId: string, type: 'invoices' | 'details' | 'print') => {
    if (type === 'invoices') {
      const colDef = allInvoiceColumnDefs.find(c => c.id === columnId)
      if (colDef?.required) return // Can't toggle required columns

      setVisibleInvoiceColumns(prev =>
        prev.includes(columnId)
          ? prev.filter(id => id !== columnId)
          : [...prev, columnId]
      )
    } else if (type === 'details') {
      const colDef = allDetailsColumnDefs.find(c => c.id === columnId)
      if (colDef?.required) return

      setVisibleDetailsColumns(prev =>
        prev.includes(columnId)
          ? prev.filter(id => id !== columnId)
          : [...prev, columnId]
      )
    } else {
      const colDef = allPrintColumnDefs.find(c => c.id === columnId)
      if (colDef?.required) return

      setVisiblePrintColumns(prev =>
        prev.includes(columnId)
          ? prev.filter(id => id !== columnId)
          : [...prev, columnId]
      )
    }
  }

  // Close save dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(e.target as Node)) {
        setShowSaveDropdown(false)
      }
      if (saveDropdownStatementRef.current && !saveDropdownStatementRef.current.contains(e.target as Node)) {
        setShowSaveDropdownStatement(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (viewMode !== 'split' || activeTab !== 'invoices') return
    setIsDragging(true)
    e.preventDefault()
  }, [viewMode, activeTab])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current || viewMode !== 'split') return
    
    const rect = containerRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const percentage = Math.max(20, Math.min(80, (y / rect.height) * 100))
    setDividerPosition(percentage)
  }, [isDragging, viewMode])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Helper function to get week start (Saturday) and end (Friday)
  const getWeekRange = (date: Date, isLastWeek: boolean = false) => {
    const targetDate = new Date(date)
    if (isLastWeek) {
      targetDate.setDate(targetDate.getDate() - 7)
    }
    
    // Find Saturday (start of week in Arabic calendar)
    const dayOfWeek = targetDate.getDay()
    const daysToSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
    
    const startOfWeek = new Date(targetDate)
    startOfWeek.setDate(targetDate.getDate() - daysToSaturday)
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    
    return { startOfWeek, endOfWeek }
  }

  // Apply date filter to query
  const applyDateFilter = (query: any) => {
    const now = new Date()
    
    switch (dateFilter.type) {
      case 'today':
        const startOfDay = new Date(now)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(now)
        endOfDay.setHours(23, 59, 59, 999)
        return query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString())
      
      case 'current_week':
        const { startOfWeek: currentWeekStart, endOfWeek: currentWeekEnd } = getWeekRange(now)
        const currentWeekEndDate = now < currentWeekEnd ? now : currentWeekEnd
        return query.gte('created_at', currentWeekStart.toISOString()).lte('created_at', currentWeekEndDate.toISOString())
      
      case 'last_week':
        const { startOfWeek: lastWeekStart, endOfWeek: lastWeekEnd } = getWeekRange(now, true)
        return query.gte('created_at', lastWeekStart.toISOString()).lte('created_at', lastWeekEnd.toISOString())
      
      case 'current_month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        return query.gte('created_at', startOfMonth.toISOString()).lte('created_at', endOfMonth.toISOString())
      
      case 'last_month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        return query.gte('created_at', lastMonthStart.toISOString()).lte('created_at', lastMonthEnd.toISOString())
      
      case 'custom':
        if (dateFilter.startDate) {
          const startDate = new Date(dateFilter.startDate)
          startDate.setHours(0, 0, 0, 0)
          query = query.gte('created_at', startDate.toISOString())
        }
        if (dateFilter.endDate) {
          const endDate = new Date(dateFilter.endDate)
          endDate.setHours(23, 59, 59, 999)
          query = query.lte('created_at', endDate.toISOString())
        }
        return query
      
      case 'all':
      default:
        return query
    }
  }

  // Fetch customer balance - independent of date filter
  const fetchCustomerBalance = async () => {
    if (!customer?.id) return

    try {
      // Get all sales for this customer (without date filter)
      const { data: allSales, error: salesError } = await supabase
        .from('sales')
        .select('total_amount, invoice_type')
        .eq('customer_id', customer.id)

      if (salesError) {
        console.error('Error fetching customer sales:', salesError)
        return
      }

      // Get all payments for this customer (without date filter)
      // Include notes to determine if it's a loan or regular payment
      const { data: allPayments, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('amount, notes')
        .eq('customer_id', customer.id)

      if (paymentsError) {
        console.error('Error fetching customer payments:', paymentsError)
        return
      }

      // Calculate sales balance: Just sum all amounts
      // Sale Returns are already stored as negative values in the database
      const salesBalance = (allSales || []).reduce((total, sale) => {
        return total + (sale.total_amount || 0)
      }, 0)

      // Calculate payments with proper handling for loans vs regular payments
      // السلفة (loan/advance) = adds to balance (customer owes more)
      // الدفعة (payment) = reduces balance (customer paid their debt)
      let totalRegularPayments = 0
      let totalLoans = 0

      ;(allPayments || []).forEach(payment => {
        const isLoan = payment.notes?.startsWith('سلفة')
        if (isLoan) {
          // سلفة: يضاف للرصيد (العميل مدين أكثر)
          totalLoans += (payment.amount || 0)
        } else {
          // دفعة: يخصم من الرصيد (العميل دفع جزء من دينه)
          totalRegularPayments += (payment.amount || 0)
        }
      })

      // Final balance = Sales Balance + Loans - Regular Payments
      const finalBalance = salesBalance + totalLoans - totalRegularPayments

      setCustomerBalance(finalBalance)
    } catch (error) {
      console.error('Error calculating customer balance:', error)
    }
  }

  // Fetch sales from Supabase for the specific customer
  const fetchSales = async () => {
    if (!customer?.id) return
    
    try {
      setIsLoadingSales(true)
      
      let query = supabase
        .from('sales')
        .select(`
          id,
          invoice_number,
          customer_id,
          total_amount,
          payment_method,
          notes,
          created_at,
          time,
          invoice_type,
          customer:customers(
            name,
            phone
          )
        `)
        .eq('customer_id', customer.id)
      
      // Apply date filter
      query = applyDateFilter(query)
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) {
        console.error('Error fetching sales:', error)
        return
      }
      
      setSales(data || [])
      
      // Auto-select first sale if available
      if (data && data.length > 0) {
        setSelectedTransaction(0)
        fetchSaleItems(data[0].id)
      }
      
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setIsLoadingSales(false)
    }
  }

  // Fetch customer payments
  const fetchCustomerPayments = async () => {
    if (!customer?.id) return

    try {
      setIsLoadingPayments(true)

      const { data, error } = await supabase
        .from('customer_payments')
        .select(`
          id,
          amount,
          payment_method,
          reference_number,
          notes,
          payment_date,
          created_at
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching customer payments:', error)
        return
      }

      setCustomerPayments(data || [])

    } catch (error) {
      console.error('Error fetching customer payments:', error)
    } finally {
      setIsLoadingPayments(false)
    }
  }

  // Fetch invoice items for statement invoice
  const fetchStatementInvoiceItems = async (saleId: string) => {
    try {
      setIsLoadingStatementInvoiceItems(true)

      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          id,
          quantity,
          unit_price,
          cost_price,
          discount,
          notes,
          product:products(
            id,
            name,
            barcode,
            main_image_url,
            category:categories(name)
          )
        `)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching statement invoice items:', error)
        setStatementInvoiceItems([])
        return
      }

      setStatementInvoiceItems(data || [])

    } catch (error) {
      console.error('Error fetching statement invoice items:', error)
      setStatementInvoiceItems([])
    } finally {
      setIsLoadingStatementInvoiceItems(false)
    }
  }

  // Handle double click on statement row
  const handleStatementRowDoubleClick = async (statement: any) => {
    // Only handle invoices, not payments or opening balance
    if (statement.type !== 'فاتورة' && statement.type !== 'مرتجع') {
      return
    }

    // Get invoice details - extract sale ID from statement id
    const saleIdMatch = statement.id.match(/^sale-(.+)$/)
    if (saleIdMatch) {
      const saleId = saleIdMatch[1]

      const { data: saleData, error } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single()

      if (!error && saleData) {
        setSelectedStatementInvoice(saleData)
        setShowStatementInvoiceDetails(true)
        await fetchStatementInvoiceItems(saleId)
      }
    }
  }

  // Fetch and build account statement
  const fetchAccountStatement = async () => {
    if (!customer?.id) return

    try {
      setIsLoadingStatements(true)

      // Get all sales for this customer
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, invoice_number, total_amount, invoice_type, created_at, time')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: true })

      if (salesError) {
        console.error('Error fetching sales:', salesError)
        return
      }

      // Get all payments for this customer
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('id, amount, notes, created_at, payment_date')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: true })

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError)
        return
      }

      // Get cash drawer transactions to get actual paid amounts for each sale
      const saleIds = salesData?.map(s => s.id) || []
      let paidAmountsMap = new Map<string, number>()

      if (saleIds.length > 0) {
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('cash_drawer_transactions')
          .select('sale_id, amount')
          .in('sale_id', saleIds)
          .eq('transaction_type', 'sale')

        if (!transactionsError && transactionsData) {
          for (const tx of transactionsData) {
            if (tx.sale_id) {
              paidAmountsMap.set(tx.sale_id, tx.amount || 0)
            }
          }
        }
      }

      // Build statement array
      const statements: any[] = []

      // Add sales
      // Note: Sale Returns are already stored as negative values in the database
      salesData?.forEach(sale => {
        if (sale.created_at) {
          const saleDate = new Date(sale.created_at)
          const isReturn = sale.invoice_type === 'Sale Return'
          const typeName = isReturn ? 'مرتجع بيع' : 'فاتورة بيع'

          // Get actual paid amount from cash drawer transactions
          // If no transaction found, paid amount is 0 (credit sale)
          const actualPaidAmount = paidAmountsMap.get(sale.id) || 0

          statements.push({
            id: `sale-${sale.id}`,
            saleId: sale.id,
            date: saleDate,
            description: `${typeName} - ${sale.invoice_number}`,
            type: typeName,
            amount: sale.total_amount, // Already negative for returns
            invoiceValue: Math.abs(sale.total_amount),
            paidAmount: Math.abs(actualPaidAmount), // Use actual paid amount from transactions
            balance: 0, // Will be calculated
            isNegative: isReturn
          })
        }
      })

      // Add payments
      paymentsData?.forEach(payment => {
        if (payment.created_at) {
          const paymentDate = new Date(payment.created_at)
          // التحقق إذا كانت سلفة من خلال الملاحظات
          const isLoan = payment.notes?.startsWith('سلفة')

          if (isLoan) {
            // السلفة تزيد الرصيد المستحق على العميل
            statements.push({
              id: `payment-${payment.id}`,
              date: paymentDate,
              description: payment.notes,
              type: 'سلفة',
              amount: payment.amount, // Positive because it increases balance
              invoiceValue: payment.amount,
              paidAmount: 0,
              balance: 0,
              isNegative: false
            })
          } else {
            // الدفعة العادية تنقص الرصيد المستحق على العميل
            statements.push({
              id: `payment-${payment.id}`,
              date: paymentDate,
              description: payment.notes ? `دفعة - ${payment.notes}` : 'دفعة',
              type: 'دفعة',
              amount: -payment.amount, // Negative because it reduces balance
              invoiceValue: 0,
              paidAmount: payment.amount,
              balance: 0,
              isNegative: false
            })
          }
        }
      })

      // Sort by date
      statements.sort((a, b) => a.date.getTime() - b.date.getTime())

      // Calculate running balance
      let runningBalance = 0
      const statementsWithBalance = statements.map((statement, index) => {
        runningBalance += statement.amount
        return {
          ...statement,
          balance: runningBalance,
          displayDate: statement.date.toLocaleDateString('en-GB'),
          displayTime: statement.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          index: index + 1
        }
      })

      setAccountStatements(statementsWithBalance)

    } catch (error) {
      console.error('Error building account statement:', error)
    } finally {
      setIsLoadingStatements(false)
    }
  }

  // Fetch sale items for selected sale
  const fetchSaleItems = async (saleId: string) => {
    try {
      setIsLoadingItems(true)
      
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          id,
          quantity,
          unit_price,
          cost_price,
          discount,
          notes,
          product:products(
            id,
            name,
            barcode,
            main_image_url,
            category:categories(name)
          )
        `)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching sale items:', error)
        setSaleItems([])
        return
      }
      
      setSaleItems(data || [])
      
    } catch (error) {
      console.error('Error fetching sale items:', error)
      setSaleItems([])
    } finally {
      setIsLoadingItems(false)
    }
  }

  // Print receipt function
  const printReceipt = async (sale: any, items: any[]) => {
    if (!sale || items.length === 0) {
      alert('لا توجد بيانات للطباعة')
      return
    }

    // Calculate customer balance
    let calculatedBalance = 0
    if (customer && customer.id !== '00000000-0000-0000-0000-000000000001') {
      const [salesRes, paymentsRes] = await Promise.all([
        supabase.from('sales').select('total_amount').eq('customer_id', customer.id),
        supabase.from('customer_payments').select('amount').eq('customer_id', customer.id)
      ])
      const salesTotal = (salesRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0)
      const paymentsTotal = (paymentsRes.data || []).reduce((sum, p) => sum + (p.amount || 0), 0)
      calculatedBalance = salesTotal - paymentsTotal
    }

    // Get branch info
    const { data: branchData } = await supabase
      .from('branches')
      .select('name, phone')
      .limit(1)
      .single()

    // Number to Arabic words function
    const numberToArabicWords = (num: number): string => {
      const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
        'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
      const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
      const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

      if (num === 0) return 'صفر'
      if (num < 0) return 'سالب ' + numberToArabicWords(Math.abs(num))

      const intNum = Math.floor(num)
      let result = ''

      const hundredsDigit = Math.floor(intNum / 100)
      const tensDigit = Math.floor((intNum % 100) / 10)
      const onesDigit = intNum % 10

      if (hundredsDigit > 0) {
        result += hundreds[hundredsDigit]
        if (tensDigit > 0 || onesDigit > 0) result += ' و'
      }

      if (intNum % 100 < 20) {
        result += ones[intNum % 100]
      } else {
        if (tensDigit > 0) {
          result += tens[tensDigit]
          if (onesDigit > 0) result += ' و'
        }
        if (onesDigit > 0) result += ones[onesDigit]
      }

      return result.trim().replace(/\s*و$/, '')
    }

    // Check if customer has any balance (for showing total debt)
    const showTotalDebt = customer && customer.id !== '00000000-0000-0000-0000-000000000001' && calculatedBalance !== 0
    const logoUrl = window.location.origin + '/assets/logo/El Farouk Group2.png'

    const receiptContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة رقم ${sale.invoice_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Arial', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
              background: white;
              width: 100%;
              margin: 0;
              padding: 0;
            }

            .receipt-header {
              text-align: center;
              margin-bottom: 3px;
              padding: 0 2px;
            }

            .company-logo {
              width: 60px;
              height: auto;
              margin: 0 auto 4px auto;
              display: block;
              max-height: 60px;
              object-fit: contain;
            }

            .company-logo-fallback {
              display: none;
            }

            .company-name {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 2px;
              color: #000;
            }

            .receipt-date {
              font-size: 11px;
              margin-bottom: 1px;
            }

            .receipt-address {
              font-size: 10px;
              margin-bottom: 1px;
            }

            .receipt-phone {
              font-size: 10px;
            }

            .customer-info {
              margin: 10px 20px;
              padding: 8px;
              border: 1px dashed #333;
              background-color: #f9f9f9;
            }

            .customer-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 11px;
            }

            .customer-label {
              font-weight: 600;
              color: #333;
            }

            .customer-value {
              color: #000;
            }

            .items-table {
              width: calc(100% - 40px);
              border-collapse: collapse;
              margin: 3px 20px;
              border: 1px solid #000;
              table-layout: fixed;
            }

            .items-table th,
            .items-table td {
              border: 1px solid #000;
              padding: 7px;
              text-align: center;
              font-size: 14px;
              font-weight: 400;
            }

            .items-table th {
              background-color: #f5f5f5;
              font-weight: 600;
              font-size: 14px;
            }

            .items-table th:nth-child(1),
            .items-table td:nth-child(1) {
              width: 45%;
            }

            .items-table th:nth-child(2),
            .items-table td:nth-child(2) {
              width: 12%;
            }

            .items-table th:nth-child(3),
            .items-table td:nth-child(3) {
              width: 18%;
            }

            .items-table th:nth-child(4),
            .items-table td:nth-child(4) {
              width: 25%;
              text-align: right !important;
              padding-right: 4px !important;
            }

            .item-name {
              text-align: right !important;
              padding-right: 12px !important;
              padding-left: 2px !important;
              font-size: 15px;
              font-weight: bold;
              word-wrap: break-word;
              white-space: normal;
              overflow-wrap: break-word;
            }

            .total-row {
              border-top: 2px solid #000;
              font-weight: 700;
              font-size: 12px;
            }

            .payment-section {
              margin-top: 8px;
              text-align: center;
              font-size: 11px;
              padding: 0 2px;
            }

            .total-debt {
              margin: 10px 20px;
              padding: 8px;
              border: 1px solid #000;
              background-color: #f5f5f5;
              text-align: center;
              font-weight: 600;
              font-size: 14px;
            }

            .footer {
              text-align: center;
              margin-top: 8px;
              font-size: 9px;
              border-top: 1px solid #000;
              padding: 3px 2px 0 2px;
            }

            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }

              body {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 0 1.5mm !important;
              }

              .no-print {
                display: none;
              }

              .items-table {
                margin: 3px 0;
                width: 100% !important;
              }

              .items-table th,
              .items-table td {
                padding: 2px;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <img
              src="${logoUrl}"
              alt="El Farouk Group"
              class="company-logo"
              onerror="this.style.display='none'; document.querySelector('.company-logo-fallback').style.display='block';"
            />
            <div class="company-logo-fallback" style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">🏢</div>
            <div class="company-name">El Farouk Group</div>
            <div class="receipt-date">${new Date(sale.created_at).toLocaleDateString("ar-EG")} - ${new Date(sale.created_at).toLocaleDateString("en-US")}</div>
            <div class="receipt-address">${branchData?.name || "الفرع الرئيسي"}</div>
            <div class="receipt-phone">${branchData?.phone || "01102862856"}</div>
          </div>

          ${customer && customer.id !== '00000000-0000-0000-0000-000000000001' && (customer.name || customer.phone || customer.address || customer.city) ? `
          <div class="customer-info">
            ${customer.name ? `<div class="customer-row"><span class="customer-label">العميل:</span> <span class="customer-value">${customer.name}</span></div>` : ''}
            ${customer.phone ? `<div class="customer-row"><span class="customer-label">الهاتف:</span> <span class="customer-value">${customer.phone}</span></div>` : ''}
            ${customer.address ? `<div class="customer-row"><span class="customer-label">العنوان:</span> <span class="customer-value">${customer.address}</span></div>` : ''}
            ${customer.city ? `<div class="customer-row"><span class="customer-label">المدينة:</span> <span class="customer-value">${customer.city}</span></div>` : ''}
          </div>
          ` : ''}

          <table class="items-table">
            <thead>
              <tr>
                <th class="item-name">الصنف</th>
                <th>كمية</th>
                <th>سعر</th>
                <th>قيمة</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td class="item-name">${item.product?.name || 'منتج'}</td>
                  <td>${item.quantity}</td>
                  <td>${(item.unit_price || 0).toFixed(0)}</td>
                  <td>${((item.unit_price || 0) * item.quantity).toFixed(0)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td class="item-name">-</td>
                <td>${items.length}</td>
                <td>= اجمالي =</td>
                <td>${Math.abs(sale.total_amount).toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          ${showTotalDebt ? `
          <div class="payment-section">
            ${numberToArabicWords(Math.abs(sale.total_amount))} جنيهاً
          </div>
          <div class="total-debt">
            إجمالي الدين: ${calculatedBalance.toFixed(0)} جنيه
          </div>
          ` : ''}

          <div class="footer">
            ${new Date(sale.created_at).toLocaleDateString("en-GB")} ${sale.time || new Date(sale.created_at).toLocaleTimeString("en-GB", { hour12: false })}
          </div>

          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">طباعة</button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">إغلاق</button>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=450,height=650,scrollbars=yes,resizable=yes')
    if (printWindow) {
      printWindow.document.write(receiptContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 500)
    } else {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة')
    }
  }

  // Print A4 Invoice function - Professional customer statement
  const printA4Invoice = async (sale: any, items: any[]) => {
    if (!sale || items.length === 0) {
      alert('لا توجد بيانات للطباعة')
      return
    }

    // Calculate totals
    const total = Math.abs(sale.total_amount)

    // Logo URL for the company logo
    const logoUrl = window.location.origin + '/assets/logo/El Farouk Group2.png'

    const a4InvoiceContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة رقم ${sale.invoice_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');

            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
              font-family: 'Cairo', 'Arial', sans-serif;
              font-size: 14px;
              line-height: 1.5;
              color: #333;
              background: white;
              padding: 15px;
            }

            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              border: 2px solid #5d1f1f;
              border-radius: 10px;
              overflow: hidden;
            }

            .invoice-header {
              background: #5d1f1f;
              color: white;
              padding: 15px 25px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .header-right {
              display: flex;
              align-items: center;
              gap: 15px;
            }

            .company-logo {
              width: 70px;
              height: 70px;
              border-radius: 50%;
              object-fit: contain;
            }

            .company-name {
              font-size: 24px;
              font-weight: 700;
            }

            .invoice-title {
              text-align: center;
              padding: 12px;
              background: #f8fafc;
              border-bottom: 2px solid #e2e8f0;
            }

            .invoice-title h2 {
              font-size: 20px;
              color: #5d1f1f;
              margin-bottom: 3px;
            }

            .invoice-number {
              font-size: 14px;
              color: #64748b;
            }

            .invoice-body { padding: 20px; }

            .info-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              gap: 15px;
            }

            .info-box {
              flex: 1;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
            }

            .info-box h4 {
              color: #5d1f1f;
              font-size: 13px;
              margin-bottom: 8px;
              border-bottom: 2px solid #5d1f1f;
              padding-bottom: 4px;
            }

            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 3px 0;
              font-size: 12px;
            }

            .info-label { color: #64748b; }
            .info-value { font-weight: 600; color: #1e293b; }

            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }

            .items-table th {
              background: #5d1f1f;
              color: white;
              padding: 10px 8px;
              text-align: center;
              font-size: 12px;
              font-weight: 600;
            }

            .items-table th:first-child { border-radius: 0 6px 0 0; }
            .items-table th:last-child { border-radius: 6px 0 0 0; }

            .items-table td {
              padding: 8px;
              text-align: center;
              border-bottom: 1px solid #e2e8f0;
              font-size: 12px;
            }

            .items-table tr:nth-child(even) { background: #f8fafc; }
            .product-name { text-align: right !important; font-weight: 500; }

            .summary-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #5d1f1f;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              margin-top: 15px;
            }

            .summary-item {
              text-align: center;
              flex: 1;
              border-left: 1px solid rgba(255,255,255,0.3);
            }

            .summary-item:last-child { border-left: none; }

            .summary-label {
              font-size: 11px;
              opacity: 0.9;
              margin-bottom: 2px;
            }

            .summary-value {
              font-size: 18px;
              font-weight: 700;
            }

            .summary-value.negative { color: #fca5a5; }
            .summary-value.positive { color: #86efac; }

            .invoice-footer {
              background: #f8fafc;
              padding: 12px;
              text-align: center;
              border-top: 2px solid #e2e8f0;
            }

            .thank-you {
              font-size: 14px;
              font-weight: 600;
              color: #5d1f1f;
            }

            .no-print {
              margin-top: 20px;
              text-align: center;
            }

            .no-print button {
              padding: 10px 25px;
              font-size: 14px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              margin: 0 5px;
              font-family: 'Cairo', sans-serif;
            }

            .btn-print { background: #5d1f1f; color: white; }
            .btn-print:hover { background: #4a1818; }
            .btn-close { background: #64748b; color: white; }
            .btn-close:hover { background: #475569; }

            @media print {
              @page { size: A4; margin: 10mm; }
              body { padding: 0; }
              .no-print { display: none; }
              .invoice-container { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div class="header-right">
                <img src="${logoUrl}" alt="El Farouk Group" class="company-logo" onerror="this.style.display='none'" />
                <div class="company-name">El Farouk Group</div>
              </div>
            </div>

            <div class="invoice-title">
              <h2>${sale.invoice_type === 'Sale Return' ? 'فاتورة مرتجع' : 'فاتورة بيع'}</h2>
              <div class="invoice-number">رقم الفاتورة: ${sale.invoice_number}</div>
            </div>

            <div class="invoice-body">
              <div class="info-section">
                <div class="info-box">
                  <h4>معلومات العميل</h4>
                  <div class="info-row">
                    <span class="info-label">اسم العميل:</span>
                    <span class="info-value">${customer?.name || 'عميل نقدي'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">رقم الهاتف:</span>
                    <span class="info-value">${customer?.phone || '-'}</span>
                  </div>
                  ${customer?.address ? `
                  <div class="info-row">
                    <span class="info-label">العنوان:</span>
                    <span class="info-value">${customer.address}</span>
                  </div>
                  ` : ''}
                </div>
                <div class="info-box">
                  <h4>معلومات الفاتورة</h4>
                  <div class="info-row">
                    <span class="info-label">التاريخ:</span>
                    <span class="info-value">${new Date(sale.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">الوقت:</span>
                    <span class="info-value">${sale.time || new Date(sale.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">طريقة الدفع:</span>
                    <span class="info-value">${sale.payment_method || 'نقدي'}</span>
                  </div>
                </div>
              </div>

              <table class="items-table">
                <thead>
                  <tr>
                    ${visiblePrintColumns.includes('index') ? '<th>#</th>' : ''}
                    ${visiblePrintColumns.includes('productName') ? '<th>اسم المنتج</th>' : ''}
                    ${visiblePrintColumns.includes('category') ? '<th>المجموعة</th>' : ''}
                    ${visiblePrintColumns.includes('quantity') ? '<th>الكمية</th>' : ''}
                    ${visiblePrintColumns.includes('barcode') ? '<th>الباركود</th>' : ''}
                    ${visiblePrintColumns.includes('unit_price') ? '<th>السعر</th>' : ''}
                    ${visiblePrintColumns.includes('discount') ? '<th>الخصم</th>' : ''}
                    ${visiblePrintColumns.includes('total') ? '<th>الإجمالي</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${items.map((item, index) => `
                    <tr>
                      ${visiblePrintColumns.includes('index') ? `<td>${index + 1}</td>` : ''}
                      ${visiblePrintColumns.includes('productName') ? `<td class="product-name">${item.product?.name || 'منتج'}</td>` : ''}
                      ${visiblePrintColumns.includes('category') ? `<td>${item.product?.category?.name || '-'}</td>` : ''}
                      ${visiblePrintColumns.includes('quantity') ? `<td>${item.quantity}</td>` : ''}
                      ${visiblePrintColumns.includes('barcode') ? `<td>${item.product?.barcode || '-'}</td>` : ''}
                      ${visiblePrintColumns.includes('unit_price') ? `<td>${formatPrice(item.unit_price, 'system')}</td>` : ''}
                      ${visiblePrintColumns.includes('discount') ? `<td>${item.discount ? formatPrice(item.discount, 'system') : '-'}</td>` : ''}
                      ${visiblePrintColumns.includes('total') ? `<td>${formatPrice((item.quantity * item.unit_price) - (item.discount || 0), 'system')}</td>` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="summary-bar">
                <div class="summary-item">
                  <div class="summary-label">إجمالي الفاتورة</div>
                  <div class="summary-value">${formatPrice(total, 'system')}</div>
                </div>
                ${customer && customer.id !== '00000000-0000-0000-0000-000000000001' ? `
                <div class="summary-item">
                  <div class="summary-label">رصيد العميل</div>
                  <div class="summary-value ${customerBalance > 0 ? 'negative' : 'positive'}">${formatPrice(customerBalance, 'system')}</div>
                </div>
                ` : ''}
              </div>
            </div>

            <div class="invoice-footer">
              <div class="thank-you">شكراً لتعاملكم معنا</div>
            </div>
          </div>

          <div class="no-print">
            <button class="btn-print" onclick="window.print()">طباعة</button>
            <button class="btn-close" onclick="window.close()">إغلاق</button>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes')
    if (printWindow) {
      printWindow.document.write(a4InvoiceContent)
      printWindow.document.close()
      printWindow.focus()
    } else {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة')
    }
  }

  // Save document as PDF or PNG
  const saveDocument = async (sale: any, items: any[], format: 'pdf' | 'png') => {
    if (!sale || items.length === 0) {
      alert('لا توجد بيانات للحفظ')
      return
    }

    // For now, we'll generate an HTML document and use browser print to PDF
    // For PNG, we'd need html2canvas library

    if (format === 'pdf') {
      // Generate the A4 invoice and use browser's print to PDF
      const { data: branchData } = await supabase
        .from('branches')
        .select('name, phone, address')
        .limit(1)
        .single()

      const logoUrl = window.location.origin + '/assets/logo/El Farouk Group2.png'
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
      const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0)
      const total = Math.abs(sale.total_amount)

      const pdfContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <title>فاتورة رقم ${sale.invoice_number} - PDF</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Cairo', sans-serif; padding: 20px; background: white; }
              .invoice-container { max-width: 800px; margin: 0 auto; border: 2px solid #1e40af; border-radius: 10px; }
              .invoice-header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 25px; display: flex; justify-content: space-between; align-items: center; }
              .company-name { font-size: 28px; font-weight: 700; }
              .company-details { font-size: 12px; opacity: 0.9; }
              .invoice-title { text-align: center; padding: 15px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
              .invoice-title h2 { font-size: 22px; color: #1e40af; }
              .invoice-number { font-size: 16px; color: #64748b; }
              .invoice-body { padding: 25px; }
              .info-section { display: flex; gap: 20px; margin-bottom: 25px; }
              .info-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
              .info-box h4 { color: #1e40af; margin-bottom: 10px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
              .info-row { display: flex; justify-content: space-between; padding: 5px 0; }
              .info-label { color: #64748b; }
              .info-value { font-weight: 600; }
              .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
              .items-table th { background: #1e40af; color: white; padding: 12px; text-align: center; }
              .items-table td { padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; }
              .items-table tr:nth-child(even) { background: #f8fafc; }
              .product-name { text-align: right !important; }
              .totals-box { width: 300px; background: #f8fafc; border: 2px solid #1e40af; border-radius: 8px; }
              .total-row { display: flex; justify-content: space-between; padding: 10px 15px; border-bottom: 1px solid #e2e8f0; }
              .total-row:last-child { background: #1e40af; color: white; font-weight: 700; border-bottom: none; }
              .customer-balance { margin-top: 20px; padding: 15px; background: ${customerBalance > 0 ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${customerBalance > 0 ? '#ef4444' : '#22c55e'}; border-radius: 8px; text-align: center; }
              .balance-amount { font-size: 24px; font-weight: 700; color: ${customerBalance > 0 ? '#dc2626' : '#16a34a'}; }
              .invoice-footer { background: #f8fafc; padding: 20px; text-align: center; border-top: 2px solid #e2e8f0; }
              .thank-you { font-size: 16px; font-weight: 600; color: #1e40af; }
              .no-print { margin-top: 30px; text-align: center; }
              .no-print button { padding: 12px 30px; font-size: 16px; border: none; border-radius: 8px; cursor: pointer; margin: 5px; }
              .btn-save { background: #1e40af; color: white; }
              @media print { @page { size: A4; margin: 10mm; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <div class="invoice-header">
                <div>
                  <div class="company-name">El Farouk Group</div>
                  <div class="company-details">${branchData?.name || 'الفرع الرئيسي'}<br>${branchData?.phone || '01102862856'}</div>
                </div>
              </div>
              <div class="invoice-title">
                <h2>${sale.invoice_type === 'Sale Return' ? 'فاتورة مرتجع' : 'فاتورة بيع'}</h2>
                <div class="invoice-number">رقم الفاتورة: ${sale.invoice_number}</div>
              </div>
              <div class="invoice-body">
                <div class="info-section">
                  <div class="info-box">
                    <h4>معلومات العميل</h4>
                    <div class="info-row"><span class="info-label">اسم العميل:</span><span class="info-value">${customer?.name || 'عميل نقدي'}</span></div>
                    <div class="info-row"><span class="info-label">رقم الهاتف:</span><span class="info-value">${customer?.phone || '-'}</span></div>
                    <div class="info-row"><span class="info-label">العنوان:</span><span class="info-value">${customer?.address || '-'}</span></div>
                  </div>
                  <div class="info-box">
                    <h4>معلومات الفاتورة</h4>
                    <div class="info-row"><span class="info-label">تاريخ الفاتورة:</span><span class="info-value">${new Date(sale.created_at).toLocaleDateString('ar-EG')}</span></div>
                    <div class="info-row"><span class="info-label">الوقت:</span><span class="info-value">${sale.time || '-'}</span></div>
                    <div class="info-row"><span class="info-label">طريقة الدفع:</span><span class="info-value">${sale.payment_method || 'نقدي'}</span></div>
                  </div>
                </div>
                <table class="items-table">
                  <thead>
                    <tr>
                      ${visiblePrintColumns.includes('index') ? '<th>#</th>' : ''}
                      ${visiblePrintColumns.includes('productName') ? '<th>اسم المنتج</th>' : ''}
                      ${visiblePrintColumns.includes('category') ? '<th>المجموعة</th>' : ''}
                      ${visiblePrintColumns.includes('quantity') ? '<th>الكمية</th>' : ''}
                      ${visiblePrintColumns.includes('barcode') ? '<th>الباركود</th>' : ''}
                      ${visiblePrintColumns.includes('unit_price') ? '<th>السعر</th>' : ''}
                      ${visiblePrintColumns.includes('discount') ? '<th>الخصم</th>' : ''}
                      ${visiblePrintColumns.includes('total') ? '<th>الإجمالي</th>' : ''}
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((item, index) => `
                      <tr>
                        ${visiblePrintColumns.includes('index') ? `<td>${index + 1}</td>` : ''}
                        ${visiblePrintColumns.includes('productName') ? `<td class="product-name">${item.product?.name || 'منتج'}</td>` : ''}
                        ${visiblePrintColumns.includes('category') ? `<td>${item.product?.category?.name || '-'}</td>` : ''}
                        ${visiblePrintColumns.includes('quantity') ? `<td>${item.quantity}</td>` : ''}
                        ${visiblePrintColumns.includes('barcode') ? `<td>${item.product?.barcode || '-'}</td>` : ''}
                        ${visiblePrintColumns.includes('unit_price') ? `<td>${formatPrice(item.unit_price, 'system')}</td>` : ''}
                        ${visiblePrintColumns.includes('discount') ? `<td>${item.discount ? formatPrice(item.discount, 'system') : '-'}</td>` : ''}
                        ${visiblePrintColumns.includes('total') ? `<td>${formatPrice((item.quantity * item.unit_price) - (item.discount || 0), 'system')}</td>` : ''}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                <div class="totals-box">
                  <div class="total-row"><span>المجموع الفرعي:</span><span>${formatPrice(subtotal, 'system')}</span></div>
                  ${totalDiscount > 0 ? `<div class="total-row"><span>إجمالي الخصم:</span><span>-${formatPrice(totalDiscount, 'system')}</span></div>` : ''}
                  <div class="total-row"><span>الإجمالي النهائي:</span><span>${formatPrice(total, 'system')}</span></div>
                </div>
                ${customer && customer.id !== '00000000-0000-0000-0000-000000000001' ? `
                <div class="customer-balance">
                  <div style="color: #64748b; margin-bottom: 5px;">رصيد العميل الحالي</div>
                  <div class="balance-amount">${formatPrice(customerBalance, 'system')}</div>
                </div>
                ` : ''}
              </div>
              <div class="invoice-footer">
                <div class="thank-you">شكراً لتعاملكم معنا</div>
              </div>
            </div>
            <div class="no-print">
              <p style="color: #64748b; margin-bottom: 15px;">اضغط Ctrl+P أو استخدم زر الطباعة واختر "حفظ كـ PDF" من الوجهة</p>
              <button class="btn-save" onclick="window.print()">حفظ كـ PDF</button>
              <button style="background: #64748b; color: white;" onclick="window.close()">إغلاق</button>
            </div>
          </body>
        </html>
      `

      const pdfWindow = window.open('', '_blank', 'width=900,height=700')
      if (pdfWindow) {
        pdfWindow.document.write(pdfContent)
        pdfWindow.document.close()
      }
    } else if (format === 'png') {
      // For PNG, we'll create a canvas and convert to image
      alert('لحفظ كصورة PNG: استخدم "طباعة A4" ثم اضغط Ctrl+Shift+S في المتصفح لحفظ الصفحة كصورة')
    }

    setShowSaveDropdown(false)
    setShowSaveDropdownStatement(false)
  }

  // Set up real-time subscriptions and fetch initial data
  useEffect(() => {
    if (isOpen && customer?.id) {
      fetchSales()
      fetchCustomerPayments()
      fetchAccountStatement()

      // Set up real-time subscription for sales
      const salesChannel = supabase
        .channel('modal_sales_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'sales' },
          (payload: any) => {
            console.log('Sales real-time update:', payload)
            fetchSales()
            fetchCustomerBalance() // Also update balance on sales changes
            fetchAccountStatement() // Update account statement
          }
        )
        .subscribe()

      // Set up real-time subscription for sale_items
      const saleItemsChannel = supabase
        .channel('modal_sale_items_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'sale_items' },
          (payload: any) => {
            console.log('Sale items real-time update:', payload)
            if (sales.length > 0 && selectedTransaction < sales.length) {
              fetchSaleItems(sales[selectedTransaction].id)
            }
          }
        )
        .subscribe()

      // Set up real-time subscription for customer_payments
      const paymentsChannel = supabase
        .channel('modal_customer_payments_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'customer_payments' },
          (payload: any) => {
            console.log('Customer payments real-time update:', payload)
            fetchCustomerPayments()
            fetchCustomerBalance() // Also update balance on payment changes
            fetchAccountStatement() // Update account statement
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(salesChannel)
        supabase.removeChannel(saleItemsChannel)
        supabase.removeChannel(paymentsChannel)
      }
    }
  }, [isOpen, customer?.id, dateFilter])

  // Fetch customer balance independently of date filter
  useEffect(() => {
    if (isOpen && customer?.id) {
      fetchCustomerBalance()
    }
  }, [isOpen, customer?.id])

  // Fetch sale items when selected transaction changes
  useEffect(() => {
    if (sales.length > 0 && selectedTransaction < sales.length) {
      fetchSaleItems(sales[selectedTransaction].id)
    }
  }, [selectedTransaction, sales])

  // Reset statement invoice details when changing tabs
  useEffect(() => {
    if (activeTab !== 'statement') {
      setShowStatementInvoiceDetails(false)
      setSelectedStatementInvoice(null)
      setStatementInvoiceItems([])
    }
  }, [activeTab])

  // Handle delete invoice
  const handleDeleteInvoice = (invoice: any) => {
    setInvoiceToDelete(invoice)
    setShowDeleteModal(true)
  }

  // Confirm delete invoice
  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return

    try {
      setIsDeleting(true)

      // 1. أولاً: نجيب معاملات الخزنة المرتبطة بهذه الفاتورة لتحديث رصيد الخزنة
      const { data: drawerTransactions, error: transError } = await supabase
        .from('cash_drawer_transactions')
        .select('id, drawer_id, amount, record_id')
        .eq('sale_id', invoiceToDelete.id)

      if (!transError && drawerTransactions && drawerTransactions.length > 0) {
        // لكل معاملة، نخصم المبلغ من الخزنة
        for (const transaction of drawerTransactions) {
          // جلب رصيد الخزنة الحالي
          const { data: drawer } = await supabase
            .from('cash_drawers')
            .select('id, current_balance')
            .eq('id', transaction.drawer_id)
            .single()

          if (drawer) {
            // خصم المبلغ من رصيد الخزنة (المبلغ موجب للبيع، سالب للمرتجع)
            const newBalance = (drawer.current_balance || 0) - transaction.amount

            // تحديث رصيد الخزنة
            await supabase
              .from('cash_drawers')
              .update({
                current_balance: newBalance,
                updated_at: new Date().toISOString()
              })
              .eq('id', drawer.id)

            // إضافة سجل حذف الفاتورة
            await supabase
              .from('cash_drawer_transactions')
              .insert({
                drawer_id: drawer.id,
                record_id: transaction.record_id,
                transaction_type: 'invoice_delete',
                amount: -transaction.amount, // عكس المبلغ الأصلي
                balance_after: newBalance,
                sale_id: invoiceToDelete.id,
                notes: `حذف فاتورة رقم ${invoiceToDelete.invoice_number}`,
                performed_by: 'system'
              })

            console.log(`✅ Cash drawer updated after delete: ${-transaction.amount}, new balance: ${newBalance}`)
          }
        }

        // حذف معاملات الخزنة الأصلية المرتبطة بالفاتورة
        await supabase
          .from('cash_drawer_transactions')
          .delete()
          .eq('sale_id', invoiceToDelete.id)
          .neq('transaction_type', 'invoice_delete') // لا نحذف سجل الحذف الجديد
      }

      // 2. حذف المدفوعات المرتبطة بالفاتورة من جدول customer_payments
      const { error: paymentsError } = await supabase
        .from('customer_payments')
        .delete()
        .ilike('notes', `%${invoiceToDelete.invoice_number}%`)

      if (paymentsError) {
        console.warn('Error deleting customer payments:', paymentsError)
      }

      // 3. حذف عناصر الفاتورة
      const { error: saleItemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', invoiceToDelete.id)

      if (saleItemsError) {
        console.error('Error deleting sale items:', saleItemsError)
        throw saleItemsError
      }

      // 4. حذف الفاتورة نفسها
      const { error: saleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', invoiceToDelete.id)

      if (saleError) {
        console.error('Error deleting sale:', saleError)
        throw saleError
      }

      // Close modal and reset state
      setShowDeleteModal(false)
      setInvoiceToDelete(null)

      // Refresh data (real-time will handle it but this ensures immediate update)
      fetchSales()

      // Reset selected transaction if needed
      if (selectedTransaction >= sales.length - 1) {
        setSelectedTransaction(Math.max(0, sales.length - 2))
      }

    } catch (error) {
      console.error('Error deleting invoice:', error)
      // You could add a toast notification here for error feedback
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle delete payment
  const handleDeletePayment = (payment: any) => {
    setSelectedPayment(payment)
    setShowDeletePaymentModal(true)
  }

  // Cancel delete payment
  const cancelDeletePayment = () => {
    setShowDeletePaymentModal(false)
    setSelectedPayment(null)
  }

  // Confirm delete payment
  const confirmDeletePayment = async () => {
    if (!selectedPayment) return

    try {
      setIsDeletingPayment(true)

      // حذف الدفعة من قاعدة البيانات
      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('id', selectedPayment.id)

      if (error) {
        console.error('Error deleting payment:', error)
        alert('حدث خطأ أثناء حذف الدفعة')
        return
      }

      // إغلاق المودال وتحديث البيانات
      setShowDeletePaymentModal(false)
      setSelectedPayment(null)

      // تحديث البيانات
      fetchCustomerPayments()
      fetchCustomerBalance()
      fetchAccountStatement()

    } catch (error) {
      console.error('Error deleting payment:', error)
      alert('حدث خطأ أثناء حذف الدفعة')
    } finally {
      setIsDeletingPayment(false)
    }
  }

  // Handle right-click context menu for payments
  const handlePaymentContextMenu = (e: React.MouseEvent, payment: any) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      payment
    })
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  // Calculate total invoices amount (for all sales, not filtered by date)
  const [totalInvoicesAmount, setTotalInvoicesAmount] = useState(0)

  // Fetch total invoices amount
  useEffect(() => {
    const fetchTotalInvoicesAmount = async () => {
      if (!customer?.id) return

      const { data, error } = await supabase
        .from('sales')
        .select('total_amount, invoice_type')
        .eq('customer_id', customer.id)

      if (!error && data) {
        // Just sum all amounts - Sale Returns are already stored as negative values
        const total = data.reduce((sum, sale) => {
          return sum + (sale.total_amount || 0)
        }, 0)
        setTotalInvoicesAmount(total)
      }
    }

    if (isOpen && customer?.id) {
      fetchTotalInvoicesAmount()
    }
  }, [isOpen, customer?.id])

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false)
    setInvoiceToDelete(null)
  }

  if (!customer) return null

  // العميل الافتراضي
  const isDefaultCustomer = customer.id === '00000000-0000-0000-0000-000000000001'

  // Calculate total payments amount
  const totalPayments = customerPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0)

  // حساب مجموع الفواتير المعروضة (للعميل الافتراضي - يتغير حسب الفلتر)
  // المبيعات موجبة والمرتجعات سالبة في قاعدة البيانات
  const displayedInvoicesSum = sales.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0)

  // Calculate average order value
  const averageOrderValue = sales.length > 0
    ? totalInvoicesAmount / sales.length
    : 0

  // Define columns for account statement table
  const statementColumns = [
    {
      id: 'index',
      header: '#',
      accessor: 'index',
      width: 50,
      render: (value: number) => (
        <span className="text-gray-400">{value}</span>
      )
    },
    {
      id: 'date',
      header: 'التاريخ',
      accessor: 'displayDate',
      width: 120,
      render: (value: string) => <span className="text-white">{value}</span>
    },
    {
      id: 'time',
      header: '⏰ الساعة',
      accessor: 'displayTime',
      width: 80,
      render: (value: string) => <span className="text-blue-400">{value}</span>
    },
    {
      id: 'description',
      header: 'البيان',
      accessor: 'description',
      width: 250,
      render: (value: string) => <span className="text-white">{value}</span>
    },
    {
      id: 'type',
      header: 'نوع العملية',
      accessor: 'type',
      width: 120,
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === 'فاتورة بيع'
            ? 'bg-green-600/20 text-green-400 border border-green-600'
            : value === 'دفعة'
            ? 'bg-blue-600/20 text-blue-400 border border-blue-600'
            : value === 'مرتجع بيع'
            ? 'bg-orange-600/20 text-orange-400 border border-orange-600'
            : value === 'سلفة'
            ? 'bg-purple-600/20 text-purple-400 border border-purple-600'
            : 'bg-gray-600/20 text-gray-400 border border-gray-600'
        }`}>
          {value}
        </span>
      )
    },
    {
      id: 'invoiceValue',
      header: 'قيمة الفاتورة',
      accessor: 'invoiceValue',
      width: 130,
      render: (value: number, item: any) => (
        <span className="text-gray-300 font-medium">
          {value > 0 ? formatPrice(value, 'system') : '-'}
        </span>
      )
    },
    {
      id: 'paidAmount',
      header: 'المبلغ المدفوع',
      accessor: 'paidAmount',
      width: 130,
      render: (value: number, item: any) => (
        <span className={`font-medium ${
          item.type === 'مرتجع بيع'
            ? 'text-red-400'
            : item.type === 'دفعة'
            ? 'text-green-400'
            : item.type === 'سلفة'
            ? 'text-purple-400'
            : 'text-blue-400'
        }`}>
          {item.type === 'مرتجع بيع' ? '-' : item.type === 'دفعة' ? '-' : item.type === 'سلفة' ? '+' : '+'}{formatPrice(value, 'system')}
        </span>
      )
    },
    {
      id: 'balance',
      header: 'الرصيد',
      accessor: 'balance',
      width: 140,
      render: (value: number) => <span className="text-white font-medium">{formatPrice(value, 'system')}</span>
    }
  ]

  const invoiceColumns = [
    { 
      id: 'index', 
      header: '#', 
      accessor: '#', 
      width: 50,
      render: (value: any, item: any, index: number) => (
        <span className="text-gray-400">{index + 1}</span>
      )
    },
    { 
      id: 'invoice_number', 
      header: 'رقم الفاتورة', 
      accessor: 'invoice_number', 
      width: 180,
      render: (value: string) => <span className="text-blue-400">{value}</span>
    },
    { 
      id: 'created_at', 
      header: 'التاريخ', 
      accessor: 'created_at', 
      width: 120,
      render: (value: string) => {
        const date = new Date(value)
        return <span className="text-white">{date.toLocaleDateString('en-GB')}</span>
      }
    },
    { 
      id: 'time', 
      header: 'الوقت', 
      accessor: 'time', 
      width: 100,
      render: (value: string) => {
        if (!value) return <span className="text-gray-400">-</span>
        const timeOnly = value.substring(0, 5)
        return <span className="text-blue-400 font-mono">{timeOnly}</span>
      }
    },
    { 
      id: 'invoice_type', 
      header: 'نوع الفاتورة', 
      accessor: 'invoice_type', 
      width: 120,
      render: (value: string) => {
        const getInvoiceTypeText = (invoiceType: string) => {
          switch (invoiceType) {
            case 'Sale Invoice': return 'فاتورة بيع'
            case 'Sale Return': return 'مرتجع بيع'
            default: return invoiceType || 'غير محدد'
          }
        }
        
        const getInvoiceTypeColor = (invoiceType: string) => {
          switch (invoiceType) {
            case 'Sale Invoice': return 'bg-green-900 text-green-300'
            case 'Sale Return': return 'bg-red-900 text-red-300'
            default: return 'bg-gray-900 text-gray-300'
          }
        }
        
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getInvoiceTypeColor(value)}`}>
            {getInvoiceTypeText(value)}
          </span>
        )
      }
    },
    { 
      id: 'customer_name', 
      header: 'العميل', 
      accessor: 'customer.name', 
      width: 150,
      render: (value: string, item: any) => <span className="text-white">{item.customer?.name || 'غير محدد'}</span>
    },
    { 
      id: 'customer_phone', 
      header: 'الهاتف', 
      accessor: 'customer.phone', 
      width: 150,
      render: (value: string, item: any) => <span className="text-gray-300 font-mono text-sm">{item.customer?.phone || '-'}</span>
    },
    { 
      id: 'total_amount', 
      header: 'المبلغ الإجمالي', 
      accessor: 'total_amount', 
      width: 150,
      render: (value: number) => <span className="text-green-400 font-medium">{formatPrice(value, 'system')}</span>
    },
    { 
      id: 'payment_method', 
      header: 'طريقة الدفع', 
      accessor: 'payment_method', 
      width: 120,
      render: (value: string) => <span className="text-blue-400">{value}</span>
    },
    {
      id: 'notes',
      header: 'البيان',
      accessor: 'notes',
      width: 200,
      render: (value: string) => <span className="text-gray-400">{value || '-'}</span>
    }
  ].filter(col => visibleInvoiceColumns.includes(col.id))

  const paymentsColumns = [
    {
      id: 'index',
      header: '#',
      accessor: '#',
      width: 50,
      render: (value: any, item: any, index: number) => (
        <span className="text-gray-400">{index + 1}</span>
      )
    },
    {
      id: 'payment_date',
      header: 'التاريخ',
      accessor: 'payment_date',
      width: 120,
      render: (value: string) => {
        const date = new Date(value)
        return <span className="text-white">{date.toLocaleDateString('en-GB')}</span>
      }
    },
    {
      id: 'created_at',
      header: '⏰ الساعة',
      accessor: 'created_at',
      width: 80,
      render: (value: string) => {
        const date = new Date(value)
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        return <span className="text-blue-400">{time}</span>
      }
    },
    {
      id: 'amount',
      header: 'المبلغ',
      accessor: 'amount',
      width: 140,
      render: (value: number) => <span className="text-green-400 font-medium">{formatPrice(value, 'system')}</span>
    },
    {
      id: 'payment_method',
      header: 'طريقة الدفع',
      accessor: 'payment_method',
      width: 120,
      render: (value: string) => {
        const methodNames: {[key: string]: string} = {
          'cash': 'نقدي',
          'card': 'بطاقة',
          'bank_transfer': 'تحويل بنكي',
          'check': 'شيك'
        }
        return <span className="text-blue-400">{methodNames[value] || value}</span>
      }
    },
    {
      id: 'notes',
      header: 'البيان',
      accessor: 'notes',
      width: 200,
      render: (value: string) => <span className="text-gray-400">{value || '-'}</span>
    }
  ]

  const invoiceDetailsColumns = [
    { 
      id: 'index', 
      header: '#', 
      accessor: '#', 
      width: 50,
      render: (value: any, item: any, index: number) => (
        <span className="text-white">{index + 1}</span>
      )
    },
    { 
      id: 'category', 
      header: 'المجموعة', 
      accessor: 'product.category.name', 
      width: 120,
      render: (value: string, item: any) => (
        <span className="text-blue-400">{item.product?.category?.name || 'غير محدد'}</span>
      )
    },
    { 
      id: 'productName', 
      header: 'اسم المنتج', 
      accessor: 'product.name', 
      width: 200,
      render: (value: string, item: any) => (
        <span className="text-white font-medium">{item.product?.name || 'منتج محذوف'}</span>
      )
    },
    { 
      id: 'quantity', 
      header: 'الكمية', 
      accessor: 'quantity', 
      width: 80,
      render: (value: number) => <span className="text-white font-medium">{value}</span>
    },
    { 
      id: 'barcode', 
      header: 'الباركود', 
      accessor: 'product.barcode', 
      width: 150,
      render: (value: string, item: any) => (
        <span className="text-orange-400 font-mono text-sm">{item.product?.barcode || 'غير محدد'}</span>
      )
    },
    { 
      id: 'unit_price', 
      header: 'السعر', 
      accessor: 'unit_price', 
      width: 100,
      render: (value: number) => <span className="text-green-400 font-medium">{formatPrice(value, 'system')}</span>
    },
    { 
      id: 'discount', 
      header: 'خصم', 
      accessor: 'discount', 
      width: 80,
      render: (value: number) => <span className="text-red-400 font-medium">{value ? value.toFixed(2) : '0.00'}</span>
    },
    { 
      id: 'total', 
      header: 'الإجمالي', 
      accessor: 'total', 
      width: 120,
      render: (value: any, item: any) => {
        const total = (item.quantity * item.unit_price) - (item.discount || 0)
        return <span className="text-green-400 font-bold">{formatPrice(total, 'system')}</span>
      }
    },
    {
      id: 'notes',
      header: 'ملاحظات',
      accessor: 'notes',
      width: 150,
      render: (value: string) => <span className="text-gray-400">{value || '-'}</span>
    }
  ].filter(col => visibleDetailsColumns.includes(col.id))

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Modal */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="bg-[#2B3544] h-full w-full flex flex-col">
          
          {/* Top Navigation - Responsive Layout */}
          <div className="bg-[#374151] border-b border-gray-600">
            {/* Tablet Layout */}
            {isTabletDevice ? (
              <div className="px-4 py-3">
                {/* Single Scrollable Row with Close Button and All Tabs/Actions */}
                <div className="flex items-center gap-3">
                  {/* Close Button - Fixed */}
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 text-gray-400 hover:text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-600/30 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>

                  {/* Scrollable Buttons Container */}
                  <div className="flex-1 overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-2 min-w-max">
                      {/* Main Tabs */}
                      <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                          activeTab === 'invoices'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                        }`}
                      >
                        فواتير ({sales.length})
                      </button>

                      {/* إخفاء الدفعات وكشف الحساب للعميل الافتراضي */}
                      {!isDefaultCustomer && (
                        <>
                          <button
                            onClick={() => setActiveTab('payments')}
                            className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                              activeTab === 'payments'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                            }`}
                          >
                            الدفعات
                          </button>

                          <button
                            onClick={() => setActiveTab('statement')}
                            className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                              activeTab === 'statement'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                            }`}
                          >
                            كشف الحساب
                          </button>
                        </>
                      )}

                      {/* View Mode Toggle Button - Only for invoices tab */}
                      {activeTab === 'invoices' && (
                        <div className="flex gap-1 bg-gray-600/50 rounded-lg p-1">
                          <button
                            onClick={() => setViewMode('invoices-only')}
                            className={`px-2.5 py-1.5 text-base rounded transition-all duration-200 ${
                              viewMode === 'invoices-only'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                            }`}
                            title="فواتير فقط"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => setViewMode('split')}
                            className={`px-2.5 py-1.5 text-base rounded transition-all duration-200 ${
                              viewMode === 'split'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                            }`}
                            title="عرض مقسم"
                          >
                            ⬌
                          </button>
                          <button
                            onClick={() => setViewMode('details-only')}
                            className={`px-2.5 py-1.5 text-base rounded transition-all duration-200 ${
                              viewMode === 'details-only'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                            }`}
                            title="تفاصيل فقط"
                          >
                            📄
                          </button>
                        </div>
                      )}

                      {/* Action Buttons - Only for invoices tab */}
                      {activeTab === 'invoices' && (
                        <>
                          {/* إخفاء زرار التعديل للعميل الافتراضي - يمكن الحذف فقط */}
                          {!isDefaultCustomer && (
                            <button
                              onClick={() => {
                                // Get the selected sale
                                const selectedSale = sales[selectedTransaction]
                                if (!selectedSale) {
                                  alert('يرجى اختيار فاتورة للتعديل')
                                  return
                                }

                                // Store invoice data in localStorage for the POS page to read (localStorage is shared between tabs)
                                const editData = {
                                  saleId: selectedSale.id,
                                  invoiceNumber: selectedSale.invoice_number,
                                  customerId: customer.id,
                                  customerName: customer.name,
                                  customerPhone: customer.phone,
                                  items: saleItems.map(item => ({
                                    productId: item.product?.id,
                                    productName: item.product?.name,
                                    quantity: item.quantity,
                                    unitPrice: item.unit_price,
                                    discount: item.discount || 0,
                                    barcode: item.product?.barcode,
                                    main_image_url: item.product?.main_image_url
                                  }))
                                }
                                localStorage.setItem('pos_edit_invoice', JSON.stringify(editData))

                                // Open POS in a new window with edit mode
                                window.open(`/pos?edit=true&saleId=${selectedSale.id}`, '_blank')
                              }}
                              disabled={sales.length === 0 || selectedTransaction >= sales.length || isLoadingItems}
                              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-gray-600/30 rounded-lg transition-all whitespace-nowrap"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              <span>تحرير</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (sales.length > 0 && selectedTransaction < sales.length) {
                                handleDeleteInvoice(sales[selectedTransaction])
                              }
                            }}
                            disabled={sales.length === 0 || selectedTransaction >= sales.length}
                            className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-red-600/10 rounded-lg transition-all whitespace-nowrap"
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span>حذف</span>
                          </button>

                          <button className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-lg transition-all whitespace-nowrap">
                            <TableCellsIcon className="h-4 w-4" />
                            <span>الأعمدة</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Desktop Layout - Original */
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    {/* Action Buttons - Same style as customer list */}
                    <div className="flex items-center gap-1">
                      {/* إخفاء زرار التعديل للعميل الافتراضي - يمكن الحذف فقط */}
                      {!isDefaultCustomer && (
                        <button
                          onClick={() => {
                            // Get the selected sale
                            const selectedSale = sales[selectedTransaction]
                            if (!selectedSale) {
                              alert('يرجى اختيار فاتورة للتعديل')
                              return
                            }

                            // Store invoice data in localStorage for the POS page to read (localStorage is shared between tabs)
                            const editData = {
                              saleId: selectedSale.id,
                              invoiceNumber: selectedSale.invoice_number,
                              customerId: customer.id,
                              customerName: customer.name,
                              customerPhone: customer.phone,
                              items: saleItems.map(item => ({
                                productId: item.product?.id,
                                productName: item.product?.name,
                                quantity: item.quantity,
                                unitPrice: item.unit_price,
                                discount: item.discount || 0,
                                barcode: item.product?.barcode,
                                main_image_url: item.product?.main_image_url
                              }))
                            }
                            localStorage.setItem('pos_edit_invoice', JSON.stringify(editData))

                            // Open POS in a new window with edit mode
                            window.open(`/pos?edit=true&saleId=${selectedSale.id}`, '_blank')
                          }}
                          disabled={sales.length === 0 || selectedTransaction >= sales.length || isLoadingItems}
                          className="flex flex-col items-center p-2 text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer min-w-[80px] transition-colors"
                        >
                          <PencilSquareIcon className="h-5 w-5 mb-1" />
                          <span className="text-sm">تحرير الفاتورة</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (sales.length > 0 && selectedTransaction < sales.length) {
                            handleDeleteInvoice(sales[selectedTransaction])
                          }
                        }}
                        disabled={sales.length === 0 || selectedTransaction >= sales.length}
                        className="flex flex-col items-center p-2 text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer min-w-[80px] transition-colors"
                      >
                        <TrashIcon className="h-5 w-5 mb-1" />
                        <span className="text-sm">حذف الفاتورة</span>
                      </button>

                      <button
                        onClick={() => setShowColumnManager(true)}
                        className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-colors"
                      >
                        <TableCellsIcon className="h-5 w-5 mb-1" />
                        <span className="text-sm">إدارة الأعمدة</span>
                      </button>
                    </div>

                    {/* Tab Navigation - Same row */}
                    <div className="flex gap-2">
                      {/* إخفاء الدفعات وكشف الحساب للعميل الافتراضي */}
                      {!isDefaultCustomer && (
                        <>
                          <button
                            onClick={() => setActiveTab('payments')}
                            className={`px-6 py-3 text-base font-medium border-b-2 rounded-t-lg transition-all duration-200 ${
                              activeTab === 'payments'
                                ? 'text-blue-400 border-blue-400 bg-blue-600/10'
                                : 'text-gray-300 hover:text-white border-transparent hover:border-gray-400 hover:bg-gray-600/20'
                            }`}
                          >
                            الدفعات
                          </button>
                          <button
                            onClick={() => setActiveTab('statement')}
                            className={`px-6 py-3 text-base font-medium border-b-2 rounded-t-lg transition-all duration-200 ${
                              activeTab === 'statement'
                                ? 'text-blue-400 border-blue-400 bg-blue-600/10'
                                : 'text-gray-300 hover:text-white border-transparent hover:border-gray-400 hover:bg-gray-600/20'
                            }`}
                          >
                            كشف الحساب
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-6 py-3 text-base font-semibold border-b-2 rounded-t-lg transition-all duration-200 ${
                          activeTab === 'invoices'
                            ? 'text-blue-400 border-blue-400 bg-blue-600/10'
                            : 'text-gray-300 hover:text-white border-transparent hover:border-gray-400 hover:bg-gray-600/20'
                        }`}
                      >
                        فواتير العميل ({sales.length})
                      </button>
                    </div>

                    {/* View Mode Toggle Buttons - Only show for invoices tab */}
                    {activeTab === 'invoices' && (
                      <div className="flex gap-1 bg-gray-600/50 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode('invoices-only')}
                          className={`px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 ${
                            viewMode === 'invoices-only'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                          }`}
                          title="عرض فواتير العميل فقط"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => setViewMode('split')}
                          className={`px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 ${
                            viewMode === 'split'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                          }`}
                          title="عرض مقسم"
                        >
                          ⬌
                        </button>
                        <button
                          onClick={() => setViewMode('details-only')}
                          className={`px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 ${
                            viewMode === 'details-only'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                          }`}
                          title="عرض تفاصيل الفاتورة فقط"
                        >
                          📄
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-600/30 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-1 min-h-0" ref={containerRef}>
            {/* Toggle Button - Flat design on the edge */}
            <div className="flex">
              <button
                onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                className="w-6 bg-[#374151] hover:bg-[#4B5563] border-r border-gray-600 flex items-center justify-center transition-colors duration-200"
                title={showCustomerDetails ? 'إخفاء تفاصيل العميل' : 'إظهار تفاصيل العميل'}
              >
                {showCustomerDetails ? (
                  <ChevronRightIcon className="h-4 w-4 text-gray-300" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4 text-gray-300" />
                )}
              </button>
            </div>

            {/* Right Sidebar - Customer Info (First in RTL) */}
            {showCustomerDetails && (
              <div className={`bg-[#3B4754] border-l border-gray-600 flex flex-col ${
                isTabletDevice ? 'w-64' : 'w-80'
              }`}>

                {/* Customer Balance / Invoices Sum */}
                <div className={`border-b border-gray-600 ${isTabletDevice ? 'p-3' : 'p-4'}`}>
                  <div className={`bg-blue-600 rounded text-center ${isTabletDevice ? 'p-3' : 'p-4'}`}>
                    <div className={`font-bold text-white ${isTabletDevice ? 'text-xl' : 'text-2xl'}`}>
                      {formatPrice(isDefaultCustomer ? displayedInvoicesSum : customerBalance, 'system')}
                    </div>
                    <div className={`text-blue-200 ${isTabletDevice ? 'text-xs' : 'text-sm'}`}>
                      {isDefaultCustomer ? 'مجموع الفواتير' : 'رصيد العميل'}
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className={`space-y-3 flex-1 overflow-y-auto scrollbar-hide ${isTabletDevice ? 'p-3' : 'p-4'}`}>
                  <h3 className={`text-white font-medium text-right ${isTabletDevice ? 'text-base' : 'text-lg'}`}>
                    معلومات العميل
                  </h3>

                  <div className={isTabletDevice ? 'space-y-2' : 'space-y-3'}>
                    <div className="flex justify-between items-center">
                      <span className={`text-white ${isTabletDevice ? 'text-sm' : ''}`}>
                        {customer.name || 'Mazen taps'}
                      </span>
                      <span className="text-gray-400 text-xs">اسم العميل</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className={`text-white ${isTabletDevice ? 'text-sm' : ''}`}>
                        {customer.address || '23626125215'}
                      </span>
                      <span className="text-gray-400 text-xs">رقم الهاتف</span>
                    </div>

                    {!isTabletDevice && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-white">عمر الثامن</span>
                          <span className="text-gray-400 text-sm">الجيل</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-white">6/24/2025</span>
                          <span className="text-gray-400 text-sm">تاريخ التسجيل</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-yellow-400 flex items-center gap-1">
                        <span className={isTabletDevice ? 'text-sm' : ''}>Immortal</span>
                        <span>⭐</span>
                      </span>
                      <span className="text-gray-400 text-xs">الرتبة</span>
                    </div>
                  </div>

                  {/* Customer Statistics */}
                  <div className={`border-t border-gray-600 ${isTabletDevice ? 'pt-3 mt-3' : 'pt-4 mt-4'}`}>
                    <h4 className={`text-white font-medium text-right flex items-center gap-2 ${
                      isTabletDevice ? 'text-sm mb-2' : 'mb-3'
                    }`}>
                      <span>📊</span>
                      <span>إحصائيات</span>
                    </h4>
                    <div className={isTabletDevice ? 'space-y-2' : 'space-y-3'}>
                      <div className="flex justify-between items-center">
                        <span className={`text-white ${isTabletDevice ? 'text-sm' : ''}`}>
                          {sales.length}
                        </span>
                        <span className="text-gray-400 text-xs">عدد الفواتير</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-blue-400 ${isTabletDevice ? 'text-sm' : ''}`}>
                          {formatPrice(totalInvoicesAmount, 'system')}
                        </span>
                        <span className="text-gray-400 text-xs">إجمالي الفواتير</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-green-400 ${isTabletDevice ? 'text-sm' : ''}`}>
                          {formatPrice(totalPayments, 'system')}
                        </span>
                        <span className="text-gray-400 text-xs">إجمالي الدفعات</span>
                      </div>
                      {!isTabletDevice && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-white">{formatPrice(averageOrderValue, 'system')}</span>
                            <span className="text-gray-400 text-sm">متوسط قيمة الطلبية</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white">
                              {sales.length > 0
                                ? new Date(sales[0].created_at).toLocaleDateString('en-GB')
                                : '-'
                              }
                            </span>
                            <span className="text-gray-400 text-sm">آخر فاتورة</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Date Filter Button */}
                <div className={`border-t border-gray-600 ${isTabletDevice ? 'p-3' : 'p-4'}`}>
                  <button
                    onClick={() => setShowDateFilter(true)}
                    className={`w-full bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center justify-center gap-2 transition-colors ${
                      isTabletDevice ? 'px-3 py-2 text-sm' : 'px-4 py-3'
                    }`}
                  >
                    <CalendarDaysIcon className={isTabletDevice ? 'h-4 w-4' : 'h-5 w-5'} />
                    <span>التاريخ</span>
                  </button>

                  {/* Current Filter Display */}
                  {dateFilter.type !== 'all' && (
                    <div className="mt-2 text-center">
                      <span className="text-xs text-blue-400">
                        {dateFilter.type === 'today' && 'عرض فواتير اليوم'}
                        {dateFilter.type === 'current_week' && 'عرض فواتير الأسبوع الحالي'}
                        {dateFilter.type === 'last_week' && 'عرض فواتير الأسبوع الماضي'}
                        {dateFilter.type === 'current_month' && 'عرض فواتير الشهر الحالي'}
                        {dateFilter.type === 'last_month' && 'عرض فواتير الشهر الماضي'}
                        {dateFilter.type === 'custom' && dateFilter.startDate && dateFilter.endDate &&
                          `من ${dateFilter.startDate.toLocaleDateString('en-GB')} إلى ${dateFilter.endDate.toLocaleDateString('en-GB')}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Content Area - Left side containing both tables */}
            <div className="flex-1 flex flex-col min-w-0 relative">
              
              {/* Search Bar */}
              <div className={`bg-[#374151] border-b border-gray-600 ${isTabletDevice ? 'p-3' : 'p-4'}`}>
                <div className="relative">
                  <MagnifyingGlassIcon className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${
                    isTabletDevice ? 'h-3.5 w-3.5' : 'h-4 w-4'
                  }`} />
                  <input
                    type="text"
                    placeholder={isTabletDevice ? "بحث..." : "ابحث عن فاتورة (رقم الفاتورة، اسم العميل، أو الهاتف)..."}
                    className={`w-full pr-10 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isTabletDevice ? 'pl-3 py-1.5 text-xs' : 'pl-4 py-2 text-sm'
                    }`}
                  />
                </div>
              </div>

              {/* Conditional Content Based on Active Tab and View Mode */}
              <div className="flex-1 overflow-hidden relative">
                {activeTab === 'statement' && (
                  <div className="h-full flex flex-col">
                    {showStatementInvoiceDetails ? (
                      <>
                        {/* Invoice Details Header */}
                        <div className="bg-[#2B3544] border-b border-gray-600 p-4 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setShowStatementInvoiceDetails(false)
                              setSelectedStatementInvoice(null)
                              setStatementInvoiceItems([])
                            }}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                            <span>العودة إلى كشف الحساب</span>
                          </button>
                          <h3 className="text-white font-medium text-lg">
                            تفاصيل الفاتورة {selectedStatementInvoice?.invoice_number || ''}
                          </h3>
                          <div className="flex items-center gap-2">
                            {/* Print Receipt Button */}
                            <button
                              onClick={() => printReceipt(selectedStatementInvoice, statementInvoiceItems)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                              disabled={isLoadingStatementInvoiceItems || statementInvoiceItems.length === 0}
                            >
                              <PrinterIcon className="h-4 w-4" />
                              طباعة الريسيت
                            </button>

                            {/* Print A4 Invoice Button */}
                            <button
                              onClick={() => printA4Invoice(selectedStatementInvoice, statementInvoiceItems)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                              disabled={isLoadingStatementInvoiceItems || statementInvoiceItems.length === 0}
                            >
                              <DocumentIcon className="h-4 w-4" />
                              طباعة A4
                            </button>

                            {/* Save Dropdown Button */}
                            <div className="relative" ref={saveDropdownStatementRef}>
                              <button
                                onClick={() => setShowSaveDropdownStatement(!showSaveDropdownStatement)}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                                disabled={isLoadingStatementInvoiceItems || statementInvoiceItems.length === 0}
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                حفظ
                              </button>

                              {/* Dropdown Menu */}
                              {showSaveDropdownStatement && (
                                <div className="absolute top-full left-0 mt-1 bg-[#374151] border border-gray-600 rounded-lg shadow-xl z-50 min-w-[140px]">
                                  <button
                                    onClick={() => saveDocument(selectedStatementInvoice, statementInvoiceItems, 'pdf')}
                                    className="w-full px-4 py-2 text-right text-white hover:bg-gray-600 flex items-center gap-2 rounded-t-lg transition-colors"
                                  >
                                    <DocumentArrowDownIcon className="h-4 w-4 text-red-400" />
                                    <span>PDF</span>
                                  </button>
                                  <button
                                    onClick={() => saveDocument(selectedStatementInvoice, statementInvoiceItems, 'png')}
                                    className="w-full px-4 py-2 text-right text-white hover:bg-gray-600 flex items-center gap-2 rounded-b-lg transition-colors"
                                  >
                                    <DocumentArrowDownIcon className="h-4 w-4 text-blue-400" />
                                    <span>PNG</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Invoice Details Table */}
                        <div className="flex-1">
                          {isLoadingStatementInvoiceItems ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                              <span className="text-gray-400">جاري تحميل تفاصيل الفاتورة...</span>
                            </div>
                          ) : (
                            <ResizableTable
                              className="h-full w-full"
                              columns={invoiceDetailsColumns}
                              data={statementInvoiceItems}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {isLoadingStatements ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                            <span className="text-gray-400">جاري تحميل كشف الحساب...</span>
                          </div>
                        ) : accountStatements.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-gray-400">لا توجد عمليات مسجلة</span>
                          </div>
                        ) : (
                          <ResizableTable
                            className="h-full w-full"
                            columns={statementColumns}
                            data={accountStatements}
                            onRowDoubleClick={handleStatementRowDoubleClick}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
                
                {activeTab === 'invoices' && (
                  <div className="h-full relative">
                    {/* Invoices Table - Always rendered but z-indexed based on view mode */}
                    <div 
                      className={`absolute inset-0 bg-[#2B3544] transition-all duration-300 ${
                        viewMode === 'details-only' ? 'z-0 opacity-20' : 'z-10'
                      } ${
                        viewMode === 'split' ? '' : 'opacity-100'
                      }`}
                      style={{
                        height: viewMode === 'split' ? `${dividerPosition}%` : '100%',
                        zIndex: viewMode === 'invoices-only' ? 20 : viewMode === 'split' ? 10 : 5
                      }}
                    >
                      {isLoadingSales ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                          <span className="text-gray-400">جاري تحميل الفواتير...</span>
                        </div>
                      ) : (
                        <ResizableTable
                          className="h-full w-full"
                          columns={invoiceColumns}
                          data={sales}
                          selectedRowId={sales[selectedTransaction]?.id?.toString() || null}
                          onRowClick={(sale: any, index: number) => setSelectedTransaction(index)}
                        />
                      )}
                    </div>

                    {/* Resizable Divider - Only show in split mode */}
                    {viewMode === 'split' && (
                      <div
                        className="absolute left-0 right-0 h-2 bg-gray-600 hover:bg-blue-500 cursor-row-resize z-30 flex items-center justify-center transition-colors duration-200"
                        style={{ top: `${dividerPosition}%`, transform: 'translateY(-50%)' }}
                        onMouseDown={handleMouseDown}
                      >
                        <div className="w-12 h-1 bg-gray-400 rounded-full"></div>
                      </div>
                    )}

                    {/* Invoice Details - Always rendered but z-indexed based on view mode */}
                    <div 
                      className={`absolute inset-0 bg-[#2B3544] flex flex-col transition-all duration-300 ${
                        viewMode === 'invoices-only' ? 'z-0 opacity-20' : 'z-10'
                      }`}
                      style={{
                        top: viewMode === 'split' ? `${dividerPosition}%` : '0',
                        height: viewMode === 'split' ? `${100 - dividerPosition}%` : '100%',
                        zIndex: viewMode === 'details-only' ? 20 : viewMode === 'split' ? 10 : 5
                      }}
                    >
                      <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0 border-b border-gray-600">
                        <div className="flex items-center gap-2">
                          {/* Print Receipt Button */}
                          <button
                            onClick={() => printReceipt(sales[selectedTransaction], saleItems)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                            disabled={isLoadingItems || saleItems.length === 0}
                          >
                            <PrinterIcon className="h-4 w-4" />
                            طباعة الريسيت
                          </button>

                          {/* Print A4 Invoice Button */}
                          <button
                            onClick={() => printA4Invoice(sales[selectedTransaction], saleItems)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                            disabled={isLoadingItems || saleItems.length === 0}
                          >
                            <DocumentIcon className="h-4 w-4" />
                            طباعة A4
                          </button>

                          {/* Save Dropdown Button */}
                          <div className="relative" ref={saveDropdownRef}>
                            <button
                              onClick={() => setShowSaveDropdown(!showSaveDropdown)}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                              disabled={isLoadingItems || saleItems.length === 0}
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              حفظ
                            </button>

                            {/* Dropdown Menu */}
                            {showSaveDropdown && (
                              <div className="absolute top-full left-0 mt-1 bg-[#374151] border border-gray-600 rounded-lg shadow-xl z-50 min-w-[140px]">
                                <button
                                  onClick={() => saveDocument(sales[selectedTransaction], saleItems, 'pdf')}
                                  className="w-full px-4 py-2 text-right text-white hover:bg-gray-600 flex items-center gap-2 rounded-t-lg transition-colors"
                                >
                                  <DocumentArrowDownIcon className="h-4 w-4 text-red-400" />
                                  <span>PDF</span>
                                </button>
                                <button
                                  onClick={() => saveDocument(sales[selectedTransaction], saleItems, 'png')}
                                  className="w-full px-4 py-2 text-right text-white hover:bg-gray-600 flex items-center gap-2 rounded-b-lg transition-colors"
                                >
                                  <DocumentArrowDownIcon className="h-4 w-4 text-blue-400" />
                                  <span>PNG</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <h3 className="text-blue-400 font-medium text-lg">
                          تفاصيل الفاتورة {sales[selectedTransaction]?.invoice_number || ''}
                        </h3>
                      </div>

                      <div className="flex-1 min-h-0">
                        {isLoadingItems ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                            <span className="text-gray-400">جاري تحميل العناصر...</span>
                          </div>
                        ) : (
                          <ResizableTable
                            className="h-full w-full"
                            columns={invoiceDetailsColumns}
                            data={saleItems}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab === 'payments' && (
                  <div className="h-full flex flex-col">
                    {/* Payments Header */}
                    <div className="bg-[#2B3544] border-b border-gray-600 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <button
                            onClick={() => {
                              setPaymentType('payment')
                              setShowAddPaymentModal(true)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                          >
                            <PlusIcon className="h-4 w-4" />
                            إضافة دفعة
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-white text-lg font-medium">دفعات العميل</div>
                          <div className="text-gray-400 text-sm mt-1">إجمالي الدفعات: {formatPrice(totalPayments, 'system')}</div>
                        </div>
                      </div>
                    </div>

                    {/* Payments Table */}
                    <div className="flex-1 relative">
                      {isLoadingPayments ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                          <span className="text-gray-400">جاري تحميل الدفعات...</span>
                        </div>
                      ) : customerPayments.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-400">لا توجد دفعات مسجلة</span>
                        </div>
                      ) : (
                        <ResizableTable
                          className="h-full w-full"
                          columns={paymentsColumns}
                          data={customerPayments}
                          selectedRowId={selectedPayment?.id}
                          onRowClick={(payment: any) => setSelectedPayment(payment)}
                          onRowContextMenu={(e: React.MouseEvent, payment: any) => handlePaymentContextMenu(e, payment)}
                        />
                      )}

                      {/* Context Menu for Payment */}
                      {contextMenu && (
                        <div
                          className="fixed bg-[#2B3544] border border-gray-600 rounded-lg shadow-xl py-1 z-[100]"
                          style={{
                            left: contextMenu.x,
                            top: contextMenu.y,
                          }}
                        >
                          <button
                            onClick={() => {
                              handleDeletePayment(contextMenu.payment)
                              setContextMenu(null)
                            }}
                            className="w-full px-4 py-2 text-right text-red-400 hover:bg-red-600/20 hover:text-red-300 flex items-center gap-2 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span>حذف الدفعة</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Delete Invoice Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDeleteInvoice}
        isDeleting={isDeleting}
        title="تأكيد حذف الفاتورة"
        message="هل أنت متأكد أنك تريد حذف هذه الفاتورة؟"
        itemName={invoiceToDelete ? `فاتورة رقم: ${invoiceToDelete.invoice_number}` : ''}
      />

      {/* Delete Payment Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeletePaymentModal}
        onClose={cancelDeletePayment}
        onConfirm={confirmDeletePayment}
        isDeleting={isDeletingPayment}
        title="تأكيد حذف الدفعة"
        message="هل أنت متأكد أنك تريد حذف هذه الدفعة؟"
        itemName={selectedPayment ? `دفعة بمبلغ: ${formatPrice(selectedPayment.amount, 'system')}` : ''}
      />

      {/* Date Filter Modal */}
      <SimpleDateFilterModal
        isOpen={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onDateFilterChange={(filter) => {
          setDateFilter(filter)
        }}
        currentFilter={dateFilter}
      />

      {/* Add Payment Modal */}
      <AddPaymentModal
        isOpen={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        entityId={customer.id}
        entityType="customer"
        entityName={customer.name}
        currentBalance={customerBalance}
        initialPaymentType={paymentType}
        onPaymentAdded={() => {
          fetchCustomerPayments()
          fetchCustomerBalance()
          fetchAccountStatement()
        }}
      />

      {/* Column Manager Modal */}
      {showColumnManager && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-60"
            onClick={() => setShowColumnManager(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-[#2B3544] rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden border border-gray-600">
            {/* Header */}
            <div className="bg-[#374151] px-6 py-4 border-b border-gray-600 flex items-center justify-between">
              <h3 className="text-white text-lg font-semibold flex items-center gap-2">
                <TableCellsIcon className="h-5 w-5 text-blue-400" />
                إدارة الأعمدة
              </h3>
              <button
                onClick={() => setShowColumnManager(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-600 bg-[#374151]/50">
              <button
                onClick={() => setColumnManagerTab('invoices')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  columnManagerTab === 'invoices'
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-600/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600/30'
                }`}
              >
                📋 فواتير العميل
              </button>
              <button
                onClick={() => setColumnManagerTab('details')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  columnManagerTab === 'details'
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-600/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600/30'
                }`}
              >
                📄 تفاصيل الفاتورة
              </button>
              <button
                onClick={() => setColumnManagerTab('print')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  columnManagerTab === 'print'
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-600/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600/30'
                }`}
              >
                🖨️ طباعة A4
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              {columnManagerTab === 'invoices' && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm mb-4">
                    اختر الأعمدة التي تريد عرضها في جدول فواتير العميل
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {allInvoiceColumnDefs.map((col) => (
                      <label
                        key={col.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          visibleInvoiceColumns.includes(col.id)
                            ? 'bg-blue-600/20 border-blue-500'
                            : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                        } ${col.required ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={visibleInvoiceColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id, 'invoices')}
                          disabled={col.required}
                          className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span className={`text-sm ${visibleInvoiceColumns.includes(col.id) ? 'text-white' : 'text-gray-400'}`}>
                          {col.label}
                        </span>
                        {col.required && (
                          <span className="text-xs text-yellow-500 mr-auto">مطلوب</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {columnManagerTab === 'details' && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm mb-4">
                    اختر الأعمدة التي تريد عرضها في جدول تفاصيل الفاتورة
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {allDetailsColumnDefs.map((col) => (
                      <label
                        key={col.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          visibleDetailsColumns.includes(col.id)
                            ? 'bg-blue-600/20 border-blue-500'
                            : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                        } ${col.required ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={visibleDetailsColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id, 'details')}
                          disabled={col.required}
                          className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span className={`text-sm ${visibleDetailsColumns.includes(col.id) ? 'text-white' : 'text-gray-400'}`}>
                          {col.label}
                        </span>
                        {col.required && (
                          <span className="text-xs text-yellow-500 mr-auto">مطلوب</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {columnManagerTab === 'print' && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm mb-4">
                    اختر الأعمدة التي تريد طباعتها في فاتورة A4
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {allPrintColumnDefs.map((col) => (
                      <label
                        key={col.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          visiblePrintColumns.includes(col.id)
                            ? 'bg-green-600/20 border-green-500'
                            : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                        } ${col.required ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={visiblePrintColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id, 'print')}
                          disabled={col.required}
                          className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-green-500 focus:ring-green-500 focus:ring-offset-0"
                        />
                        <span className={`text-sm ${visiblePrintColumns.includes(col.id) ? 'text-white' : 'text-gray-400'}`}>
                          {col.label}
                        </span>
                        {col.required && (
                          <span className="text-xs text-yellow-500 mr-auto">مطلوب</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#374151]/50 px-6 py-4 border-t border-gray-600 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                {columnManagerTab === 'invoices' && `${visibleInvoiceColumns.length} من ${allInvoiceColumnDefs.length} أعمدة مفعلة`}
                {columnManagerTab === 'details' && `${visibleDetailsColumns.length} من ${allDetailsColumnDefs.length} أعمدة مفعلة`}
                {columnManagerTab === 'print' && `${visiblePrintColumns.length} من ${allPrintColumnDefs.length} أعمدة مفعلة`}
              </div>
              <button
                onClick={() => setShowColumnManager(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}