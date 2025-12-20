'use client'

import {
  PlusIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import SafeDetailsModal from '../../components/SafeDetailsModal'
import AddSafeModal from '../../components/AddSafeModal'
import EditSafeModal from '../../components/EditSafeModal'

export default function SafesPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSafeDetailsModalOpen, setIsSafeDetailsModalOpen] = useState(false)
  const [isAddSafeModalOpen, setIsAddSafeModalOpen] = useState(false)
  const [isEditSafeModalOpen, setIsEditSafeModalOpen] = useState(false)
  const [selectedSafe, setSelectedSafe] = useState<any>(null)
  const [safeToEdit, setSafeToEdit] = useState<any>(null)
  const [safes, setSafes] = useState<any[]>([])
  const [activeSafesCount, setActiveSafesCount] = useState(0)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const openSafeDetails = (safe: any) => {
    setSelectedSafe(safe)
    setIsSafeDetailsModalOpen(true)
  }

  const closeSafeDetails = () => {
    setIsSafeDetailsModalOpen(false)
    setSelectedSafe(null)
  }

  const openAddSafeModal = () => {
    setIsAddSafeModalOpen(true)
  }

  const closeAddSafeModal = () => {
    setIsAddSafeModalOpen(false)
  }

  const openEditSafeModal = (safe: any) => {
    setSafeToEdit(safe)
    setIsEditSafeModalOpen(true)
  }

  const closeEditSafeModal = () => {
    setIsEditSafeModalOpen(false)
    setSafeToEdit(null)
  }

  const handleDeleteSafe = async (safe: any) => {
    // Prevent deletion of primary safe
    if (safe.is_primary) {
      alert('لا يمكن حذف الخزنة الرئيسية')
      return
    }

    try {
      // Check if safe has balance before allowing deletion
      const { data: drawer, error: drawerError } = await supabase
        .from('cash_drawers')
        .select('current_balance')
        .eq('record_id', safe.id)
        .single()

      if (drawerError && drawerError.code !== 'PGRST116') {
        console.error('Error checking safe balance:', drawerError)
        alert('حدث خطأ أثناء التحقق من رصيد الخزنة')
        return
      }

      // Prevent deletion if safe has balance
      const balance = drawer?.current_balance || 0
      if (balance !== 0) {
        alert(`لا يمكن حذف الخزنة "${safe.name}" لأنها تحتوي على رصيد (${balance.toLocaleString()} ج.م)\n\nيجب تفريغ الخزنة أولاً قبل حذفها`)
        return
      }

      if (window.confirm(`هل أنت متأكد من حذف الخزنة "${safe.name}"؟`)) {
        const { error } = await supabase
          .from('records')
          .delete()
          .eq('id', safe.id)

        if (error) {
          console.error('Error deleting safe:', error)
          alert('حدث خطأ أثناء حذف الخزنة')
          return
        }

        // The real-time subscription will automatically update the UI
      }
    } catch (error) {
      console.error('Error deleting safe:', error)
      alert('حدث خطأ أثناء حذف الخزنة')
    }
  }


  const fetchSafes = async () => {
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching safes:', error)
        return
      }

      setSafes(data || [])
      setActiveSafesCount(data?.filter((safe: any) => safe.is_active).length || 0)
    } catch (error) {
      console.error('Error fetching safes:', error)
    }
  }

  const handleSafeAdded = () => {
    fetchSafes()
  }

  const handleSafeUpdated = () => {
    fetchSafes()
  }

  useEffect(() => {
    fetchSafes()

    // Set up real-time subscription
    const channel = supabase
      .channel('safes_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'records' },
        (payload: any) => {
          console.log('Real-time update:', payload)
          fetchSafes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-y-auto scrollbar-hide bg-pos-dark text-white" dir="rtl">
      {/* Header */}
      <div className="bg-pos-darker p-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/payment-methods')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-purple-700 transition-colors"
          >
            <BanknotesIcon className="h-4 w-4" />
            طرق الدفع
          </button>
        </div>

        <div className="flex items-center gap-4">
          <h1 className="text-xl font-medium text-gray-300">
            إدارة وعرض جميع الخزن المالية
          </h1>
          <h1 className="text-xl font-bold">الخزن</h1>
          <BanknotesIcon className="h-6 w-6 text-purple-600" />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Balance */}
        <div className="bg-pos-darker rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">الرصيد الإجمالي</p>
              <p className="text-2xl font-bold text-white mt-1">$٠.٠٠</p>
            </div>
            <div className="text-blue-500 text-3xl">$</div>
          </div>
        </div>

        {/* Active Safes */}
        <div className="bg-pos-darker rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">الخزن النشطة</p>
              <p className="text-2xl font-bold text-white mt-1">{activeSafesCount}</p>
            </div>
            <div className="text-green-500 text-2xl">👁</div>
          </div>
        </div>

        {/* Total Safes */}
        <div className="bg-pos-darker rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">إجمالي الخزن</p>
              <p className="text-2xl font-bold text-white mt-1">{safes.length}</p>
            </div>
            <div className="text-purple-500 text-2xl">🏦</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={openAddSafeModal}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              إضافة خزنة جديدة
            </button>
            <button className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium">
              جميع الفروع
            </button>
            <button className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium flex items-center gap-2">
              جميع الأنواع
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="البحث في الخزن..."
              className="bg-gray-700 text-white placeholder-gray-400 pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
            />
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Safes Table */}
      <div className="mx-6 bg-pos-darker rounded-lg overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-3 text-right font-medium">#</th>
              <th className="p-3 text-right font-medium">اسم الخزنة</th>
              <th className="p-3 text-right font-medium">الحالة</th>
              <th className="p-3 text-right font-medium">تاريخ الإنشاء</th>
              <th className="p-3 text-right font-medium">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="bg-pos-darker divide-y divide-gray-700">
            {safes.map((safe, index) => (
              <tr
                key={safe.id}
                className="hover:bg-gray-700 transition-colors cursor-pointer"
                onDoubleClick={() => openSafeDetails(safe)}
              >
                <td className="p-3 text-white font-medium">{index + 1}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${
                      safe.is_primary
                        ? 'bg-purple-600'
                        : 'bg-blue-600'
                    } rounded flex items-center justify-center`}>
                      <BanknotesIcon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-white font-medium">{safe.name}</span>
                    {safe.is_primary && (
                      <span className="px-2 py-1 rounded-full text-xs mr-2 bg-purple-900 text-purple-300">
                        رئيسية
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    safe.is_active
                      ? 'bg-green-900 text-green-300'
                      : 'bg-red-900 text-red-300'
                  }`}>
                    {safe.is_active ? 'نشطة' : 'غير نشطة'}
                  </span>
                </td>
                <td className="p-3 text-gray-400">{formatDate(safe.created_at)}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditSafeModal(safe)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                    >
                      <PencilIcon className="h-3 w-3" />
                      تعديل
                    </button>
                    {!safe.is_primary && (
                      <button
                        onClick={() => handleDeleteSafe(safe)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                      >
                        <TrashIcon className="h-3 w-3" />
                        حذف
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-6"></div>
      </div>

      {/* Safe Details Modal */}
      <SafeDetailsModal
        isOpen={isSafeDetailsModalOpen}
        onClose={closeSafeDetails}
        safe={selectedSafe}
      />

      {/* Add Safe Modal */}
      <AddSafeModal
        isOpen={isAddSafeModalOpen}
        onClose={closeAddSafeModal}
        onSafeAdded={handleSafeAdded}
      />

      {/* Edit Safe Modal */}
      <EditSafeModal
        isOpen={isEditSafeModalOpen}
        onClose={closeEditSafeModal}
        onSafeUpdated={handleSafeUpdated}
        safe={safeToEdit}
      />
    </div>
  )
}