'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Local storage key for suppliers column visibility
const SUPPLIERS_COLUMN_VISIBILITY_KEY = 'suppliers-column-visibility-v2'
import { supabase } from '../../lib/supabase/client'
import ResizableTable from '../../components/tables/ResizableTable'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import AddSupplierModal from '../../components/AddSupplierModal'
import EditSupplierModal from '../../components/EditSupplierModal'
import SupplierGroupSidebar from '../../components/SupplierGroupSidebar'
import SupplierDetailsModal from '../../components/SupplierDetailsModal'
import ColumnsControlModal from '../../components/ColumnsControlModal'
import SuppliersGridView from '../../components/SuppliersGridView'
import MergeSuppliersModal from '../../components/MergeSuppliersModal'
import { useSupplierGroups, SupplierGroup } from '../../lib/hooks/useSupplierGroups'
import { useSuppliers, Supplier, DEFAULT_SUPPLIER_ID } from '../../lib/hooks/useSuppliers'
import {
  ArrowPathIcon,
  FolderPlusIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  PrinterIcon,
  DocumentArrowDownIcon,
  ArrowsUpDownIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  ListBulletIcon,
  MinusIcon,
  FolderIcon,
  FolderOpenIcon,
  UserPlusIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline'
import { ranks } from '@/app/lib/data/ranks'
import Image from 'next/image'

// Supplier groups interface is now imported from the hook

// Supplier data is now loaded from the database via useSuppliers hook

// Table columns matching the design exactly
const tableColumns = [
  { 
    id: 'index', 
    header: '#', 
    accessor: '#', 
    width: 60,
    render: (value: any, item: any, index: number) => (
      <span className="text-gray-400 font-medium">{index + 1}</span>
    )
  },
  { 
    id: 'name', 
    header: 'الاسم', 
    accessor: 'name', 
    width: 200,
    render: (value: string, supplier: Supplier) => (
      <div className="flex items-center gap-2">
        <span className="text-white font-medium">{value}</span>
        {supplier.id === DEFAULT_SUPPLIER_ID && (
          <span className="text-yellow-400">★</span>
        )}
      </div>
    )
  },
  { 
    id: 'category', 
    header: 'الفئة', 
    accessor: 'category', 
    width: 100,
    render: (value: string | null) => <span className="text-gray-300">{value || 'غير محدد'}</span>
  },
  { 
    id: 'points', 
    header: 'النقاط', 
    accessor: 'loyalty_points', 
    width: 120,
    render: (value: number | null) => (
      <span className="text-white font-medium">{(value || 0).toLocaleString()}</span>
    )
  },
  { 
    id: 'rank', 
    header: 'الرتبة', 
    accessor: 'rank', 
    width: 150,
    render: (value: string | null) => {
      if (!value) {
        return <span className="text-gray-300">غير محدد</span>
      }
      
      const rank = ranks.find(r => r.id === value)
      if (!rank) {
        return <span className="text-white font-medium">{value}</span>
      }
      
      return (
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{rank.name}</span>
          <div className="w-5 h-5 relative">
            <Image
              src={rank.icon}
              alt={rank.name}
              fill
              className="object-contain"
            />
          </div>
        </div>
      )
    }
  },
  { 
    id: 'phone', 
    header: 'رقم الهاتف', 
    accessor: 'phone', 
    width: 150,
    render: (value: string | null) => <span className="text-gray-300 font-mono text-sm">{value || 'غير محدد'}</span>
  },
  { 
    id: 'created_at', 
    header: 'تاريخ الإنشاء', 
    accessor: 'created_at', 
    width: 120,
    render: (value: string | null) => {
      if (!value) return <span className="text-gray-300 text-sm">-</span>
      const date = new Date(value)
      return <span className="text-gray-300 text-sm">{date.toLocaleDateString('en-US')}</span>
    }
  },
  { 
    id: 'city', 
    header: 'المدينة', 
    accessor: 'city', 
    width: 120,
    render: (value: string | null) => <span className="text-gray-300">{value || '-'}</span>
  }
]

// Simple tree view component matching the exact reference design
const TreeView = ({ 
  node, 
  level = 0, 
  onToggle,
  onSelect,
  selectedGroupId
}: { 
  node: SupplierGroup
  level?: number
  onToggle: (nodeId: string) => void
  onSelect?: (group: SupplierGroup | null) => void
  selectedGroupId?: string | null
}) => {
  const hasChildren = node.children && node.children.length > 0
  
  const handleGroupClick = () => {
    if (onSelect) {
      // If this group is already selected, deselect it (pass null)
      if (selectedGroupId === node.id) {
        onSelect(null) // Deselect by passing null
      } else {
        onSelect(node) // Select the group
      }
    }
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent group selection when clicking expand/collapse
    if (hasChildren) {
      onToggle(node.id)
    }
  }
  
  return (
    <div>
      <div 
        className={`flex items-center cursor-pointer transition-colors ${
          selectedGroupId === node.id 
            ? 'bg-blue-600 text-white' 
            : 'hover:bg-[#2B3544] text-gray-300 hover:text-white'
        }`}
        style={{ paddingRight: `${16 + level * 24}px`, paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px' }}
        onClick={handleGroupClick}
      >
        <div className="flex items-center gap-2 w-full">
          {/* Fixed width container for expand/collapse button or spacer */}
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            {hasChildren ? (
              <button 
                className="text-gray-400 hover:text-white w-4 h-4 flex items-center justify-center rounded hover:bg-gray-600/20"
                onClick={handleToggleClick}
              >
                {node.isExpanded ? (
                  <MinusIcon className="h-4 w-4" />
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>
          
          <FolderIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
          
          <span className="text-base text-gray-300 truncate">
            {node.name}
          </span>
        </div>
      </div>
      
      {hasChildren && node.isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeView 
              key={child.id} 
              node={child} 
              level={level + 1} 
              onToggle={onToggle}
              onSelect={onSelect}
              selectedGroupId={selectedGroupId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SuppliersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('فئة الموردين')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false)
  const [isEditSupplierModalOpen, setIsEditSupplierModalOpen] = useState(false)
  const [isGroupSidebarOpen, setIsGroupSidebarOpen] = useState(false)
  const [isSupplierDetailsModalOpen, setIsSupplierDetailsModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplierGroup, setSelectedSupplierGroup] = useState<SupplierGroup | null>(null)
  const [supplierGroups, setSupplierGroups] = useState<any[]>([])
  const [editGroup, setEditGroup] = useState<any | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const [isGroupsHidden, setIsGroupsHidden] = useState(true)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<{[key: string]: boolean}>({})
  const suppliersVisibilityLoadedRef = useRef(false)
  
  // Use the real-time hooks for supplier groups and suppliers
  const { groups, isLoading: groupsLoading, error: groupsError, toggleGroup } = useSupplierGroups()
  const { suppliers, isLoading: suppliersLoading, error: suppliersError, isDefaultSupplier } = useSuppliers()

  // Get all columns for columns control modal
  const getAllColumns = () => {
    return tableColumns.map(col => ({
      id: col.id,
      header: col.header,
      visible: visibleColumns[col.id] !== false
    }))
  }

  // Load column visibility from localStorage on mount
  useEffect(() => {
    if (suppliersVisibilityLoadedRef.current) return

    try {
      const savedData = localStorage.getItem(SUPPLIERS_COLUMN_VISIBILITY_KEY)
      if (savedData) {
        const parsed = JSON.parse(savedData)
        setVisibleColumns(parsed)
        console.log('✅ Loaded suppliers column visibility from localStorage')
      }
      suppliersVisibilityLoadedRef.current = true
    } catch (error) {
      console.error('Error loading suppliers column visibility:', error)
      suppliersVisibilityLoadedRef.current = true
    }
  }, [])

  // Handle columns visibility change - saves to localStorage
  const handleColumnsChange = useCallback((updatedColumns: any[]) => {
    const newVisibleColumns: {[key: string]: boolean} = {}
    updatedColumns.forEach(col => {
      newVisibleColumns[col.id] = col.visible
    })
    setVisibleColumns(newVisibleColumns)

    // Save to localStorage
    try {
      localStorage.setItem(SUPPLIERS_COLUMN_VISIBILITY_KEY, JSON.stringify(newVisibleColumns))
      console.log('✅ Saved suppliers column visibility to localStorage')
    } catch (error) {
      console.error('Error saving suppliers column visibility:', error)
    }
  }, [])

  // Filter visible columns
  const visibleTableColumns = tableColumns.filter(col => visibleColumns[col.id] !== false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const toggleAddSupplierModal = () => {
    setIsAddSupplierModalOpen(!isAddSupplierModalOpen)
  }

  const openEditSupplierModal = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setIsEditSupplierModalOpen(true)
  }

  const closeEditSupplierModal = () => {
    setIsEditSupplierModalOpen(false)
    setEditingSupplier(null)
  }

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return
    
    // Prevent deletion of default supplier
    if (isDefaultSupplier(selectedSupplier.id)) {
      alert('لا يمكن حذف المورد الافتراضي')
      return
    }

    const isConfirmed = window.confirm(
      `هل أنت متأكد من حذف المورد "${selectedSupplier.name}"؟\n\nلن يمكن التراجع عن هذا الإجراء.`
    )

    if (!isConfirmed) return

    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', selectedSupplier.id)

      if (error) {
        console.error('Error deleting supplier:', error)
        alert('حدث خطأ أثناء حذف المورد: ' + error.message)
        return
      }

      // Clear selection after successful deletion
      setSelectedSupplier(null)
      
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('حدث خطأ غير متوقع أثناء حذف المورد')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleGroupSidebar = () => {
    setIsGroupSidebarOpen(!isGroupSidebarOpen)
    // Reset edit mode when opening for new group
    if (!isGroupSidebarOpen) {
      setIsEditing(false)
      setEditGroup(null)
      // Auto-select the currently selected group as parent (like in products page)
      // This will be handled in SupplierGroupSidebar useEffect based on selectedGroup prop
    }
  }

  const handleEditGroup = (group: SupplierGroup) => {
    // Convert from hook format to flat format for editing
    const flatGroup = {
      id: group.id,
      name: group.name,
      parent_id: group.parent_id,
      is_active: group.is_active,
      sort_order: group.sort_order,
      created_at: group.created_at,
      updated_at: group.updated_at
    }
    setEditGroup(flatGroup)
    setIsEditing(true)
    setIsGroupSidebarOpen(true)
  }

  const openSupplierDetails = (supplier: any) => {
    setSelectedSupplier(supplier)
    setIsSupplierDetailsModalOpen(true)
  }

  const closeSupplierDetails = () => {
    setIsSupplierDetailsModalOpen(false)
    setSelectedSupplier(null)
  }

  const handleSupplierGroupSelect = (group: SupplierGroup | null) => {
    setSelectedSupplierGroup(group)
    // إلغاء تحديد المورد عند تغيير المجموعة
    setSelectedSupplier(null)
  }

  const toggleGroupsVisibility = () => {
    setIsGroupsHidden(!isGroupsHidden)
  }

  const handleDeleteGroup = async () => {
    if (!selectedSupplierGroup) return
    
    // Prevent deletion of "موردين" group
    if (selectedSupplierGroup.name === 'موردين') {
      alert('لا يمكن حذف المجموعة الرئيسية "موردين"')
      return
    }
    
    // Check if group has subgroups or suppliers
    try {
      // Check for subgroups
      const { data: subgroups, error: subError } = await supabase
        .from('supplier_groups')
        .select('id')
        .eq('parent_id', selectedSupplierGroup.id)
        .or('is_active.is.null,is_active.eq.true')
      
      if (subError) throw subError
      
      if (subgroups && subgroups.length > 0) {
        alert('لا يمكن حذف المجموعة لأنها تحتوي على مجموعات فرعية')
        return
      }
      
      // Check for suppliers in this group
      const { data: suppliers, error: suppError } = await supabase
        .from('suppliers')
        .select('id')
        .eq('group_id', selectedSupplierGroup.id)
        .eq('is_active', true)
      
      if (suppError) throw suppError
      
      if (suppliers && suppliers.length > 0) {
        alert('لا يمكن حذف المجموعة لأنها تحتوي على موردين')
        return
      }
      
      // Show confirmation dialog
      setShowDeleteConfirm(true)
      
    } catch (error) {
      console.error('Error checking group dependencies:', error)
      alert('حدث خطأ أثناء التحقق من المجموعة')
    }
  }

  const confirmDeleteGroup = async () => {
    if (!selectedSupplierGroup) return
    
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('supplier_groups')
        .delete()
        .eq('id', selectedSupplierGroup.id)
      
      if (error) throw error
      
      // Clear selection and close confirmation
      setSelectedSupplierGroup(null)
      setShowDeleteConfirm(false)
      
      // Refresh groups list
      await fetchSupplierGroups()
      
    } catch (error) {
      console.error('Error deleting supplier group:', error)
      alert('حدث خطأ أثناء حذف المجموعة')
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelDeleteGroup = () => {
    setShowDeleteConfirm(false)
  }

  // Fetch supplier groups for SupplierGroupSidebar usage
  const fetchSupplierGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_groups')
        .select('*')
        .or('is_active.is.null,is_active.eq.true')
        .order('sort_order', { ascending: true, nullsFirst: false })
      
      if (error) throw error
      setSupplierGroups(data || [])
    } catch (error) {
      console.error('Error fetching supplier groups:', error)
    }
  }

  // Fetch supplier groups on component mount
  useEffect(() => {
    fetchSupplierGroups()
  }, [])

  // toggleGroup is now provided by the hook

  // دالة للحصول على جميع معرفات المجموعات الفرعية
  const getAllSubGroupIds = (groupId: string, allGroups: SupplierGroup[]): string[] => {
    const subGroups: string[] = [groupId]
    
    const findSubGroups = (parentId: string) => {
      allGroups.forEach(group => {
        if (group.parent_id === parentId) {
          subGroups.push(group.id)
          findSubGroups(group.id) // البحث بشكل متكرر
        }
      })
    }
    
    findSubGroups(groupId)
    return subGroups
  }

  // فلترة الموردين حسب المجموعة المحددة والبحث
  const filteredSuppliers = suppliers.filter(supplier => {
    // فلترة البحث أولاً
    const matchesSearch = supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.phone && supplier.phone.includes(searchQuery)) ||
      (supplier.city && supplier.city.toLowerCase().includes(searchQuery.toLowerCase()))
    
    // إذا لم يكن هناك مجموعة محددة، إظهار جميع الموردين
    if (!selectedSupplierGroup) {
      return matchesSearch
    }
    
    // إذا كانت المجموعة المحددة هي المجموعة الرئيسية "موردين"، إظهار جميع الموردين
    if (selectedSupplierGroup.name === 'موردين') {
      return matchesSearch
    }
    
    // الحصول على جميع المجموعات الفرعية للمجموعة المحددة
    const allGroupIds = getAllSubGroupIds(selectedSupplierGroup.id, groups)
    
    // فلترة الموردين الذين ينتمون للمجموعة أو مجموعاتها الفرعية
    const matchesGroup = supplier.group_id && allGroupIds.includes(supplier.group_id)
    
    return matchesSearch && matchesGroup
  })

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-hidden flex flex-col">
        
        {/* Top Action Buttons Toolbar - Full Width with Horizontal Scroll */}
        <div className="bg-[#374151] border-b border-gray-600 px-4 py-2 w-full">
          <div className="flex items-center justify-start gap-2 overflow-x-auto scrollbar-hide">
            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors">
              <ArrowPathIcon className="h-4 w-4" />
              <span className="text-sm">تحديث</span>
            </button>

            <button
              onClick={toggleGroupSidebar}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors"
            >
              <FolderPlusIcon className="h-4 w-4" />
              <span className="text-sm">مجموعة جديدة</span>
            </button>

            <button
              onClick={() => selectedSupplierGroup && handleEditGroup(selectedSupplierGroup)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                selectedSupplierGroup && !selectedSupplierGroup.isDefault
                  ? 'text-gray-300 hover:text-white hover:bg-gray-600/30'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedSupplierGroup || selectedSupplierGroup.isDefault}
            >
              <PencilSquareIcon className="h-4 w-4" />
              <span className="text-sm">تحرير المجموعة</span>
            </button>

            <button
              onClick={handleDeleteGroup}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                selectedSupplierGroup && !selectedSupplierGroup.isDefault
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-600/10'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedSupplierGroup || selectedSupplierGroup.isDefault}
            >
              <TrashIcon className="h-4 w-4" />
              <span className="text-sm">حذف المجموعة</span>
            </button>

            <button
              onClick={toggleAddSupplierModal}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors"
            >
              <UserPlusIcon className="h-4 w-4" />
              <span className="text-sm">إضافة مورد</span>
            </button>

            <button
              onClick={() => selectedSupplier && openEditSupplierModal(selectedSupplier)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                selectedSupplier
                  ? 'text-gray-300 hover:text-white hover:bg-gray-600/30'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedSupplier}
            >
              <PencilSquareIcon className="h-4 w-4" />
              <span className="text-sm">تحرير المورد</span>
            </button>

            <button
              onClick={handleDeleteSupplier}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                !selectedSupplier
                  ? 'text-gray-500 cursor-not-allowed'
                  : selectedSupplier && isDefaultSupplier(selectedSupplier.id)
                  ? 'text-gray-500 cursor-not-allowed'
                  : isDeleting
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-red-400 hover:text-red-300 hover:bg-red-600/10'
              }`}
              disabled={!selectedSupplier || (selectedSupplier && isDefaultSupplier(selectedSupplier.id)) || isDeleting}
              title={
                !selectedSupplier
                  ? 'اختر مورد للحذف'
                  : selectedSupplier && isDefaultSupplier(selectedSupplier.id)
                  ? 'لا يمكن حذف المورد الافتراضي'
                  : isDeleting
                  ? 'جاري الحذف...'
                  : 'حذف المورد'
              }
            >
              <TrashIcon className="h-4 w-4" />
              <span className="text-sm">{isDeleting ? 'جاري الحذف...' : 'حذف المورد'}</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors">
              <PrinterIcon className="h-4 w-4" />
              <span className="text-sm">طباعة</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors">
              <DocumentArrowDownIcon className="h-4 w-4" />
              <span className="text-sm">حفظ كـ PDF</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors">
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span className="text-sm">استيراد</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors">
              <ArrowUpTrayIcon className="h-4 w-4" />
              <span className="text-sm">تصدير</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors">
              <ArrowsUpDownIcon className="h-4 w-4" />
              <span className="text-sm">ترتيب</span>
            </button>

            <button
              onClick={() => setIsMergeModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors"
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
              <span className="text-sm">دمج الموردين</span>
            </button>

            {viewMode === 'table' && (
              <button
                onClick={() => setShowColumnsModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors"
              >
                <TableCellsIcon className="h-4 w-4" />
                <span className="text-sm">الأعمدة</span>
              </button>
            )}
          </div>
        </div>

        {/* Second Toolbar - Search and Controls - Full Width */}
        <div className="bg-[#374151] border-b border-gray-600 px-2 py-3 w-full flex-shrink-0">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
            {/* Search - First - Increased width slightly */}
            <div className="relative flex-shrink-0">
              <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اسم المورد..."
                className="w-56 sm:w-64 md:w-80 pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Supplier Count Display - Second */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-gray-400 whitespace-nowrap">{filteredSuppliers.length} من {suppliers.length} مورد</span>
            </div>

            {/* Groups Toggle Button - Third */}
            <button
              onClick={toggleGroupsVisibility}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-colors bg-[#2B3544] border border-gray-600 flex-shrink-0"
              title={isGroupsHidden ? 'إظهار المجموعات' : 'إخفاء المجموعات'}
            >
              {isGroupsHidden ? (
                <FolderIcon className="h-4 w-4" />
              ) : (
                <FolderOpenIcon className="h-4 w-4" />
              )}
            </button>

            {/* View Toggle - Fourth */}
            <div className="flex bg-[#2B3544] rounded-md overflow-hidden flex-shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area with Sidebar and Main Content */}
        <div className="flex-1 flex overflow-hidden">

          {/* Supplier Groups Tree Sidebar - Conditional */}
          {!isGroupsHidden && (
            <div className="w-64 bg-[#374151] border-l border-gray-700 flex flex-col">
              {/* Tree View */}
              <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
                {groupsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-400">جاري التحميل...</div>
                  </div>
                ) : groupsError ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-red-400 text-sm">{groupsError}</div>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-400 text-sm">لا توجد مجموعات</div>
                  </div>
                ) : (
                  groups.map((group) => (
                    <TreeView
                      key={group.id}
                      node={group}
                      onToggle={toggleGroup}
                      onSelect={handleSupplierGroupSelect}
                      selectedGroupId={selectedSupplierGroup?.id}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Suppliers Content Container */}
            <div className="flex-1 overflow-hidden bg-[#2B3544]">
              {suppliersLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">جاري تحميل الموردين...</div>
                </div>
              ) : suppliersError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-400">{suppliersError}</div>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="h-full overflow-y-auto scrollbar-hide">
                  <SuppliersGridView
                    suppliers={filteredSuppliers}
                    selectedSupplier={selectedSupplier}
                    onSupplierClick={(supplier) => {
                      // Toggle selection: if already selected, deselect it
                      if (selectedSupplier?.id === supplier.id) {
                        setSelectedSupplier(null)
                      } else {
                        setSelectedSupplier(supplier)
                      }
                    }}
                    onSupplierDoubleClick={openSupplierDetails}
                    isDefaultSupplier={isDefaultSupplier}
                  />
                </div>
              ) : (
                <ResizableTable
                  className="h-full w-full"
                  columns={visibleTableColumns}
                  data={filteredSuppliers}
                  selectedRowId={selectedSupplier?.id || null}
                  onRowClick={(supplier, index) => {
                    // Toggle selection: if already selected, deselect it
                    if (selectedSupplier?.id === supplier.id) {
                      setSelectedSupplier(null)
                    } else {
                      setSelectedSupplier(supplier)
                    }
                  }}
                  onRowDoubleClick={(supplier, index) => {
                    openSupplierDetails(supplier)
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Supplier Modal */}
      <AddSupplierModal 
        isOpen={isAddSupplierModalOpen} 
        onClose={() => setIsAddSupplierModalOpen(false)} 
      />

      {/* Edit Supplier Modal */}
      <EditSupplierModal 
        isOpen={isEditSupplierModalOpen} 
        onClose={closeEditSupplierModal}
        supplier={editingSupplier}
      />

      {/* Supplier Group Sidebar */}
      <SupplierGroupSidebar 
        isOpen={isGroupSidebarOpen} 
        onClose={() => {
          setIsGroupSidebarOpen(false)
          setIsEditing(false)
          setEditGroup(null)
        }}
        supplierGroups={supplierGroups}
        onGroupCreated={fetchSupplierGroups}
        editGroup={editGroup}
        isEditing={isEditing}
        selectedGroup={selectedSupplierGroup ? {
          id: selectedSupplierGroup.id,
          name: selectedSupplierGroup.name,
          parent_id: selectedSupplierGroup.parent_id,
          is_active: selectedSupplierGroup.is_active,
          sort_order: selectedSupplierGroup.sort_order,
          created_at: selectedSupplierGroup.created_at,
          updated_at: selectedSupplierGroup.updated_at
        } : null}
      />

      {/* Supplier Details Modal */}
      <SupplierDetailsModal 
        isOpen={isSupplierDetailsModalOpen} 
        onClose={closeSupplierDetails}
        supplier={selectedSupplier}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={cancelDeleteGroup} />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#3A4553] rounded-lg shadow-2xl border border-[#4A5568] max-w-md w-full">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#4A5568]">
                <h3 className="text-lg font-medium text-white text-right">تأكيد الحذف</h3>
              </div>
              
              {/* Content */}
              <div className="px-6 py-4">
                <p className="text-gray-300 text-right mb-2">
                  هل أنت متأكد من أنك تريد حذف هذه المجموعة؟
                </p>
                <p className="text-blue-400 font-medium text-right">
                  {selectedSupplierGroup?.name}
                </p>
              </div>
              
              {/* Actions */}
              <div className="px-6 py-4 border-t border-[#4A5568] flex gap-3 justify-end">
                <button
                  onClick={cancelDeleteGroup}
                  className="px-4 py-2 text-gray-300 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 hover:border-gray-500 rounded transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDeleteGroup}
                  disabled={isDeleting}
                  className={`px-4 py-2 rounded transition-colors ${
                    isDeleting
                      ? 'bg-red-600/50 text-red-300 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isDeleting ? 'جاري الحذف...' : 'نعم، احذف'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Remove scrollbars globally */}
      <style jsx global>{`
        html, body {
          overflow: hidden;
        }
        
        /* Hide scrollbars but maintain functionality */
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        
        /* Custom scrollbar for table and tree view */
        .table-container, .tree-container {
          scrollbar-width: thin;
          scrollbar-color: #6B7280 #374151;
        }
        
        .table-container::-webkit-scrollbar,
        .tree-container::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        
        .table-container::-webkit-scrollbar-track,
        .tree-container::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 4px;
        }
        
        .table-container::-webkit-scrollbar-thumb,
        .tree-container::-webkit-scrollbar-thumb {
          background: #6B7280;
          border-radius: 4px;
        }
        
        .table-container::-webkit-scrollbar-thumb:hover,
        .tree-container::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
        }
      `}</style>

      {/* Columns Control Modal */}
      <ColumnsControlModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        columns={getAllColumns()}
        onColumnsChange={handleColumnsChange}
      />

      {/* Merge Suppliers Modal */}
      <MergeSuppliersModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        onMergeComplete={() => {
          // Refresh is handled automatically by real-time hook
          setSelectedSupplier(null)
        }}
        preSelectedSupplier={selectedSupplier}
      />
    </div>
  )
}