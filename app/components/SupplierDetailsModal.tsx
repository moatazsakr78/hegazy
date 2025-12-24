'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, PencilSquareIcon, TrashIcon, TableCellsIcon, CalendarDaysIcon, PrinterIcon, DocumentIcon, ArrowDownTrayIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import ResizableTable from './tables/ResizableTable'
import { supabase } from '../lib/supabase/client'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import SimpleDateFilterModal, { DateFilter } from './SimpleDateFilterModal'
import AddPaymentModal from './AddPaymentModal'
import { useFormatPrice } from '@/lib/hooks/useCurrency'

interface SupplierDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  supplier: any
}

type ViewMode = 'split' | 'invoices-only' | 'details-only'

export default function SupplierDetailsModal({ isOpen, onClose, supplier }: SupplierDetailsModalProps) {
  const formatPrice = useFormatPrice();
  const [selectedTransaction, setSelectedTransaction] = useState(0) // First row selected (index 0)
  const [showSupplierDetails, setShowSupplierDetails] = useState(true)
  const [activeTab, setActiveTab] = useState('invoices') // 'invoices', 'payments', 'statement'
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [dividerPosition, setDividerPosition] = useState(50) // Percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Real-time state for purchase invoices and purchase invoice items
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([])
  const [purchaseInvoiceItems, setPurchaseInvoiceItems] = useState<any[]>([])
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  // Supplier balance state - independent of date filter
  const [supplierBalance, setSupplierBalance] = useState(0)

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null)

  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'all' })

  // Add Payment Modal state
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false)

  // Supplier payments state
  const [supplierPayments, setSupplierPayments] = useState<any[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)

  // Account statement state
  const [accountStatements, setAccountStatements] = useState<any[]>([])
  const [isLoadingStatements, setIsLoadingStatements] = useState(false)

  // Statement invoice details state
  const [showStatementInvoiceDetails, setShowStatementInvoiceDetails] = useState(false)
  const [selectedStatementInvoice, setSelectedStatementInvoice] = useState<any>(null)
  const [statementInvoiceItems, setStatementInvoiceItems] = useState<any[]>([])
  const [isLoadingStatementInvoiceItems, setIsLoadingStatementInvoiceItems] = useState(false)
  const [currentInvoiceIndex, setCurrentInvoiceIndex] = useState<number>(0)

  // Get list of invoice statements for navigation (only invoices, not payments)
  const invoiceStatements = accountStatements.filter(s => s.type === 'فاتورة شراء' || s.type === 'مرتجع شراء')

  // Save dropdown state
  const [showSaveDropdown, setShowSaveDropdown] = useState(false)
  const [showSaveDropdownStatement, setShowSaveDropdownStatement] = useState(false)
  const saveDropdownRef = useRef<HTMLDivElement>(null)
  const saveDropdownStatementRef = useRef<HTMLDivElement>(null)

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

  // Fetch supplier balance - independent of date filter
  const fetchSupplierBalance = async () => {
    if (!supplier?.id) return

    try {
      // Get all purchase invoices for this supplier (without date filter)
      const { data: allInvoices, error: invoicesError } = await supabase
        .from('purchase_invoices')
        .select('total_amount, invoice_type')
        .eq('supplier_id', supplier.id)

      if (invoicesError) {
        console.error('Error fetching supplier invoices:', invoicesError)
        return
      }

      // Get all payments for this supplier (without date filter)
      const { data: allPayments, error: paymentsError } = await supabase
        .from('supplier_payments')
        .select('amount')
        .eq('supplier_id', supplier.id)

      if (paymentsError) {
        console.error('Error fetching supplier payments:', paymentsError)
        return
      }

      // Calculate invoices balance: Purchase Invoices add to balance, Purchase Returns subtract
      const invoicesBalance = (allInvoices || []).reduce((total, invoice) => {
        if (invoice.invoice_type === 'Purchase Invoice') {
          return total + (invoice.total_amount || 0)
        } else if (invoice.invoice_type === 'Purchase Return') {
          return total - (invoice.total_amount || 0)
        }
        return total
      }, 0)

      // Calculate total payments
      const totalPayments = (allPayments || []).reduce((total, payment) => {
        return total + (payment.amount || 0)
      }, 0)

      // Final balance = Invoices Balance - Total Payments
      const finalBalance = invoicesBalance - totalPayments

      setSupplierBalance(finalBalance)
    } catch (error) {
      console.error('Error calculating supplier balance:', error)
    }
  }

  // Fetch purchase invoices from Supabase for the specific supplier
  const fetchPurchaseInvoices = async () => {
    if (!supplier?.id) return
    
    try {
      setIsLoadingInvoices(true)
      
      let query = supabase
        .from('purchase_invoices')
        .select(`
          id,
          invoice_number,
          supplier_id,
          total_amount,
          notes,
          created_at,
          time,
          invoice_type,
          record_id,
          created_by,
          supplier:suppliers(
            name,
            phone
          ),
          record:records(
            name
          ),
          creator:user_profiles(
            full_name
          )
        `)
        .eq('supplier_id', supplier.id)
      
      // Apply date filter
      query = applyDateFilter(query)
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) {
        console.error('Error fetching purchase invoices:', error)
        return
      }
      
      setPurchaseInvoices(data || [])
      
      // Auto-select first invoice if available
      if (data && data.length > 0) {
        setSelectedTransaction(0)
        fetchPurchaseInvoiceItems(data[0].id)
      }
      
    } catch (error) {
      console.error('Error fetching purchase invoices:', error)
    } finally {
      setIsLoadingInvoices(false)
    }
  }

  // Fetch supplier payments
  const fetchSupplierPayments = async () => {
    if (!supplier?.id) return

    try {
      setIsLoadingPayments(true)

      const { data, error } = await supabase
        .from('supplier_payments')
        .select(`
          id,
          amount,
          payment_method,
          reference_number,
          notes,
          payment_date,
          created_at,
          created_by,
          safe_id,
          creator:user_profiles(full_name)
        `)
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching supplier payments:', error)
        return
      }

      // Get safe names for payments that have safe_id
      const safeIds = (data || []).filter(p => p.safe_id).map(p => p.safe_id as string)
      let safesMap = new Map<string, string>()

      if (safeIds.length > 0) {
        const { data: safesData } = await supabase
          .from('records')
          .select('id, name')
          .in('id', safeIds)

        if (safesData) {
          safesData.forEach(safe => safesMap.set(safe.id, safe.name))
        }
      }

      // Map payments with safe_name and employee_name
      const paymentsWithInfo = (data || []).map(payment => ({
        ...payment,
        safe_name: payment.safe_id ? safesMap.get(payment.safe_id) || null : null,
        employee_name: (payment as any).creator?.full_name || null
      }))

      setSupplierPayments(paymentsWithInfo)

    } catch (error) {
      console.error('Error fetching supplier payments:', error)
    } finally {
      setIsLoadingPayments(false)
    }
  }

  // Fetch invoice items for statement invoice
  const fetchStatementInvoiceItems = async (invoiceId: string) => {
    try {
      setIsLoadingStatementInvoiceItems(true)

      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .select(`
          id,
          quantity,
          unit_purchase_price,
          total_price,
          discount_amount,
          notes,
          product:products(
            name,
            barcode,
            category:categories(name)
          )
        `)
        .eq('purchase_invoice_id', invoiceId)
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
    if (statement.type !== 'فاتورة شراء' && statement.type !== 'مرتجع شراء') {
      return
    }

    // Find the index of this invoice in the invoice statements
    const index = invoiceStatements.findIndex(s => s.id === statement.id)
    if (index !== -1) {
      setCurrentInvoiceIndex(index)
    }

    // Get invoice details
    if (statement.invoiceId) {
      const { data: invoiceData, error } = await supabase
        .from('purchase_invoices')
        .select(`
          *,
          creator:user_profiles(full_name)
        `)
        .eq('id', statement.invoiceId)
        .single()

      if (!error && invoiceData) {
        setSelectedStatementInvoice(invoiceData)
        setShowStatementInvoiceDetails(true)
        await fetchStatementInvoiceItems(statement.invoiceId)
      }
    }
  }

  // Navigate to next invoice in the statement
  const navigateToNextInvoice = async () => {
    if (currentInvoiceIndex < invoiceStatements.length - 1) {
      const nextIndex = currentInvoiceIndex + 1
      const nextStatement = invoiceStatements[nextIndex]
      setCurrentInvoiceIndex(nextIndex)

      if (nextStatement.invoiceId) {
        setIsLoadingStatementInvoiceItems(true)
        const { data: invoiceData, error } = await supabase
          .from('purchase_invoices')
          .select(`
            *,
            creator:user_profiles(full_name)
          `)
          .eq('id', nextStatement.invoiceId)
          .single()

        if (!error && invoiceData) {
          setSelectedStatementInvoice(invoiceData)
          await fetchStatementInvoiceItems(nextStatement.invoiceId)
        }
      }
    }
  }

  // Navigate to previous invoice in the statement
  const navigateToPreviousInvoice = async () => {
    if (currentInvoiceIndex > 0) {
      const prevIndex = currentInvoiceIndex - 1
      const prevStatement = invoiceStatements[prevIndex]
      setCurrentInvoiceIndex(prevIndex)

      if (prevStatement.invoiceId) {
        setIsLoadingStatementInvoiceItems(true)
        const { data: invoiceData, error } = await supabase
          .from('purchase_invoices')
          .select(`
            *,
            creator:user_profiles(full_name)
          `)
          .eq('id', prevStatement.invoiceId)
          .single()

        if (!error && invoiceData) {
          setSelectedStatementInvoice(invoiceData)
          await fetchStatementInvoiceItems(prevStatement.invoiceId)
        }
      }
    }
  }

  // Fetch account statement
  const fetchAccountStatement = async () => {
    if (!supplier?.id) return

    try {
      setIsLoadingStatements(true)

      // Get all purchase invoices for this supplier
      const { data: invoices, error: invoicesError } = await supabase
        .from('purchase_invoices')
        .select(`
          id, invoice_number, total_amount, invoice_type, created_at,
          record:records(name),
          creator:user_profiles(full_name)
        `)
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: true })

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError)
        return
      }

      // Get all payments for this supplier
      const { data: payments, error: paymentsError } = await supabase
        .from('supplier_payments')
        .select(`
          id, amount, payment_method, notes, created_at, safe_id,
          creator:user_profiles(full_name)
        `)
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: true })

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError)
        return
      }

      // Get safe names for payments
      const paymentSafeIds = (payments || []).filter(p => p.safe_id).map(p => p.safe_id as string)
      let paymentSafesMap = new Map<string, string>()

      if (paymentSafeIds.length > 0) {
        const { data: safesData } = await supabase
          .from('records')
          .select('id, name')
          .in('id', paymentSafeIds)

        if (safesData) {
          safesData.forEach(safe => paymentSafesMap.set(safe.id, safe.name))
        }
      }

      // Build statements array
      const statements: any[] = []

      // Add invoices
      invoices?.forEach((invoice) => {
        if (invoice.created_at) {  // Add null check
          const amount = invoice.invoice_type === 'Purchase Invoice'
            ? invoice.total_amount
            : -invoice.total_amount

          statements.push({
            id: statements.length + 1,
            date: new Date(invoice.created_at),
            description: `فاتورة ${invoice.invoice_number}`,
            type: invoice.invoice_type === 'Purchase Invoice' ? 'فاتورة شراء' : 'مرتجع شراء',
            amount: amount,
            invoiceId: invoice.id,
            safe_name: (invoice as any).record?.name || null,
            employee_name: (invoice as any).creator?.full_name || null
          })
        }
      })

      // Add payments
      payments?.forEach((payment) => {
        if (payment.created_at) {  // Add null check
          // التحقق إذا كانت سلفة من خلال الملاحظات
          const isLoan = payment.notes?.startsWith('سلفة')

          // Get safe name from map and employee name from joined data
          const safeName = payment.safe_id ? paymentSafesMap.get(payment.safe_id) || null : null
          const employeeName = (payment as any).creator?.full_name || null

          if (isLoan) {
            // السلفة من المورد تزيد الرصيد المستحق له
            statements.push({
              id: statements.length + 1,
              date: new Date(payment.created_at),
              description: payment.notes,
              type: 'سلفة',
              amount: payment.amount, // Positive because it increases the balance
              paymentId: payment.id,
              safe_name: safeName,
              employee_name: employeeName
            })
          } else {
            // الدفعة للمورد تنقص الرصيد المستحق له
            statements.push({
              id: statements.length + 1,
              date: new Date(payment.created_at),
              description: payment.notes || 'دفعة',
              type: 'دفعة',
              amount: -payment.amount, // Negative because it reduces the balance
              paymentId: payment.id,
              safe_name: safeName,
              employee_name: employeeName
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
          displayTime: statement.date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          displayAmount: statement.amount >= 0
            ? `+${formatPrice(statement.amount)}`
            : formatPrice(statement.amount),
          displayBalance: formatPrice(runningBalance),
          id: index + 1 // Reassign IDs to be sequential
        }
      })

      setAccountStatements(statementsWithBalance)

    } catch (error) {
      console.error('Error fetching account statement:', error)
    } finally {
      setIsLoadingStatements(false)
    }
  }

  // Fetch purchase invoice items for selected invoice
  const fetchPurchaseInvoiceItems = async (invoiceId: string) => {
    try {
      setIsLoadingItems(true)
      
      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .select(`
          id,
          quantity,
          unit_purchase_price,
          total_price,
          discount_amount,
          notes,
          product:products(
            name,
            barcode,
            category:categories(name)
          )
        `)
        .eq('purchase_invoice_id', invoiceId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching purchase invoice items:', error)
        setPurchaseInvoiceItems([])
        return
      }
      
      setPurchaseInvoiceItems(data || [])
      
    } catch (error) {
      console.error('Error fetching purchase invoice items:', error)
      setPurchaseInvoiceItems([])
    } finally {
      setIsLoadingItems(false)
    }
  }

  // Set up real-time subscriptions and fetch initial data
  useEffect(() => {
    if (isOpen && supplier?.id) {
      fetchPurchaseInvoices()
      fetchSupplierPayments()
      fetchAccountStatement()

      // Set up real-time subscription for purchase_invoices
      const invoicesChannel = supabase
        .channel('modal_purchase_invoices_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'purchase_invoices' },
          (payload: any) => {
            console.log('Purchase invoices real-time update:', payload)
            fetchPurchaseInvoices()
            fetchSupplierBalance() // Also update balance on invoice changes
            fetchAccountStatement() // Update account statement on invoice changes
          }
        )
        .subscribe()

      // Set up real-time subscription for purchase_invoice_items
      const invoiceItemsChannel = supabase
        .channel('modal_purchase_invoice_items_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'purchase_invoice_items' },
          (payload: any) => {
            console.log('Purchase invoice items real-time update:', payload)
            if (purchaseInvoices.length > 0 && selectedTransaction < purchaseInvoices.length) {
              fetchPurchaseInvoiceItems(purchaseInvoices[selectedTransaction].id)
            }
          }
        )
        .subscribe()

      // Set up real-time subscription for supplier_payments
      const paymentsChannel = supabase
        .channel('modal_supplier_payments_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'supplier_payments' },
          (payload: any) => {
            console.log('Supplier payments real-time update:', payload)
            fetchSupplierPayments()
            fetchSupplierBalance() // Also update balance on payment changes
            fetchAccountStatement() // Update account statement on payment changes
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(invoicesChannel)
        supabase.removeChannel(invoiceItemsChannel)
        supabase.removeChannel(paymentsChannel)
      }
    }
  }, [isOpen, supplier?.id, dateFilter])

  // Fetch supplier balance independently of date filter
  useEffect(() => {
    if (isOpen && supplier?.id) {
      fetchSupplierBalance()
    }
  }, [isOpen, supplier?.id])

  // Fetch purchase invoice items when selected transaction changes
  useEffect(() => {
    if (purchaseInvoices.length > 0 && selectedTransaction < purchaseInvoices.length) {
      fetchPurchaseInvoiceItems(purchaseInvoices[selectedTransaction].id)
    }
  }, [selectedTransaction, purchaseInvoices])

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

      // Delete purchase invoice items first (foreign key constraint)
      const { error: purchaseItemsError } = await supabase
        .from('purchase_invoice_items')
        .delete()
        .eq('purchase_invoice_id', invoiceToDelete.id)

      if (purchaseItemsError) {
        console.error('Error deleting purchase invoice items:', purchaseItemsError)
        throw purchaseItemsError
      }

      // Delete the purchase invoice
      const { error: purchaseError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoiceToDelete.id)

      if (purchaseError) {
        console.error('Error deleting purchase invoice:', purchaseError)
        throw purchaseError
      }

      // Close modal and reset state
      setShowDeleteModal(false)
      setInvoiceToDelete(null)
      
      // Refresh data (real-time will handle it but this ensures immediate update)
      fetchPurchaseInvoices()
      
      // Reset selected transaction if needed
      if (selectedTransaction >= purchaseInvoices.length - 1) {
        setSelectedTransaction(Math.max(0, purchaseInvoices.length - 2))
      }

    } catch (error) {
      console.error('Error deleting purchase invoice:', error)
      // You could add a toast notification here for error feedback
    } finally {
      setIsDeleting(false)
    }
  }

  // Print receipt function for supplier invoice
  const printReceipt = async (invoice: any, items: any[]) => {
    if (!invoice || items.length === 0) {
      alert('لا توجد بيانات للطباعة')
      return
    }

    // Get branch info
    const { data: branchData } = await supabase
      .from('branches')
      .select('name, phone')
      .limit(1)
      .single()

    const logoUrl = window.location.origin + '/assets/logo/Hegazy.png'

    const receiptContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة شراء رقم ${invoice.invoice_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; font-size: 13px; line-height: 1.3; color: #000; background: white; width: 100%; }
            .receipt-header { text-align: center; margin-bottom: 5px; padding: 0 2px; }
            .company-logo { width: 60px; height: auto; margin: 0 auto 4px auto; display: block; }
            .company-name { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
            .receipt-date { font-size: 11px; margin-bottom: 1px; }
            .receipt-phone { font-size: 10px; }
            .supplier-info { margin: 10px 20px; padding: 8px; border: 1px dashed #333; background-color: #f9f9f9; }
            .supplier-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
            .supplier-label { font-weight: 600; color: #333; }
            .items-table { width: calc(100% - 40px); border-collapse: collapse; margin: 3px 20px; border: 1px solid #000; }
            .items-table th, .items-table td { border: 1px solid #000; padding: 7px; text-align: center; font-size: 14px; }
            .items-table th { background-color: #f5f5f5; font-weight: 600; }
            .item-name { text-align: right !important; padding-right: 12px !important; font-weight: bold; }
            .total-row { border-top: 2px solid #000; font-weight: 700; }
            .total-debt { margin: 10px 20px; padding: 8px; border: 1px solid #000; background-color: #f5f5f5; text-align: center; font-weight: 600; font-size: 14px; }
            .footer { text-align: center; margin-top: 8px; font-size: 9px; border-top: 1px solid #000; padding: 3px 2px 0 2px; }
            .no-print { text-align: center; margin-top: 20px; }
            .no-print button { padding: 10px 20px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; margin: 0 5px; }
            @media print { @page { size: 80mm auto; margin: 0; } body { width: 80mm !important; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <img src="${logoUrl}" alt="El Farouk Group" class="company-logo" onerror="this.style.display='none'" />
            <div class="company-name">El Farouk Group</div>
            <div class="receipt-date">${new Date(invoice.created_at).toLocaleDateString('ar-EG')} - ${new Date(invoice.created_at).toLocaleDateString('en-US')}</div>
            <div class="receipt-phone">${branchData?.phone || '01102862856'}</div>
          </div>

          <div class="supplier-info">
            <div class="supplier-row"><span class="supplier-label">المورد:</span> <span>${supplier?.name || '-'}</span></div>
            <div class="supplier-row"><span class="supplier-label">الهاتف:</span> <span>${supplier?.phone || '-'}</span></div>
            <div class="supplier-row"><span class="supplier-label">رقم الفاتورة:</span> <span>${invoice.invoice_number}</span></div>
          </div>

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
                  <td>${(item.unit_purchase_price || 0).toFixed(0)}</td>
                  <td>${((item.unit_purchase_price || 0) * item.quantity).toFixed(0)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td class="item-name">-</td>
                <td>${items.length}</td>
                <td>= اجمالي =</td>
                <td>${Math.abs(invoice.total_amount).toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-debt">
            رصيد المورد: ${formatPrice(supplierBalance)}
          </div>

          <div class="footer">
            ${new Date(invoice.created_at).toLocaleDateString('en-GB')} ${invoice.time || ''}
          </div>

          <div class="no-print">
            <button onclick="window.print()" style="background: #007bff; color: white;">طباعة</button>
            <button onclick="window.close()" style="background: #6c757d; color: white;">إغلاق</button>
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

  // Print A4 Invoice function - Professional supplier invoice
  const printA4Invoice = async (invoice: any, items: any[]) => {
    if (!invoice || items.length === 0) {
      alert('لا توجد بيانات للطباعة')
      return
    }

    // Get branch info
    const { data: branchData } = await supabase
      .from('branches')
      .select('name, phone, address')
      .limit(1)
      .single()

    const logoUrl = window.location.origin + '/assets/logo/Hegazy.png'
    const currentDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_purchase_price), 0)
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
    const total = Math.abs(invoice.total_amount)

    const a4InvoiceContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة شراء رقم ${invoice.invoice_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Cairo', 'Arial', sans-serif; font-size: 14px; line-height: 1.6; color: #333; background: white; padding: 20px; }
            .invoice-container { max-width: 800px; margin: 0 auto; border: 2px solid #059669; border-radius: 10px; overflow: hidden; }
            .invoice-header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 25px; display: flex; justify-content: space-between; align-items: center; }
            .company-info { text-align: right; }
            .company-logo { width: 80px; height: auto; filter: brightness(0) invert(1); }
            .company-name { font-size: 28px; font-weight: 700; margin-bottom: 5px; }
            .company-details { font-size: 12px; opacity: 0.9; }
            .invoice-title { text-align: center; padding: 15px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
            .invoice-title h2 { font-size: 22px; color: #059669; margin-bottom: 5px; }
            .invoice-number { font-size: 16px; color: #64748b; }
            .invoice-body { padding: 25px; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 25px; gap: 20px; }
            .info-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .info-box h4 { color: #059669; font-size: 14px; margin-bottom: 10px; border-bottom: 2px solid #10b981; padding-bottom: 5px; }
            .info-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
            .info-label { color: #64748b; }
            .info-value { font-weight: 600; color: #1e293b; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .items-table th { background: #059669; color: white; padding: 12px 10px; text-align: center; font-size: 13px; font-weight: 600; }
            .items-table th:first-child { border-radius: 0 8px 0 0; }
            .items-table th:last-child { border-radius: 8px 0 0 0; }
            .items-table td { padding: 12px 10px; text-align: center; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .items-table tr:nth-child(even) { background: #f8fafc; }
            .items-table tr:hover { background: #d1fae5; }
            .product-name { text-align: right !important; font-weight: 500; }
            .totals-section { display: flex; justify-content: flex-start; margin-top: 20px; }
            .totals-box { width: 300px; background: #f8fafc; border: 2px solid #059669; border-radius: 8px; overflow: hidden; }
            .total-row { display: flex; justify-content: space-between; padding: 10px 15px; border-bottom: 1px solid #e2e8f0; }
            .total-row:last-child { border-bottom: none; background: #059669; color: white; font-size: 16px; font-weight: 700; }
            .supplier-balance { margin-top: 20px; padding: 15px; background: ${supplierBalance > 0 ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${supplierBalance > 0 ? '#ef4444' : '#22c55e'}; border-radius: 8px; text-align: center; }
            .balance-label { font-size: 14px; color: #64748b; margin-bottom: 5px; }
            .balance-amount { font-size: 24px; font-weight: 700; color: ${supplierBalance > 0 ? '#dc2626' : '#16a34a'}; }
            .invoice-footer { background: #f8fafc; padding: 20px; text-align: center; border-top: 2px solid #e2e8f0; }
            .footer-text { font-size: 12px; color: #64748b; margin-bottom: 5px; }
            .thank-you { font-size: 16px; font-weight: 600; color: #059669; }
            .no-print { margin-top: 30px; text-align: center; }
            .no-print button { padding: 12px 30px; font-size: 16px; border: none; border-radius: 8px; cursor: pointer; margin: 0 5px; font-family: 'Cairo', sans-serif; transition: all 0.3s; }
            .btn-print { background: #059669; color: white; }
            .btn-print:hover { background: #047857; }
            .btn-close { background: #64748b; color: white; }
            .btn-close:hover { background: #475569; }
            @media print { @page { size: A4; margin: 10mm; } body { padding: 0; } .no-print { display: none; } .invoice-container { border: none; } }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div class="company-info">
                <div class="company-name">El Farouk Group</div>
                <div class="company-details">${branchData?.name || 'الفرع الرئيسي'}<br>${branchData?.phone || '01102862856'}</div>
              </div>
              <img src="${logoUrl}" alt="Logo" class="company-logo" onerror="this.style.display='none'" />
            </div>

            <div class="invoice-title">
              <h2>${invoice.invoice_type === 'Purchase Return' ? 'فاتورة مرتجع شراء' : 'فاتورة شراء'}</h2>
              <div class="invoice-number">رقم الفاتورة: ${invoice.invoice_number}</div>
            </div>

            <div class="invoice-body">
              <div class="info-section">
                <div class="info-box">
                  <h4>معلومات المورد</h4>
                  <div class="info-row"><span class="info-label">اسم المورد:</span><span class="info-value">${supplier?.name || '-'}</span></div>
                  <div class="info-row"><span class="info-label">رقم الهاتف:</span><span class="info-value">${supplier?.phone || '-'}</span></div>
                  <div class="info-row"><span class="info-label">العنوان:</span><span class="info-value">${supplier?.address || '-'}</span></div>
                </div>
                <div class="info-box">
                  <h4>معلومات الفاتورة</h4>
                  <div class="info-row"><span class="info-label">تاريخ الفاتورة:</span><span class="info-value">${new Date(invoice.created_at).toLocaleDateString('ar-EG')}</span></div>
                  <div class="info-row"><span class="info-label">الوقت:</span><span class="info-value">${invoice.time || new Date(invoice.created_at).toLocaleTimeString('ar-EG')}</span></div>
                  <div class="info-row"><span class="info-label">نوع الفاتورة:</span><span class="info-value">${invoice.invoice_type === 'Purchase Return' ? 'مرتجع شراء' : 'فاتورة شراء'}</span></div>
                </div>
              </div>

              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 5%">#</th>
                    <th style="width: 35%">اسم المنتج</th>
                    <th style="width: 12%">المجموعة</th>
                    <th style="width: 10%">الكمية</th>
                    <th style="width: 13%">السعر</th>
                    <th style="width: 10%">الخصم</th>
                    <th style="width: 15%">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((item, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td class="product-name">${item.product?.name || 'منتج'}</td>
                      <td>${item.product?.category?.name || '-'}</td>
                      <td>${item.quantity}</td>
                      <td>${formatPrice(item.unit_purchase_price)}</td>
                      <td>${item.discount_amount ? formatPrice(item.discount_amount) : '-'}</td>
                      <td>${formatPrice((item.quantity * item.unit_purchase_price) - (item.discount_amount || 0))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="totals-box">
                  <div class="total-row"><span>المجموع الفرعي:</span><span>${formatPrice(subtotal)}</span></div>
                  ${totalDiscount > 0 ? `<div class="total-row"><span>إجمالي الخصم:</span><span style="color: #dc2626;">-${formatPrice(totalDiscount)}</span></div>` : ''}
                  <div class="total-row"><span>الإجمالي النهائي:</span><span>${formatPrice(total)}</span></div>
                </div>
              </div>

              <div class="supplier-balance">
                <div class="balance-label">رصيد المورد الحالي</div>
                <div class="balance-amount">${formatPrice(supplierBalance)}</div>
              </div>
            </div>

            <div class="invoice-footer">
              <div class="footer-text">تاريخ الطباعة: ${currentDate}</div>
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
  const saveDocument = async (invoice: any, items: any[], format: 'pdf' | 'png') => {
    if (!invoice || items.length === 0) {
      alert('لا توجد بيانات للحفظ')
      return
    }

    if (format === 'pdf') {
      // Generate the A4 invoice and use browser's print to PDF
      const { data: branchData } = await supabase
        .from('branches')
        .select('name, phone, address')
        .limit(1)
        .single()

      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_purchase_price), 0)
      const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
      const total = Math.abs(invoice.total_amount)

      const pdfContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <title>فاتورة شراء رقم ${invoice.invoice_number} - PDF</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Cairo', sans-serif; padding: 20px; background: white; }
              .invoice-container { max-width: 800px; margin: 0 auto; border: 2px solid #059669; border-radius: 10px; }
              .invoice-header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 25px; display: flex; justify-content: space-between; align-items: center; }
              .company-name { font-size: 28px; font-weight: 700; }
              .company-details { font-size: 12px; opacity: 0.9; }
              .invoice-title { text-align: center; padding: 15px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
              .invoice-title h2 { font-size: 22px; color: #059669; }
              .invoice-number { font-size: 16px; color: #64748b; }
              .invoice-body { padding: 25px; }
              .info-section { display: flex; gap: 20px; margin-bottom: 25px; }
              .info-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
              .info-box h4 { color: #059669; margin-bottom: 10px; border-bottom: 2px solid #10b981; padding-bottom: 5px; }
              .info-row { display: flex; justify-content: space-between; padding: 5px 0; }
              .info-label { color: #64748b; }
              .info-value { font-weight: 600; }
              .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
              .items-table th { background: #059669; color: white; padding: 12px; text-align: center; }
              .items-table td { padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; }
              .items-table tr:nth-child(even) { background: #f8fafc; }
              .product-name { text-align: right !important; }
              .totals-box { width: 300px; background: #f8fafc; border: 2px solid #059669; border-radius: 8px; }
              .total-row { display: flex; justify-content: space-between; padding: 10px 15px; border-bottom: 1px solid #e2e8f0; }
              .total-row:last-child { background: #059669; color: white; font-weight: 700; border-bottom: none; }
              .supplier-balance { margin-top: 20px; padding: 15px; background: ${supplierBalance > 0 ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${supplierBalance > 0 ? '#ef4444' : '#22c55e'}; border-radius: 8px; text-align: center; }
              .balance-amount { font-size: 24px; font-weight: 700; color: ${supplierBalance > 0 ? '#dc2626' : '#16a34a'}; }
              .invoice-footer { background: #f8fafc; padding: 20px; text-align: center; border-top: 2px solid #e2e8f0; }
              .thank-you { font-size: 16px; font-weight: 600; color: #059669; }
              .no-print { margin-top: 30px; text-align: center; }
              .no-print button { padding: 12px 30px; font-size: 16px; border: none; border-radius: 8px; cursor: pointer; margin: 5px; }
              .btn-save { background: #059669; color: white; }
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
                <h2>${invoice.invoice_type === 'Purchase Return' ? 'فاتورة مرتجع شراء' : 'فاتورة شراء'}</h2>
                <div class="invoice-number">رقم الفاتورة: ${invoice.invoice_number}</div>
              </div>
              <div class="invoice-body">
                <div class="info-section">
                  <div class="info-box">
                    <h4>معلومات المورد</h4>
                    <div class="info-row"><span class="info-label">اسم المورد:</span><span class="info-value">${supplier?.name || '-'}</span></div>
                    <div class="info-row"><span class="info-label">رقم الهاتف:</span><span class="info-value">${supplier?.phone || '-'}</span></div>
                    <div class="info-row"><span class="info-label">العنوان:</span><span class="info-value">${supplier?.address || '-'}</span></div>
                  </div>
                  <div class="info-box">
                    <h4>معلومات الفاتورة</h4>
                    <div class="info-row"><span class="info-label">تاريخ الفاتورة:</span><span class="info-value">${new Date(invoice.created_at).toLocaleDateString('ar-EG')}</span></div>
                    <div class="info-row"><span class="info-label">الوقت:</span><span class="info-value">${invoice.time || '-'}</span></div>
                  </div>
                </div>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>اسم المنتج</th>
                      <th>المجموعة</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الخصم</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((item, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td class="product-name">${item.product?.name || 'منتج'}</td>
                        <td>${item.product?.category?.name || '-'}</td>
                        <td>${item.quantity}</td>
                        <td>${formatPrice(item.unit_purchase_price)}</td>
                        <td>${item.discount_amount ? formatPrice(item.discount_amount) : '-'}</td>
                        <td>${formatPrice((item.quantity * item.unit_purchase_price) - (item.discount_amount || 0))}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                <div class="totals-box">
                  <div class="total-row"><span>المجموع الفرعي:</span><span>${formatPrice(subtotal)}</span></div>
                  ${totalDiscount > 0 ? `<div class="total-row"><span>إجمالي الخصم:</span><span>-${formatPrice(totalDiscount)}</span></div>` : ''}
                  <div class="total-row"><span>الإجمالي النهائي:</span><span>${formatPrice(total)}</span></div>
                </div>
                <div class="supplier-balance">
                  <div style="color: #64748b; margin-bottom: 5px;">رصيد المورد الحالي</div>
                  <div class="balance-amount">${formatPrice(supplierBalance)}</div>
                </div>
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
      alert('لحفظ كصورة PNG: استخدم "طباعة A4" ثم اضغط Ctrl+Shift+S في المتصفح لحفظ الصفحة كصورة')
    }

    setShowSaveDropdown(false)
    setShowSaveDropdownStatement(false)
  }

  // Calculate total invoices amount (for all invoices, not filtered by date)
  const [totalInvoicesAmount, setTotalInvoicesAmount] = useState(0)

  // Fetch total invoices amount
  useEffect(() => {
    const fetchTotalInvoicesAmount = async () => {
      if (!supplier?.id) return

      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('total_amount, invoice_type')
        .eq('supplier_id', supplier.id)

      if (!error && data) {
        const total = data.reduce((sum, invoice) => {
          if (invoice.invoice_type === 'Purchase Invoice') {
            return sum + (invoice.total_amount || 0)
          } else if (invoice.invoice_type === 'Purchase Return') {
            return sum - (invoice.total_amount || 0)
          }
          return sum
        }, 0)
        setTotalInvoicesAmount(total)
      }
    }

    if (isOpen && supplier?.id) {
      fetchTotalInvoicesAmount()
    }
  }, [isOpen, supplier?.id])

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false)
    setInvoiceToDelete(null)
  }

  if (!supplier) return null

  // Calculate total payments amount
  const totalPayments = supplierPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0)

  // Calculate average order value
  const averageOrderValue = purchaseInvoices.length > 0
    ? totalInvoicesAmount / purchaseInvoices.length
    : 0

  // Define columns for each table - exactly like RecordDetailsModal structure
  const statementColumns = [
    {
      id: 'index',
      header: '#',
      accessor: 'id',
      width: 50,
      render: (value: any, item: any, index: number) => (
        <span className="text-gray-400">{item.id}</span>
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
      width: 300,
      render: (value: string) => <span className="text-white">{value}</span>
    },
    {
      id: 'type',
      header: 'نوع العملية',
      accessor: 'type',
      width: 120,
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === 'فاتورة شراء'
            ? 'bg-blue-600/20 text-blue-400 border border-blue-600'
            : value === 'دفعة'
            ? 'bg-green-600/20 text-green-400 border border-green-600'
            : value === 'مرتجع شراء'
            ? 'bg-orange-600/20 text-orange-400 border border-orange-600'
            : value === 'سلفة'
            ? 'bg-purple-600/20 text-purple-400 border border-purple-600'
            : 'bg-blue-600/20 text-blue-400 border border-blue-600'
        }`}>
          {value}
        </span>
      )
    },
    {
      id: 'amount',
      header: 'المبلغ',
      accessor: 'amount',
      width: 140,
      render: (value: number, item: any) => {
        const isDafeaa = item.type === 'دفعة'
        const isSalfa = item.type === 'سلفة'
        const isPositive = value > 0
        return (
          <span className={`font-medium ${
            isDafeaa ? 'text-green-400' : isSalfa ? 'text-purple-400' : 'text-blue-400'
          }`}>
            {isPositive ? '+' : '-'}{formatPrice(Math.abs(value))}
          </span>
        )
      }
    },
    {
      id: 'balance',
      header: 'الرصيد',
      accessor: 'displayBalance',
      width: 140,
      render: (value: string) => <span className="text-white font-medium">{value}</span>
    },
    {
      id: 'safe_name',
      header: 'الخزنة',
      accessor: 'safe_name',
      width: 120,
      render: (value: string) => <span className="text-cyan-400">{value || '-'}</span>
    },
    {
      id: 'employee_name',
      header: 'الموظف',
      accessor: 'employee_name',
      width: 120,
      render: (value: string) => <span className="text-yellow-400">{value || '-'}</span>
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
            case 'Purchase Invoice': return 'فاتورة شراء'
            case 'Purchase Return': return 'مرتجع شراء'
            default: return invoiceType || 'غير محدد'
          }
        }
        
        const getInvoiceTypeColor = (invoiceType: string) => {
          switch (invoiceType) {
            case 'Purchase Invoice': return 'bg-blue-900 text-blue-300'
            case 'Purchase Return': return 'bg-yellow-900 text-yellow-300'
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
      id: 'supplier_name', 
      header: 'المورد', 
      accessor: 'supplier.name', 
      width: 150,
      render: (value: string, item: any) => <span className="text-white">{item.supplier?.name || 'غير محدد'}</span>
    },
    { 
      id: 'supplier_phone', 
      header: 'الهاتف', 
      accessor: 'supplier.phone', 
      width: 150,
      render: (value: string, item: any) => <span className="text-gray-300 font-mono text-sm">{item.supplier?.phone || '-'}</span>
    },
    { 
      id: 'total_amount', 
      header: 'المبلغ الإجمالي', 
      accessor: 'total_amount', 
      width: 150,
      render: (value: number) => <span className="text-green-400 font-medium">{formatPrice(value)}</span>
    },
    {
      id: 'notes',
      header: 'البيان',
      accessor: 'notes',
      width: 200,
      render: (value: string) => <span className="text-gray-400">{value || '-'}</span>
    },
    {
      id: 'safe_name',
      header: 'الخزنة',
      accessor: 'record.name',
      width: 120,
      render: (value: string, item: any) => <span className="text-cyan-400">{item.record?.name || '-'}</span>
    },
    {
      id: 'employee_name',
      header: 'الموظف',
      accessor: 'creator.full_name',
      width: 120,
      render: (value: string, item: any) => <span className="text-yellow-400">{item.creator?.full_name || '-'}</span>
    }
  ]

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
      render: (value: number) => <span className="text-green-400 font-medium">{formatPrice(value)}</span>
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
    },
    {
      id: 'safe_name',
      header: 'الخزنة',
      accessor: 'safe_name',
      width: 120,
      render: (value: string) => <span className="text-cyan-400">{value || '-'}</span>
    },
    {
      id: 'employee_name',
      header: 'الموظف',
      accessor: 'employee_name',
      width: 120,
      render: (value: string, item: any) => <span className="text-yellow-400">{item.employee_name || item.creator?.full_name || '-'}</span>
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
      id: 'unit_purchase_price', 
      header: 'السعر', 
      accessor: 'unit_purchase_price', 
      width: 100,
      render: (value: number) => <span className="text-green-400 font-medium">{formatPrice(value)}</span>
    },
    { 
      id: 'discount_amount', 
      header: 'خصم', 
      accessor: 'discount_amount', 
      width: 80,
      render: (value: number) => <span className="text-red-400 font-medium">{value ? value.toFixed(2) : '0%'}</span>
    },
    { 
      id: 'total', 
      header: 'الإجمالي', 
      accessor: 'total', 
      width: 120,
      render: (value: any, item: any) => {
        const total = (item.quantity * item.unit_purchase_price) - (item.discount_amount || 0)
        return <span className="text-green-400 font-bold">{formatPrice(total)}</span>
      }
    },
    { 
      id: 'notes', 
      header: 'ملاحظات', 
      accessor: 'notes', 
      width: 150,
      render: (value: string) => <span className="text-gray-400">{value || '-'}</span>
    }
  ]

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
          
          {/* Top Navigation - All buttons in one row */}
          <div className="bg-[#374151] border-b border-gray-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                {/* Action Buttons - Same style as customer list */}
                <div className="flex items-center gap-1">
                  <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-colors">
                    <PencilSquareIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">تحرير الفاتورة</span>
                  </button>

                  <button 
                    onClick={() => {
                      if (purchaseInvoices.length > 0 && selectedTransaction < purchaseInvoices.length) {
                        handleDeleteInvoice(purchaseInvoices[selectedTransaction])
                      }
                    }}
                    disabled={purchaseInvoices.length === 0 || selectedTransaction >= purchaseInvoices.length}
                    className="flex flex-col items-center p-2 text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer min-w-[80px] transition-colors"
                  >
                    <TrashIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">حذف الفاتورة</span>
                  </button>

                  <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-colors">
                    <TableCellsIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">إدارة الأعمدة</span>
                  </button>
                </div>

                {/* Tab Navigation - Same row */}
                <div className="flex gap-2">
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
                  <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`px-6 py-3 text-base font-semibold border-b-2 rounded-t-lg transition-all duration-200 ${
                      activeTab === 'invoices' 
                        ? 'text-blue-400 border-blue-400 bg-blue-600/10' 
                        : 'text-gray-300 hover:text-white border-transparent hover:border-gray-400 hover:bg-gray-600/20'
                    }`}
                  >
                    فواتير المورد ({purchaseInvoices.length})
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
                      title="عرض فواتير المورد فقط"
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

          <div className="flex flex-1 min-h-0" ref={containerRef}>
            {/* Toggle Button - Flat design on the edge */}
            <div className="flex">
              <button
                onClick={() => setShowSupplierDetails(!showSupplierDetails)}
                className="w-6 bg-[#374151] hover:bg-[#4B5563] border-r border-gray-600 flex items-center justify-center transition-colors duration-200"
                title={showSupplierDetails ? 'إخفاء تفاصيل المورد' : 'إظهار تفاصيل المورد'}
              >
                {showSupplierDetails ? (
                  <ChevronRightIcon className="h-4 w-4 text-gray-300" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4 text-gray-300" />
                )}
              </button>
            </div>

            {/* Right Sidebar - Supplier Info (First in RTL) */}
            {showSupplierDetails && (
              <div className="w-80 bg-[#3B4754] border-l border-gray-600 flex flex-col">
                
                {/* Supplier Balance */}
                <div className="p-4 border-b border-gray-600">
                  <div className="bg-blue-600 rounded p-4 text-center">
                    <div className="text-2xl font-bold text-white">{formatPrice(supplierBalance)}</div>
                    <div className="text-blue-200 text-sm">رصيد المورد</div>
                  </div>
                </div>

                {/* Supplier Details */}
                <div className="p-4 space-y-4 flex-1">
                  <h3 className="text-white font-medium text-lg text-right">معلومات المورد</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white">{supplier.name || 'شركة المعدات التقنية'}</span>
                    <span className="text-gray-400 text-sm">اسم المورد</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-white">{supplier.address || '23626125215'}</span>
                    <span className="text-gray-400 text-sm">رقم الهاتف</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-white">المنطقة الوسطى</span>
                    <span className="text-gray-400 text-sm">المنطقة</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-white">6/24/2025</span>
                    <span className="text-gray-400 text-sm">تاريخ التسجيل</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-400 flex items-center gap-1">
                      <span>Premium</span>
                      <span>⭐</span>
                    </span>
                    <span className="text-gray-400 text-sm">الرتبة</span>
                  </div>
                </div>
              </div>

              {/* Supplier Statistics */}
              <div className="p-4 border-t border-gray-600">
                <h4 className="text-white font-medium mb-3 text-right flex items-center gap-2">
                  <span>📊</span>
                  <span>إحصائيات المورد</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white">{purchaseInvoices.length}</span>
                    <span className="text-gray-400 text-sm">عدد الفواتير</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-400">{formatPrice(totalInvoicesAmount)}</span>
                    <span className="text-gray-400 text-sm">إجمالي الفواتير</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-400">{formatPrice(totalPayments)}</span>
                    <span className="text-gray-400 text-sm">إجمالي الدفعات</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white">{formatPrice(averageOrderValue)}</span>
                    <span className="text-gray-400 text-sm">متوسط قيمة الطلبية</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white">
                      {purchaseInvoices.length > 0
                        ? new Date(purchaseInvoices[0].created_at).toLocaleDateString('en-GB')
                        : '-'
                      }
                    </span>
                    <span className="text-gray-400 text-sm">آخر فاتورة</span>
                  </div>
                </div>
              </div>

              {/* Date Filter Button */}
              <div className="p-4 border-t border-gray-600">
                <button
                  onClick={() => setShowDateFilter(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <CalendarDaysIcon className="h-5 w-5" />
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
              <div className="bg-[#374151] border-b border-gray-600 p-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ابحث عن فاتورة (رقم الفاتورة، اسم المورد، أو الهاتف)..."
                    className="w-full pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Conditional Content Based on Active Tab and View Mode */}
              <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {activeTab === 'statement' && (
                  <div className="h-full flex flex-col">
                    {showStatementInvoiceDetails ? (
                      <div className="flex flex-col h-full bg-[#1F2937]">
                        {/* Top Bar with Back Button and Print Actions */}
                        <div className="bg-[#2B3544] border-b border-gray-600 px-4 py-2 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setShowStatementInvoiceDetails(false)
                              setSelectedStatementInvoice(null)
                              setStatementInvoiceItems([])
                            }}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors text-sm"
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                            <span>العودة</span>
                          </button>
                          <div className="flex items-center gap-2">
                            {/* Print Receipt Button */}
                            <button
                              onClick={() => printReceipt(selectedStatementInvoice, statementInvoiceItems)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                              disabled={isLoadingStatementInvoiceItems || statementInvoiceItems.length === 0}
                            >
                              <PrinterIcon className="h-4 w-4" />
                              ريسيت
                            </button>

                            {/* Print A4 Invoice Button */}
                            <button
                              onClick={() => printA4Invoice(selectedStatementInvoice, statementInvoiceItems)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                              disabled={isLoadingStatementInvoiceItems || statementInvoiceItems.length === 0}
                            >
                              <DocumentIcon className="h-4 w-4" />
                              A4
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

                        {/* Navigation Bar with Invoice Number */}
                        <div className="bg-[#374151] border-b border-gray-600 px-4 py-3 flex items-center justify-center gap-4">
                          {/* Previous Button */}
                          <button
                            onClick={navigateToPreviousInvoice}
                            disabled={currentInvoiceIndex === 0 || isLoadingStatementInvoiceItems}
                            className={`p-2 rounded-lg transition-colors ${
                              currentInvoiceIndex === 0
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <ChevronRightIcon className="h-5 w-5" />
                          </button>

                          {/* Invoice Number Display */}
                          <div className="flex items-center gap-3 bg-[#2B3544] px-6 py-2 rounded-lg border border-gray-600">
                            <span className="text-gray-400 text-sm">فاتورة رقم</span>
                            <span className="text-white font-bold text-xl">
                              {selectedStatementInvoice?.invoice_number?.replace('PUR-', '').split('-')[0] || '---'}
                            </span>
                            <span className="text-gray-500 text-xs">
                              ({currentInvoiceIndex + 1} من {invoiceStatements.length})
                            </span>
                          </div>

                          {/* Next Button */}
                          <button
                            onClick={navigateToNextInvoice}
                            disabled={currentInvoiceIndex >= invoiceStatements.length - 1 || isLoadingStatementInvoiceItems}
                            className={`p-2 rounded-lg transition-colors ${
                              currentInvoiceIndex >= invoiceStatements.length - 1
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <ChevronLeftIcon className="h-5 w-5" />
                          </button>
                        </div>

                        {/* Invoice Info Header */}
                        <div className="bg-[#2B3544] border-b border-gray-600 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className={`px-3 py-1 rounded text-sm font-medium ${
                                selectedStatementInvoice?.invoice_type === 'Purchase Return' || selectedStatementInvoice?.invoice_type === 'مرتجع شراء'
                                  ? 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
                                  : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                              }`}>
                                {selectedStatementInvoice?.invoice_type === 'Purchase Return' ? 'مرتجع شراء' :
                                 selectedStatementInvoice?.invoice_type === 'Purchase Invoice' ? 'فاتورة شراء' :
                                 selectedStatementInvoice?.invoice_type || 'فاتورة'}
                              </span>
                              <span className="text-gray-300 text-sm">
                                {selectedStatementInvoice?.created_at
                                  ? new Date(selectedStatementInvoice.created_at).toLocaleDateString('ar-EG', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'numeric',
                                      day: 'numeric'
                                    })
                                  : '---'}
                              </span>
                            </div>
                            <div className="text-white font-medium">
                              {supplier?.name || '---'}
                            </div>
                          </div>
                        </div>

                        {/* Invoice Items Table */}
                        <div className="flex-1 overflow-hidden">
                          {isLoadingStatementInvoiceItems ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                              <span className="text-gray-400">جاري تحميل تفاصيل الفاتورة...</span>
                            </div>
                          ) : (
                            <div className="h-full overflow-y-auto scrollbar-hide">
                              <table className="w-full">
                                <thead className="bg-[#374151] sticky top-0">
                                  <tr>
                                    <th className="px-4 py-3 text-right text-gray-300 font-medium text-sm border-b border-gray-600 w-12">م</th>
                                    <th className="px-4 py-3 text-right text-gray-300 font-medium text-sm border-b border-gray-600">الصنف</th>
                                    <th className="px-4 py-3 text-center text-gray-300 font-medium text-sm border-b border-gray-600 w-24">الكمية</th>
                                    <th className="px-4 py-3 text-center text-gray-300 font-medium text-sm border-b border-gray-600 w-28">سعر</th>
                                    <th className="px-4 py-3 text-center text-gray-300 font-medium text-sm border-b border-gray-600 w-28">قيمة</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {statementInvoiceItems.map((item, index) => (
                                    <tr key={item.id} className="border-b border-gray-700 hover:bg-[#374151]/50">
                                      <td className="px-4 py-3 text-blue-400 font-medium text-sm">{index + 1}</td>
                                      <td className="px-4 py-3 text-blue-400 font-medium text-sm">
                                        {item.product?.name || 'منتج غير معروف'}
                                      </td>
                                      <td className="px-4 py-3 text-center text-white text-sm">
                                        {Math.abs(item.quantity)}
                                      </td>
                                      <td className="px-4 py-3 text-center text-white text-sm">
                                        {formatPrice(item.unit_price)}
                                      </td>
                                      <td className="px-4 py-3 text-center text-white text-sm">
                                        {formatPrice(Math.abs(item.quantity) * item.unit_price)}
                                      </td>
                                    </tr>
                                  ))}
                                  {/* Totals Row */}
                                  <tr className="bg-[#374151] border-t-2 border-blue-500">
                                    <td colSpan={2} className="px-4 py-3 text-left text-blue-400 font-bold text-sm">
                                      - = اجمالي = -
                                    </td>
                                    <td className="px-4 py-3 text-center text-blue-400 font-bold text-sm">
                                      {statementInvoiceItems.reduce((sum, item) => sum + Math.abs(item.quantity), 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-white text-sm"></td>
                                    <td className="px-4 py-3 text-center text-blue-400 font-bold text-sm">
                                      {formatPrice(Math.abs(selectedStatementInvoice?.total_amount || 0))}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Invoice Info Footer */}
                        <div className="bg-[#2B3544] border-t border-gray-600 p-4">
                          <div className="grid grid-cols-6 gap-4 text-sm">
                            <div className="flex flex-col items-center bg-[#374151] rounded-lg p-3 border border-gray-600">
                              <span className="text-gray-400 mb-1">الاجمالي</span>
                              <span className="text-white font-bold">
                                {formatPrice(Math.abs(selectedStatementInvoice?.total_amount || 0))}
                              </span>
                            </div>
                            <div className="flex flex-col items-center bg-[#374151] rounded-lg p-3 border border-gray-600">
                              <span className="text-gray-400 mb-1">الخصم</span>
                              <span className="text-white font-bold">
                                {formatPrice(selectedStatementInvoice?.discount_amount || 0)}
                              </span>
                            </div>
                            <div className="flex flex-col items-center bg-[#374151] rounded-lg p-3 border border-gray-600">
                              <span className="text-gray-400 mb-1">ضريبة</span>
                              <span className="text-white font-bold">
                                {formatPrice(selectedStatementInvoice?.tax_amount || 0)}
                              </span>
                            </div>
                            <div className="flex flex-col items-center bg-[#374151] rounded-lg p-3 border border-gray-600">
                              <span className="text-gray-400 mb-1">المدفوع</span>
                              <span className="text-green-400 font-bold">
                                {formatPrice(Math.abs(selectedStatementInvoice?.total_amount || 0))}
                              </span>
                            </div>
                            <div className="flex flex-col items-center bg-[#374151] rounded-lg p-3 border border-gray-600">
                              <span className="text-gray-400 mb-1">آجل</span>
                              <span className="text-orange-400 font-bold">
                                {formatPrice(0)}
                              </span>
                            </div>
                            <div className="flex flex-col items-center bg-[#374151] rounded-lg p-3 border border-gray-600">
                              <span className="text-gray-400 mb-1">الرصيد</span>
                              <span className={`font-bold ${supplierBalance >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {formatPrice(Math.abs(supplierBalance))}
                              </span>
                            </div>
                          </div>

                          {/* Notes and Employee Info */}
                          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                            <div className="flex items-center gap-2">
                              <span>الملاحظات:</span>
                              <span className="text-gray-300">{selectedStatementInvoice?.notes || '---'}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span>
                                TIME: {selectedStatementInvoice?.created_at
                                  ? new Date(selectedStatementInvoice.created_at).toLocaleDateString('en-GB')
                                  : '---'} {selectedStatementInvoice?.time || ''}
                              </span>
                              <span>
                                by: {(selectedStatementInvoice as any)?.creator?.full_name || 'system'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {isLoadingStatements ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                            <span className="text-gray-400">جاري تحميل كشف الحساب...</span>
                          </div>
                        ) : accountStatements.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-gray-400">لا توجد عمليات في كشف الحساب</span>
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
                      {isLoadingInvoices ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                          <span className="text-gray-400">جاري تحميل الفواتير...</span>
                        </div>
                      ) : (
                        <ResizableTable
                          className="h-full w-full"
                          columns={invoiceColumns}
                          data={purchaseInvoices}
                          selectedRowId={purchaseInvoices[selectedTransaction]?.id?.toString() || null}
                          onRowClick={(invoice: any, index: number) => setSelectedTransaction(index)}
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
                            onClick={() => printReceipt(purchaseInvoices[selectedTransaction], purchaseInvoiceItems)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                            disabled={isLoadingItems || purchaseInvoiceItems.length === 0}
                          >
                            <PrinterIcon className="h-4 w-4" />
                            طباعة الريسيت
                          </button>

                          {/* Print A4 Invoice Button */}
                          <button
                            onClick={() => printA4Invoice(purchaseInvoices[selectedTransaction], purchaseInvoiceItems)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                            disabled={isLoadingItems || purchaseInvoiceItems.length === 0}
                          >
                            <DocumentIcon className="h-4 w-4" />
                            طباعة A4
                          </button>

                          {/* Save Dropdown Button */}
                          <div className="relative" ref={saveDropdownRef}>
                            <button
                              onClick={() => setShowSaveDropdown(!showSaveDropdown)}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                              disabled={isLoadingItems || purchaseInvoiceItems.length === 0}
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              حفظ
                            </button>

                            {/* Dropdown Menu */}
                            {showSaveDropdown && (
                              <div className="absolute top-full left-0 mt-1 bg-[#374151] border border-gray-600 rounded-lg shadow-xl z-50 min-w-[140px]">
                                <button
                                  onClick={() => saveDocument(purchaseInvoices[selectedTransaction], purchaseInvoiceItems, 'pdf')}
                                  className="w-full px-4 py-2 text-right text-white hover:bg-gray-600 flex items-center gap-2 rounded-t-lg transition-colors"
                                >
                                  <DocumentArrowDownIcon className="h-4 w-4 text-red-400" />
                                  <span>PDF</span>
                                </button>
                                <button
                                  onClick={() => saveDocument(purchaseInvoices[selectedTransaction], purchaseInvoiceItems, 'png')}
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
                          تفاصيل الفاتورة {purchaseInvoices[selectedTransaction]?.invoice_number || ''}
                        </h3>
                      </div>

                      <div className="flex-1 min-h-0 px-4 pb-4">
                        {isLoadingItems ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                            <span className="text-gray-400">جاري تحميل العناصر...</span>
                          </div>
                        ) : (
                          <ResizableTable
                            className="h-full w-full"
                            columns={invoiceDetailsColumns}
                            data={purchaseInvoiceItems}
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
                            onClick={() => setShowAddPaymentModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                          >
                            <PlusIcon className="h-4 w-4" />
                            إضافة دفعة
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-white text-lg font-medium">دفعات المورد</div>
                          <div className="text-gray-400 text-sm mt-1">إجمالي الدفعات: {formatPrice(totalPayments)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Payments Table */}
                    <div className="flex-1">
                      {isLoadingPayments ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                          <span className="text-gray-400">جاري تحميل الدفعات...</span>
                        </div>
                      ) : supplierPayments.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-400">لا توجد دفعات مسجلة</span>
                        </div>
                      ) : (
                        <ResizableTable
                          className="h-full w-full"
                          columns={paymentsColumns}
                          data={supplierPayments}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDeleteInvoice}
        isDeleting={isDeleting}
        title="تأكيد حذف فاتورة الشراء"
        message="هل أنت متأكد أنك تريد حذف هذه فاتورة الشراء؟"
        itemName={invoiceToDelete ? `فاتورة شراء رقم: ${invoiceToDelete.invoice_number}` : ''}
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
        entityId={supplier.id}
        entityType="supplier"
        entityName={supplier.name}
        currentBalance={supplierBalance}
        onPaymentAdded={() => {
          fetchSupplierPayments()
          fetchSupplierBalance()
        }}
      />
    </>
  )
}