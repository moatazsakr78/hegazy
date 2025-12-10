'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ProductsTabletView from '../../components/ProductsTabletView'
import { supabase } from '../../lib/supabase/client'
import { ProductGridImage, ProductModalImage, ProductThumbnail } from '../../components/ui/OptimizedImage'
import ResizableTable from '../../components/tables/ResizableTable'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import CategorySidebar from '../../components/CategorySidebar'
import ProductSidebar from '../../components/ProductSidebar'
import CategoriesTreeView from '../../components/CategoriesTreeView'
import ColorAssignmentModal from '../../components/ColorAssignmentModal'
import ColorAssignmentModalNew from '../../components/ColorAssignmentModalNew'
import ColorChangeModal from '../../components/ColorChangeModal'
import ColumnsControlModal from '../../components/ColumnsControlModal'
import ProductExportModal from '../../components/ProductExportModal'
import ProductImportModal from '../../components/ProductImportModal'
import BarcodePrintModal from '../../components/BarcodePrintModal'
import { useBranches, Branch, ProductVariant } from '../../lib/hooks/useBranches'
import { useProductsAdmin } from '../../../lib/hooks/useProductsAdmin'
import { Product } from '../../lib/hooks/useProductsOptimized'
// Local storage key for products column visibility
const PRODUCTS_COLUMN_VISIBILITY_KEY = 'products-column-visibility-v2'
import {
  ArrowPathIcon,
  FolderPlusIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  PrinterIcon,
  DocumentArrowDownIcon,
  TagIcon,
  ArrowsUpDownIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'


// Database category interface
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

// Dynamic product groups will be generated from branches data


export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('الفروع والمخازن')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isTablet, setIsTablet] = useState(false) // Now includes mobile devices
  const [isMobile, setIsMobile] = useState(false)
  const [isCategorySidebarOpen, setIsCategorySidebarOpen] = useState(false)
  const [isProductSidebarOpen, setIsProductSidebarOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showDeleteProductConfirm, setShowDeleteProductConfirm] = useState(false)
  const [isDeletingProduct, setIsDeletingProduct] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const [showProductModal, setShowProductModal] = useState(false)
  const [modalProduct, setModalProduct] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showColorAssignmentModal, setShowColorAssignmentModal] = useState(false)
  const [showColorAssignmentModalNew, setShowColorAssignmentModalNew] = useState(false)
  const [showColorChangeModal, setShowColorChangeModal] = useState(false)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<{[key: string]: boolean}>({})
  const [showBranchesDropdown, setShowBranchesDropdown] = useState(false)
  const [selectedBranches, setSelectedBranches] = useState<{[key: string]: boolean}>({})
  const [tempSelectedBranches, setTempSelectedBranches] = useState<{[key: string]: boolean}>({})

  // Import/Export modals state
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // Barcode print modal state
  const [showBarcodePrintModal, setShowBarcodePrintModal] = useState(false)

  // Scroll state for hiding/showing toolbar
  const [isToolbarHidden, setIsToolbarHidden] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)

  // ✨ OPTIMIZED: Use super-optimized admin hook (reduces queries significantly!)
  const { products, setProducts, branches, isLoading, error, fetchProducts, createProduct, updateProduct, deleteProduct } = useProductsAdmin()
  const { fetchBranchInventory, fetchProductVariants } = useBranches()

  // Device detection for tablet and mobile optimization
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isTabletDevice = /tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(userAgent) ||
                            (window.innerWidth >= 768 && window.innerWidth <= 1024)
      // Also detect mobile devices
      const isMobileDevice = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
                            (window.innerWidth < 768)
      // Use optimized view for tablets and mobile devices
      setIsTablet(isTabletDevice || isMobileDevice)
      setIsMobile(window.innerWidth < 768)
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
      setTempSelectedBranches(initialBranches)
    }
  }, [branches, selectedBranches])

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

  // OPTIMIZED: Memoized branch toggle handler
  const handleBranchToggle = useCallback((branchId: string) => {
    setSelectedBranches(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }))
  }, [])

  // معالج للتحديد المؤقت في النافذة
  const handleTempBranchToggle = useCallback((branchId: string) => {
    setTempSelectedBranches(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }))
  }, [])

  // تطبيق التحديد المؤقت
  const applyBranchSelection = useCallback(() => {
    setSelectedBranches({...tempSelectedBranches})
    setShowBranchesDropdown(false)
  }, [tempSelectedBranches])

  // إلغاء التحديد المؤقت
  const cancelBranchSelection = useCallback(() => {
    setTempSelectedBranches({...selectedBranches})
    setShowBranchesDropdown(false)
  }, [selectedBranches])

  // Track if columns visibility has been loaded from storage
  const visibilityLoadedRef = useRef(false)

  // Initialize visible columns state - load from localStorage
  useEffect(() => {
    // Only load once per session
    if (visibilityLoadedRef.current) return
    if (branches.length === 0) return

    const allColumnIds = ['index', 'name', 'group', 'totalQuantity', 'buyPrice', 'sellPrice', 'wholeSalePrice', 'sellPrice1', 'sellPrice2', 'sellPrice3', 'sellPrice4', 'location', 'barcode', 'activity']

    // Add branch columns
    branches.forEach(branch => {
      allColumnIds.push(`branch_${branch.id}`, `min_stock_${branch.id}`, `variants_${branch.id}`)
    })

    try {
      // Load from localStorage
      const savedData = localStorage.getItem(PRODUCTS_COLUMN_VISIBILITY_KEY)

      if (savedData) {
        const parsed = JSON.parse(savedData)
        console.log('✅ Loaded column visibility from localStorage:', parsed)

        // Merge with all column IDs (for new columns not in saved config)
        const mergedVisible: {[key: string]: boolean} = {}
        allColumnIds.forEach(colId => {
          // Use saved value if exists, otherwise default to true
          mergedVisible[colId] = parsed[colId] !== undefined ? parsed[colId] : true
        })

        const hiddenCount = Object.values(mergedVisible).filter(v => !v).length
        console.log(`📊 Hidden columns: ${hiddenCount}`)

        setVisibleColumns(mergedVisible)
      } else {
        console.log('⚠️ No saved config found, using defaults (all visible)')
        // No saved config, use defaults (all visible)
        const defaultVisible: {[key: string]: boolean} = {}
        allColumnIds.forEach(colId => {
          defaultVisible[colId] = true
        })
        setVisibleColumns(defaultVisible)
      }

      visibilityLoadedRef.current = true
    } catch (error) {
      console.error('❌ Error loading column visibility:', error)
      // Fallback to all visible
      const fallbackVisible: {[key: string]: boolean} = {}
      allColumnIds.forEach(colId => {
        fallbackVisible[colId] = true
      })
      setVisibleColumns(fallbackVisible)
      visibilityLoadedRef.current = true
    }
  }, [branches])

  // Handle scroll to hide/show toolbar like in the image
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const threshold = 10 // Minimum scroll to trigger hide/show

      if (Math.abs(currentScrollY - lastScrollY) < threshold) return

      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down and past threshold - hide toolbar
        if (!isToolbarHidden) {
          setIsToolbarHidden(true)
        }
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show toolbar
        if (isToolbarHidden) {
          setIsToolbarHidden(false)
        }
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY, isToolbarHidden])

  // OPTIMIZED: Generate dynamic table columns with advanced memoization
  const dynamicTableColumns = useMemo(() => {
    const baseColumns = [
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
        id: 'group', 
        header: 'المجموعة', 
        accessor: 'category', 
        width: 100,
        render: (value: any) => <span className="text-gray-300">{value?.name || 'غير محدد'}</span>
      },
      { 
        id: 'totalQuantity', 
        header: 'كمية كلية', 
        accessor: 'totalQuantity', 
        width: 120,
        render: (value: number) => (
          <span className="text-blue-400 font-medium">قطعة {value}</span>
        )
      },
      { 
        id: 'buyPrice', 
        header: 'سعر الشراء', 
        accessor: 'cost_price', 
        width: 120,
        render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
      },
      { 
        id: 'sellPrice', 
        header: 'سعر البيع', 
        accessor: 'price', 
        width: 120,
        render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
      },
      { 
        id: 'wholeSalePrice', 
        header: 'سعر الجملة', 
        accessor: 'wholesale_price', 
        width: 120,
        render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
      },
      { 
        id: 'sellPrice1', 
        header: 'سعر 1', 
        accessor: 'price1', 
        width: 100,
        render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
      },
      { 
        id: 'sellPrice2', 
        header: 'سعر 2', 
        accessor: 'price2', 
        width: 100,
        render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
      },
      { 
        id: 'sellPrice3', 
        header: 'سعر 3', 
        accessor: 'price3', 
        width: 100,
        render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
      },
      { 
        id: 'sellPrice4', 
        header: 'سعر 4', 
        accessor: 'price4', 
        width: 100,
        render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
      },
      { 
        id: 'location', 
        header: 'الموقع', 
        accessor: 'location', 
        width: 100,
        render: (value: string) => <span className="text-gray-300">{value || '-'}</span>
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
    const branchColumns = branches
      .filter(branch => selectedBranches[branch.id])
      .map(branch => ({
        id: `branch_${branch.id}`,
        header: branch.name,
        accessor: `branch_${branch.id}`,
        width: 120,
        render: (value: any, item: Product) => {
          const inventoryData = item.inventoryData?.[branch.id]
          const quantity = inventoryData?.quantity || 0
          return (
            <span className="text-blue-400 font-medium">قطعة {quantity}</span>
          )
        }
      }))

    // Add dynamic branch min stock columns (only for selected branches)
    const minStockColumns = branches
      .filter(branch => selectedBranches[branch.id])
      .map(branch => ({
        id: `min_stock_${branch.id}`,
        header: `منخفض - ${branch.name}`,
        accessor: `min_stock_${branch.id}`,
        width: 150,
        render: (value: any, item: Product) => {
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
      render: (value: any, item: Product) => {
        const variants = item.variantsData?.[branch.id] || []
        const colorVariants = variants.filter(v => v.variant_type === 'color')
        const shapeVariants = variants.filter(v => v.variant_type === 'shape')
        
        // Helper function to get variant color
        const getVariantColor = (variant: any) => {
          if (variant.variant_type === 'color') {
            // Try to find the color from product colors
            const productColor = item.productColors?.find(c => c.name === variant.name)
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
        const assignedQuantity = [...colorVariants, ...shapeVariants].reduce((sum, variant) => sum + variant.quantity, 0)
        const unassignedQuantity = totalInventoryQuantity - assignedQuantity

        // Group variants and consolidate unspecified ones
        const specifiedVariants = [...colorVariants, ...shapeVariants].filter(v => v.name !== 'غير محدد')
        const unspecifiedVariants = [...colorVariants, ...shapeVariants].filter(v => v.name === 'غير محدد')
        const totalUnspecifiedQuantity = unspecifiedVariants.reduce((sum, v) => sum + v.quantity, 0) + unassignedQuantity

        return (
          <div className="flex flex-wrap gap-1">
            {/* Show specified variants (colors, shapes with names) */}
            {specifiedVariants.map((variant, index) => {
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
            
            {/* Show consolidated unspecified quantity if any */}
            {totalUnspecifiedQuantity > 0 && (
              <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600"
              >
                غير محدد الكلي ({totalUnspecifiedQuantity})
              </span>
            )}
          </div>
        )
      }
    }))

    const activityColumn = { 
      id: 'activity', 
      header: 'نشيط', 
      accessor: 'is_active', 
      width: 80,
      render: (value: boolean) => (
        <div className="flex justify-center">
          <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
      )
    }

    // Get count of selected branches
    const selectedBranchesCount = Object.values(selectedBranches).filter(Boolean).length

    // Filter baseColumns to hide totalQuantity if only one branch is selected
    const filteredBaseColumns = baseColumns.filter(col => {
      // Hide totalQuantity column if only one branch is selected
      if (col.id === 'totalQuantity' && selectedBranchesCount === 1) {
        return false
      }
      return true
    })

    const allColumns = [...filteredBaseColumns, ...branchColumns, ...minStockColumns, ...variantColumns, activityColumn]
    
    // Filter columns based on visibility
    return allColumns.filter(col => visibleColumns[col.id] !== false)
  }, [branches, visibleColumns, selectedBranches])

  // OPTIMIZED: Memoized refresh handler
  const handleRefresh = useCallback(() => {
    fetchProducts()
  }, [fetchProducts])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const toggleCategorySidebar = () => {
    setIsCategorySidebarOpen(!isCategorySidebarOpen)
    // Reset edit mode when opening for new category
    if (!isCategorySidebarOpen) {
      setIsEditing(false)
      setEditCategory(null)
    }
  }

  const handleEditCategory = (category: Category) => {
    setEditCategory(category)
    setIsEditing(true)
    setIsCategorySidebarOpen(true)
  }

  const handleCategorySelect = (category: Category | null) => {
    setSelectedCategory(category)
  }

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return

    // Prevent deletion of root "منتجات" category - المجموعة الأم الأساسية
    if (selectedCategory.name === 'منتجات') {
      alert('لا يمكن حذف المجموعة الرئيسية "منتجات" - هذه هي المجموعة الأم الأساسية')
      return
    }
    
    // Check if category has subcategories or products
    try {
      // Check for subcategories
      const { data: subcategories, error: subcatError } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', selectedCategory.id)
        .eq('is_active', true)
      
      if (subcatError) throw subcatError
      
      if (subcategories && subcategories.length > 0) {
        alert('لا يمكن حذف المجموعة لأنها تحتوي على مجموعات فرعية')
        return
      }
      
      // Check for products in this category
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', selectedCategory.id)
        .eq('is_active', true)
      
      if (prodError) throw prodError
      
      if (products && products.length > 0) {
        alert('لا يمكن حذف المجموعة لأنها تحتوي على منتجات')
        return
      }
      
      // Show confirmation dialog
      setShowDeleteConfirm(true)
      
    } catch (error) {
      console.error('Error checking category dependencies:', error)
      alert('حدث خطأ أثناء التحقق من المجموعة')
    }
  }

  const confirmDeleteCategory = async () => {
    if (!selectedCategory) return
    
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', selectedCategory.id)
      
      if (error) throw error
      
      // Clear selection and close confirmation
      setSelectedCategory(null)
      setShowDeleteConfirm(false)
      
      // Refresh categories list
      await fetchCategories()
      
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('حدث خطأ أثناء حذف المجموعة')
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelDeleteCategory = () => {
    setShowDeleteConfirm(false)
  }

  const toggleProductSidebar = () => {
    setIsProductSidebarOpen(!isProductSidebarOpen)
    // Reset selection when opening for new product
    if (!isProductSidebarOpen) {
      setSelectedProduct(null)
    }
  }

  const handleEditProduct = () => {
    if (selectedProduct) {
      setIsProductSidebarOpen(true)
    }
  }

  const handleDeleteProduct = () => {
    if (selectedProduct) {
      setShowDeleteProductConfirm(true)
    }
  }

  const confirmDeleteProduct = async () => {
    if (!selectedProduct) return
    
    setIsDeletingProduct(true)
    try {
      await deleteProduct(selectedProduct.id)
      
      // Clear selection and close confirmation
      setSelectedProduct(null)
      setShowDeleteProductConfirm(false)
      
    } catch (error) {
      console.error('Error deleting product:', error)
      // Show specific error message if it's about invoices, otherwise show generic error
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حذف المنتج'
      alert(errorMessage)
    } finally {
      setIsDeletingProduct(false)
    }
  }

  const cancelDeleteProduct = () => {
    setShowDeleteProductConfirm(false)
  }

  // OPTIMIZED: Memoized columns change handler - saves to localStorage
  const handleColumnsChange = useCallback((updatedColumns: {id: string, header: string, visible: boolean}[]) => {
    const newVisibleColumns: {[key: string]: boolean} = {}
    updatedColumns.forEach(col => {
      newVisibleColumns[col.id] = col.visible
    })
    setVisibleColumns(newVisibleColumns)

    const visibleCount = updatedColumns.filter(c => c.visible).length
    const hiddenCount = updatedColumns.filter(c => !c.visible).length
    console.log(`🔄 Columns changed: ${visibleCount} visible, ${hiddenCount} hidden`)

    // Save to localStorage directly
    try {
      localStorage.setItem(PRODUCTS_COLUMN_VISIBILITY_KEY, JSON.stringify(newVisibleColumns))
      console.log('✅ Saved column visibility to localStorage!')
    } catch (error) {
      console.error('❌ Error saving column visibility:', error)
    }
  }, [])

  // OPTIMIZED: Memoized columns data preparation
  const getAllColumns = useMemo(() => {
    const baseColumns = [
      { id: 'index', header: '#' },
      { id: 'name', header: 'اسم المنتج' },
      { id: 'group', header: 'المجموعة' },
      { id: 'totalQuantity', header: 'كمية كلية' },
      { id: 'buyPrice', header: 'سعر الشراء' },
      { id: 'sellPrice', header: 'سعر البيع' },
      { id: 'wholeSalePrice', header: 'سعر الجملة' },
      { id: 'sellPrice1', header: 'سعر 1' },
      { id: 'sellPrice2', header: 'سعر 2' },
      { id: 'sellPrice3', header: 'سعر 3' },
      { id: 'sellPrice4', header: 'سعر 4' },
      { id: 'location', header: 'الموقع' },
      { id: 'barcode', header: 'الباركود' },
      { id: 'activity', header: 'نشيط' }
    ]

    // Add branch columns
    const branchColumns = branches.map(branch => ([
      { id: `branch_${branch.id}`, header: branch.name },
      { id: `min_stock_${branch.id}`, header: `منخفض - ${branch.name}` },
      { id: `variants_${branch.id}`, header: `الأشكال والألوان - ${branch.name}` }
    ])).flat()

    const allColumns = [...baseColumns, ...branchColumns]
    
    return allColumns.map(col => ({
      id: col.id,
      header: col.header,
      visible: visibleColumns[col.id] !== false
    }))
  }, [branches, visibleColumns])


  // OPTIMIZED: Memoized categories fetcher
  const fetchCategories = useCallback(async () => {
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
    // setIsLoading is now handled by the useProducts hook
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

  useEffect(() => {
    fetchCategories()
  }, [])


  // OPTIMIZED: Memoized product filtering to prevent unnecessary re-renders
  const filteredProducts = useMemo(() => {
    let filtered = products

    // Category filter: If a category is selected and it's not the root "منتجات" category
    if (selectedCategory && selectedCategory.name !== 'منتجات') {
      const categoryIds = getAllSubcategoryIds(selectedCategory.id, categories)

      filtered = filtered.filter(product =>
        product.category_id && categoryIds.includes(product.category_id)
      )
    }

    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        (product.barcode && product.barcode.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [products, searchQuery, selectedCategory, categories, getAllSubcategoryIds])

  // Use tablet view if detected as tablet or mobile device
  if (isTablet) {
    return (
      <ProductsTabletView
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />
    )
  }

  // Default PC/Desktop view
  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-hidden flex flex-col">
        
        {/* Top Action Buttons Toolbar - Full Width with hide/show animation */}
        <div className={`bg-[#374151] border-b border-gray-600 px-4 py-2 w-full transition-all duration-300 ease-in-out ${
          isToolbarHidden ? 'transform -translate-y-full opacity-0' : 'transform translate-y-0 opacity-100'
        }`}>
          <div className="flex items-center justify-start gap-1">
            <button 
              onClick={handleRefresh}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <ArrowPathIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">تحديث</span>
            </button>

            <button 
              onClick={toggleCategorySidebar}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <FolderPlusIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">مجموعة جديدة</span>
            </button>

            <button 
              onClick={() => selectedCategory && handleEditCategory(selectedCategory)}
              className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] ${
                selectedCategory && selectedCategory.name !== 'منتجات'
                  ? 'text-gray-300 hover:text-white' 
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedCategory || selectedCategory.name === 'منتجات'}
            >
              <PencilSquareIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">تحرير المجموعة</span>
            </button>

            <button 
              onClick={handleDeleteCategory}
              className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] ${
                selectedCategory && selectedCategory.name !== 'منتجات'
                  ? 'text-red-400 hover:text-red-300' 
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedCategory || selectedCategory.name === 'منتجات'}
            >
              <TrashIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">حذف المجموعة</span>
            </button>

            <button 
              onClick={toggleProductSidebar}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <PlusIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">منتج جديد</span>
            </button>

            <button 
              onClick={() => selectedProduct && handleEditProduct()}
              className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] ${
                selectedProduct
                  ? 'text-gray-300 hover:text-white' 
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedProduct}
            >
              <PencilSquareIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">تحرير المنتج</span>
            </button>

            <button 
              onClick={handleDeleteProduct}
              className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] ${
                selectedProduct
                  ? 'text-red-400 hover:text-red-300' 
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedProduct}
            >
              <TrashIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">حذف المنتج</span>
            </button>

            <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]">
              <PrinterIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">طباعة</span>
            </button>

            <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]">
              <DocumentArrowDownIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">حفظ كـ PDF</span>
            </button>

            <button
              onClick={() => setShowBarcodePrintModal(true)}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <TagIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">بطاقات الأسعار</span>
            </button>

            <button className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]">
              <ArrowsUpDownIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">ترتيب</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">استيراد</span>
            </button>

            {isSelectionMode && selectedProductIds.length > 0 ? (
              <>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex flex-col items-center p-2 text-green-300 hover:text-green-100 cursor-pointer min-w-[80px] animate-pulse"
                >
                  <ArrowUpTrayIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">تصدير المحددة ({selectedProductIds.length})</span>
                </button>

                <button
                  onClick={() => {
                    setIsSelectionMode(false)
                    setSelectedProductIds([])
                  }}
                  className="flex flex-col items-center p-2 text-red-300 hover:text-red-100 cursor-pointer min-w-[80px]"
                >
                  <XMarkIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">إلغاء التحديد</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
              >
                <ArrowUpTrayIcon className="h-5 w-5 mb-1" />
                <span className="text-sm">تصدير</span>
              </button>
            )}

            <button 
              onClick={() => setShowColumnsModal(true)}
              className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
            >
              <TableCellsIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">الأعمدة</span>
            </button>

            <button
              onClick={() => selectedProduct && setShowColorAssignmentModalNew(true)}
              className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] ${
                selectedProduct
                  ? 'text-gray-300 hover:text-white'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedProduct}
            >
              <TagIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">الألوان والأشكال</span>
            </button>

            <button 
              onClick={() => selectedProduct && setShowColorChangeModal(true)}
              className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] ${
                selectedProduct
                  ? 'text-orange-300 hover:text-orange-100' 
                  : 'text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedProduct}
            >
              <ArrowPathIcon className="h-5 w-5 mb-1" />
              <span className="text-sm">تغيير اللون</span>
            </button>

          </div>
        </div>

        {/* Content Area with Sidebar and Main Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Product Groups Tree Sidebar */}
          <CategoriesTreeView 
            onCategorySelect={handleCategorySelect}
            selectedCategoryId={selectedCategory?.id}
            showActionButtons={true}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Second Toolbar - Search and Controls */}
            <div className={`bg-[#374151] border-b border-gray-600 ${isMobile ? 'px-3 py-2' : 'px-6 py-3'} flex-shrink-0`}>
              <div className="flex items-center justify-between">
                {/* Left Side - Search and Controls */}
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
                  {/* Group Filter Dropdown */}
                  <div className="relative branches-dropdown">
                    <button
                      onClick={() => {
                        // نسخ التحديد الحالي للحالة المؤقتة عند فتح النافذة
                        setTempSelectedBranches({...selectedBranches})
                        setShowBranchesDropdown(!showBranchesDropdown)
                      }}
                      className={`flex items-center ${isMobile ? 'gap-1 px-2 py-2 text-xs' : 'gap-2 px-4 py-2 text-sm'} bg-blue-600 hover:bg-blue-700 rounded-md text-white font-medium transition-colors ${isMobile ? 'max-w-[120px] min-w-[100px]' : ''}`}
                    >
                      <span className={isMobile ? 'truncate' : ''}>{selectedGroup}</span>
                      <ChevronDownIcon className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} transition-transform flex-shrink-0 ${showBranchesDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Branches Dropdown - Desktop */}
                    {showBranchesDropdown && !isMobile && (
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
                      className="w-80 pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* Right Side - Additional controls can be added here */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">عرض {filteredProducts.length} من أصل {products.length} منتج</span>
                </div>
              </div>
            </div>

            {/* Products Content Container */}
            <div className="flex-1 overflow-hidden bg-[#2B3544]">
              {viewMode === 'table' ? (
                <ResizableTable
                  className="h-full w-full"
                  columns={dynamicTableColumns}
                  data={filteredProducts}
                  selectedRowId={selectedProduct?.id || null}
                  reportType="PRODUCTS_REPORT"
                  onRowClick={(product, index) => {
                    // Toggle selection: if already selected, deselect it
                    if (selectedProduct?.id === product.id) {
                      setSelectedProduct(null)
                    } else {
                      setSelectedProduct(product as Product)
                    }
                  }}
                />
              ) : (
                // Grid View
                <div className="h-full overflow-y-auto scrollbar-hide p-4">
                  <div className="grid grid-cols-6 gap-4">
                    {filteredProducts.map((product, index) => {
                      const isSelected = isSelectionMode
                        ? selectedProductIds.includes(product.id)
                        : selectedProduct?.id === product.id

                      return <div
                        key={product.id}
                        onClick={() => {
                          if (isSelectionMode) {
                            // Multi-select mode
                            if (selectedProductIds.includes(product.id)) {
                              setSelectedProductIds(selectedProductIds.filter(id => id !== product.id))
                            } else {
                              setSelectedProductIds([...selectedProductIds, product.id])
                            }
                          } else {
                            // Single-select mode
                            if (selectedProduct?.id === product.id) {
                              setSelectedProduct(null)
                            } else {
                              setSelectedProduct(product as Product)
                            }
                          }
                        }}
                        className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group ${
                          isSelected
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
                                setModalProduct(product as Product)
                                // Set first available image as selected
                                const firstImage = product.allImages?.[0] || product.main_image_url || null
                                setSelectedImage(firstImage)
                                setShowProductModal(true)
                              }}
                              className={`bg-black/70 hover:bg-black/90 text-white p-2 rounded-full opacity-0 ${!isSidebarOpen ? 'group-hover:opacity-100' : 'pointer-events-none'} transition-all duration-200 shadow-lg`}
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
                          {/* Rating */}
                          {(product.rating || 0) > 0 && (
                            <div className="flex justify-center items-center gap-1 mb-1">
                              <span className="text-yellow-400 text-xs">⭐</span>
                              <span className="text-yellow-400 font-medium text-xs">
                                {(product.rating || 0).toFixed(1)}
                              </span>
                              <span className="text-gray-500 text-xs">
                                ({product.rating_count || 0})
                              </span>
                            </div>
                          )}

                          {/* Selling Price with Discount */}
                          <div className="flex justify-center mb-2 flex-col items-center">
                            {product.isDiscounted ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="text-blue-400 font-medium text-sm">
                                    {(product.finalPrice || 0).toFixed(2)}
                                  </span>
                                  <span className="bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                                    {product.discountLabel}
                                  </span>
                                </div>
                                <span className="text-gray-500 line-through text-xs">
                                  {(product.price || 0).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-blue-400 font-medium text-sm">
                                {(product.price || 0).toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Total Quantity */}
                          <div className="flex justify-between items-center">
                            <span className="text-blue-400 font-medium">
                              {(product.inventoryData && Object.values(product.inventoryData).reduce((sum: number, inv: any) => sum + (inv?.quantity || 0), 0)) || 0}
                            </span>
                            <span className="text-gray-400">الكمية الإجمالية</span>
                          </div>

                          {/* Branch/Warehouse Quantities */}
                          {product.inventoryData && Object.entries(product.inventoryData).map(([locationId, inventory]: [string, any]) => {
                            // Find the branch name for this location
                            const branch = branches.find(b => b.id === locationId)
                            const locationName = branch?.name || `موقع ${locationId.slice(0, 8)}`

                            return (
                              <div key={locationId} className="flex justify-between items-center">
                                <span className="text-white">
                                  {inventory?.quantity || 0}
                                </span>
                                <span className="text-gray-400 truncate">
                                  {locationName}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    })}
                  </div>

                  {/* Spacer div to compensate for hidden toolbar */}
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      isToolbarHidden ? 'h-20' : 'h-0'
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Sidebar */}
      <CategorySidebar 
        isOpen={isCategorySidebarOpen} 
        onClose={() => {
          setIsCategorySidebarOpen(false)
          setIsEditing(false)
          setEditCategory(null)
        }}
        categories={categories}
        onCategoryCreated={fetchCategories}
        editCategory={editCategory}
        isEditing={isEditing}
        selectedCategory={selectedCategory}
      />

      {/* Product Sidebar */}
      <ProductSidebar
        isOpen={isProductSidebarOpen}
        onClose={() => {
          setIsProductSidebarOpen(false)
          setSelectedProduct(null)
        }}
        onProductCreated={() => {
          // Explicitly refresh products list to ensure inventory data is loaded
          console.log('🔄 Refreshing products list after creation')
          fetchProducts()
          setIsProductSidebarOpen(false)
          setSelectedProduct(null)
        }}
        createProduct={createProduct}
        updateProduct={updateProduct}
        categories={categories}
        editProduct={selectedProduct}
        selectedCategory={selectedCategory}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={cancelDeleteCategory} />
          
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
                  {selectedCategory?.name}
                </p>
              </div>
              
              {/* Actions */}
              <div className="px-6 py-4 border-t border-[#4A5568] flex gap-3 justify-end">
                <button
                  onClick={cancelDeleteCategory}
                  className="px-4 py-2 text-gray-300 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 hover:border-gray-500 rounded transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDeleteCategory}
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

      {/* Product Delete Confirmation Modal */}
      {showDeleteProductConfirm && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={cancelDeleteProduct} />
          
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
                  هل أنت متأكد من أنك تريد حذف هذا المنتج؟
                </p>
                <p className="text-blue-400 font-medium text-right">
                  {selectedProduct?.name}
                </p>
                <p className="text-yellow-400 text-sm text-right mt-2">
                  تحذير: لا يمكن التراجع عن هذا الإجراء
                </p>
              </div>
              
              {/* Actions */}
              <div className="px-6 py-4 border-t border-[#4A5568] flex gap-3 justify-end">
                <button
                  onClick={cancelDeleteProduct}
                  className="px-4 py-2 text-gray-300 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 hover:border-gray-500 rounded transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDeleteProduct}
                  disabled={isDeletingProduct}
                  className={`px-4 py-2 rounded transition-colors ${
                    isDeletingProduct
                      ? 'bg-red-600/50 text-red-300 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isDeletingProduct ? 'جاري الحذف...' : 'نعم، احذف'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
                      
                      {/* Main Price with Discount */}
                      <div className="mb-4">
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center border border-green-600/30">
                          <p className="text-gray-400 text-sm mb-1">سعر البيع</p>
                          <div className="flex items-center justify-center gap-2">
                            {modalProduct.isDiscounted ? (
                              <>
                                <p className="text-green-400 font-bold text-2xl">{(modalProduct.finalPrice || 0).toFixed(2)}</p>
                                <p className="text-gray-500 line-through text-lg">{(modalProduct.price || 0).toFixed(2)}</p>
                                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                                  {modalProduct.discountLabel}
                                </span>
                              </>
                            ) : (
                              <p className="text-green-400 font-bold text-2xl">{(modalProduct.price || 0).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر الشراء</p>
                          <p className="text-orange-400 font-bold text-lg">{(modalProduct.cost_price || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر الجملة</p>
                          <p className="text-blue-400 font-bold text-lg">{(modalProduct.wholesale_price || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر 1</p>
                          <p className="text-purple-400 font-bold text-lg">{(modalProduct.price1 || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر 2</p>
                          <p className="text-indigo-400 font-bold text-lg">{(modalProduct.price2 || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Rating Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-yellow-400 text-sm">⭐</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">التقييمات</h3>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-yellow-400 font-bold text-3xl">
                            {(modalProduct.rating || 0).toFixed(1)}
                          </span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-xl ${
                                  star <= (modalProduct.rating || 0)
                                    ? 'text-yellow-400'
                                    : 'text-gray-600'
                                }`}
                              >
                                ⭐
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm">
                          {modalProduct.rating_count || 0} تقييم
                        </p>
                        {(modalProduct.rating_count || 0) === 0 && (
                          <p className="text-gray-500 text-xs mt-2">
                            لا توجد تقييمات بعد
                          </p>
                        )}
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
                          {modalProduct.inventoryData && Object.values(modalProduct.inventoryData).reduce((sum: number, inv: any) => sum + (inv?.quantity || 0), 0) || 0}
                        </p>
                      </div>

                      {/* Branch/Warehouse Details */}
                      <div className="space-y-3">
                        {modalProduct.inventoryData && Object.entries(modalProduct.inventoryData).map(([locationId, inventory]: [string, any]) => {
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
                          {Object.entries(modalProduct.variantsData).map(([locationId, variants]: [string, any]) => {
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

                      {/* Thumbnail Gallery */}
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {modalProduct.allImages && modalProduct.allImages.length > 0 ? (
                          modalProduct.allImages.map((imageUrl, index) => {
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

      {/* New Color Assignment Modal */}
      {showColorAssignmentModalNew && selectedProduct && (
        <ColorAssignmentModalNew
          product={selectedProduct}
          branches={branches}
          isOpen={showColorAssignmentModalNew}
          onClose={() => setShowColorAssignmentModalNew(false)}
          onAssignmentComplete={() => {
            fetchProducts() // Refresh products after assignment
            setShowColorAssignmentModalNew(false)
          }}
        />
      )}

      {/* Color Assignment Modal (Old - Backup) */}
      {showColorAssignmentModal && selectedProduct && (
        <ColorAssignmentModal
          product={selectedProduct}
          branches={branches}
          isOpen={showColorAssignmentModal}
          onClose={() => setShowColorAssignmentModal(false)}
          onAssignmentComplete={() => {
            fetchProducts() // Refresh products after assignment
            setShowColorAssignmentModal(false)
          }}
        />
      )}

      {/* Color Change Modal */}
      {showColorChangeModal && selectedProduct && (
        <ColorChangeModal 
          product={selectedProduct}
          branches={branches}
          isOpen={showColorChangeModal}
          onClose={() => setShowColorChangeModal(false)}
          onColorChangeComplete={() => {
            fetchProducts() // Refresh products after color change
            setShowColorChangeModal(false)
          }}
        />
      )}

      {/* Columns Control Modal */}
      <ColumnsControlModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        columns={getAllColumns}
        onColumnsChange={handleColumnsChange}
      />

      {/* Product Export Modal */}
      <ProductExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        products={filteredProducts}
        selectedProductIds={selectedProductIds}
        onSelectModeRequest={() => {
          setIsSelectionMode(true)
          setSelectedProductIds([])
        }}
      />

      {/* Product Import Modal */}
      <ProductImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        createProduct={createProduct}
        onImportComplete={() => {
          fetchProducts()
          setShowImportModal(false)
        }}
      />

      {/* Barcode Print Modal */}
      <BarcodePrintModal
        isOpen={showBarcodePrintModal}
        onClose={() => setShowBarcodePrintModal(false)}
        products={filteredProducts}
        branches={branches}
      />

      {/* Mobile/Tablet Branches Modal - Positioned at top level */}
      {showBranchesDropdown && (isMobile || isTablet) && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
            onClick={cancelBranchSelection}
          />

          {/* Modal */}
          <div className="branches-dropdown fixed inset-4 bg-[#2B3544] rounded-2xl z-[99999] flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#4A5568]">
              <h3 className="text-white text-lg font-semibold">اختر الفروع والمخازن</h3>
              <button
                onClick={cancelBranchSelection}
                className="text-gray-400 hover:text-white p-1"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-3">
                {branches.map(branch => (
                  <div
                    key={branch.id}
                    className="flex items-center gap-3 p-3 bg-[#374151] hover:bg-[#434E61] rounded-xl transition-colors border border-gray-600/30"
                  >
                    <div
                      className="relative"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTempBranchToggle(branch.id)
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={tempSelectedBranches[branch.id] || false}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleTempBranchToggle(branch.id)
                        }}
                        className="w-5 h-5 opacity-0 absolute"
                      />
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        tempSelectedBranches[branch.id]
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-transparent border-blue-500'
                      }`}>
                        {tempSelectedBranches[branch.id] && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                      <span className="text-white text-base font-medium block">
                        {branch.name}
                      </span>
                    </div>
                    <span className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded border border-blue-600/30">
                      {branch.name.includes('مخزن') || branch.name.includes('شاكوس') ? 'مخزن' : 'فرع'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#4A5568] bg-[#374151] rounded-b-2xl">
              <div className="flex items-center justify-between">
                <span className="text-blue-400 font-medium">
                  {Object.values(tempSelectedBranches).filter(Boolean).length} من أصل {branches.length} محدد
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={cancelBranchSelection}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={applyBranchSelection}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    تطبيق
                  </button>
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
      `}</style>
    </div>
  )
}