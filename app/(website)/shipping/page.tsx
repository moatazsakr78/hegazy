'use client'

import { useState, useEffect } from 'react'
import { ArrowRightIcon, PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/app/lib/supabase/client'
import { useCompanySettings } from '@/lib/hooks/useCompanySettings'
import { useStoreTheme } from '@/lib/hooks/useStoreTheme'

interface ShippingCompany {
  id: string
  name: string
  created_at: string
  status: 'active' | 'inactive'
}

export default function ShippingPage() {
  const [companies, setCompanies] = useState<ShippingCompany[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get company settings
  const { companyName, logoUrl, isLoading: isCompanyLoading } = useCompanySettings()

  // Get store theme colors
  const { primaryColor, primaryHoverColor, isLoading: isThemeLoading } = useStoreTheme()

  // Load companies from database
  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await (supabase as any)
        .from('shipping_companies')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCompanies((data as any) || [])
    } catch (error) {
      console.error('Error loading companies:', error)
      alert('حدث خطأ في تحميل الشركات')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCompany = async () => {
    if (!newCompanyName.trim() || isSubmitting) return

    try {
      setIsSubmitting(true)
      const { data, error } = await (supabase as any)
        .from('shipping_companies')
        .insert([{ 
          name: newCompanyName.trim(),
          status: 'active'
        }])
        .select()
        .single()
      
      if (error) throw error
      
      setCompanies([(data as any), ...companies])
      setNewCompanyName('')
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding company:', error)
      alert('حدث خطأ في إضافة الشركة')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الشركة؟ سيتم حذف جميع المحافظات والمناطق المرتبطة بها.')) {
      return
    }

    try {
      const { error } = await (supabase as any)
        .from('shipping_companies')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setCompanies(companies.filter(company => company.id !== id))
    } catch (error) {
      console.error('Error deleting company:', error)
      alert('حدث خطأ في حذف الشركة')
    }
  }

  if (isLoading || isCompanyLoading || isThemeLoading) {
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
            <h2 className="text-xl font-bold text-white">إدارة شركات الشحن</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="text-gray-300 hover:text-red-400 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              العودة للمتجر
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-6">
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">شركات الشحن</h2>
            <p className="text-gray-600">إدارة جميع شركات الشحن المضافة إلى النظام</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[var(--primary-color)] hover:bg-[var(--primary-hover-color)] text-white px-6 py-3 rounded-lg transition-colors shadow-md"
          >
            <PlusIcon className="h-5 w-5" />
            إضافة شركة شحن
          </button>
        </div>

        {/* Companies Grid */}
        {companies.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <div className="text-xl font-bold text-gray-700 mb-2">لا توجد شركات شحن</div>
            <p className="text-gray-500 mb-6">لم يتم إضافة أي شركات شحن بعد</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[var(--primary-color)] hover:bg-[var(--primary-hover-color)] text-white px-8 py-3 rounded-lg transition-colors"
            >
              إضافة أول شركة شحن
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{company.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      company.status === 'active' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {company.status === 'active' ? '✓ نشط' : '✗ غير نشط'}
                    </span>
                  </div>

                  <div className="text-gray-500 text-sm mb-6 flex items-center gap-2">
                    <span>📅</span>
                    <span>تم الإنشاء: {new Date(company.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.href = `/shipping/${company.id}`}
                      className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-hover-color)] text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <EyeIcon className="h-4 w-4" />
                      عرض التفاصيل
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteCompany(company.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">إضافة شركة شحن جديدة</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  اسم شركة الشحن
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="أدخل اسم شركة الشحن"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddCompany}
                  disabled={!newCompanyName.trim() || isSubmitting}
                  className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-hover-color)] disabled:bg-gray-300 disabled:text-gray-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {isSubmitting ? 'جاري الإضافة...' : 'إضافة الشركة'}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewCompanyName('')
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