'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, PencilSquareIcon, TrashIcon, TableCellsIcon, CalendarDaysIcon, PrinterIcon } from '@heroicons/react/24/outline'
import ResizableTable from './tables/ResizableTable'
import { supabase } from '../lib/supabase/client'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import SimpleDateFilterModal, { DateFilter } from './SimpleDateFilterModal'
import { useFormatPrice } from '@/lib/hooks/useCurrency'

interface SafeDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  safe: any
}

type ViewMode = 'split' | 'safes-only' | 'details-only'

export default function SafeDetailsModal({ isOpen, onClose, safe }: SafeDetailsModalProps) {
  const formatPrice = useFormatPrice();
  const [selectedTransaction, setSelectedTransaction] = useState(0) // First row selected (index 0)
  const [showSafeDetails, setShowSafeDetails] = useState(true)
  const [activeTab, setActiveTab] = useState('transactions') // 'transactions', 'payments', 'statement'
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [dividerPosition, setDividerPosition] = useState(50) // Percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Real-time state for sales and sale items
  const [sales, setSales] = useState<any[]>([])
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  // Real-time state for purchase invoices and purchase invoice items
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([])
  const [purchaseInvoiceItems, setPurchaseInvoiceItems] = useState<any[]>([])
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false)
  const [isLoadingPurchaseItems, setIsLoadingPurchaseItems] = useState(false)

  // Cash drawer balance (actual paid amounts, not invoice totals)
  const [cashDrawerBalance, setCashDrawerBalance] = useState<number>(0)

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'today' })
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState<string>('')
  const [withdrawType, setWithdrawType] = useState<'withdraw' | 'transfer' | 'deposit'>('withdraw')
  const [targetSafeId, setTargetSafeId] = useState<string>('')
  const [allSafes, setAllSafes] = useState<any[]>([])
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawNotes, setWithdrawNotes] = useState('')

  // Account statement state
  const [accountStatementData, setAccountStatementData] = useState<any[]>([])
  const [isLoadingStatement, setIsLoadingStatement] = useState(false)

  // Transfers state (deposits and withdrawals from cash_drawer_transactions)
  const [transfers, setTransfers] = useState<any[]>([])
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(false)

  // Paid amounts mapped by sale_id or purchase_invoice_id
  const [paidAmounts, setPaidAmounts] = useState<Record<string, number>>({})

  // The safe balance is the actual cash drawer balance (paid amounts, not invoice totals)
  // This is fetched from the cash_drawers table
  const safeBalance = cashDrawerBalance

  // Load date filter preferences from database
  const loadDateFilterPreferences = async () => {
    if (!safe?.id) return

    try {
      const { data, error } = await (supabase as any)
        .from('user_column_preferences')
        .select('preferences')
        .eq('user_id', 'default_user') // You can replace with actual user_id from auth
        .eq('table_name', `record_${safe.id}_date_filter`)
        .single()

      if (!error && data?.preferences) {
        const savedFilter = data.preferences as unknown as DateFilter
        setDateFilter(savedFilter)
      }
    } catch (error) {
      console.error('Error loading date filter preferences:', error)
    } finally {
      setIsLoadingPreferences(false)
    }
  }

  // Save date filter preferences to database
  const saveDateFilterPreferences = async (filter: DateFilter) => {
    if (!safe?.id) return

    try {
      const { error } = await (supabase as any)
        .from('user_column_preferences')
        .upsert({
          user_id: 'default_user', // You can replace with actual user_id from auth
          table_name: `record_${safe.id}_date_filter`,
          preferences: filter,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,table_name'
        })

      if (error) {
        console.error('Error saving date filter preferences:', error)
      }
    } catch (error) {
      console.error('Error saving date filter preferences:', error)
    }
  }

  // Load preferences on mount
  useEffect(() => {
    if (isOpen && safe?.id) {
      loadDateFilterPreferences()
    }

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [isOpen, safe?.id])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (viewMode !== 'split' || activeTab !== 'transactions') return
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

  // Fetch sales from Supabase for the specific record
  const fetchSales = async () => {
    if (!safe?.id) return
    
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
        .eq('record_id', safe.id)
      
      // Apply date filter
      query = applyDateFilter(query)
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Error fetching sales:', error)
        return
      }
      
      setSales(data || [])

      // Fetch paid amounts for all sales
      if (data && data.length > 0) {
        const saleIds = data.map((s: any) => s.id)
        const { data: transactions } = await supabase
          .from('cash_drawer_transactions')
          .select('sale_id, amount')
          .in('sale_id', saleIds)
          .eq('record_id', safe.id)

        if (transactions) {
          const amounts: Record<string, number> = {}
          transactions.forEach((t: any) => {
            if (t.sale_id) {
              amounts[t.sale_id] = Math.abs(t.amount || 0)
            }
          })
          setPaidAmounts(prev => ({ ...prev, ...amounts }))
        }

        setSelectedTransaction(0)
        fetchSaleItems(data[0].id)
      }

    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setIsLoadingSales(false)
    }
  }

  // Fetch cash drawer balance (actual paid amounts)
  const fetchCashDrawerBalance = async () => {
    if (!safe?.id) return

    try {
      // Try to get the cash drawer for this safe/record
      const { data: drawer, error } = await supabase
        .from('cash_drawers')
        .select('current_balance')
        .eq('record_id', safe.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching cash drawer balance:', error)
        setCashDrawerBalance(0)
        return
      }

      setCashDrawerBalance(drawer?.current_balance || 0)
    } catch (error) {
      console.error('Error fetching cash drawer balance:', error)
      setCashDrawerBalance(0)
    }
  }

  // Fetch transfers (deposits and withdrawals - not sales)
  const fetchTransfers = async () => {
    if (!safe?.id) return

    try {
      setIsLoadingTransfers(true)

      // Get all non-sale transactions (deposits, withdrawals, adjustments)
      let query = supabase
        .from('cash_drawer_transactions')
        .select('id, amount, transaction_type, notes, created_at, balance_after')
        .eq('record_id', safe.id)
        .is('sale_id', null) // Only get non-sale transactions

      // Apply date filter
      query = applyDateFilter(query)

      const { data, error } = await query
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching transfers:', error)
        setTransfers([])
        return
      }

      // Format the data for display
      const formattedTransfers = (data || []).map((tx, index) => {
        const createdDate = tx.created_at ? new Date(tx.created_at) : new Date()
        return {
          id: index + 1,
          dbId: tx.id,
          date: createdDate.toLocaleDateString('en-GB'),
          time: createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          amount: tx.amount,
          type: tx.transaction_type,
          notes: tx.notes || '-',
          balance_after: tx.balance_after
        }
      })

      setTransfers(formattedTransfers)
    } catch (error) {
      console.error('Error fetching transfers:', error)
      setTransfers([])
    } finally {
      setIsLoadingTransfers(false)
    }
  }

  // Fetch account statement data from database
  const fetchAccountStatement = async () => {
    if (!safe?.id) return

    try {
      setIsLoadingStatement(true)
      const statements: any[] = []
      let runningBalance = 0

      // 1. Get record info including initial_balance
      const { data: recordData, error: recordError } = await (supabase as any)
        .from('records')
        .select('initial_balance, created_at')
        .eq('id', safe.id)
        .single()

      if (!recordError && recordData) {
        const initialBalance = parseFloat(String(recordData.initial_balance || 0)) || 0
        if (initialBalance > 0) {
          runningBalance = initialBalance
          const createdDate = recordData.created_at ? new Date(recordData.created_at) : new Date()
          statements.push({
            id: 'initial',
            date: createdDate.toLocaleDateString('en-GB'),
            time: createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            description: 'الرصيد الأولي',
            type: 'رصيد أولي',
            paidAmount: initialBalance,
            invoiceValue: 0,
            balance: runningBalance,
            created_at: recordData.created_at || new Date().toISOString()
          })
        }
      }

      // 2. Get all sales for this record (فواتير البيع و مرتجعات البيع)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, invoice_number, total_amount, invoice_type, created_at, time, notes')
        .eq('record_id', safe.id)
        .order('created_at', { ascending: true })

      // 2.5. Get all purchase invoices for this record (فواتير الشراء و مرتجعات الشراء)
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchase_invoices')
        .select('id, invoice_number, total_amount, invoice_type, created_at, time, notes')
        .eq('record_id', safe.id)
        .order('created_at', { ascending: true })

      // 3. Get cash drawer transactions for actual paid amounts
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('cash_drawer_transactions')
        .select('id, sale_id, amount, balance_after, transaction_type, notes, created_at')
        .eq('record_id', safe.id)
        .order('created_at', { ascending: true })

      // Create a map of sale_id to transaction amount
      const saleTransactionMap = new Map()
      if (transactionsData) {
        for (const tx of transactionsData) {
          if (tx.sale_id) {
            saleTransactionMap.set(tx.sale_id, tx.amount)
          }
        }
      }

      // Process sales data
      if (salesData) {
        for (const sale of salesData) {
          const invoiceValue = parseFloat(String(sale.total_amount || 0)) || 0
          const paidAmount = saleTransactionMap.get(sale.id) || invoiceValue // fallback to total if no transaction
          runningBalance += paidAmount

          // Determine type based on invoice_type
          let typeName = 'فاتورة بيع'
          if (sale.invoice_type === 'Sale Return') {
            typeName = 'مرتجع بيع'
          }

          // Check if this is a payment only (دفعة) - payment without goods
          const isPaymentOnly = sale.notes && sale.notes.includes('دفعة')
          if (isPaymentOnly) {
            typeName = 'دفعة'
          }

          const createdDate = sale.created_at ? new Date(sale.created_at) : new Date()
          const timeStr = sale.time ? String(sale.time).substring(0, 5) : createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

          statements.push({
            id: sale.id,
            date: createdDate.toLocaleDateString('en-GB'),
            time: timeStr,
            description: `${typeName} - ${sale.invoice_number}`,
            type: typeName,
            paidAmount: Math.abs(paidAmount),
            invoiceValue: Math.abs(invoiceValue),
            balance: runningBalance,
            created_at: sale.created_at || new Date().toISOString(),
            isPositive: paidAmount >= 0
          })
        }
      }

      // Process purchase invoices data (فواتير الشراء تنقص من الرصيد)
      if (purchaseData) {
        for (const purchase of purchaseData) {
          const invoiceValue = parseFloat(String(purchase.total_amount || 0)) || 0

          // Determine type based on invoice_type
          // Purchase Invoice = money goes out (negative)
          // Purchase Return = money comes back (positive)
          let typeName = 'فاتورة شراء'
          let isPositiveAmount = false
          if (purchase.invoice_type === 'Purchase Return') {
            typeName = 'مرتجع شراء'
            isPositiveAmount = true
          }

          const createdDate = purchase.created_at ? new Date(purchase.created_at) : new Date()
          const timeStr = purchase.time ? String(purchase.time).substring(0, 5) : createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

          statements.push({
            id: purchase.id,
            date: createdDate.toLocaleDateString('en-GB'),
            time: timeStr,
            description: `${typeName} - ${purchase.invoice_number}`,
            type: typeName,
            paidAmount: Math.abs(invoiceValue),
            invoiceValue: Math.abs(invoiceValue),
            balance: runningBalance, // Will be recalculated later
            created_at: purchase.created_at || new Date().toISOString(),
            isPositive: isPositiveAmount
          })
        }
      }

      // Process non-sale transactions (deposits, withdrawals, adjustments)
      if (transactionsData) {
        for (const tx of transactionsData) {
          if (!tx.sale_id) {
            // This is a deposit, withdrawal, or adjustment
            const amount = parseFloat(String(tx.amount || 0)) || 0
            runningBalance += amount

            let typeName = 'دفعة'
            if (tx.transaction_type === 'withdrawal') {
              typeName = 'سحب'
            } else if (tx.transaction_type === 'adjustment') {
              typeName = 'تسوية'
            } else if (tx.transaction_type === 'deposit') {
              typeName = 'دفعة'
            }

            const createdDate = tx.created_at ? new Date(tx.created_at) : new Date()

            statements.push({
              id: tx.id,
              date: createdDate.toLocaleDateString('en-GB'),
              time: createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              description: tx.notes || typeName,
              type: typeName,
              paidAmount: Math.abs(amount),
              invoiceValue: 0,
              balance: runningBalance,
              created_at: tx.created_at || new Date().toISOString(),
              isPositive: amount >= 0
            })
          }
        }
      }

      // Sort by created_at descending (newest first)
      statements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Recalculate running balance from oldest to newest, then reverse for display
      let recalcBalance = 0
      const sortedAsc = [...statements].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      for (const stmt of sortedAsc) {
        if (stmt.type === 'رصيد أولي') {
          recalcBalance = stmt.paidAmount
        } else if (stmt.type === 'مرتجع بيع' || stmt.type === 'سحب' || stmt.type === 'فاتورة شراء') {
          // These decrease the balance (money going out)
          recalcBalance -= stmt.paidAmount
        } else if (stmt.type === 'مرتجع شراء') {
          // Purchase returns increase the balance (money coming back)
          recalcBalance += stmt.paidAmount
        } else {
          // Sales and deposits increase the balance
          recalcBalance += stmt.paidAmount
        }
        stmt.balance = recalcBalance
      }

      // Sort descending for display
      const sortedDesc = sortedAsc.reverse()

      // Apply date filter to final statements
      const getDateRange = () => {
        const now = new Date()
        switch (dateFilter.type) {
          case 'today':
            const startOfDay = new Date(now)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(now)
            endOfDay.setHours(23, 59, 59, 999)
            return { start: startOfDay, end: endOfDay }
          case 'current_week':
            const dayOfWeek = now.getDay()
            const daysToSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1
            const startOfWeek = new Date(now)
            startOfWeek.setDate(now.getDate() - daysToSaturday)
            startOfWeek.setHours(0, 0, 0, 0)
            return { start: startOfWeek, end: now }
          case 'last_week':
            const lastWeekStart = new Date(now)
            lastWeekStart.setDate(now.getDate() - 7 - (now.getDay() === 6 ? 0 : now.getDay() + 1))
            lastWeekStart.setHours(0, 0, 0, 0)
            const lastWeekEnd = new Date(lastWeekStart)
            lastWeekEnd.setDate(lastWeekStart.getDate() + 6)
            lastWeekEnd.setHours(23, 59, 59, 999)
            return { start: lastWeekStart, end: lastWeekEnd }
          case 'current_month':
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            return { start: startOfMonth, end: now }
          case 'last_month':
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
            return { start: lastMonthStart, end: lastMonthEnd }
          case 'custom':
            return {
              start: dateFilter.startDate ? new Date(dateFilter.startDate) : null,
              end: dateFilter.endDate ? new Date(dateFilter.endDate) : null
            }
          case 'all':
          default:
            return { start: null, end: null }
        }
      }

      const dateRange = getDateRange()
      let filteredStatements = sortedDesc

      if (dateRange.start || dateRange.end) {
        filteredStatements = sortedDesc.filter(stmt => {
          const stmtDate = new Date(stmt.created_at)
          if (dateRange.start && stmtDate < dateRange.start) return false
          if (dateRange.end && stmtDate > dateRange.end) return false
          return true
        })
      }

      // Add index to filtered statements
      const finalStatements = filteredStatements.map((stmt, index) => ({
        ...stmt,
        index: index + 1
      }))

      setAccountStatementData(finalStatements)
    } catch (error) {
      console.error('Error fetching account statement:', error)
      setAccountStatementData([])
    } finally {
      setIsLoadingStatement(false)
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
            name,
            barcode,
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

  // Fetch purchase invoices from Supabase for the specific record
  const fetchPurchaseInvoices = async () => {
    if (!safe?.id) return
    
    try {
      setIsLoadingPurchases(true)
      
      let query = supabase
        .from('purchase_invoices')
        .select(`
          id,
          invoice_number,
          supplier_id,
          total_amount,
          payment_status,
          notes,
          created_at,
          time,
          invoice_type,
          supplier:suppliers(
            name,
            phone
          )
        `)
        .eq('record_id', safe.id)
      
      // Apply date filter
      query = applyDateFilter(query)
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Error fetching purchase invoices:', error)
        return
      }
      
      setPurchaseInvoices(data || [])

      // Fetch paid amounts for all purchase invoices
      if (data && data.length > 0) {
        const purchaseIds = data.map((p: any) => p.id)
        const { data: transactions } = await supabase
          .from('cash_drawer_transactions')
          .select('purchase_invoice_id, amount')
          .in('purchase_invoice_id', purchaseIds)
          .eq('record_id', safe.id)

        if (transactions) {
          const amounts: Record<string, number> = {}
          transactions.forEach((t: any) => {
            if (t.purchase_invoice_id) {
              amounts[t.purchase_invoice_id] = Math.abs(t.amount || 0)
            }
          })
          setPaidAmounts(prev => ({ ...prev, ...amounts }))
        }
      }

    } catch (error) {
      console.error('Error fetching purchase invoices:', error)
    } finally {
      setIsLoadingPurchases(false)
    }
  }

  // Fetch purchase invoice items for selected purchase invoice
  const fetchPurchaseInvoiceItems = async (purchaseInvoiceId: string) => {
    try {
      setIsLoadingPurchaseItems(true)
      
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
        .eq('purchase_invoice_id', purchaseInvoiceId)
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
      setIsLoadingPurchaseItems(false)
    }
  }

  // Print receipt function
  const printReceipt = async (transaction: any, items: any[]) => {
    if (!transaction || items.length === 0) {
      alert('لا توجد بيانات للطباعة')
      return
    }

    // Get customer data if it's a sale
    let customerData = null
    let calculatedBalance = 0
    if (transaction.transactionType === 'sale' && transaction.customer_id) {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, address, city')
        .eq('id', transaction.customer_id)
        .single()
      customerData = data

      // Calculate customer balance
      if (customerData && customerData.id !== '00000000-0000-0000-0000-000000000001') {
        const [salesRes, paymentsRes] = await Promise.all([
          supabase.from('sales').select('total_amount').eq('customer_id', customerData.id),
          supabase.from('customer_payments').select('amount').eq('customer_id', customerData.id)
        ])
        const salesTotal = (salesRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0)
        const paymentsTotal = (paymentsRes.data || []).reduce((sum, p) => sum + (p.amount || 0), 0)
        calculatedBalance = salesTotal - paymentsTotal
      }
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

    const isSale = transaction.transactionType === 'sale'
    const isPurchase = transaction.transactionType === 'purchase'
    const showTotalDebt = isSale && customerData && customerData.id !== '00000000-0000-0000-0000-000000000001' && calculatedBalance !== 0
    const logoUrl = window.location.origin + '/assets/logo/El Farouk Group2.png'

    const receiptContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة رقم ${transaction.invoice_number}</title>
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

            .invoice-type {
              font-size: 12px;
              font-weight: 600;
              margin-top: 5px;
              color: ${isPurchase ? '#dc3545' : '#28a745'};
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
            <div class="receipt-date">${new Date(transaction.created_at).toLocaleDateString("ar-EG")} - ${new Date(transaction.created_at).toLocaleDateString("en-US")}</div>
            <div class="receipt-address">${branchData?.name || "الفرع الرئيسي"}</div>
            <div class="receipt-phone">${branchData?.phone || "01102862856"}</div>
            <div class="invoice-type">${isPurchase ? 'فاتورة مشتريات' : (transaction.invoice_type === 'sale_return' ? 'مرتجع مبيعات' : 'فاتورة مبيعات')}</div>
          </div>

          ${customerData && customerData.id !== '00000000-0000-0000-0000-000000000001' && (customerData.name || customerData.phone || customerData.address || customerData.city) ? `
          <div class="customer-info">
            ${customerData.name ? `<div class="customer-row"><span class="customer-label">العميل:</span> <span class="customer-value">${customerData.name}</span></div>` : ''}
            ${customerData.phone ? `<div class="customer-row"><span class="customer-label">الهاتف:</span> <span class="customer-value">${customerData.phone}</span></div>` : ''}
            ${customerData.address ? `<div class="customer-row"><span class="customer-label">العنوان:</span> <span class="customer-value">${customerData.address}</span></div>` : ''}
            ${customerData.city ? `<div class="customer-row"><span class="customer-label">المدينة:</span> <span class="customer-value">${customerData.city}</span></div>` : ''}
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
                  <td>${Math.abs(item.quantity)}</td>
                  <td>${(item.unit_price || 0).toFixed(0)}</td>
                  <td>${Math.abs((item.unit_price || 0) * item.quantity).toFixed(0)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td class="item-name">-</td>
                <td>${items.length}</td>
                <td>= اجمالي =</td>
                <td>${Math.abs(transaction.total_amount).toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          ${showTotalDebt ? `
          <div class="payment-section">
            ${numberToArabicWords(Math.abs(transaction.total_amount))} جنيهاً
          </div>
          <div class="total-debt">
            إجمالي الدين: ${calculatedBalance.toFixed(0)} جنيه
          </div>
          ` : ''}

          <div class="footer">
            ${new Date(transaction.created_at).toLocaleDateString("en-GB")} ${transaction.time || new Date(transaction.created_at).toLocaleTimeString("en-GB", { hour12: false })}
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

  // Set up real-time subscriptions and fetch initial data
  useEffect(() => {
    if (isOpen && safe?.id && !isLoadingPreferences) {
      fetchSales()
      fetchPurchaseInvoices()
      fetchCashDrawerBalance()
      fetchAccountStatement()
      fetchTransfers()

      // Set up real-time subscription for sales
      const salesChannel = supabase
        .channel('record_modal_sales_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'sales' },
          (payload: any) => {
            console.log('Sales real-time update:', payload)
            fetchSales()
          }
        )
        .subscribe()

      // Set up real-time subscription for sale_items
      const saleItemsChannel = supabase
        .channel('record_modal_sale_items_changes')
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

      // Set up real-time subscription for purchase_invoices
      const purchaseInvoicesChannel = supabase
        .channel('record_modal_purchase_invoices_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'purchase_invoices' },
          (payload: any) => {
            console.log('Purchase invoices real-time update:', payload)
            fetchPurchaseInvoices()
          }
        )
        .subscribe()

      // Set up real-time subscription for purchase_invoice_items
      const purchaseInvoiceItemsChannel = supabase
        .channel('record_modal_purchase_invoice_items_changes')
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

      // Set up real-time subscription for cash_drawers (to update balance)
      const cashDrawersChannel = supabase
        .channel('record_modal_cash_drawers_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'cash_drawers' },
          (payload: any) => {
            console.log('Cash drawer real-time update:', payload)
            fetchCashDrawerBalance()
          }
        )
        .subscribe()

      // Set up real-time subscription for cash_drawer_transactions (to update transfers)
      const cashTransactionsChannel = supabase
        .channel('record_modal_cash_transactions_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'cash_drawer_transactions' },
          (payload: any) => {
            console.log('Cash drawer transactions real-time update:', payload)
            fetchTransfers()
            fetchAccountStatement() // Also update account statement
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(salesChannel)
        supabase.removeChannel(saleItemsChannel)
        supabase.removeChannel(purchaseInvoicesChannel)
        supabase.removeChannel(purchaseInvoiceItemsChannel)
        supabase.removeChannel(cashDrawersChannel)
        supabase.removeChannel(cashTransactionsChannel)
      }
    }
  }, [isOpen, safe?.id, dateFilter, isLoadingPreferences])

  // Search for product in invoices
  const searchProductInInvoices = async (query: string) => {
    if (!query.trim() || !safe?.id) {
      setSearchQuery('')
      setHighlightedProductId(null)
      // Reset to normal view with date filter
      fetchSales()
      fetchPurchaseInvoices()
      return
    }

    setSearchQuery(query)
    setIsLoadingSales(true)
    setIsLoadingPurchases(true)

    try {
      // First, search for products matching the query
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, barcode')
        .or(`name.ilike.%${query}%,barcode.ilike.%${query}%`)
        .limit(50)

      if (productsError || !productsData || productsData.length === 0) {
        console.log('No products found matching:', query)
        setSales([])
        setPurchaseInvoices([])
        setHighlightedProductId(null)
        setIsLoadingSales(false)
        setIsLoadingPurchases(false)
        return
      }

      const productIds = productsData.map(p => p.id)
      const firstProductId = productsData[0].id

      // Search in sale_items for these products
      const { data: saleItemsData } = await supabase
        .from('sale_items')
        .select('sale_id, product_id')
        .in('product_id', productIds)

      // Search in purchase_invoice_items for these products
      const { data: purchaseItemsData } = await supabase
        .from('purchase_invoice_items')
        .select('purchase_invoice_id, product_id')
        .in('product_id', productIds)

      // Get unique sale and purchase IDs
      const saleIds = Array.from(new Set(saleItemsData?.map((item: any) => item.sale_id) || []))
      const purchaseIds = Array.from(new Set(purchaseItemsData?.map((item: any) => item.purchase_invoice_id) || []))

      // Fetch matching sales with date filter
      let matchingSales: any[] = []
      if (saleIds.length > 0) {
        let salesQuery = supabase
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
          .eq('record_id', safe.id)
          .in('id', saleIds)

        // Apply date filter
        salesQuery = applyDateFilter(salesQuery)

        const { data: salesData } = await salesQuery.order('created_at', { ascending: false })
        matchingSales = salesData || []
      }

      // Fetch matching purchases with date filter
      let matchingPurchases: any[] = []
      if (purchaseIds.length > 0) {
        let purchasesQuery = supabase
          .from('purchase_invoices')
          .select(`
            id,
            invoice_number,
            supplier_id,
            total_amount,
            payment_status,
            notes,
            created_at,
            time,
            invoice_type,
            supplier:suppliers(
              name,
              phone
            )
          `)
          .eq('record_id', safe.id)
          .in('id', purchaseIds)

        // Apply date filter
        purchasesQuery = applyDateFilter(purchasesQuery)

        const { data: purchasesData } = await purchasesQuery.order('created_at', { ascending: false })
        matchingPurchases = purchasesData || []
      }

      // Update sales and purchases with search results
      setSales(matchingSales)
      setPurchaseInvoices(matchingPurchases)

      // Highlight the first found product
      setHighlightedProductId(firstProductId)

      // Auto-select first transaction if available
      if (matchingSales.length > 0 || matchingPurchases.length > 0) {
        setSelectedTransaction(0)

        // Load items for first transaction
        if (matchingSales.length > 0) {
          fetchSaleItems(matchingSales[0].id)
        } else if (matchingPurchases.length > 0) {
          fetchPurchaseInvoiceItems(matchingPurchases[0].id)
        }
      }

    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoadingSales(false)
      setIsLoadingPurchases(false)
    }
  }

  // Create combined transactions array from sales and purchase invoices
  const allTransactions = useMemo(() => {
    const salesWithType = sales.map(sale => ({
      ...sale,
      transactionType: 'sale',
      amount: sale.total_amount,
      paid_amount: paidAmounts[sale.id] || 0,
      client: sale.customer,
      clientType: 'عميل'
    }))

    const purchasesWithType = purchaseInvoices.map(purchase => ({
      ...purchase,
      transactionType: 'purchase',
      amount: purchase.total_amount,
      paid_amount: paidAmounts[purchase.id] || 0,
      client: purchase.supplier,
      clientType: 'مورد'
    }))

    // Combine and sort by creation date
    return [...salesWithType, ...purchasesWithType].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [sales, purchaseInvoices, paidAmounts])

  // Create combined transaction items based on selected transaction type
  const allTransactionItems = useMemo(() => {
    if (allTransactions.length === 0 || selectedTransaction >= allTransactions.length) return []
    
    const selectedTxn = allTransactions[selectedTransaction]
    if (selectedTxn.transactionType === 'sale') {
      return saleItems.map(item => ({ ...item, itemType: 'sale' }))
    } else if (selectedTxn.transactionType === 'purchase') {
      return purchaseInvoiceItems.map(item => ({ ...item, itemType: 'purchase' }))
    }
    return []
  }, [allTransactions, selectedTransaction, saleItems, purchaseInvoiceItems])

  // Fetch transaction items when selected transaction changes
  useEffect(() => {
    if (allTransactions.length > 0 && selectedTransaction < allTransactions.length) {
      const selectedTxn = allTransactions[selectedTransaction]
      if (selectedTxn.transactionType === 'sale') {
        fetchSaleItems(selectedTxn.id)
        setPurchaseInvoiceItems([]) // Clear purchase items
      } else if (selectedTxn.transactionType === 'purchase') {
        fetchPurchaseInvoiceItems(selectedTxn.id)
        setSaleItems([]) // Clear sale items
      }
    }
  }, [selectedTransaction, allTransactions])

  // Handle delete transaction
  const handleDeleteTransaction = (transaction: any) => {
    setTransactionToDelete(transaction)
    setShowDeleteModal(true)
  }

  // Confirm delete transaction
  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return

    try {
      setIsDeleting(true)

      if (transactionToDelete.transactionType === 'sale') {
        // Delete sale items first (foreign key constraint)
        const { error: saleItemsError } = await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', transactionToDelete.id)

        if (saleItemsError) {
          console.error('Error deleting sale items:', saleItemsError)
          throw saleItemsError
        }

        // Delete the sale
        const { error: saleError } = await supabase
          .from('sales')
          .delete()
          .eq('id', transactionToDelete.id)

        if (saleError) {
          console.error('Error deleting sale:', saleError)
          throw saleError
        }
      } else if (transactionToDelete.transactionType === 'purchase') {
        // Delete purchase invoice items first (foreign key constraint)
        const { error: purchaseItemsError } = await supabase
          .from('purchase_invoice_items')
          .delete()
          .eq('purchase_invoice_id', transactionToDelete.id)

        if (purchaseItemsError) {
          console.error('Error deleting purchase invoice items:', purchaseItemsError)
          throw purchaseItemsError
        }

        // Delete the purchase invoice
        const { error: purchaseError } = await supabase
          .from('purchase_invoices')
          .delete()
          .eq('id', transactionToDelete.id)

        if (purchaseError) {
          console.error('Error deleting purchase invoice:', purchaseError)
          throw purchaseError
        }
      }

      // Close modal and reset state
      setShowDeleteModal(false)
      setTransactionToDelete(null)
      
      // Refresh data (real-time will handle it but this ensures immediate update)
      fetchSales()
      fetchPurchaseInvoices()
      
      // Reset selected transaction if needed
      if (selectedTransaction >= allTransactions.length - 1) {
        setSelectedTransaction(Math.max(0, allTransactions.length - 2))
      }

    } catch (error) {
      console.error('Error deleting transaction:', error)
      // You could add a toast notification here for error feedback
    } finally {
      setIsDeleting(false)
    }
  }

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false)
    setTransactionToDelete(null)
  }

  // Load all safes for transfer selection
  const loadAllSafes = async () => {
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('is_active', true)
        .neq('id', safe?.id) // Exclude current safe
        .order('name')

      if (!error && data) {
        setAllSafes(data)
      }
    } catch (error) {
      console.error('Error loading safes:', error)
    }
  }

  // Open withdraw modal
  const openWithdrawModal = () => {
    setWithdrawAmount('')
    setWithdrawType('withdraw')
    setTargetSafeId('')
    setWithdrawNotes('')
    loadAllSafes()
    setShowWithdrawModal(true)
  }

  // Handle withdraw/deposit/transfer
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)

    if (!amount || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }

    // فقط للسحب والتحويل: التحقق من الرصيد الكافي
    if ((withdrawType === 'withdraw' || withdrawType === 'transfer') && amount > safeBalance) {
      alert('لا يوجد رصيد كافي في الخزنة')
      return
    }

    // منع السحب إذا كان الرصيد بالسالب أو صفر
    if ((withdrawType === 'withdraw' || withdrawType === 'transfer') && safeBalance <= 0) {
      alert('لا يوجد رصيد كافي في الخزنة للسحب')
      return
    }

    if (withdrawType === 'transfer' && !targetSafeId) {
      alert('يرجى اختيار الخزنة المستهدفة للتحويل')
      return
    }

    setIsWithdrawing(true)

    try {
      // 1. Get current safe's drawer
      let { data: sourceDrawer, error: sourceError } = await supabase
        .from('cash_drawers')
        .select('*')
        .eq('record_id', safe.id)
        .single()

      // إنشاء الخزنة إذا لم تكن موجودة (للإيداع)
      if (sourceError && sourceError.code === 'PGRST116' && withdrawType === 'deposit') {
        const { data: newDrawer, error: createError } = await supabase
          .from('cash_drawers')
          .insert({ record_id: safe.id, current_balance: 0 })
          .select()
          .single()

        if (createError) throw createError
        sourceDrawer = newDrawer
      } else if (sourceError || !sourceDrawer) {
        throw new Error('لم يتم العثور على الخزنة')
      }

      // 2. حساب الرصيد الجديد بناءً على نوع العملية
      let newSourceBalance: number
      let transactionAmount: number
      let transactionType: string
      let transactionNotes: string

      if (withdrawType === 'deposit') {
        // إيداع: إضافة للرصيد
        newSourceBalance = (sourceDrawer.current_balance || 0) + amount
        transactionAmount = amount
        transactionType = 'deposit'
        transactionNotes = `إيداع في الخزنة${withdrawNotes ? ` - ${withdrawNotes}` : ''}`
      } else {
        // سحب أو تحويل: خصم من الرصيد
        newSourceBalance = (sourceDrawer.current_balance || 0) - amount
        transactionAmount = -amount
        transactionType = withdrawType === 'transfer' ? 'transfer_out' : 'withdrawal'
        transactionNotes = withdrawType === 'transfer'
          ? `تحويل إلى خزنة أخرى${withdrawNotes ? ` - ${withdrawNotes}` : ''}`
          : `سحب من الخزنة${withdrawNotes ? ` - ${withdrawNotes}` : ''}`
      }

      // تحديث رصيد الخزنة
      await supabase
        .from('cash_drawers')
        .update({
          current_balance: newSourceBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', sourceDrawer.id)

      // 3. إنشاء سجل المعاملة
      await supabase
        .from('cash_drawer_transactions')
        .insert({
          drawer_id: sourceDrawer.id,
          record_id: safe.id,
          transaction_type: transactionType,
          amount: transactionAmount,
          balance_after: newSourceBalance,
          notes: transactionNotes,
          performed_by: 'system'
        })

      // 4. في حالة التحويل، إضافة للخزنة المستهدفة
      if (withdrawType === 'transfer' && targetSafeId) {
        // Get or create target drawer
        let { data: targetDrawer, error: targetError } = await supabase
          .from('cash_drawers')
          .select('*')
          .eq('record_id', targetSafeId)
          .single()

        if (targetError && targetError.code === 'PGRST116') {
          // Create target drawer if doesn't exist
          const { data: newTargetDrawer, error: createError } = await supabase
            .from('cash_drawers')
            .insert({ record_id: targetSafeId, current_balance: 0 })
            .select()
            .single()

          if (!createError) {
            targetDrawer = newTargetDrawer
          }
        }

        if (targetDrawer) {
          const newTargetBalance = (targetDrawer.current_balance || 0) + amount

          await supabase
            .from('cash_drawers')
            .update({
              current_balance: newTargetBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetDrawer.id)

          // Create deposit transaction for target
          await supabase
            .from('cash_drawer_transactions')
            .insert({
              drawer_id: targetDrawer.id,
              record_id: targetSafeId,
              transaction_type: 'transfer_in',
              amount: amount,
              balance_after: newTargetBalance,
              notes: `تحويل من خزنة ${safe.name}${withdrawNotes ? ` - ${withdrawNotes}` : ''}`,
              performed_by: 'system'
            })
        }
      }

      // 5. Update local state
      setCashDrawerBalance(newSourceBalance)

      // 6. Reset form
      setWithdrawAmount('')
      setWithdrawNotes('')
      setTargetSafeId('')

      // 7. Close modal and show success
      setShowWithdrawModal(false)

      const successMessage = withdrawType === 'deposit'
        ? `تم إيداع ${amount} بنجاح`
        : withdrawType === 'transfer'
          ? `تم تحويل ${amount} بنجاح`
          : `تم سحب ${amount} بنجاح`

      alert(successMessage)

    } catch (error: any) {
      console.error('Error in transaction:', error)
      alert(`حدث خطأ: ${error.message}`)
    } finally {
      setIsWithdrawing(false)
    }
  }

  if (!safe) return null

  // Transfers data - now uses real data from state
  // transfers state is populated by fetchTransfers()

  // Sample invoices data
  const transactions = [
    {
      id: 1,
      invoiceNumber: 'INV-2025-001',
      date: 'July 15, 2025',
      day: 'الثلاثاء',
      barcode: '1234567890123',
      totalAmount: formatPrice(1677),
      paymentMethod: 'نقدي',
      invoiceType: 'بيع',
      notes: 'فاتورة عادية',
      updateDate: '03:22 PM - 6/30/2025',
      updatedBy: 'محمد علي'
    },
    {
      id: 2,
      invoiceNumber: 'INV-2025-002',
      date: 'July 2, 2025', 
      day: 'الأربعاء',
      barcode: '1234567890124',
      totalAmount: formatPrice(210),
      paymentMethod: 'فيزا',
      invoiceType: 'بيع',
      notes: '',
      updateDate: '01:15 PM - 7/2/2025',
      updatedBy: 'فاطمة أحمد'
    },
    {
      id: 3,
      invoiceNumber: 'INV-2025-003',
      date: 'June 29, 2025',
      day: 'الأحد', 
      barcode: '1234567890125',
      totalAmount: formatPrice(850),
      paymentMethod: 'نقدي',
      invoiceType: 'بيع',
      notes: 'عميل VIP',
      updateDate: '11:30 AM - 6/29/2025',
      updatedBy: 'عبد الرحمن'
    },
    {
      id: 4,
      invoiceNumber: 'RET-2025-001',
      date: 'June 29, 2025',
      day: 'الأحد',
      barcode: '1234567890126',
      totalAmount: `-${formatPrice(100)}`,
      paymentMethod: 'نقدي',
      invoiceType: 'مرتجع',
      notes: 'مرتجع معيب',
      updateDate: '04:45 PM - 6/29/2025',
      updatedBy: 'سارة محمد'
    },
    {
      id: 5,
      invoiceNumber: 'INV-2025-004',
      date: 'June 28, 2025',
      day: 'السبت',
      barcode: '1234567890127',
      totalAmount: formatPrice(485), 
      paymentMethod: 'ماستركارد',
      invoiceType: 'بيع',
      notes: '',
      updateDate: '09:15 AM - 6/28/2025',
      updatedBy: 'أحمد خالد'
    }
  ]

  // Sample invoice details data for selected invoice
  const transactionDetails = [
    {
      id: 1,
      category: 'الإلكترونيات',
      productName: 'هاتف سامسونج جالاكسي',
      quantity: 2,
      productCode: 'PHONE-001',
      barcode: '1234567890001',
      variant: { color: 'أسود', shape: 'عادي' },
      price: 15000.00,
      discount: 5,
      total: 28500.00
    },
    {
      id: 2,
      category: 'الإلكترونيات',
      productName: 'سماعات بلوتوث',
      quantity: 1,
      productCode: 'HEADPHONE-001',
      barcode: '1234567890002',
      variant: { color: 'أبيض' },
      price: 2500.00,
      discount: 10,
      total: 2250.00
    },
    {
      id: 3,
      category: 'الملابس',
      productName: 'تي شيرت قطني',
      quantity: 3,
      productCode: 'TSHIRT-001',
      barcode: '1234567890003',
      variant: { color: 'أزرق', shape: 'L' },
      price: 250.00,
      discount: 0,
      total: 750.00
    },
    {
      id: 4,
      category: 'المنزل',
      productName: 'كوب قهوة زجاجي',
      quantity: 6,
      productCode: 'CUP-001',
      barcode: '1234567890004',
      variant: {},
      price: 75.00,
      discount: 15,
      total: 382.50
    },
    {
      id: 5,
      category: 'الكتب',
      productName: 'كتاب البرمجة',
      quantity: 1,
      productCode: 'BOOK-001',
      barcode: '1234567890005',
      variant: {},
      price: 500.00,
      discount: 20,
      total: 400.00
    }
  ];

  // Define columns for each table - exactly like Products page structure
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
      accessor: 'date',
      width: 120,
      render: (value: string) => <span className="text-white">{value}</span>
    },
    {
      id: 'time',
      header: '⏰ الساعة',
      accessor: 'time',
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
            : value === 'مرتجع بيع'
            ? 'bg-orange-600/20 text-orange-400 border border-orange-600'
            : value === 'دفعة'
            ? 'bg-blue-600/20 text-blue-400 border border-blue-600'
            : value === 'سحب'
            ? 'bg-red-600/20 text-red-400 border border-red-600'
            : value === 'تسوية'
            ? 'bg-purple-600/20 text-purple-400 border border-purple-600'
            : value === 'رصيد أولي'
            ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600'
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
          item.type === 'مرتجع بيع' || item.type === 'سحب'
            ? 'text-red-400'
            : 'text-green-400'
        }`}>
          {item.type === 'مرتجع بيع' || item.type === 'سحب' ? '-' : '+'}{formatPrice(value, 'system')}
        </span>
      )
    },
    {
      id: 'balance',
      header: 'الرصيد',
      accessor: 'balance',
      width: 140,
      render: (value: number) => <span className="text-blue-400 font-medium">{formatPrice(value, 'system')}</span>
    }
  ]

  const transactionColumns = [
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
      id: 'client_name', 
      header: 'العميل/المورد', 
      accessor: 'client.name', 
      width: 150,
      render: (value: string, item: any) => (
        <div>
          <span className="text-white">{item.client?.name || 'غير محدد'}</span>
          <br />
          <span className="text-xs text-gray-400">({item.clientType})</span>
        </div>
      )
    },
    { 
      id: 'client_phone', 
      header: 'الهاتف', 
      accessor: 'client.phone', 
      width: 150,
      render: (value: string, item: any) => <span className="text-gray-300 font-mono text-sm">{item.client?.phone || '-'}</span>
    },
    {
      id: 'total_amount',
      header: 'قيمة الفاتورة',
      accessor: 'total_amount',
      width: 130,
      render: (value: number) => (
        <span className="text-gray-300 font-medium">
          {formatPrice(Math.abs(value), 'system')}
        </span>
      )
    },
    {
      id: 'paid_amount',
      header: 'المبلغ المدفوع',
      accessor: 'paid_amount',
      width: 130,
      render: (value: number, item: any) => {
        const isPurchase = item.transactionType === 'purchase'
        const isReturn = item.invoice_type === 'Purchase Return' || item.invoice_type === 'Sale Return'
        // Purchase Invoice = negative (money out), Purchase Return = positive
        // Sale Invoice = positive (money in), Sale Return = negative
        const shouldBeNegative = (isPurchase && !isReturn) || (!isPurchase && isReturn)
        const colorClass = shouldBeNegative ? 'text-red-400' : 'text-green-400'

        return (
          <span className={`${colorClass} font-medium`}>
            {shouldBeNegative ? '-' : '+'}{formatPrice(value || 0, 'system')}
          </span>
        )
      }
    },
    { 
      id: 'payment_method', 
      header: 'طريقة الدفع', 
      accessor: 'payment_method', 
      width: 120,
      render: (value: string) => <span className="text-blue-400">{value || 'نقد'}</span>
    },
    { 
      id: 'invoice_type', 
      header: 'نوع الفاتورة', 
      accessor: 'invoice_type', 
      width: 120,
      render: (value: string, item: any) => {
        const getInvoiceTypeText = (invoiceType: string, transactionType: string, notes: string) => {
          // Check if this is a transfer invoice by looking for [TRANSFER] prefix in notes
          if (notes && notes.startsWith('[TRANSFER]')) {
            return 'نقل'
          }
          
          if (transactionType === 'purchase') {
            switch (invoiceType) {
              case 'Purchase Invoice': return 'فاتورة شراء'
              case 'Purchase Return': return 'مرتجع شراء'
              default: return 'فاتورة شراء'
            }
          } else {
            switch (invoiceType) {
              case 'sale': return 'فاتورة بيع'
              case 'Sale Invoice': return 'فاتورة بيع'
              case 'Sale Return': return 'مرتجع بيع'
              default: return invoiceType || 'فاتورة بيع'
            }
          }
        }
        
        const getInvoiceTypeColor = (invoiceType: string, transactionType: string, notes: string) => {
          // Check if this is a transfer invoice by looking for [TRANSFER] prefix in notes
          if (notes && notes.startsWith('[TRANSFER]')) {
            return 'bg-orange-600/20 text-orange-400 border border-orange-600'
          }
          
          if (transactionType === 'purchase') {
            switch (invoiceType) {
              case 'Purchase Invoice': return 'bg-blue-600/20 text-blue-400 border border-blue-600'
              case 'Purchase Return': return 'bg-purple-600/20 text-purple-400 border border-purple-600'
              default: return 'bg-blue-600/20 text-blue-400 border border-blue-600'
            }
          } else {
            switch (invoiceType) {
              case 'sale': 
              case 'Sale Invoice': return 'bg-green-600/20 text-green-400 border border-green-600'
              case 'Sale Return': return 'bg-orange-600/20 text-orange-400 border border-orange-600'
              default: return 'bg-green-600/20 text-green-400 border border-green-600'
            }
          }
        }
        
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getInvoiceTypeColor(value, item.transactionType, item.notes)}`}>
            {getInvoiceTypeText(value, item.transactionType, item.notes)}
          </span>
        )
      }
    },
    {
      id: 'notes',
      header: 'البيان',
      accessor: 'notes',
      width: 200,
      render: (value: string) => {
        // Clean up transfer notes by removing [TRANSFER] prefix
        const cleanNotes = value && value.startsWith('[TRANSFER]')
          ? value.replace('[TRANSFER] ', '')
          : value
        return <span className="text-gray-400">{cleanNotes || '-'}</span>
      }
    }
  ]

  const paymentsColumns = [
    {
      id: 'index',
      header: '#',
      accessor: '#',
      width: 50,
      render: (value: any, item: any, index: number) => (
        <span className="text-gray-400">{item.id}</span>
      )
    },
    {
      id: 'date',
      header: 'التاريخ',
      accessor: 'date',
      width: 120,
      render: (value: string) => <span className="text-white">{value}</span>
    },
    {
      id: 'time',
      header: '⏰ الساعة',
      accessor: 'time',
      width: 100,
      render: (value: string) => <span className="text-blue-400">{value}</span>
    },
    {
      id: 'type',
      header: 'نوع العملية',
      accessor: 'type',
      width: 120,
      render: (value: string) => {
        const typeMap: { [key: string]: { text: string; color: string; bg: string } } = {
          'deposit': { text: 'إيداع', color: 'text-green-400', bg: 'bg-green-600/20 border-green-600' },
          'withdrawal': { text: 'سحب', color: 'text-red-400', bg: 'bg-red-600/20 border-red-600' },
          'adjustment': { text: 'تسوية', color: 'text-yellow-400', bg: 'bg-yellow-600/20 border-yellow-600' },
          'transfer': { text: 'تحويل', color: 'text-blue-400', bg: 'bg-blue-600/20 border-blue-600' }
        }
        const typeInfo = typeMap[value] || { text: value || '-', color: 'text-gray-400', bg: 'bg-gray-600/20 border-gray-600' }
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium border ${typeInfo.bg} ${typeInfo.color}`}>
            {typeInfo.text}
          </span>
        )
      }
    },
    {
      id: 'amount',
      header: 'المبلغ',
      accessor: 'amount',
      width: 140,
      render: (value: number) => {
        const isPositive = value >= 0
        return (
          <span className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{formatPrice(value, 'system')}
          </span>
        )
      }
    },
    {
      id: 'notes',
      header: 'البيان',
      accessor: 'notes',
      width: 250,
      render: (value: string) => <span className="text-gray-400">{value}</span>
    }
  ]

  const transactionDetailsColumns = [
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
      render: (value: string, item: any) => {
        const isHighlighted = highlightedProductId === item.product?.id
        return (
          <span className={`${isHighlighted ? 'bg-yellow-500/40 px-2 py-1 rounded text-yellow-100 font-semibold' : 'text-purple-400'}`}>
            {item.product?.category?.name || 'غير محدد'}
          </span>
        )
      }
    },
    {
      id: 'productName',
      header: 'اسم المنتج',
      accessor: 'product.name',
      width: 200,
      render: (value: string, item: any) => {
        const isHighlighted = highlightedProductId === item.product?.id
        return (
          <div className={`flex items-center gap-2 ${isHighlighted ? 'bg-yellow-500/40 px-2 py-1 rounded' : ''}`}>
            {isHighlighted && <span className="text-yellow-300 text-lg">★</span>}
            <span className={`font-medium ${isHighlighted ? 'text-yellow-100 font-bold' : 'text-white'}`}>
              {item.product?.name || 'منتج محذوف'}
            </span>
          </div>
        )
      }
    },
    { 
      id: 'quantity', 
      header: 'الكمية', 
      accessor: 'quantity', 
      width: 80,
      render: (value: number) => <span className="text-blue-400 font-medium">{value}</span>
    },
    { 
      id: 'barcode', 
      header: 'الباركود', 
      accessor: 'product.barcode', 
      width: 150,
      render: (value: string, item: any) => (
        <span className="text-gray-300 font-mono text-sm">{item.product?.barcode || '-'}</span>
      )
    },
    { 
      id: 'unit_price', 
      header: 'السعر', 
      accessor: 'unit_price', 
      width: 100,
      render: (value: number, item: any) => {
        const price = item.itemType === 'purchase' ? item.unit_purchase_price : item.unit_price
        return <span className="text-green-400 font-medium">{price ? price.toFixed(2) : '0.00'}</span>
      }
    },
    { 
      id: 'discount', 
      header: 'خصم', 
      accessor: 'discount', 
      width: 80,
      render: (value: number, item: any) => {
        const discount = item.itemType === 'purchase' ? item.discount_amount : item.discount
        return <span className="text-orange-400 font-medium">{discount ? discount.toFixed(2) : '0.00'}</span>
      }
    },
    { 
      id: 'total', 
      header: 'الإجمالي', 
      accessor: 'total', 
      width: 120,
      render: (value: any, item: any) => {
        let total: number
        if (item.itemType === 'purchase') {
          // For purchase items, use total_price if available, otherwise calculate
          total = item.total_price || ((item.quantity * item.unit_purchase_price) - (item.discount_amount || 0))
        } else {
          // For sale items, calculate from unit_price
          total = (item.quantity * item.unit_price) - (item.discount || 0)
        }
        return <span className="text-green-400 font-bold">{total.toFixed(2)}</span>
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
                  <button
                    onClick={() => {
                      if (allTransactions.length > 0 && selectedTransaction < allTransactions.length) {
                        handleDeleteTransaction(allTransactions[selectedTransaction])
                      }
                    }}
                    disabled={allTransactions.length === 0 || selectedTransaction >= allTransactions.length}
                    className="flex flex-col items-center p-2 text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer min-w-[80px] transition-colors"
                  >
                    <TrashIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">حذف الفاتورة</span>
                  </button>

                  <button
                    onClick={openWithdrawModal}
                    className="flex flex-col items-center p-2 text-orange-400 hover:text-orange-300 cursor-pointer min-w-[80px] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm">سحب الخزنة</span>
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
                    التحويلات
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
                    onClick={() => setActiveTab('transactions')}
                    className={`px-6 py-3 text-base font-semibold border-b-2 rounded-t-lg transition-all duration-200 ${
                      activeTab === 'transactions' 
                        ? 'text-blue-400 border-blue-400 bg-blue-600/10' 
                        : 'text-gray-300 hover:text-white border-transparent hover:border-gray-400 hover:bg-gray-600/20'
                    }`}
                  >
                    فواتير الخزنة ({allTransactions.length})
                  </button>
                </div>
                
                {/* View Mode Toggle Buttons - Only show for transactions tab */}
                {activeTab === 'transactions' && (
                  <div className="flex gap-1 bg-gray-600/50 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('safes-only')}
                      className={`px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 ${
                        viewMode === 'safes-only'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                      }`}
                      title="عرض فواتير الخزنة فقط"
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
                onClick={() => setShowSafeDetails(!showSafeDetails)}
                className="w-6 bg-[#374151] hover:bg-[#4B5563] border-r border-gray-600 flex items-center justify-center transition-colors duration-200"
                title={showSafeDetails ? 'إخفاء تفاصيل الخزنة' : 'إظهار تفاصيل الخزنة'}
              >
                {showSafeDetails ? (
                  <ChevronRightIcon className="h-4 w-4 text-gray-300" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4 text-gray-300" />
                )}
              </button>
            </div>

            {/* Right Sidebar - Record Info (First in RTL) */}
            {showSafeDetails && (
              <div className="w-80 bg-[#3B4754] border-l border-gray-600 flex flex-col">
                
                {/* Record Balance */}
                <div className="p-4 border-b border-gray-600">
                  <div className="bg-purple-600 rounded p-4 text-center">
                    <div className="text-2xl font-bold text-white">{formatPrice(safeBalance, 'system')}</div>
                    <div className="text-purple-200 text-sm">رصيد الخزنة</div>
                  </div>
                </div>

                {/* Record Details */}
                <div className="p-4 space-y-4 flex-1">
                  <h3 className="text-white font-medium text-lg text-right">معلومات الخزنة</h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white">{safe?.name || 'الخزنة الرئيسي'}</span>
                    <span className="text-gray-400 text-sm">اسم الخزنة</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-white">جميع الفروع</span>
                    <span className="text-gray-400 text-sm">الفرع</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-400 flex items-center gap-1">
                      <span>
                        {dateFilter.type === 'today' && 'اليوم'}
                        {dateFilter.type === 'current_week' && 'الأسبوع الحالي'}
                        {dateFilter.type === 'last_week' && 'الأسبوع الماضي'}
                        {dateFilter.type === 'current_month' && 'الشهر الحالي'}
                        {dateFilter.type === 'last_month' && 'الشهر الماضي'}
                        {dateFilter.type === 'custom' && 'فترة مخصصة'}
                        {dateFilter.type === 'all' && 'جميع الفترات'}
                      </span>
                      <span>📅</span>
                    </span>
                    <span className="text-gray-400 text-sm">الفترة الزمنية</span>
                  </div>

                  {dateFilter.type === 'custom' && dateFilter.startDate && dateFilter.endDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-white text-xs">
                        {dateFilter.startDate.toLocaleDateString('en-GB')} - {dateFilter.endDate.toLocaleDateString('en-GB')}
                      </span>
                      <span className="text-gray-400 text-sm">من - إلى</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-white">
                      {new Date().toLocaleDateString('en-GB')}
                    </span>
                    <span className="text-gray-400 text-sm">التاريخ الحالي</span>
                  </div>
                </div>
              </div>

              {/* Record Statistics */}
              <div className="p-4 border-t border-gray-600">
                <h4 className="text-white font-medium mb-3 text-right flex items-center gap-2">
                  <span>📊</span>
                  <span>إحصائيات الخزنة</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white">{allTransactions.length}</span>
                    <span className="text-gray-400 text-sm">عدد المعاملات</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-400">{formatPrice(sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0), 'system')}</span>
                    <span className="text-gray-400 text-sm">إجمالي المدين</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-red-400">{formatPrice(purchaseInvoices.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0), 'system')}</span>
                    <span className="text-gray-400 text-sm">إجمالي الدائن</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white">
                      {allTransactions.length > 0
                        ? new Date(allTransactions[0].created_at).toLocaleDateString('en-GB')
                        : '-'
                      }
                    </span>
                    <span className="text-gray-400 text-sm">آخر معاملة</span>
                  </div>
                </div>
              </div>

              {/* Date Filter Button */}
              <div className="p-4 border-t border-gray-600">
                <button
                  onClick={() => setShowDateFilter(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <CalendarDaysIcon className="h-5 w-5" />
                  <span>التاريخ</span>
                </button>
                
                {/* Current Filter Display */}
                {dateFilter.type !== 'all' && (
                  <div className="mt-2 text-center">
                    <span className="text-xs text-purple-400">
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
              <div className={`bg-[#374151] border-b p-4 transition-colors ${searchQuery ? 'border-blue-500' : 'border-gray-600'}`}>
                {searchQuery && (
                  <div className="mb-2 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                      <span>🔍</span>
                      <span>البحث نشط - عرض الفواتير التي تحتوي على المنتج المحدد فقط</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">النتائج:</span>
                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-medium">
                        {allTransactions.length}
                      </span>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <MagnifyingGlassIcon className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors ${searchQuery ? 'text-blue-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    placeholder="ابحث عن منتج (اسم المنتج أو الباركود)..."
                    value={searchQuery}
                    onChange={(e) => {
                      const value = e.target.value
                      setSearchQuery(value)

                      // Clear previous timeout
                      if (searchTimeout) {
                        clearTimeout(searchTimeout)
                      }

                      // Set new timeout for auto-search after 500ms
                      if (value.trim()) {
                        const timeout = setTimeout(() => {
                          searchProductInInvoices(value)
                        }, 500)
                        setSearchTimeout(timeout)
                      } else {
                        // If search is cleared, reload normal data
                        setHighlightedProductId(null)
                        fetchSales()
                        fetchPurchaseInvoices()
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        // Clear timeout and search immediately
                        if (searchTimeout) {
                          clearTimeout(searchTimeout)
                        }
                        searchProductInInvoices(searchQuery)
                      }
                    }}
                    className="w-full pl-24 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                    <button
                      onClick={() => searchProductInInvoices(searchQuery)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    >
                      بحث
                    </button>
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setHighlightedProductId(null)
                        fetchSales()
                        fetchPurchaseInvoices()
                      }}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
                    >
                      مسح
                    </button>
                  </div>
                </div>
              </div>

              {/* Conditional Content Based on Active Tab and View Mode */}
              <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {activeTab === 'statement' && (
                  <div className="h-full flex flex-col">
                    {/* Account Statement Header */}
                    <div className="bg-[#2B3544] border-b border-gray-600 p-4">
                      <div className="flex items-center justify-end">
                        <div className="text-white text-lg font-medium">كشف حساب الخزنة</div>
                      </div>
                    </div>

                    {/* Account Statement Table */}
                    <div className="flex-1">
                      {isLoadingStatement ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                          <span className="text-gray-400">جاري تحميل كشف الحساب...</span>
                        </div>
                      ) : accountStatementData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8">
                          <div className="text-6xl mb-4">📊</div>
                          <p className="text-gray-400 text-lg mb-2">لا توجد عمليات في كشف الحساب</p>
                          <p className="text-gray-500 text-sm">سيتم عرض العمليات هنا عند إجرائها</p>
                        </div>
                      ) : (
                        <ResizableTable
                          className="h-full w-full"
                          columns={statementColumns}
                          data={accountStatementData}
                        />
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'transactions' && (
                  <div className="h-full relative">
                    {/* Records Table - Always rendered but z-indexed based on view mode */}
                    <div 
                      className={`absolute inset-0 bg-[#2B3544] transition-all duration-300 ${
                        viewMode === 'details-only' ? 'z-0 opacity-20' : 'z-10'
                      } ${
                        viewMode === 'split' ? '' : 'opacity-100'
                      }`}
                      style={{
                        height: viewMode === 'split' ? `${dividerPosition}%` : '100%',
                        zIndex: viewMode === 'safes-only' ? 20 : viewMode === 'split' ? 10 : 5
                      }}
                    >
                      {isLoadingSales ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                          <span className="text-gray-400">جاري تحميل الفواتير...</span>
                        </div>
                      ) : allTransactions.length === 0 && searchQuery ? (
                        <div className="flex flex-col items-center justify-center h-full p-8">
                          <div className="text-6xl mb-4">🔍</div>
                          <p className="text-gray-400 text-lg mb-2">لا توجد فواتير تحتوي على هذا المنتج</p>
                          <p className="text-gray-500 text-sm">ابحث عن منتج آخر أو امسح البحث</p>
                        </div>
                      ) : (
                        <ResizableTable
                          className="h-full w-full"
                          columns={transactionColumns}
                          data={allTransactions}
                          selectedRowId={allTransactions[selectedTransaction]?.id?.toString() || null}
                          onRowClick={(transaction: any, index: number) => setSelectedTransaction(index)}
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

                    {/* Transaction Details - Always rendered but z-indexed based on view mode */}
                    <div 
                      className={`absolute inset-0 bg-[#2B3544] flex flex-col transition-all duration-300 ${
                        viewMode === 'safes-only' ? 'z-0 opacity-20' : 'z-10'
                      }`}
                      style={{
                        top: viewMode === 'split' ? `${dividerPosition}%` : '0',
                        height: viewMode === 'split' ? `${100 - dividerPosition}%` : '100%',
                        zIndex: viewMode === 'details-only' ? 20 : viewMode === 'split' ? 10 : 5
                      }}
                    >
                      <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0 border-b border-gray-600">
                        <button
                          onClick={() => {
                            const currentTransaction = allTransactions[selectedTransaction]
                            const items = currentTransaction?.transactionType === 'sale' ? saleItems : purchaseInvoiceItems
                            printReceipt(currentTransaction, items)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                          disabled={isLoadingItems || (saleItems.length === 0 && purchaseInvoiceItems.length === 0)}
                        >
                          <PrinterIcon className="h-4 w-4" />
                          طباعة الريسيت
                        </button>
                        <h3 className="text-blue-400 font-medium text-lg">
                          تفاصيل الفاتورة {allTransactions[selectedTransaction]?.invoice_number || ''}
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
                            columns={transactionDetailsColumns}
                            data={allTransactionItems}
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
                      <div className="flex items-center justify-end">
                        <div className="text-right">
                          <div className="text-white text-lg font-medium">تحويلات الخزنة</div>
                          <div className="text-gray-400 text-sm mt-1">
                            إجمالي التحويلات: {formatPrice(transfers.reduce((sum, t) => sum + (t.amount || 0), 0), 'system')}
                            <span className="mx-2">|</span>
                            عدد العمليات: {transfers.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payments Table */}
                    <div className="flex-1">
                      {isLoadingTransfers ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                          <span className="text-gray-400">جاري تحميل التحويلات...</span>
                        </div>
                      ) : transfers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8">
                          <div className="text-6xl mb-4">💸</div>
                          <p className="text-gray-400 text-lg mb-2">لا توجد تحويلات مسجلة</p>
                          <p className="text-gray-500 text-sm">الإيداعات والسحوبات ستظهر هنا</p>
                        </div>
                      ) : (
                        <ResizableTable
                          className="h-full w-full"
                          columns={paymentsColumns}
                          data={transfers}
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
        onConfirm={confirmDeleteTransaction}
        isDeleting={isDeleting}
        title={transactionToDelete?.transactionType === 'purchase' ? 'تأكيد حذف فاتورة الشراء' : 'تأكيد حذف فاتورة البيع'}
        message={transactionToDelete?.transactionType === 'purchase' ? 'هل أنت متأكد أنك تريد حذف هذه فاتورة الشراء؟' : 'هل أنت متأكد أنك تريد حذف هذه فاتورة البيع؟'}
        itemName={transactionToDelete ? `فاتورة رقم: ${transactionToDelete.invoice_number} (${transactionToDelete.transactionType === 'purchase' ? 'شراء' : 'بيع'})` : ''}
      />

      {/* Date Filter Modal */}
      <SimpleDateFilterModal
        isOpen={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onDateFilterChange={(filter) => {
          setDateFilter(filter)
          saveDateFilterPreferences(filter)
        }}
        currentFilter={dateFilter}
      />

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-[#2B3544] rounded-lg w-full max-w-md mx-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <h3 className="text-white font-medium text-lg">
                {withdrawType === 'deposit' ? 'إيداع في الخزنة' : withdrawType === 'transfer' ? 'تحويل من الخزنة' : 'سحب من الخزنة'}
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Current Balance Display */}
              <div className="bg-purple-600/20 border border-purple-500 rounded p-3 text-center">
                <div className="text-purple-300 text-sm">الرصيد الحالي</div>
                <div className="text-white text-xl font-bold">{formatPrice(safeBalance, 'system')}</div>
              </div>

              {/* Operation Type */}
              <div>
                <label className="block text-gray-300 text-sm mb-2 text-right">نوع العملية</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWithdrawType('withdraw')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      withdrawType === 'withdraw'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    سحب
                  </button>
                  <button
                    onClick={() => setWithdrawType('deposit')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      withdrawType === 'deposit'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    إيداع
                  </button>
                  <button
                    onClick={() => setWithdrawType('transfer')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      withdrawType === 'transfer'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    تحويل
                  </button>
                </div>
              </div>

              {/* Target Safe (if transfer) */}
              {withdrawType === 'transfer' && (
                <div>
                  <label className="block text-gray-300 text-sm mb-2 text-right">الخزنة المستهدفة</label>
                  <select
                    value={targetSafeId}
                    onChange={(e) => setTargetSafeId(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">اختر الخزنة...</option>
                    {allSafes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-gray-300 text-sm mb-2 text-right">المبلغ</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="أدخل المبلغ"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                  min="0"
                  max={withdrawType === 'deposit' ? undefined : safeBalance}
                  step="0.01"
                />
                {/* زر سحب الرصيد بالكامل - فقط للسحب والتحويل */}
                {withdrawType !== 'deposit' && safeBalance > 0 && (
                  <button
                    onClick={() => setWithdrawAmount(safeBalance.toString())}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    سحب الرصيد بالكامل ({formatPrice(safeBalance, 'system')})
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-gray-300 text-sm mb-2 text-right">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="ملاحظات إضافية..."
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-gray-600">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded text-sm font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
                  withdrawType === 'deposit'
                    ? 'bg-green-600 hover:bg-green-700 text-white disabled:bg-green-800 disabled:cursor-not-allowed'
                    : withdrawType === 'transfer'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-800 disabled:cursor-not-allowed'
                }`}
              >
                {isWithdrawing ? 'جاري...' : withdrawType === 'deposit' ? 'إيداع' : withdrawType === 'transfer' ? 'تحويل' : 'سحب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}