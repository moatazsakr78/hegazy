'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

// Local storage key for inventory column visibility
const INVENTORY_COLUMN_VISIBILITY_KEY = 'inventory-column-visibility-v2'
import InventoryTabletView from '../../components/InventoryTabletView'
import { ProductGridImage, ProductModalImage, ProductThumbnail } from '../../components/ui/OptimizedImage'
import ResizableTable from '../../components/tables/ResizableTable'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import AddBranchModal from '../../components/AddBranchModal'
import AddStorageModal from '../../components/AddStorageModal'
import ManagementModal from '../../components/ManagementModal'
import CategoriesTreeView from '../../components/CategoriesTreeView'
import ColumnsControlModal from '../../components/ColumnsControlModal'
import QuantityAdjustmentModal from '../../components/QuantityAdjustmentModal'
import { useProductsAdmin } from '../../../lib/hooks/useProductsAdmin'
import { supabase } from '../../lib/supabase/client'
import { revalidateProductPage } from '../../../lib/utils/revalidate'
import {
  ArrowPathIcon,
  BuildingStorefrontIcon,
  BuildingOffice2Icon,
  CogIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EyeIcon,
  XMarkIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline'

// Database category interface for type safety
interface Category {
  id: string
  name: string
  name_en: string | null
  parent_id: string | null
  image_url: string | null
  is_active: boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('الفروع والمخازن')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showBranchesDropdown, setShowBranchesDropdown] = useState(false)
  const [selectedBranches, setSelectedBranches] = useState<{[key: string]: boolean}>({})
  const [stockStatusFilters, setStockStatusFilters] = useState({
    good: true,
    low: true,
    zero: true
  })
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false)
  const [isAddStorageModalOpen, setIsAddStorageModalOpen] = useState(false)
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false)
  
  // Edit state
  const [editBranch, setEditBranch] = useState<any>(null)
  const [isEditingBranch, setIsEditingBranch] = useState(false)
  const [editWarehouse, setEditWarehouse] = useState<any>(null)
  const [isEditingWarehouse, setIsEditingWarehouse] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showProductModal, setShowProductModal] = useState(false)
  const [modalProduct, setModalProduct] = useState<any>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<{[key: string]: boolean}>({})
  const inventoryVisibilityLoadedRef = useRef(false)
  const [isTablet, setIsTablet] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Quantity adjustment modal states
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [quantityModalMode, setQuantityModalMode] = useState<'add' | 'edit'>('add')
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<any>(null)
  const [selectedBranchForQuantity, setSelectedBranchForQuantity] = useState<string>('')
  
  // Audit status states - removed since we now use database values
  
  // Audit status filter states
  const [auditStatusFilters, setAuditStatusFilters] = useState({
    'تام الجرد': true,
    'استعد': true,
    'غير مجرود': true
  })
  
  // Selected branch for audit status filtering
  const [selectedAuditBranch, setSelectedAuditBranch] = useState<string>('')
  
  // Context menu state for audit status
  const [auditContextMenu, setAuditContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    productId: string;
    branchId: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    productId: '',
    branchId: ''
  })

  // ✨ OPTIMIZED: Use super-optimized admin hook (reduces 201 queries to 3!)
  const { products, setProducts, branches, isLoading, error, fetchProducts } = useProductsAdmin()

  // Categories state for filtering
  const [categories, setCategories] = useState<Category[]>([])

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true })

        if (error) throw error

        setCategories(data || [])
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }

    fetchCategories()
  }, [])

  // Helper function to get all subcategory IDs recursively
  const getAllSubcategoryIds = useCallback((categoryId: string, allCategories: Category[]): string[] => {
    const subcategories = allCategories.filter(cat => cat.parent_id === categoryId)
    let ids = [categoryId]

    subcategories.forEach(subcat => {
      ids = [...ids, ...getAllSubcategoryIds(subcat.id, allCategories)]
    })

    return ids
  }, [])

  // Device detection for mobile and tablet optimization
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const windowWidth = window.innerWidth

      // Check for mobile devices (phones) - only phones use mobile view
      const isMobileDevice = /mobile|android(?=.*mobile)|iphone|ipod|blackberry|opera mini/i.test(userAgent) ||
                            windowWidth < 768

      // Check for tablet devices - use tablet view for tablets and medium screens
      const isTabletDevice = (/tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(userAgent) ||
                            (windowWidth >= 768 && windowWidth <= 1280)) &&
                            !isMobileDevice

      setIsMobile(isMobileDevice)
      setIsTablet(isTabletDevice)
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  // Initialize selected branches when branches data loads
  useEffect(() => {
    if (branches.length > 0 && Object.keys(selectedBranches).length === 0) {
      const initialBranches: {[key: string]: boolean} = {}
      branches.forEach(branch => {
        initialBranches[branch.id] = true
      })
      setSelectedBranches(initialBranches)
    }
  }, [branches, selectedBranches])

  // Initialize visible columns state
  useEffect(() => {
    const allColumns = ['index', 'name', 'category', 'totalQuantity', 'cost_price', 'price', 'wholesale_price', 'price1', 'price2', 'price3', 'price4', 'barcode', 'audit_status']
    
    // Add branch columns
    branches.forEach(branch => {
      allColumns.push(`quantity_${branch.id}`, `lowstock_${branch.id}`, `variants_${branch.id}`)
    })
    
    const initialVisible: {[key: string]: boolean} = {}
    allColumns.forEach(colId => {
      initialVisible[colId] = true // Initially all columns are visible
    })
    
    setVisibleColumns(initialVisible)
  }, [branches])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.branches-dropdown')) {
        setShowBranchesDropdown(false)
      }
    }

    if (showBranchesDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showBranchesDropdown])
  
  // Handle click outside audit context menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (auditContextMenu.show) {
        console.log('Click outside detected, closing audit context menu')
        setAuditContextMenu({ show: false, x: 0, y: 0, productId: '', branchId: '' })
      }
    }

    if (auditContextMenu.show) {
      // Add a small delay to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 100)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [auditContextMenu.show])

  // OPTIMIZED: Generate dynamic table columns with advanced memoization
  const dynamicTableColumns = useMemo(() => {
    const staticColumns = [
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
      header: 'اسم المنتج', 
      accessor: 'name', 
      width: 200,
      render: (value: string) => <span className="text-white font-medium">{value}</span>
    },
    { 
      id: 'category', 
      header: 'المجموعة', 
      accessor: 'category', 
      width: 120,
      render: (value: any) => (
        <span className="text-gray-300">
          {value?.name || 'غير محدد'}
        </span>
      )
    },
    { 
      id: 'totalQuantity', 
      header: 'كمية كلية', 
      accessor: 'totalQuantity', 
      width: 120,
      render: (value: any, item: any) => {
        // Calculate total quantity based on selected branches only
        let totalQuantity = 0
        if (item.inventoryData) {
          Object.entries(item.inventoryData).forEach(([branchId, inventory]: [string, any]) => {
            if (selectedBranches[branchId]) {
              totalQuantity += inventory?.quantity || 0
            }
          })
        }
        
        // Determine color based on stock status
        const stockStatus = getStockStatus(item)
        let colorClass = 'text-green-400' // Good - Green
        if (stockStatus === 'low') colorClass = 'text-yellow-400' // Low - Yellow  
        if (stockStatus === 'zero') colorClass = 'text-red-400' // Zero - Red
        
        return (
          <span className={`${colorClass} font-medium`}>قطعة {totalQuantity}</span>
        )
      }
    },
    { 
      id: 'cost_price', 
      header: 'سعر الشراء', 
      accessor: 'cost_price', 
      width: 120,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price', 
      header: 'سعر البيع', 
      accessor: 'price', 
      width: 120,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'wholesale_price', 
      header: 'سعر الجملة', 
      accessor: 'wholesale_price', 
      width: 120,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price1', 
      header: 'سعر 1', 
      accessor: 'price1', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price2', 
      header: 'سعر 2', 
      accessor: 'price2', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price3', 
      header: 'سعر 3', 
      accessor: 'price3', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price4', 
      header: 'سعر 4', 
      accessor: 'price4', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'barcode', 
      header: 'الباركود', 
      accessor: 'barcode', 
      width: 150,
      render: (value: string) => <span className="text-gray-300 font-mono text-sm">{value || '-'}</span>
    }
    ]

    // Add dynamic branch quantity columns (only for selected branches)
  const branchQuantityColumns = branches
    .filter(branch => selectedBranches[branch.id])
    .map(branch => ({
      id: `quantity_${branch.id}`,
      header: branch.name,
      accessor: `quantity_${branch.id}`,
      width: 120,
      render: (value: any, item: any) => {
        const inventoryData = item.inventoryData?.[branch.id]
        const quantity = inventoryData?.quantity || 0
        const minStock = inventoryData?.min_stock || 0
        
        // Determine color based on quantity status for this specific branch
        let colorClass = 'text-green-400' // Good - Green
        if (quantity === 0) {
          colorClass = 'text-red-400' // Zero - Red
        } else if (quantity <= minStock && minStock > 0) {
          colorClass = 'text-yellow-400' // Low - Yellow
        }
        
        return (
          <span className={`${colorClass} font-medium`}>
            قطعة {quantity}
          </span>
        )
      }
      }))

    // Add dynamic branch low stock columns (only for selected branches)
  const branchLowStockColumns = branches
    .filter(branch => selectedBranches[branch.id])
    .map(branch => ({
      id: `lowstock_${branch.id}`,
      header: `منخفض - ${branch.name}`,
      accessor: `lowstock_${branch.id}`,
      width: 150,
      render: (value: any, item: any) => {
        const inventoryData = item.inventoryData?.[branch.id]
        const minStock = inventoryData?.min_stock || 0
        const quantity = inventoryData?.quantity || 0
        
        // Show warning style if quantity is below or equal to min stock
        const isLowStock = quantity <= minStock && minStock > 0
        
        return (
          <span className={`font-medium ${isLowStock ? 'text-red-400' : 'text-yellow-400'}`}>
            {minStock} قطعة
          </span>
        )
      }
      }))

      // Add dynamic branch variants columns (only for selected branches)
    const variantColumns = branches
    .filter(branch => selectedBranches[branch.id])
    .map(branch => ({
    id: `variants_${branch.id}`,
    header: `الأشكال والألوان - ${branch.name}`,
    accessor: `variants_${branch.id}`,
    width: 250,
    render: (value: any, item: any) => {
      const variants = item.variantsData?.[branch.id] || []
      const colorVariants = variants.filter((v: any) => v.variant_type === 'color')
      const shapeVariants = variants.filter((v: any) => v.variant_type === 'shape')
      
      // Helper function to get variant color
      const getVariantColor = (variant: any) => {
        if (variant.variant_type === 'color') {
          // Try to find the color from product colors
          const productColor = item.productColors?.find((c: any) => c.name === variant.name)
          if (productColor?.color) {
            return productColor.color
          }
          
          // Try to parse color from variant value if it's JSON
          try {
            if (variant.value && variant.value.startsWith('{')) {
              const valueData = JSON.parse(variant.value)
              if (valueData.color) {
                return valueData.color
              }
            }
          } catch (e) {
            // If parsing fails, use default
          }
        }
        return '#6B7280' // Default gray color
      }

      // Helper function to get text color based on background
      const getTextColor = (bgColor: string) => {
        // Convert hex to RGB
        const hex = bgColor.replace('#', '')
        const r = parseInt(hex.substr(0, 2), 16)
        const g = parseInt(hex.substr(2, 2), 16)
        const b = parseInt(hex.substr(4, 2), 16)
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        
        // Return white for dark colors, black for light colors
        return luminance > 0.5 ? '#000000' : '#FFFFFF'
      }

      // Calculate unassigned quantity
      const totalInventoryQuantity = item.inventoryData?.[branch.id]?.quantity || 0
      const assignedQuantity = [...colorVariants, ...shapeVariants].reduce((sum: number, variant: any) => sum + variant.quantity, 0)
      const unassignedQuantity = totalInventoryQuantity - assignedQuantity

      return (
        <div className="flex flex-wrap gap-1">
          {[...colorVariants, ...shapeVariants].map((variant: any, index: number) => {
            const bgColor = getVariantColor(variant)
            const textColor = getTextColor(bgColor)
            
            return (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  borderColor: bgColor === '#6B7280' ? '#6B7280' : bgColor
                }}
              >
                {variant.name} ({variant.quantity})
              </span>
            )
          })}
          
          {/* Show unassigned quantity if any */}
          {unassignedQuantity > 0 && (
            <span
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600"
            >
              غير محدد ({unassignedQuantity})
            </span>
          )}
        </div>
      )
    }
  }))

    // Add audit status columns for each selected branch
    const auditStatusColumns = branches
      .filter(branch => selectedBranches[branch.id])
      .map(branch => ({
        id: `audit_status_${branch.id}`,
        header: `حالة الجرد - ${branch.name}`,
        accessor: `audit_status_${branch.id}`,
        width: 150,
        render: (value: any, item: any) => {
          const inventoryData = item.inventoryData?.[branch.id]
          const status = (inventoryData as any)?.audit_status || 'غير مجرود'
          
          const getStatusColor = (status: string) => {
            switch(status) {
              case 'تام الجرد': return 'bg-green-600 text-white'
              case 'استعد': return 'bg-yellow-600 text-white'
              case 'غير مجرود': return 'bg-red-600 text-white'
              default: return 'bg-red-600 text-white'
            }
          }
          
          return (
            <div 
              className="flex justify-center"
              onContextMenu={(e) => handleAuditStatusRightClick(e, item.id, branch.id)}
            >
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)} cursor-context-menu`}>
                {status}
              </span>
            </div>
          )
        }
      }))

    // Get count of selected branches
    const selectedBranchesCount = Object.values(selectedBranches).filter(Boolean).length

    // Combine all columns - hide totalQuantity if only one branch is selected
    const allColumns = [
      ...staticColumns.filter(col => {
        // Hide totalQuantity column if only one branch is selected
        if (col.id === 'totalQuantity' && selectedBranchesCount === 1) {
          return false
        }
        return true
      }),
      ...branchQuantityColumns,
      ...branchLowStockColumns,
      ...variantColumns,
      ...auditStatusColumns
    ]
    
    // Filter columns based on visibility
    return allColumns.filter(col => visibleColumns[col.id] !== false)
  }, [branches, visibleColumns, selectedBranches])

  // OPTIMIZED: Memoized columns data preparation
  const getAllColumns = useMemo(() => {
    return dynamicTableColumns.map(col => ({
      id: col.id,
      header: col.header,
      visible: visibleColumns[col.id] !== false
    }))
  }, [dynamicTableColumns, visibleColumns])

  // Load column visibility from localStorage on mount
  useEffect(() => {
    if (inventoryVisibilityLoadedRef.current) return

    try {
      const savedData = localStorage.getItem(INVENTORY_COLUMN_VISIBILITY_KEY)
      if (savedData) {
        const parsed = JSON.parse(savedData)
        setVisibleColumns(parsed)
        console.log('✅ Loaded inventory column visibility from localStorage')
      }
      inventoryVisibilityLoadedRef.current = true
    } catch (error) {
      console.error('Error loading inventory column visibility:', error)
      inventoryVisibilityLoadedRef.current = true
    }
  }, [])

  // OPTIMIZED: Memoized columns change handler - saves to localStorage
  const handleColumnsChange = useCallback((updatedColumns: any[]) => {
    const newVisibleColumns: {[key: string]: boolean} = {}
    updatedColumns.forEach(col => {
      newVisibleColumns[col.id] = col.visible
    })
    setVisibleColumns(newVisibleColumns)

    // Save to localStorage
    try {
      localStorage.setItem(INVENTORY_COLUMN_VISIBILITY_KEY, JSON.stringify(newVisibleColumns))
      console.log('✅ Saved inventory column visibility to localStorage')
    } catch (error) {
      console.error('Error saving inventory column visibility:', error)
    }
  }, [])

  // The visible columns are now handled within the memoized dynamicTableColumns

  // OPTIMIZED: Memoized refresh handler
  const handleRefresh = useCallback(() => {
    fetchProducts()
  }, [fetchProducts])

  // OPTIMIZED: Memoized function to calculate total quantity for selected branches only
  const calculateTotalQuantity = useCallback((item: any) => {
    let totalQuantity = 0
    if (item.inventoryData) {
      Object.entries(item.inventoryData).forEach(([branchId, inventory]: [string, any]) => {
        if (selectedBranches[branchId]) {
          totalQuantity += inventory?.quantity || 0
        }
      })
    }
    return totalQuantity
  }, [selectedBranches])

  // OPTIMIZED: Memoized function to determine stock status
  const getStockStatus = useCallback((item: any) => {
    const totalQuantity = calculateTotalQuantity(item)
    
    if (totalQuantity === 0) return 'zero'
    
    // Check if any selected branch has low stock
    let hasLowStock = false
    if (item.inventoryData) {
      Object.entries(item.inventoryData).forEach(([branchId, inventory]: [string, any]) => {
        if (selectedBranches[branchId]) {
          const quantity = inventory?.quantity || 0
          const minStock = inventory?.min_stock || 0
          if (quantity <= minStock && minStock > 0) {
            hasLowStock = true
          }
        }
      })
    }
    
    return hasLowStock ? 'low' : 'good'
  }, [calculateTotalQuantity, selectedBranches])

  // OPTIMIZED: Memoized product filtering to prevent unnecessary re-renders
  const filteredProducts = useMemo(() => {
    if (!products.length) {
      console.log('📦 No products to filter');
      return []
    }

    console.log('📦 Total products before filtering:', products.length);

    const filtered = products.filter(item => {
      // Category filter: If a category is selected and it's not the root "منتجات" category
      if (selectedCategory && selectedCategory.name !== 'منتجات') {
        const categoryIds = getAllSubcategoryIds(selectedCategory.id, categories)
        if (!item.category_id || !categoryIds.includes(item.category_id)) {
          return false
        }
      }

      // Text search filter
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      // Stock status filter
      const stockStatus = getStockStatus(item)
      if (!stockStatusFilters[stockStatus as keyof typeof stockStatusFilters]) return false

      // Audit status filter - check selected audit branch or all branches
      if (selectedAuditBranch) {
        // Filter by specific branch audit status
        const branchAuditStatus = (item.inventoryData?.[selectedAuditBranch] as any)?.audit_status || 'غير مجرود'
        return auditStatusFilters[branchAuditStatus as keyof typeof auditStatusFilters]
      } else {
        // ✨ FIXED: Show product if it has NO inventory data OR if it matches filter in selected branches
        const inventoryEntries = Object.entries(item.inventoryData || {});

        // If product has no inventory in ANY branch, show it (with default audit status)
        if (inventoryEntries.length === 0) {
          return auditStatusFilters['غير مجرود' as keyof typeof auditStatusFilters];
        }

        // Get inventory entries for selected branches only
        const selectedBranchInventory = inventoryEntries.filter(([branchId]) => selectedBranches[branchId]);

        // If no inventory in selected branches, check default audit status
        if (selectedBranchInventory.length === 0) {
          return auditStatusFilters['غير مجرود' as keyof typeof auditStatusFilters];
        }

        // Check if any selected branch matches the audit status filters
        return selectedBranchInventory.some(([branchId, inventory]: [string, any]) => {
          const auditStatus = (inventory as any)?.audit_status || 'غير مجرود'
          return auditStatusFilters[auditStatus as keyof typeof auditStatusFilters]
        })
      }
    })

    console.log('📦 Filtered products count:', filtered.length);
    console.log('🔍 Filter states:', {
      selectedCategory: selectedCategory?.name,
      searchQuery,
      stockStatusFilters: stockStatusFilters,
      auditStatusFilters: auditStatusFilters,
      selectedBranchesCount: Object.values(selectedBranches).filter(Boolean).length,
      selectedBranches: Object.keys(selectedBranches).filter(id => selectedBranches[id])
    });

    // Debug: Check why products are being filtered out
    if (filtered.length < products.length) {
      console.log('⚠️ Products filtered out:', products.length - filtered.length);

      // Sample a few filtered out products to understand why
      const filteredOut = products.filter(item => !filtered.includes(item)).slice(0, 3);
      filteredOut.forEach(item => {
        console.log('❌ Filtered out product:', {
          name: item.name,
          hasInventoryData: !!item.inventoryData,
          inventoryBranches: Object.keys(item.inventoryData || {}),
          stockStatus: getStockStatus(item)
        });
      });
    }

    return filtered;
  }, [products, searchQuery, stockStatusFilters, auditStatusFilters, selectedAuditBranch, selectedBranches, getStockStatus, selectedCategory, categories, getAllSubcategoryIds])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const toggleAddBranchModal = () => {
    setIsAddBranchModalOpen(!isAddBranchModalOpen)
  }

  const handleBranchCreated = () => {
    // Branch will be handled by real-time subscription in ManagementModal
    console.log('New branch created successfully')
  }

  const handleWarehouseCreated = () => {
    // Warehouse will be handled by real-time subscription in ManagementModal
    console.log('New warehouse created successfully')
  }

  const handleEditBranch = (branch: any) => {
    setEditBranch(branch)
    setIsEditingBranch(true)
    setIsAddBranchModalOpen(true)
    setIsManagementModalOpen(false)
  }

  const handleEditWarehouse = (warehouse: any) => {
    setEditWarehouse(warehouse)
    setIsEditingWarehouse(true)
    setIsAddStorageModalOpen(true)
    setIsManagementModalOpen(false)
  }

  const handleCloseBranchModal = () => {
    setIsAddBranchModalOpen(false)
    setEditBranch(null)
    setIsEditingBranch(false)
  }

  const handleCloseWarehouseModal = () => {
    setIsAddStorageModalOpen(false)
    setEditWarehouse(null)
    setIsEditingWarehouse(false)
  }

  const toggleAddStorageModal = () => {
    setIsAddStorageModalOpen(!isAddStorageModalOpen)
  }

  const toggleManagementModal = () => {
    setIsManagementModalOpen(!isManagementModalOpen)
  }

  const handleCategorySelect = (category: Category | null) => {
    setSelectedCategory(category)
  }

  // OPTIMIZED: Memoized branch toggle handler
  const handleBranchToggle = useCallback((branchId: string) => {
    setSelectedBranches(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }))
  }, [])

  // OPTIMIZED: Memoized stock status toggle handler
  const handleStockStatusToggle = useCallback((status: 'good' | 'low' | 'zero') => {
    setStockStatusFilters(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }, [])

  // Handle quantity adjustment actions
  const handleQuantityAction = useCallback((mode: 'add' | 'edit') => {
    if (!selectedProduct) {
      alert('يرجى اختيار منتج أولاً')
      return
    }
    
    setQuantityModalMode(mode)
    setSelectedProductForQuantity(selectedProduct)
    setShowQuantityModal(true)
  }, [selectedProduct])

  // Handle quantity confirmation with database update
  const handleQuantityConfirm = useCallback(async (newQuantity: number, reason: string, branchId: string) => {
    if (!selectedProductForQuantity || !branchId) {
      console.error('Missing required data:', { selectedProductForQuantity, branchId })
      alert('بيانات المنتج أو الفرع مفقودة')
      return
    }

    try {
      console.log('Starting inventory update:', {
        productId: selectedProductForQuantity.id,
        branchId,
        newQuantity,
        reason,
        mode: quantityModalMode
      })

      // Show loading state
      const loadingMessage = quantityModalMode === 'add' ? 'جاري إضافة الكمية...' : 'جاري تعديل الكمية...'
      console.log(loadingMessage)

      // Create the API payload
      const payload = {
        action: 'update_inventory',
        productId: selectedProductForQuantity.id,
        branchId: branchId,
        quantity: newQuantity
      }
      
      console.log('API Payload:', payload)

      // Call the API
      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      // Parse response
      let result
      try {
        result = await response.json()
        console.log('Response data:', result)
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error('استجابة غير صالحة من الخادم')
      }

      // Check for HTTP errors
      if (!response.ok) {
        const errorMessage = result?.error || result?.message || `HTTP Error ${response.status}`
        console.error('HTTP Error:', errorMessage)
        throw new Error(errorMessage)
      }

      // Check for API errors
      if (!result.success) {
        const errorMessage = result.error || result.message || 'فشل في تحديث الكمية'
        console.error('API Error:', errorMessage)
        throw new Error(errorMessage)
      }

      console.log('Update successful:', result.data)

      // Refresh the products data to show the updated quantity
      console.log('Refreshing products data...')
      await fetchProducts()
      console.log('Products data refreshed')

      // ✨ Refresh website cache instantly (On-Demand ISR)
      console.log('🔄 Refreshing website cache for product...')
      revalidateProductPage(selectedProductForQuantity.id).then((result) => {
        if (result.success) {
          console.log('✅ Website cache refreshed successfully!', result);
        } else {
          console.warn('⚠️ Failed to refresh website cache:', result.error);
        }
      }).catch((error) => {
        console.error('❌ Error refreshing website cache:', error);
      });

      // Show success message
      const successMessage = quantityModalMode === 'add' ? 'تم إضافة الكمية بنجاح' : 'تم تعديل الكمية بنجاح'
      alert(successMessage)
      
    } catch (error) {
      console.error('Complete error details:', error)
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
      alert('حدث خطأ في تحديث الكمية: ' + errorMessage)
    }
  }, [selectedProductForQuantity, quantityModalMode, fetchProducts])

  // Handle audit status right click
  const handleAuditStatusRightClick = useCallback((e: React.MouseEvent, productId: string, branchId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('Right-click detected on audit status for product:', productId, 'branch:', branchId)
    console.log('Mouse position:', e.clientX, e.clientY)
    
    setAuditContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      productId: productId,
      branchId: branchId
    })
  }, [])
  
  // Handle audit context menu action selection - Clean and simple approach with optimistic update
  const handleAuditContextMenuAction = useCallback(async (newStatus: string) => {
    if (!auditContextMenu.productId || !auditContextMenu.branchId) {
      console.error('Missing product ID or branch ID')
      return
    }
    
    const productId = auditContextMenu.productId
    const branchId = auditContextMenu.branchId
    
    // Close context menu
    setAuditContextMenu({ show: false, x: 0, y: 0, productId: '', branchId: '' })
    
    try {
      console.log('Updating audit status:', { productId, branchId, newStatus })
      
      // Optimistic update - update UI immediately
      setProducts(prevProducts => 
        prevProducts.map(product => {
          if (product.id === productId) {
            return {
              ...product,
              inventoryData: {
                ...product.inventoryData,
                [branchId]: {
                  ...product.inventoryData?.[branchId],
                  audit_status: newStatus
                } as any
              }
            } as any
          }
          return product
        })
      )
      
      // Call API in background
      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_audit_status',
          productId,
          branchId,
          auditStatus: newStatus
        })
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        // If API fails, revert the optimistic update
        await fetchProducts()
        throw new Error(result.error || 'Failed to update audit status')
      }
      
      console.log('Audit status updated successfully:', result)
      
      // Don't refresh - rely on real-time subscription to update the data
      // The optimistic update should persist until the real-time update arrives
      
    } catch (error) {
      console.error('Error updating audit status:', error)
      alert('فشل في تحديث حالة الجرد: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'))
    }
  }, [auditContextMenu.productId, auditContextMenu.branchId, setProducts, fetchProducts])
  
  // Handle audit status filter toggle
  const handleAuditStatusToggle = useCallback((status: string) => {
    setAuditStatusFilters(prev => ({
      ...prev,
      [status]: !prev[status as keyof typeof prev]
    }))
  }, [])

  // Use tablet view if detected as tablet or mobile device
  if (isTablet || isMobile) {
    return (
      <InventoryTabletView
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        stockStatusFilters={stockStatusFilters}
        setStockStatusFilters={setStockStatusFilters}
      />
    )
  }

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-hidden flex flex-col">
        
        {/* Top Action Buttons Toolbar - Full Width */}
        <div className="bg-[#374151] border-b border-gray-600 px-4 py-2 w-full">
          <div className="flex items-center justify-start gap-1">
            <button
              onClick={handleRefresh}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <ArrowPathIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">تحديث</span>
            </button>

            <button
              onClick={toggleAddBranchModal}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <BuildingStorefrontIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">إضافة فرع</span>
            </button>

            <button
              onClick={toggleAddStorageModal}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <BuildingOffice2Icon className="h-5 w-5 mb-1" />
              <span className="text-sm">إضافة مخزن</span>
            </button>

            <button
              onClick={toggleManagementModal}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <CogIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">إدارة</span>
            </button>

            <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]">
              <DocumentArrowDownIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">حفظ كـ PDF</span>
            </button>

            <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]">
              <DocumentTextIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">اكسل</span>
            </button>

            <button
              onClick={() => handleQuantityAction('add')}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <ClipboardDocumentListIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">إضافة</span>
            </button>

            <button
              onClick={() => handleQuantityAction('edit')}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <PencilSquareIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">تعديل</span>
            </button>

            <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]">
              <ChartBarIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">تقرير الجرد</span>
            </button>

            <button
              onClick={() => setShowColumnsModal(true)}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <TableCellsIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">الأعمدة</span>
            </button>
          </div>
        </div>

        {/* Content Area with Sidebar and Main Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Categories Tree Sidebar */}
          <CategoriesTreeView 
            onCategorySelect={handleCategorySelect}
            selectedCategoryId={selectedCategory?.id}
            showActionButtons={false}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Second Toolbar - Search and Controls */}
            <div className="bg-[#374151] border-b border-gray-600 px-6 py-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                {/* Left Side - Search and Controls */}
                <div className="flex items-center gap-4">
                  {/* Group Filter Dropdown */}
                  <div className="relative branches-dropdown">
                    <button 
                      onClick={() => setShowBranchesDropdown(!showBranchesDropdown)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white text-sm font-medium transition-colors"
                    >
                      <span>{selectedGroup}</span>
                      <ChevronDownIcon className={`h-4 w-4 transition-transform ${showBranchesDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Branches Dropdown */}
                    {showBranchesDropdown && (
                      <div className="absolute top-full right-0 mt-2 w-72 bg-[#2B3544] border-2 border-[#4A5568] rounded-xl shadow-2xl z-[9999] overflow-hidden backdrop-blur-sm">
                        {/* Branches List - Simple and Clean */}
                        <div className="p-3">
                          <div className="space-y-2">
                            {branches.map(branch => (
                              <label
                                key={branch.id}
                                className="flex items-center gap-3 p-3 bg-[#374151] hover:bg-[#434E61] rounded-lg cursor-pointer transition-colors border border-gray-600/30"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedBranches[branch.id] || false}
                                  onChange={() => handleBranchToggle(branch.id)}
                                  className="w-5 h-5 text-blue-600 bg-[#2B3544] border-2 border-blue-500 rounded focus:ring-blue-500 focus:ring-2 accent-blue-600"
                                />
                                <span className="text-white text-base font-medium flex-1 text-right">
                                  {branch.name}
                                </span>
                                <span className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded border border-blue-600/30">
                                  {branch.name.includes('مخزن') || branch.name.includes('شاكوس') ? 'مخزن' : 'فرع'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                        
                        {/* Simple Summary at Bottom */}
                        <div className="px-4 py-2 border-t border-[#4A5568] bg-[#374151]">
                          <div className="text-center">
                            <span className="text-blue-400 font-medium text-sm">
                              {Object.values(selectedBranches).filter(Boolean).length} من أصل {branches.length} محدد
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* View Toggle */}
                  <div className="flex bg-[#2B3544] rounded-md overflow-hidden">
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

                  {/* Search */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="اسم المنتج..."
                      className="w-80 pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* Right Side - Audit and Stock Status Filter Buttons */}
                <div className="flex items-center gap-4">
                  
                  {/* Audit Status Filter Section */}
                  <div className="flex items-center gap-2">
                    {/* Audit Status Buttons */}
                    <button 
                      onClick={() => handleAuditStatusToggle('تام الجرد')}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        auditStatusFilters['تام الجرد'] 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-gray-600 text-gray-400 opacity-50'
                      }`}
                    >
                      تام الجرد
                    </button>
                    
                    <button 
                      onClick={() => handleAuditStatusToggle('استعد')}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        auditStatusFilters['استعد'] 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                          : 'bg-gray-600 text-gray-400 opacity-50'
                      }`}
                    >
                      استعد
                    </button>
                    
                    <button 
                      onClick={() => handleAuditStatusToggle('غير مجرود')}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        auditStatusFilters['غير مجرود'] 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'bg-gray-600 text-gray-400 opacity-50'
                      }`}
                    >
                      غير مجرود
                    </button>
                  </div>
                  
                  {/* Branch Selector for Audit Status - Positioned as Separator */}
                  <select
                    value={selectedAuditBranch}
                    onChange={(e) => setSelectedAuditBranch(e.target.value)}
                    className="px-3 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">جميع الفروع</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  
                  {/* Stock Status Buttons - Desktop Style */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleStockStatusToggle('good')}
                      className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                        stockStatusFilters.good
                          ? 'text-green-400 hover:text-green-300'
                          : 'text-gray-500 opacity-50'
                      }`}
                    >
                      <div className={`h-5 w-5 mb-1 rounded-full ${
                        stockStatusFilters.good ? 'bg-green-500' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-sm">جيد</span>
                    </button>
                    <button
                      onClick={() => handleStockStatusToggle('low')}
                      className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                        stockStatusFilters.low
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-gray-500 opacity-50'
                      }`}
                    >
                      <div className={`h-5 w-5 mb-1 rounded-full ${
                        stockStatusFilters.low ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-sm">منخفض</span>
                    </button>
                    <button
                      onClick={() => handleStockStatusToggle('zero')}
                      className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                        stockStatusFilters.zero
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-gray-500 opacity-50'
                      }`}
                    >
                      <div className={`h-5 w-5 mb-1 rounded-full ${
                        stockStatusFilters.zero ? 'bg-red-500' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-sm">صفر</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Products/Inventory Content Container */}
            <div className="flex-1 overflow-hidden bg-[#2B3544]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-white">جاري التحميل...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-400">خطأ: {error}</div>
                </div>
              ) : viewMode === 'table' ? (
                <ResizableTable
                  className="h-full w-full"
                  columns={dynamicTableColumns}
                  data={filteredProducts}
                  selectedRowId={selectedProduct?.id || null}
                  onRowClick={(item, index) => {
                    // Toggle selection: if already selected, deselect it
                    if (selectedProduct?.id === item.id) {
                      setSelectedProduct(null)
                    } else {
                      setSelectedProduct(item)
                    }
                  }}
                />
              ) : (
                // Grid View
                <div className="h-full overflow-y-auto scrollbar-hide p-4">
                  <div className="grid grid-cols-6 gap-4">
                    {filteredProducts.map((product, index) => (
                      <div
                        key={product.id}
                        onClick={() => {
                          if (selectedProduct?.id === product.id) {
                            setSelectedProduct(null)
                          } else {
                            setSelectedProduct(product)
                          }
                        }}
                        className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group ${
                          selectedProduct?.id === product.id
                            ? 'border-blue-500 bg-[#434E61]'
                            : 'border-transparent hover:border-gray-500 hover:bg-[#434E61]'
                        }`}
                      >
                        {/* Product Image - OPTIMIZED */}
                        <div className="mb-3 relative">
                          <ProductGridImage
                            src={product.main_image_url}
                            alt={product.name}
                            priority={index < 6} // Prioritize first 6 products
                          />
                          
                          {/* Hover Button - positioned above image */}
                          <div className="absolute top-2 right-2 z-50">
                            <button
                              onClick={(e) => {
                                if (isSidebarOpen) return; // لا تعمل إذا القائمة مفتوحة
                                e.stopPropagation()
                                setModalProduct(product)
                                // Set first available image as selected
                                const firstImage = product.allImages?.[0] || product.main_image_url || null
                                setSelectedImage(firstImage)
                                setShowProductModal(true)
                              }}
                              className={`bg-black/50 hover:bg-black/90 text-white p-2 rounded-full opacity-0 ${!isSidebarOpen ? 'group-hover:opacity-100' : 'pointer-events-none'} transition-all duration-200 shadow-lg`}
                              style={{ zIndex: 9999 }}
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Product Name */}
                        <h3 className="text-white font-medium text-sm text-center mb-2 line-clamp-2">
                          {product.name}
                        </h3>

                        {/* Product Details */}
                        <div className="space-y-1 text-xs">
                          {/* Selling Price */}
                          <div className="flex justify-center mb-2">
                            <span className="text-blue-400 font-medium text-sm">
                              {(product.price || 0).toFixed(2)}
                            </span>
                          </div>
                          
                          {/* Total Quantity - based on selected branches only */}
                          <div className="flex justify-between items-center">
                            <span className={`font-medium ${
                              (() => {
                                const stockStatus = getStockStatus(product)
                                if (stockStatus === 'zero') return 'text-red-400'
                                if (stockStatus === 'low') return 'text-yellow-400'
                                return 'text-green-400'
                              })()
                            }`}>
                              {calculateTotalQuantity(product)}
                            </span>
                            <span className="text-gray-400">الكمية الإجمالية</span>
                          </div>
                          
                          {/* Branch/Warehouse Quantities - only selected branches */}
                          {product.inventoryData && Object.entries(product.inventoryData)
                            .filter(([locationId]) => selectedBranches[locationId])
                            .map(([locationId, inventory]: [string, any]) => {
                            // Find the branch name for this location
                            const branch = branches.find(b => b.id === locationId)
                            const locationName = branch?.name || `موقع ${locationId.slice(0, 8)}`
                            const quantity = inventory?.quantity || 0
                            const minStock = inventory?.min_stock || 0
                            
                            // Determine color based on quantity status for this specific branch
                            let colorClass = 'text-green-400' // Good - Green
                            if (quantity === 0) {
                              colorClass = 'text-red-400' // Zero - Red
                            } else if (quantity <= minStock && minStock > 0) {
                              colorClass = 'text-yellow-400' // Low - Yellow
                            }
                            
                            return (
                              <div key={locationId} className="flex justify-between items-center">
                                <span className={`${colorClass} font-medium`}>
                                  {quantity}
                                </span>
                                <span className="text-gray-400 truncate">
                                  {locationName}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Branch Modal */}
      <AddBranchModal 
        isOpen={isAddBranchModalOpen} 
        onClose={handleCloseBranchModal}
        onBranchCreated={handleBranchCreated}
        editBranch={editBranch}
        isEditing={isEditingBranch}
      />

      {/* Add Storage Modal */}
      <AddStorageModal 
        isOpen={isAddStorageModalOpen} 
        onClose={handleCloseWarehouseModal}
        onWarehouseCreated={handleWarehouseCreated}
        editWarehouse={editWarehouse}
        isEditing={isEditingWarehouse}
      />

      {/* Management Modal */}
      <ManagementModal 
        isOpen={isManagementModalOpen} 
        onClose={() => setIsManagementModalOpen(false)}
        onEditBranch={handleEditBranch}
        onEditWarehouse={handleEditWarehouse}
      />

      {/* Product Details Modal */}
      {showProductModal && modalProduct && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowProductModal(false)} />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] max-w-6xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
              {/* Header */}
              <div className="sticky top-0 bg-[#2B3544] px-8 py-6 border-b border-[#4A5568] flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">📦</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">تفاصيل المنتج</h2>
                    <p className="text-blue-400 font-medium">{modalProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-8">
                <div className="grid grid-cols-3 gap-8">
                  
                  {/* Left Column - Product Info */}
                  <div className="space-y-6">
                    
                    {/* Basic Info Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-blue-400 text-sm">ℹ️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">معلومات المنتج</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">المجموعة</span>
                          <span className="text-white font-medium">{modalProduct.category?.name || 'غير محدد'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">الوحدة</span>
                          <span className="text-white font-medium">{modalProduct.unit || 'قطعة'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">الحد الأدنى</span>
                          <span className="text-white font-medium">{modalProduct.min_stock || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-gray-400">الباركود</span>
                          <span className="text-white font-mono text-sm">{modalProduct.barcode || 'غير متوفر'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-green-400 text-sm">💰</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">الأسعار</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر البيع</p>
                          <p className="text-green-400 font-bold text-xl">{(modalProduct.price || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر الشراء</p>
                          <p className="text-orange-400 font-bold text-xl">{(modalProduct.cost_price || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر الجملة</p>
                          <p className="text-blue-400 font-bold text-lg">{(modalProduct.wholesale_price || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر 1</p>
                          <p className="text-purple-400 font-bold text-lg">{(modalProduct.price1 || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Description Card */}
                    {modalProduct.description && (
                      <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                            <span className="text-purple-400 text-sm">📝</span>
                          </div>
                          <h3 className="text-lg font-semibold text-white">وصف المنتج</h3>
                        </div>
                        <p className="text-gray-300 leading-relaxed">{modalProduct.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Middle Column - Inventory */}
                  <div className="space-y-6">
                    
                    {/* Total Inventory Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-blue-400 text-sm">📊</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">المخازن والفروع</h3>
                      </div>
                      
                      {/* Total Quantity Display */}
                      <div className="bg-blue-600/10 rounded-lg p-4 mb-4 text-center border border-blue-600/20">
                        <p className="text-blue-400 text-sm mb-1">الكمية الإجمالية</p>
                        <p className="text-blue-400 font-bold text-3xl">
                          {calculateTotalQuantity(modalProduct)}
                        </p>
                      </div>

                      {/* Branch/Warehouse Details - only selected branches */}
                      <div className="space-y-3">
                        {modalProduct.inventoryData && Object.entries(modalProduct.inventoryData)
                          .filter(([locationId]) => selectedBranches[locationId])
                          .map(([locationId, inventory]: [string, any]) => {
                          const branch = branches.find(b => b.id === locationId)
                          const locationName = branch?.name || `موقع ${locationId.slice(0, 8)}`
                          
                          return (
                            <div key={locationId} className="bg-[#2B3544] rounded-lg p-4 border border-gray-600/30">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-white font-medium">{locationName}</span>
                                <span className="text-blue-400 font-bold text-lg">{inventory?.quantity || 0}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">الحد الأدنى</span>
                                <span className="text-orange-400">{inventory?.min_stock || 0}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Variants Card */}
                    {modalProduct.variantsData && Object.keys(modalProduct.variantsData).length > 0 && (
                      <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                            <span className="text-purple-400 text-sm">🎨</span>
                          </div>
                          <h3 className="text-lg font-semibold text-white">الألوان والأشكال</h3>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(modalProduct.variantsData)
                            .filter(([locationId]) => selectedBranches[locationId])
                            .map(([locationId, variants]: [string, any]) => {
                            const branch = branches.find(b => b.id === locationId)
                            const locationName = branch?.name || `موقع ${locationId.slice(0, 8)}`

                            // Helper functions
                            const getVariantColor = (variant: any) => {
                              if (variant.variant_type === 'color') {
                                const productColor = modalProduct.productColors?.find((c: any) => c.name === variant.name)
                                if (productColor?.color) return productColor.color
                                if (variant.value) return variant.value
                                if (variant.color_hex) return variant.color_hex
                              }
                              return '#6B7280'
                            }

                            const getTextColor = (bgColor: string) => {
                              const hex = bgColor.replace('#', '')
                              const r = parseInt(hex.substr(0, 2), 16)
                              const g = parseInt(hex.substr(2, 2), 16)
                              const b = parseInt(hex.substr(4, 2), 16)
                              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                              return luminance > 0.5 ? '#000000' : '#FFFFFF'
                            }

                            // Calculate unassigned quantity
                            const totalInventoryQuantity = modalProduct.inventoryData?.[locationId]?.quantity || 0
                            const assignedQuantity = variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0)
                            const unassignedQuantity = totalInventoryQuantity - assignedQuantity

                            return (
                              <div key={locationId} className="bg-[#2B3544] rounded-lg p-4">
                                <p className="text-white font-medium mb-3">{locationName}</p>
                                <div className="flex flex-wrap gap-2">
                                  {/* Show specified variants (colors, shapes with names) */}
                                  {variants
                                    .filter((v: any) => v.name !== 'غير محدد')
                                    .map((variant: any, index: number) => {
                                      const bgColor = getVariantColor(variant)
                                      const textColor = getTextColor(bgColor)

                                      return (
                                        <span
                                          key={index}
                                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                                          style={{
                                            backgroundColor: bgColor,
                                            color: textColor,
                                            borderColor: bgColor === '#6B7280' ? '#6B7280' : bgColor
                                          }}
                                        >
                                          {variant.name} ({variant.quantity})
                                        </span>
                                      )
                                    })}

                                  {/* Show unassigned quantity if any */}
                                  {unassignedQuantity > 0 && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600">
                                      غير محدد ({unassignedQuantity})
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Images */}
                  <div className="space-y-6">
                    
                    {/* Main Image Preview */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-indigo-400 text-sm">🖼️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">صور المنتج</h3>
                      </div>
                      
                      {/* Large Image Preview - OPTIMIZED */}
                      <div className="mb-4">
                        <ProductModalImage
                          src={selectedImage}
                          alt={modalProduct.name}
                          priority={true}
                        />
                      </div>

                      {/* Thumbnail Gallery - OPTIMIZED */}
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {modalProduct.allImages && modalProduct.allImages.length > 0 ? (
                          modalProduct.allImages.map((imageUrl: string, index: number) => {
                            // Determine if this is the main image or sub image
                            const isMainImage = imageUrl === modalProduct.main_image_url
                            const isSubImage = imageUrl === modalProduct.sub_image_url
                            let imageLabel = `صورة ${index + 1}`
                            if (isMainImage) imageLabel = 'الصورة الرئيسية'
                            else if (isSubImage) imageLabel = 'الصورة الثانوية'
                            
                            return (
                              <div key={index} className="relative" title={imageLabel}>
                                <ProductThumbnail
                                  src={imageUrl}
                                  alt={imageLabel}
                                  isSelected={selectedImage === imageUrl}
                                  onClick={() => setSelectedImage(imageUrl)}
                                />
                                {/* Image type indicator */}
                                {(isMainImage || isSubImage) && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 text-center rounded-b-md">
                                    {isMainImage ? 'رئيسية' : 'ثانوية'}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        ) : (
                          /* Fallback when no images available */
                          <div className="w-full h-16 bg-[#2B3544] rounded-md border border-gray-600/30 flex items-center justify-center col-span-4">
                            <span className="text-gray-500 text-xs">لا توجد صور متاحة</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                </div>
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
        
        /* Utility classes for grid view */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Columns Control Modal */}
      <ColumnsControlModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        columns={getAllColumns}
        onColumnsChange={handleColumnsChange}
      />
      
      {/* Quantity Adjustment Modal */}
      <QuantityAdjustmentModal
        isOpen={showQuantityModal}
        onClose={() => setShowQuantityModal(false)}
        product={selectedProductForQuantity}
        mode={quantityModalMode}
        branches={branches}
        onConfirm={handleQuantityConfirm}
      />
      
      {/* Audit Status Context Menu */}
      {auditContextMenu.show && (
        <div
          className="fixed bg-[#2B3544] border-2 border-[#4A5568] rounded-xl shadow-2xl py-2 z-[9999]"
          style={{
            left: auditContextMenu.x,
            top: auditContextMenu.y,
            minWidth: '150px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Get available statuses for current product */}
          {(() => {
            const currentProduct = products.find(p => p.id === auditContextMenu.productId)
            const branchInventory = currentProduct?.inventoryData?.[auditContextMenu.branchId]
            const currentStatus = (branchInventory as any)?.audit_status || 'غير مجرود'
            const allStatuses = ['غير مجرود', 'استعد', 'تام الجرد']
            const availableStatuses = allStatuses.filter(status => status !== currentStatus)
            
            return availableStatuses.map((status) => {
              const getStatusColor = (status: string) => {
                switch(status) {
                  case 'تام الجرد': return 'hover:bg-green-600/20 text-green-400'
                  case 'استعد': return 'hover:bg-yellow-600/20 text-yellow-400'
                  case 'غير مجرود': return 'hover:bg-red-600/20 text-red-400'
                  default: return 'hover:bg-gray-600/20 text-gray-400'
                }
              }
              
              return (
                <button
                  key={status}
                  onClick={() => handleAuditContextMenuAction(status)}
                  className={`w-full text-right px-4 py-3 transition-colors ${getStatusColor(status)} border-b border-gray-600/30 last:border-b-0`}
                >
                  <span className="font-medium">{status}</span>
                </button>
              )
            })
          })()
          }
        </div>
      )}
    </div>
  )
}