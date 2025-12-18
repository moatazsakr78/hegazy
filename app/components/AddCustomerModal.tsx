'use client'

import { useState, useEffect } from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import SearchableSelect from './ui/SearchableSelect'
import { useCustomerGroups } from '@/app/lib/hooks/useCustomerGroups'
import { ranks } from '@/app/lib/data/ranks'
import { egyptianGovernorates } from '@/app/lib/data/governorates'
import { supabase } from '@/app/lib/supabase/client'

// Price type options
const priceTypeOptions = [
  { value: 'price', label: 'سعر البيع' },
  { value: 'wholesale_price', label: 'سعر الجملة' },
  { value: 'price1', label: 'سعر 1' },
  { value: 'price2', label: 'سعر 2' },
  { value: 'price3', label: 'سعر 3' },
  { value: 'price4', label: 'سعر 4' },
]

interface AddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddCustomerModal({ isOpen, onClose }: AddCustomerModalProps) {
  const [activeTab, setActiveTab] = useState('details')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [records, setRecords] = useState<{ id: string; name: string }[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(true)

  const [formData, setFormData] = useState({
    name: '',
    group: '',
    accountBalance: '',
    allowedLimit: '',
    rank: '',
    phone: '',
    backupPhone: '',
    governorate: '',
    address: '',
    defaultRecordId: '',
    defaultPriceType: 'price'
  })

  const { groups, isLoading: groupsLoading } = useCustomerGroups()

  // Fetch records for the dropdown
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setIsLoadingRecords(true)
        const { data, error } = await supabase
          .from('records')
          .select('id, name')
          .order('name')

        if (error) throw error
        setRecords(data || [])

        // Set default record to 'الخزنة الرئيسية' if exists
        const defaultRecord = data?.find(r => r.name === 'الخزنة الرئيسية')
        if (defaultRecord) {
          setFormData(prev => ({ ...prev, defaultRecordId: defaultRecord.id }))
        }
      } catch (err) {
        console.error('Error fetching records:', err)
      } finally {
        setIsLoadingRecords(false)
      }
    }

    if (isOpen) {
      fetchRecords()
    }
  }, [isOpen])

  const tabs = [
    { id: 'details', label: 'تفاصيل العميل' },
    { id: 'sales', label: 'ربط البيع' }
  ]

  // Convert records to options format
  const recordOptions = records.map(record => ({
    value: record.id,
    label: record.name
  }))

  // Convert customer groups to options format
  const customerGroupOptions = groups.flatMap(group => {
    const flatGroups = group.children || []
    return flatGroups.map(childGroup => ({
      value: childGroup.id,
      label: childGroup.name
    }))
  })

  // Convert ranks to options format
  const rankOptions = ranks.map(rank => ({
    value: rank.id,
    label: rank.name,
    icon: rank.icon
  }))

  // Convert governorates to options format
  const governorateOptions = egyptianGovernorates.map(gov => ({
    value: gov.id,
    label: gov.name
  }))

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('اسم العميل مطلوب')
      return false
    }

    return true
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      // Get governorate name for city field
      const selectedGovernorate = egyptianGovernorates.find(gov => gov.id === formData.governorate)
      const selectedRank = ranks.find(rank => rank.id === formData.rank)

      // Prepare customer data
      const customerData = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        backup_phone: formData.backupPhone.trim() || null,
        address: formData.address.trim() || null,
        city: selectedGovernorate?.name || null,
        group_id: formData.group || null,
        rank: selectedRank?.id || null,
        category: formData.group ? customerGroupOptions.find(opt => opt.value === formData.group)?.label : null,
        account_balance: formData.accountBalance ? parseFloat(formData.accountBalance) : 0,
        credit_limit: formData.allowedLimit ? parseFloat(formData.allowedLimit) : 1000,
        is_active: true,
        default_record_id: formData.defaultRecordId || null,
        default_price_type: formData.defaultPriceType || 'price'
      }

      // Insert customer into database
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()

      if (error) {
        console.error('Error saving customer:', error)
        setError('حدث خطأ أثناء حفظ العميل: ' + error.message)
        return
      }

      setSuccess('تم إضافة العميل بنجاح!')
      
      // Reset form after 1.5 seconds and close modal
      setTimeout(() => {
        resetForm()
        onClose()
      }, 1500)

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('حدث خطأ غير متوقع')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    // Find default record
    const defaultRecord = records.find(r => r.name === 'الخزنة الرئيسية')
    setFormData({
      name: '',
      group: '',
      accountBalance: '',
      allowedLimit: '',
      rank: '',
      phone: '',
      backupPhone: '',
      governorate: '',
      address: '',
      defaultRecordId: defaultRecord?.id || '',
      defaultPriceType: 'price'
    })
    setError(null)
    setSuccess(null)
    setActiveTab('details')
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const handleClearFields = () => {
    resetForm()
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar - wider for customer form */}
      <div className={`fixed top-12 right-0 h-[calc(100vh-3rem)] w-[500px] bg-[#3A4553] z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } shadow-2xl`}>

        {/* Header */}
        <div className="bg-[#3A4553] px-4 py-3 flex items-center justify-start border-b border-[#4A5568]">
          <h2 className="text-white text-lg font-medium flex-1 text-right">إضافة عميل</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors ml-4"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="bg-[#3A4553] border-b border-[#4A5568]">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#5DADE2]'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5DADE2]"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pb-24 space-y-4">

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded text-right text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-500 text-green-400 px-4 py-3 rounded text-right text-sm">
              {success}
            </div>
          )}

          {/* Tab: تفاصيل العميل */}
          {activeTab === 'details' && (
            <>
          {/* Customer Name */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              اسم العميل *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="أدخل اسم العميل"
              className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
            />
          </div>

          {/* Group */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              المجموعة
            </label>
            {groupsLoading ? (
              <div className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-gray-400 text-right text-sm">
                جاري التحميل...
              </div>
            ) : (
              <SearchableSelect
                options={customerGroupOptions}
                value={formData.group}
                onChange={(value) => handleSelectChange('group', value)}
                placeholder="-- اختر المجموعة --"
                searchPlaceholder="بحث في المجموعات..."
                name="group"
              />
            )}
          </div>

          {/* Opening Balance */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              الرصيد الافتتاحي للعميل
            </label>
            <input
              type="number"
              name="accountBalance"
              value={formData.accountBalance}
              onChange={handleInputChange}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
            />
            <p className="text-gray-400 text-xs text-right">
              هذا الرصيد يُحدد مرة واحدة فقط عند إضافة العميل ولا يمكن تعديله لاحقاً
            </p>
          </div>

          {/* Allowed Limit */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              الحد المسموح
            </label>
            <input
              type="number"
              name="allowedLimit"
              value={formData.allowedLimit}
              onChange={handleInputChange}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
            />
          </div>

          {/* Rank */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              الرتبة
            </label>
            <SearchableSelect
              options={rankOptions}
              value={formData.rank}
              onChange={(value) => handleSelectChange('rank', value)}
              placeholder="-- اختر الرتبة --"
              searchPlaceholder="بحث في الرتب..."
              name="rank"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              رقم الهاتف
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="أدخل رقم الهاتف"
              className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
            />
          </div>

          {/* Backup Phone Number */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              رقم الهاتف الاحتياطي (اختياري)
            </label>
            <input
              type="tel"
              name="backupPhone"
              value={formData.backupPhone}
              onChange={handleInputChange}
              placeholder="أدخل رقم الهاتف الاحتياطي"
              className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
            />
          </div>

          {/* Governorate */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              المحافظة
            </label>
            <SearchableSelect
              options={governorateOptions}
              value={formData.governorate}
              onChange={(value) => handleSelectChange('governorate', value)}
              placeholder="-- اختر المحافظة --"
              searchPlaceholder="بحث في المحافظات..."
              name="governorate"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              العنوان
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="أدخل العنوان التفصيلي"
              rows={3}
              className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm resize-none"
            />
          </div>
            </>
          )}

          {/* Tab: ربط البيع */}
          {activeTab === 'sales' && (
            <>
              {/* Default Record */}
              <div className="space-y-2">
                <label className="block text-white text-sm font-medium text-right">
                  الخزنة الافتراضية
                </label>
                {isLoadingRecords ? (
                  <div className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-gray-400 text-right text-sm">
                    جاري التحميل...
                  </div>
                ) : (
                  <SearchableSelect
                    options={recordOptions}
                    value={formData.defaultRecordId}
                    onChange={(value) => handleSelectChange('defaultRecordId', value)}
                    placeholder="-- اختر الخزنة --"
                    searchPlaceholder="بحث في الخزن..."
                    name="defaultRecordId"
                  />
                )}
                <p className="text-gray-400 text-xs text-right">
                  الخزنة التي سيتم استخدامه تلقائياً عند اختيار هذا العميل في نقطة البيع
                </p>
              </div>

              {/* Default Price Type */}
              <div className="space-y-2">
                <label className="block text-white text-sm font-medium text-right">
                  نوع السعر الافتراضي
                </label>
                <SearchableSelect
                  options={priceTypeOptions}
                  value={formData.defaultPriceType}
                  onChange={(value) => handleSelectChange('defaultPriceType', value)}
                  placeholder="-- اختر نوع السعر --"
                  searchPlaceholder="بحث..."
                  name="defaultPriceType"
                />
                <p className="text-gray-400 text-xs text-right">
                  نوع السعر الذي سيتم استخدامه تلقائياً عند البيع لهذا العميل
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#3A4553] border-t border-[#4A5568]">
          <div className="flex gap-2">
            {/* Clear Fields Button */}
            <button
              onClick={handleClearFields}
              className="bg-transparent hover:bg-[#EF4444]/10 text-[#EF4444] px-4 py-2 rounded-md border border-[#EF4444] hover:border-[#DC2626] hover:text-[#DC2626] text-sm font-medium transition-all duration-200"
            >
              تصفية الخلايا
            </button>
            
            <div className="flex-1"></div>
            
            {/* Cancel and Save buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500 px-4 py-2 text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className={`bg-transparent border px-4 py-2 text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center gap-2 ${
                  isLoading 
                    ? 'border-gray-600 text-gray-500 cursor-not-allowed' 
                    : 'hover:bg-gray-600/10 text-gray-300 border-gray-600 hover:border-gray-500'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    حفظ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}