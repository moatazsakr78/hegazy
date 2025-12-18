'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'
import { useFormatPrice } from '@/lib/hooks/useCurrency'

interface AddPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  entityId: string
  entityType: 'customer' | 'supplier'
  entityName: string
  currentBalance: number
  onPaymentAdded?: () => void
  initialPaymentType?: 'payment' | 'loan'
}

export default function AddPaymentModal({
  isOpen,
  onClose,
  entityId,
  entityType,
  entityName,
  currentBalance,
  onPaymentAdded,
  initialPaymentType = 'payment'
}: AddPaymentModalProps) {
  const formatPrice = useFormatPrice()
  const [amount, setAmount] = useState('')
  const [recordId, setRecordId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [records, setRecords] = useState<any[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [paymentType, setPaymentType] = useState<'payment' | 'loan'>(initialPaymentType)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false)

  // Fetch records and payment methods
  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoadingRecords(true)
      try {
        const { data, error } = await supabase
          .from('records')
          .select('id, name, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching records:', error)
          return
        }

        setRecords(data || [])

        // لا نختار خزنة تلقائياً - نبدأ بـ "لا يوجد"
        setRecordId('')
      } catch (error) {
        console.error('Error fetching records:', error)
      } finally {
        setIsLoadingRecords(false)
      }
    }

    const fetchPaymentMethods = async () => {
      setIsLoadingPaymentMethods(true)
      try {
        const { data, error } = await supabase
          .from('payment_methods')
          .select('id, name, is_default, is_active')
          .eq('is_active', true)
          .order('is_default', { ascending: false })

        if (error) {
          console.error('Error fetching payment methods:', error)
          return
        }

        setPaymentMethods(data || [])

        // Set default payment method
        const defaultMethod = data?.find(m => m.is_default)
        if (defaultMethod) {
          setPaymentMethod(defaultMethod.name)
        }
      } catch (error) {
        console.error('Error fetching payment methods:', error)
      } finally {
        setIsLoadingPaymentMethods(false)
      }
    }

    if (isOpen) {
      fetchRecords()
      fetchPaymentMethods()
    }
  }, [isOpen])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setNotes('')
      setPaymentMethod('cash')
      setPaymentType(initialPaymentType)
    }
  }, [isOpen, initialPaymentType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || parseFloat(amount) <= 0) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }

    if (!notes || notes.trim() === '') {
      alert('يرجى إدخال البيان')
      return
    }

    // الخزنة اختيارية - يمكن أن تكون "لا يوجد"

    const paymentAmount = parseFloat(amount)

    // المبلغ يُسجّل دائماً كقيمة موجبة في قاعدة البيانات
    // نوع العملية (سلفة/دفعة) يُحدد من خلال حقل الملاحظات
    const actualAmount = paymentAmount

    // Check if payment exceeds balance (فقط للدفعة العادية)
    if (paymentType === 'payment' && paymentAmount > currentBalance) {
      const confirmExceed = confirm(
        `المبلغ المدخل (${formatPrice(paymentAmount)}) أكبر من الرصيد الحالي (${formatPrice(currentBalance)}). هل تريد المتابعة؟`
      )
      if (!confirmExceed) return
    }

    setIsSubmitting(true)

    try {
      if (entityType === 'customer') {
        // إعداد الملاحظات مع توضيح نوع العملية
        const paymentNotes = paymentType === 'loan'
          ? `سلفة${notes ? ` - ${notes}` : ''}`
          : notes || null

        const { data, error } = await supabase
          .from('customer_payments')
          .insert([
            {
              customer_id: entityId,
              amount: actualAmount,
              payment_method: paymentMethod,
              notes: paymentNotes,
              payment_date: new Date().toISOString().split('T')[0],
            }
          ])
          .select()

        if (error) {
          console.error('Error adding payment:', error)
          alert(paymentType === 'loan' ? 'حدث خطأ أثناء إضافة السلفة' : 'حدث خطأ أثناء إضافة الدفعة')
          return
        }

        // Record payment in the selected safe (if a safe was selected)
        // للدفعة: إيداع في الخزنة / للسلفة: سحب من الخزنة
        if (recordId && paymentMethod === 'cash') {
          try {
            // Get or create drawer for this record
            let { data: drawer, error: drawerError } = await supabase
              .from('cash_drawers')
              .select('*')
              .eq('record_id', recordId)
              .single()

            if (drawerError && drawerError.code === 'PGRST116') {
              // Drawer doesn't exist, create it
              const { data: newDrawer, error: createError } = await supabase
                .from('cash_drawers')
                .insert({ record_id: recordId, current_balance: 0 })
                .select()
                .single()

              if (!createError) {
                drawer = newDrawer
              }
            }

            if (drawer) {
              // للدفعة: إضافة للخزنة / للسلفة: خصم من الخزنة
              const drawerChange = paymentType === 'loan' ? -paymentAmount : paymentAmount
              const newBalance = (drawer.current_balance || 0) + drawerChange

              // Update drawer balance
              await supabase
                .from('cash_drawers')
                .update({
                  current_balance: newBalance,
                  updated_at: new Date().toISOString()
                })
                .eq('id', drawer.id)

              // Create transaction record
              await supabase
                .from('cash_drawer_transactions')
                .insert({
                  drawer_id: drawer.id,
                  record_id: recordId,
                  transaction_type: paymentType === 'loan' ? 'withdrawal' : 'deposit',
                  amount: drawerChange,
                  balance_after: newBalance,
                  notes: paymentType === 'loan'
                    ? `سلفة لعميل: ${entityName}${notes ? ` - ${notes}` : ''}`
                    : `دفعة من عميل: ${entityName}${notes ? ` - ${notes}` : ''}`,
                  performed_by: 'system'
                })

              console.log(`✅ Cash drawer updated with customer ${paymentType}: ${drawerChange}, new balance: ${newBalance}`)
            }
          } catch (drawerError) {
            console.warn('Failed to update cash drawer with customer payment:', drawerError)
            // Don't throw error here as the payment was created successfully
          }
        }
      } else {
        // إعداد الملاحظات مع توضيح نوع العملية للمورد
        const supplierPaymentNotes = paymentType === 'loan'
          ? `سلفة${notes ? ` - ${notes}` : ''}`
          : notes || null

        const { data, error } = await supabase
          .from('supplier_payments')
          .insert([
            {
              supplier_id: entityId,
              amount: paymentAmount,
              payment_method: paymentMethod,
              notes: supplierPaymentNotes,
              payment_date: new Date().toISOString().split('T')[0],
            }
          ])
          .select()

        if (error) {
          console.error('Error adding payment:', error)
          alert(paymentType === 'loan' ? 'حدث خطأ أثناء إضافة السلفة' : 'حدث خطأ أثناء إضافة الدفعة')
          return
        }

        // Record payment in the selected safe (if a safe was selected)
        // للدفعة: المال يخرج من الخزنة (سلبي) / للسلفة: المال يدخل للخزنة (إيجابي)
        if (recordId && paymentMethod === 'cash') {
          try {
            // Get or create drawer for this record
            let { data: drawer, error: drawerError } = await supabase
              .from('cash_drawers')
              .select('*')
              .eq('record_id', recordId)
              .single()

            if (drawerError && drawerError.code === 'PGRST116') {
              // Drawer doesn't exist, create it
              const { data: newDrawer, error: createError } = await supabase
                .from('cash_drawers')
                .insert({ record_id: recordId, current_balance: 0 })
                .select()
                .single()

              if (!createError) {
                drawer = newDrawer
              }
            }

            if (drawer) {
              // للدفعة: خصم من الخزنة / للسلفة: إضافة للخزنة
              const drawerChange = paymentType === 'loan' ? paymentAmount : -paymentAmount
              const newBalance = (drawer.current_balance || 0) + drawerChange

              // Update drawer balance
              await supabase
                .from('cash_drawers')
                .update({
                  current_balance: newBalance,
                  updated_at: new Date().toISOString()
                })
                .eq('id', drawer.id)

              // Create transaction record
              await supabase
                .from('cash_drawer_transactions')
                .insert({
                  drawer_id: drawer.id,
                  record_id: recordId,
                  transaction_type: paymentType === 'loan' ? 'deposit' : 'withdrawal',
                  amount: drawerChange,
                  balance_after: newBalance,
                  notes: paymentType === 'loan'
                    ? `سلفة من مورد: ${entityName}${notes ? ` - ${notes}` : ''}`
                    : `دفعة لمورد: ${entityName}${notes ? ` - ${notes}` : ''}`,
                  performed_by: 'system'
                })

              console.log(`✅ Cash drawer updated with supplier ${paymentType}: ${drawerChange}, new balance: ${newBalance}`)
            }
          } catch (drawerError) {
            console.warn('Failed to update cash drawer with supplier payment:', drawerError)
            // Don't throw error here as the payment was created successfully
          }
        }
      }

      // Success - close modal and refresh
      if (onPaymentAdded) {
        onPaymentAdded()
      }
      onClose()

    } catch (error) {
      console.error('Error adding payment:', error)
      alert('حدث خطأ أثناء إضافة الدفعة')
    } finally {
      setIsSubmitting(false)
    }
  }

  const remainingBalance = currentBalance - (parseFloat(amount) || 0)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-[#2B3544] rounded-lg shadow-xl w-full max-w-md">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-600">
            <h2 className="text-xl font-bold text-white">
              {paymentType === 'loan' ? 'إضافة سلفة' : 'إضافة دفعة'} - {entityName}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Payment Type Toggle - 3/4 للدفعة و 1/4 للسلفة */}
            <div className="flex gap-2 p-1 bg-[#1F2937] rounded-lg border border-gray-600">
              <button
                type="button"
                onClick={() => setPaymentType('payment')}
                className={`flex-[3] py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  paymentType === 'payment'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                دفعة
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('loan')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  paymentType === 'loan'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                إضافة
              </button>
            </div>

            {/* Current Balance Display */}
            <div className={`rounded p-4 text-center ${
              paymentType === 'loan'
                ? 'bg-orange-600/20 border border-orange-600'
                : 'bg-blue-600/20 border border-blue-600'
            }`}>
              <div className={`text-sm mb-1 ${paymentType === 'loan' ? 'text-orange-300' : 'text-blue-300'}`}>
                الرصيد الحالي
              </div>
              <div className="text-2xl font-bold text-white">{formatPrice(currentBalance)}</div>
              {paymentType === 'loan' && (
                <div className="text-xs text-orange-300 mt-1">
                  السلفة ستزيد الرصيد المستحق على العميل
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2 text-right">
                {paymentType === 'loan' ? 'مبلغ السلفة' : 'مبلغ الدفعة'} <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full px-4 py-2 bg-[#1F2937] border border-gray-600 rounded text-white text-right focus:outline-none focus:ring-2 ${
                  paymentType === 'loan' ? 'focus:ring-orange-500' : 'focus:ring-blue-500'
                }`}
                placeholder={paymentType === 'loan' ? 'أدخل مبلغ السلفة' : 'أدخل مبلغ الدفعة'}
                required
              />
            </div>

            {/* Remaining Balance Display */}
            {amount && parseFloat(amount) > 0 && paymentType === 'payment' && (
              <div className={`rounded p-3 text-center ${
                remainingBalance < 0
                  ? 'bg-red-600/20 border border-red-600'
                  : 'bg-green-600/20 border border-green-600'
              }`}>
                <div className="text-sm mb-1" style={{ color: remainingBalance < 0 ? '#FCA5A5' : '#86EFAC' }}>
                  الرصيد المتبقي
                </div>
                <div className="text-xl font-bold text-white">
                  {formatPrice(Math.abs(remainingBalance))}
                  {remainingBalance < 0 && ' (دفع زائد)'}
                </div>
              </div>
            )}

            {/* New Balance Display for Loan */}
            {amount && parseFloat(amount) > 0 && paymentType === 'loan' && (
              <div className="rounded p-3 text-center bg-orange-600/20 border border-orange-600">
                <div className="text-sm mb-1 text-orange-300">
                  الرصيد الجديد بعد السلفة
                </div>
                <div className="text-xl font-bold text-white">
                  {formatPrice(currentBalance + parseFloat(amount))}
                </div>
              </div>
            )}

            {/* Record Selection */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2 text-right">
                الخزنة
              </label>
              {isLoadingRecords ? (
                <div className="text-gray-400 text-sm text-center py-2">جاري تحميل الخزنات...</div>
              ) : (
                <select
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1F2937] border border-gray-600 rounded text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">لا يوجد</option>
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2 text-right">
                طريقة الدفع
              </label>
              {isLoadingPaymentMethods ? (
                <div className="text-gray-400 text-sm text-center py-2">جاري تحميل طرق الدفع...</div>
              ) : (
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1F2937] border border-gray-600 rounded text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.name}>
                      {method.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* البيان */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2 text-right">
                البيان <span className="text-red-400">*</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-[#1F2937] border border-gray-600 rounded text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="أدخل البيان"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors"
                disabled={isSubmitting}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0 || !notes || notes.trim() === ''}
                className={`flex-1 px-4 py-2 text-white rounded font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ${
                  paymentType === 'loan'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting
                  ? 'جاري الإضافة...'
                  : paymentType === 'loan'
                    ? 'إضافة السلفة'
                    : 'إضافة الدفعة'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
