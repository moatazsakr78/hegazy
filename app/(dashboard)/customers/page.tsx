'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Local storage key for customers column visibility
const CUSTOMERS_COLUMN_VISIBILITY_KEY = 'customers-column-visibility-v2'
import { supabase } from '../../lib/supabase/client'
import ResizableTable from '../../components/tables/ResizableTable'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import AddCustomerModal from '../../components/AddCustomerModal'
import EditCustomerModal from '../../components/EditCustomerModal'
import CustomerGroupSidebar from '../../components/CustomerGroupSidebar'
import CustomerDetailsModal from '../../components/CustomerDetailsModal'
import ColumnsControlModal from '../../components/ColumnsControlModal'
import { useCustomerGroups, CustomerGroup } from '../../lib/hooks/useCustomerGroups'
import { useCustomers, Customer, DEFAULT_CUSTOMER_ID } from '../../lib/hooks/useCustomers'
import CustomersGridView from '../../components/CustomersGridView'
import MergeCustomersModal from '../../components/MergeCustomersModal'
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

// Customer groups interface is now imported from the hook

// Customer data is now loaded from the database via useCustomers hook

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
    render: (value: string, customer: Customer) => (
      <div className="flex items-center gap-2">
        <span className="text-white font-medium">{value}</span>
        {customer.id === DEFAULT_CUSTOMER_ID && (
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
    id: 'backup_phone',
    header: 'رقم الهاتف الاحتياطي',
    accessor: 'backup_phone',
    width: 150,
    render: (value: string | null) => <span className="text-gray-300 font-mono text-sm">{value || '-'}</span>
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
  node: CustomerGroup
  level?: number
  onToggle: (nodeId: string) => void
  onSelect?: (group: CustomerGroup | null) => void
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

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('فئة العملاء')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false)
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false)
  const [isGroupSidebarOpen, setIsGroupSidebarOpen] = useState(false)
  const [isCustomerDetailsModalOpen, setIsCustomerDetailsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState<CustomerGroup | null>(null)
  const [customerGroups, setCustomerGroups] = useState<any[]>([])
  const [editGroup, setEditGroup] = useState<any | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<{[key: string]: boolean}>({})
  const customersVisibilityLoadedRef = useRef(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const [isGroupsHidden, setIsGroupsHidden] = useState(true)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)

  // Use the real-time hooks for customer groups and customers
  const { groups, isLoading: groupsLoading, error: groupsError, toggleGroup } = useCustomerGroups()
  const { customers, isLoading: customersLoading, error: customersError, isDefaultCustomer } = useCustomers()

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
    if (customersVisibilityLoadedRef.current) return

    try {
      const savedData = localStorage.getItem(CUSTOMERS_COLUMN_VISIBILITY_KEY)
      if (savedData) {
        const parsed = JSON.parse(savedData)
        setVisibleColumns(parsed)
        console.log('✅ Loaded customers column visibility from localStorage')
      }
      customersVisibilityLoadedRef.current = true
    } catch (error) {
      console.error('Error loading customers column visibility:', error)
      customersVisibilityLoadedRef.current = true
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
      localStorage.setItem(CUSTOMERS_COLUMN_VISIBILITY_KEY, JSON.stringify(newVisibleColumns))
      console.log('✅ Saved customers column visibility to localStorage')
    } catch (error) {
      console.error('Error saving customers column visibility:', error)
    }
  }, [])

  // Filter visible columns
  const visibleTableColumns = tableColumns.filter(col => visibleColumns[col.id] !== false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const toggleAddCustomerModal = () => {
    setIsAddCustomerModalOpen(!isAddCustomerModalOpen)
  }

  const openEditCustomerModal = (customer: Customer) => {
    setEditingCustomer(customer)
    setIsEditCustomerModalOpen(true)
  }

  const closeEditCustomerModal = () => {
    setIsEditCustomerModalOpen(false)
    setEditingCustomer(null)
  }

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return
    
    // Prevent deletion of default customer
    if (isDefaultCustomer(selectedCustomer.id)) {
      alert('لا يمكن حذف العميل الافتراضي')
      return
    }

    const isConfirmed = window.confirm(
      `هل أنت متأكد من حذف العميل "${selectedCustomer.name}"؟\n\nلن يمكن التراجع عن هذا الإجراء.`
    )

    if (!isConfirmed) return

    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', selectedCustomer.id)

      if (error) {
        console.error('Error deleting customer:', error)
        alert('حدث خطأ أثناء حذف العميل: ' + error.message)
        return
      }

      // Clear selection after successful deletion
      setSelectedCustomer(null)
      
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('حدث خطأ غير متوقع أثناء حذف العميل')
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
      // This will be handled in CustomerGroupSidebar useEffect based on selectedGroup prop
    }
  }

  const handleEditGroup = (group: CustomerGroup) => {
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

  const openCustomerDetails = (customer: any) => {
    setSelectedCustomer(customer)
    setIsCustomerDetailsModalOpen(true)
  }

  const closeCustomerDetails = () => {
    setIsCustomerDetailsModalOpen(false)
    setSelectedCustomer(null)
  }

  const handleCustomerGroupSelect = (group: CustomerGroup | null) => {
    setSelectedCustomerGroup(group)
    // إلغاء تحديد العميل عند تغيير المجموعة
    setSelectedCustomer(null)
  }

  const toggleGroupsVisibility = () => {
    setIsGroupsHidden(!isGroupsHidden)
  }

  const handleDeleteGroup = async () => {
    if (!selectedCustomerGroup) return
    
    // Prevent deletion of "عملاء" group
    if (selectedCustomerGroup.name === 'عملاء') {
      alert('لا يمكن حذف المجموعة الرئيسية "عملاء"')
      return
    }
    
    // Check if group has subgroups or customers
    try {
      // Check for subgroups
      const { data: subgroups, error: subError } = await supabase
        .from('customer_groups')
        .select('id')
        .eq('parent_id', selectedCustomerGroup.id)
        .or('is_active.is.null,is_active.eq.true')
      
      if (subError) throw subError
      
      if (subgroups && subgroups.length > 0) {
        alert('لا يمكن حذف المجموعة لأنها تحتوي على مجموعات فرعية')
        return
      }
      
      // Check for customers in this group
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id')
        .eq('group_id', selectedCustomerGroup.id)
        .eq('is_active', true)
      
      if (custError) throw custError
      
      if (customers && customers.length > 0) {
        alert('لا يمكن حذف المجموعة لأنها تحتوي على عملاء')
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
    if (!selectedCustomerGroup) return
    
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('customer_groups')
        .delete()
        .eq('id', selectedCustomerGroup.id)
      
      if (error) throw error
      
      // Clear selection and close confirmation
      setSelectedCustomerGroup(null)
      setShowDeleteConfirm(false)
      
      // Refresh groups list
      await fetchCustomerGroups()
      
    } catch (error) {
      console.error('Error deleting customer group:', error)
      alert('حدث خطأ أثناء حذف المجموعة')
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelDeleteGroup = () => {
    setShowDeleteConfirm(false)
  }


  // Fetch customer groups for CustomerGroupSidebar usage
  const fetchCustomerGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_groups')
        .select('*')
        .or('is_active.is.null,is_active.eq.true')
        .order('sort_order', { ascending: true, nullsFirst: false })
      
      if (error) throw error
      setCustomerGroups(data || [])
    } catch (error) {
      console.error('Error fetching customer groups:', error)
    }
  }

  // Fetch customer groups on component mount
  useEffect(() => {
    fetchCustomerGroups()
  }, [])

  // toggleGroup is now provided by the hook

  // دالة للحصول على جميع معرفات المجموعات الفرعية
  const getAllSubGroupIds = (groupId: string, allGroups: CustomerGroup[]): string[] => {
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

  // فلترة العملاء حسب المجموعة المحددة والبحث
  const filteredCustomers = customers.filter(customer => {
    // فلترة البحث أولاً
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchQuery)) ||
      (customer.city && customer.city.toLowerCase().includes(searchQuery.toLowerCase()))
    
    // إذا لم يكن هناك مجموعة محددة، إظهار جميع العملاء
    if (!selectedCustomerGroup) {
      return matchesSearch
    }
    
    // إذا كانت المجموعة المحددة هي المجموعة الرئيسية "عملاء"، إظهار جميع العملاء
    if (selectedCustomerGroup.name === 'عملاء') {
      return matchesSearch
    }
    
    // الحصول على جميع المجموعات الفرعية للمجموعة المحددة
    const allGroupIds = getAllSubGroupIds(selectedCustomerGroup.id, groups)
    
    // فلترة العملاء الذين ينتمون للمجموعة أو مجموعاتها الفرعية
    const matchesGroup = customer.group_id && allGroupIds.includes(customer.group_id)
    
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
              onClick={() => selectedCustomerGroup && handleEditGroup(selectedCustomerGroup)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                selectedCustomerGroup && !selectedCustomerGroup.isDefault
                  ? 'text-gray-300 hover:text-white hover:bg-gray-600/30'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedCustomerGroup || selectedCustomerGroup.isDefault}
            >
              <PencilSquareIcon className="h-4 w-4" />
              <span className="text-sm">تحرير المجموعة</span>
            </button>

            <button
              onClick={handleDeleteGroup}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                selectedCustomerGroup && !selectedCustomerGroup.isDefault
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-600/10'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedCustomerGroup || selectedCustomerGroup.isDefault}
            >
              <TrashIcon className="h-4 w-4" />
              <span className="text-sm">حذف المجموعة</span>
            </button>

            <button
              onClick={toggleAddCustomerModal}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md cursor-pointer whitespace-nowrap transition-colors"
            >
              <UserPlusIcon className="h-4 w-4" />
              <span className="text-sm">إضافة عميل</span>
            </button>

            <button
              onClick={() => selectedCustomer && openEditCustomerModal(selectedCustomer)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                selectedCustomer
                  ? 'text-gray-300 hover:text-white hover:bg-gray-600/30'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedCustomer}
            >
              <PencilSquareIcon className="h-4 w-4" />
              <span className="text-sm">تحرير العميل</span>
            </button>

            <button
              onClick={handleDeleteCustomer}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                !selectedCustomer
                  ? 'text-gray-500 cursor-not-allowed'
                  : selectedCustomer && isDefaultCustomer(selectedCustomer.id)
                  ? 'text-gray-500 cursor-not-allowed'
                  : isDeleting
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-red-400 hover:text-red-300 hover:bg-red-600/10'
              }`}
              disabled={!selectedCustomer || (selectedCustomer && isDefaultCustomer(selectedCustomer.id)) || isDeleting}
              title={
                !selectedCustomer
                  ? 'اختر عميل للحذف'
                  : selectedCustomer && isDefaultCustomer(selectedCustomer.id)
                  ? 'لا يمكن حذف العميل الافتراضي'
                  : isDeleting
                  ? 'جاري الحذف...'
                  : 'حذف العميل'
              }
            >
              <TrashIcon className="h-4 w-4" />
              <span className="text-sm">{isDeleting ? 'جاري الحذف...' : 'حذف العميل'}</span>
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
              <span className="text-sm">دمج العملاء</span>
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
                placeholder="اسم العميل..."
                className="w-56 sm:w-64 md:w-80 pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Customer Count Display - Second */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-gray-400 whitespace-nowrap">{filteredCustomers.length} من {customers.length} عميل</span>
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

          {/* Customer Groups Tree Sidebar - Conditional */}
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
                      onSelect={handleCustomerGroupSelect}
                      selectedGroupId={selectedCustomerGroup?.id}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Customers Content Container */}
            <div className="flex-1 overflow-hidden bg-[#2B3544]">
              {customersLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">جاري تحميل العملاء...</div>
                </div>
              ) : customersError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-400">{customersError}</div>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="h-full overflow-y-auto scrollbar-hide">
                  <CustomersGridView
                    customers={filteredCustomers}
                    selectedCustomer={selectedCustomer}
                    onCustomerClick={(customer) => {
                      // Toggle selection: if already selected, deselect it
                      if (selectedCustomer?.id === customer.id) {
                        setSelectedCustomer(null)
                      } else {
                        setSelectedCustomer(customer)
                      }
                    }}
                    onCustomerDoubleClick={openCustomerDetails}
                    isDefaultCustomer={isDefaultCustomer}
                  />
                </div>
              ) : (
                <ResizableTable
                  className="h-full w-full"
                  columns={visibleTableColumns}
                  data={filteredCustomers}
                  selectedRowId={selectedCustomer?.id || null}
                  onRowClick={(customer, index) => {
                    // Toggle selection: if already selected, deselect it
                    if (selectedCustomer?.id === customer.id) {
                      setSelectedCustomer(null)
                    } else {
                      setSelectedCustomer(customer)
                    }
                  }}
                  onRowDoubleClick={(customer, index) => {
                    openCustomerDetails(customer)
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal 
        isOpen={isAddCustomerModalOpen} 
        onClose={() => setIsAddCustomerModalOpen(false)} 
      />

      {/* Edit Customer Modal */}
      <EditCustomerModal 
        isOpen={isEditCustomerModalOpen} 
        onClose={closeEditCustomerModal}
        customer={editingCustomer}
      />

      {/* Customer Group Sidebar */}
      <CustomerGroupSidebar 
        isOpen={isGroupSidebarOpen} 
        onClose={() => {
          setIsGroupSidebarOpen(false)
          setIsEditing(false)
          setEditGroup(null)
        }}
        customerGroups={customerGroups}
        onGroupCreated={fetchCustomerGroups}
        editGroup={editGroup}
        isEditing={isEditing}
        selectedGroup={selectedCustomerGroup ? {
          id: selectedCustomerGroup.id,
          name: selectedCustomerGroup.name,
          parent_id: selectedCustomerGroup.parent_id,
          is_active: selectedCustomerGroup.is_active,
          sort_order: selectedCustomerGroup.sort_order,
          created_at: selectedCustomerGroup.created_at,
          updated_at: selectedCustomerGroup.updated_at
        } : null}
      />

      {/* Customer Details Modal */}
      <CustomerDetailsModal 
        isOpen={isCustomerDetailsModalOpen} 
        onClose={closeCustomerDetails}
        customer={selectedCustomer}
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
                  {selectedCustomerGroup?.name}
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

      {/* Merge Customers Modal */}
      <MergeCustomersModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        onMergeComplete={() => {
          // Refresh is handled automatically by real-time hook
          setSelectedCustomer(null)
        }}
        preSelectedCustomer={selectedCustomer}
      />

    </div>
  )
}