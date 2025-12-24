'use client'

import { useState, useEffect } from 'react'
import { ArrowRightIcon, PlusIcon, PencilIcon, TrashIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase/client'
import { useCompanySettings } from '@/lib/hooks/useCompanySettings'
import { useStoreTheme } from '@/lib/hooks/useStoreTheme'

interface Area {
  id: string
  name: string
  price: number
}

interface Governorate {
  id: string
  name: string
  type: 'simple' | 'complex'
  price?: number // للمحافظات البسيطة
  areas: Area[] // للمحافظات المركبة
}

interface ShippingCompany {
  id: string
  name: string
  status: string
}

const egyptianGovernorates = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'القليوبية', 'كفر الشيخ', 
  'الغربية', 'المنوفية', 'البحيرة', 'الإسماعيلية', 'بورسعيد', 'السويس', 'المنيا', 
  'بني سويف', 'الفيوم', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء', 'دمياط'
]

export default function ShippingCompanyDetails() {
  const params = useParams()
  const router = useRouter()
  const companyId = params?.id as string
  const { companyName, logoUrl, isLoading: isCompanyLoading } = useCompanySettings()

  // Get store theme colors
  const { primaryColor, primaryHoverColor, isLoading: isThemeLoading } = useStoreTheme()

  const [company, setCompany] = useState<ShippingCompany | null>(null)
  const [governorates, setGovernorates] = useState<Governorate[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [selectedGovernorate, setSelectedGovernorate] = useState<Governorate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states for add governorate modal
  const [newGovName, setNewGovName] = useState('')
  const [govType, setGovType] = useState<'simple' | 'complex'>('simple')
  const [govPrice, setGovPrice] = useState('')

  // Form states for add area modal
  const [newAreaName, setNewAreaName] = useState('')
  const [newAreaPrice, setNewAreaPrice] = useState('')

  useEffect(() => {
    if (companyId) {
      loadCompanyData()
      loadGovernorates()
    }
  }, [companyId])

  const loadCompanyData = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('shipping_companies')
        .select('*')
        .eq('id', companyId)
        .single()
      
      if (error) throw error
      setCompany(data as any)
    } catch (error) {
      console.error('Error loading company:', error)
      alert('حدث خطأ في تحميل بيانات الشركة')
    }
  }

  const loadGovernorates = async () => {
    try {
      setIsLoading(true)
      // Load governorates with their areas
      const { data: governoratesData, error: govError } = await (supabase as any)
        .from('shipping_governorates')
        .select(`
          *,
          shipping_areas (
            id,
            name,
            price
          )
        `)
        .eq('shipping_company_id', companyId)
        .order('created_at', { ascending: false })

      if (govError) throw govError

      // Transform data to match our interface
      const transformedGovernorates = (governoratesData as any).map((gov: any) => ({
        id: gov.id,
        name: gov.name,
        type: gov.type as 'simple' | 'complex',
        price: gov.price,
        areas: gov.shipping_areas.map((area: any) => ({
          id: area.id,
          name: area.name,
          price: area.price
        }))
      }))

      setGovernorates(transformedGovernorates)
    } catch (error) {
      console.error('Error loading governorates:', error)
      alert('حدث خطأ في تحميل المحافظات')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddGovernorate = async () => {
    if (!newGovName.trim() || isSubmitting) return
    if (govType === 'simple' && !govPrice.trim()) return

    try {
      setIsSubmitting(true)
      const { data, error } = await (supabase as any)
        .from('shipping_governorates')
        .insert([{
          shipping_company_id: companyId,
          name: newGovName.trim(),
          type: govType,
          price: govType === 'simple' ? parseFloat(govPrice) : null
        }])
        .select()
        .single()

      if (error) throw error

      const newGov: Governorate = {
        id: (data as any).id,
        name: (data as any).name,
        type: (data as any).type,
        price: (data as any).price,
        areas: []
      }

      setGovernorates([newGov, ...governorates])
      setNewGovName('')
      setGovPrice('')
      setGovType('simple')
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding governorate:', error)
      alert('حدث خطأ في إضافة المحافظة')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddArea = async () => {
    if (!selectedGovernorate || !newAreaName.trim() || !newAreaPrice.trim() || isSubmitting) return

    try {
      setIsSubmitting(true)
      const { data, error } = await (supabase as any)
        .from('shipping_areas')
        .insert([{
          shipping_governorate_id: selectedGovernorate.id,
          name: newAreaName.trim(),
          price: parseFloat(newAreaPrice)
        }])
        .select()
        .single()

      if (error) throw error

      const newArea: Area = {
        id: (data as any).id,
        name: (data as any).name,
        price: (data as any).price
      }

      const updatedGovernorates = governorates.map(gov => 
        gov.id === selectedGovernorate.id 
          ? { ...gov, areas: [newArea, ...gov.areas] }
          : gov
      )

      setGovernorates(updatedGovernorates)
      setNewAreaName('')
      setNewAreaPrice('')
      setShowAreaModal(false)
      setSelectedGovernorate(null)
    } catch (error) {
      console.error('Error adding area:', error)
      alert('حدث خطأ في إضافة المنطقة')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteGovernorate = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المحافظة؟ سيتم حذف جميع المناطق المرتبطة بها.')) {
      return
    }

    try {
      const { error } = await (supabase as any)
        .from('shipping_governorates')
        .delete()
        .eq('id', id)

      if (error) throw error

      setGovernorates(governorates.filter(gov => gov.id !== id))
    } catch (error) {
      console.error('Error deleting governorate:', error)
      alert('حدث خطأ في حذف المحافظة')
    }
  }

  const handleDeleteArea = async (govId: string, areaId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المنطقة؟')) {
      return
    }

    try {
      const { error } = await (supabase as any)
        .from('shipping_areas')
        .delete()
        .eq('id', areaId)

      if (error) throw error

      const updatedGovernorates = governorates.map(gov =>
        gov.id === govId 
          ? { ...gov, areas: gov.areas.filter(area => area.id !== areaId) }
          : gov
      )
      setGovernorates(updatedGovernorates)
    } catch (error) {
      console.error('Error deleting area:', error)
      alert('حدث خطأ في حذف المنطقة')
    }
  }

  const availableGovernorates = egyptianGovernorates.filter(
    gov => !governorates.some(g => g.name === gov)
  )

  if (isLoading || !company || isCompanyLoading || isThemeLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-700 py-0 sticky top-0 z-10" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="max-w-[80%] mx-auto px-4 flex items-center justify-between min-h-[80px]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 rounded-lg flex items-center justify-center">
                <img 
                  src={logoUrl || '/assets/logo/Hegazy.png'} 
                  alt="Hegazy Logo" 
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
              <h1 className="text-xl font-bold text-white">{companyName}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">{company.name}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/shipping')}
              className="text-gray-300 hover:text-red-400 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              العودة للخلف
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-6">
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">المحافظات والأسعار</h2>
            <p className="text-gray-600">إدارة أسعار الشحن لكل محافظة ومنطقة</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[var(--primary-color)] hover:bg-[var(--primary-hover-color)] text-white px-6 py-3 rounded-lg transition-colors shadow-md"
          >
            <PlusIcon className="h-5 w-5" />
            إضافة محافظة
          </button>
        </div>

        {/* Governorates List */}
        {governorates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <div className="text-xl font-bold text-gray-700 mb-2">لا توجد محافظات مضافة</div>
            <p className="text-gray-500 mb-6">ابدأ بإضافة المحافظات وتحديد أسعار الشحن</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[var(--primary-color)] hover:bg-[var(--primary-hover-color)] text-white px-8 py-3 rounded-lg transition-colors"
            >
              إضافة أول محافظة
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {governorates.map((gov) => (
              <div
                key={gov.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <MapPinIcon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-800">{gov.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            gov.type === 'simple' 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'bg-orange-100 text-orange-700 border border-orange-200'
                          }`}>
                            {gov.type === 'simple' ? '📍 بسيط' : '🏘️ مركب'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {gov.type === 'complex' && (
                        <button
                          onClick={() => {
                            setSelectedGovernorate(gov)
                            setShowAreaModal(true)
                          }}
                          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                        >
                          <PlusIcon className="h-4 w-4" />
                          إضافة منطقة
                        </button>
                      )}
                      
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteGovernorate(gov.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Simple Governorate Price */}
                  {gov.type === 'simple' && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">سعر الشحن</div>
                        <div className="text-3xl font-bold text-green-600">{gov.price} <span className="text-lg">جنيه</span></div>
                      </div>
                    </div>
                  )}

                  {/* Complex Governorate Areas */}
                  {gov.type === 'complex' && (
                    <div>
                      {gov.areas.length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-8 text-center">
                          <div className="text-gray-400 mb-2">لم يتم إضافة أي مناطق بعد</div>
                          <button
                            onClick={() => {
                              setSelectedGovernorate(gov)
                              setShowAreaModal(true)
                            }}
                            className="text-orange-600 hover:text-orange-700 font-medium"
                          >
                            إضافة منطقة
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {gov.areas.map((area) => (
                            <div
                              key={area.id}
                              className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-gray-800">{area.name}</div>
                                  <div className="text-lg font-bold text-green-600">{area.price} جنيه</div>
                                </div>
                                <button
                                  onClick={() => handleDeleteArea(gov.id, area.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Governorate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">إضافة محافظة جديدة</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  اسم المحافظة
                </label>
                <select
                  value={newGovName}
                  onChange={(e) => setNewGovName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="">اختر المحافظة</option>
                  {availableGovernorates.map((gov) => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  نوع المحافظة
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGovType('simple')}
                    disabled={isSubmitting}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      govType === 'simple'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl mb-2">📍</div>
                    <div className="font-medium">بسيط</div>
                    <div className="text-xs mt-1">سعر واحد للمحافظة</div>
                  </button>
                  <button
                    onClick={() => setGovType('complex')}
                    disabled={isSubmitting}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      govType === 'complex'
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl mb-2">🏘️</div>
                    <div className="font-medium">مركب</div>
                    <div className="text-xs mt-1">أسعار مختلفة للمناطق</div>
                  </button>
                </div>
              </div>

              {govType === 'simple' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    سعر الشحن (جنيه)
                  </label>
                  <input
                    type="number"
                    value={govPrice}
                    onChange={(e) => setGovPrice(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="أدخل سعر الشحن"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {govType === 'complex' && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-700">
                    <div className="text-lg">ℹ️</div>
                    <div className="text-sm">
                      سيتم تحديد أسعار الشحن لكل منطقة داخل المحافظة بعد الإضافة
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAddGovernorate}
                  disabled={!newGovName.trim() || (govType === 'simple' && !govPrice.trim()) || isSubmitting}
                  className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-hover-color)] disabled:bg-gray-300 disabled:text-gray-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {isSubmitting ? 'جاري الإضافة...' : 'إضافة المحافظة'}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewGovName('')
                    setGovPrice('')
                    setGovType('simple')
                  }}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Area Modal */}
      {showAreaModal && selectedGovernorate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                إضافة منطقة جديدة
              </h2>
              <p className="text-gray-600 text-center mb-6">{selectedGovernorate.name}</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  اسم المنطقة
                </label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="أدخل اسم المنطقة"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  سعر الشحن (جنيه)
                </label>
                <input
                  type="number"
                  value={newAreaPrice}
                  onChange={(e) => setNewAreaPrice(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="أدخل سعر الشحن"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddArea}
                  disabled={!newAreaName.trim() || !newAreaPrice.trim() || isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:text-gray-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {isSubmitting ? 'جاري الإضافة...' : 'إضافة المنطقة'}
                </button>
                <button
                  onClick={() => {
                    setShowAreaModal(false)
                    setSelectedGovernorate(null)
                    setNewAreaName('')
                    setNewAreaPrice('')
                  }}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}