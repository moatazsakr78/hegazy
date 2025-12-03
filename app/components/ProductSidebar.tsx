'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRightIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'
import { useShapes } from '../lib/hooks/useShapes'
import { uploadProductImage, PRODUCT_STORAGE_BUCKETS, getProductImageUrl } from '../lib/supabase/storage'
import { uploadAndSetMainImage, uploadAndSetSubImage, addAdditionalVersionedImage, uploadVersionedProductImage } from '../lib/services/simpleImageVersioning'
import { Product } from '../lib/hooks/useProducts'
import { checkProductPurchaseHistory, PurchaseHistoryCheck } from '../lib/utils/purchase-cost-management'
import { useProductVideos, ProductVideo } from '../lib/hooks/useProductVideos'
import ProductVideoUpload from './ProductVideoUpload'

interface Branch {
  id: string
  name: string
  name_en: string | null
  address: string
  phone: string
  manager_id: string | null
  allow_variants: boolean
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface Warehouse {
  id: string
  name: string
  name_en: string | null
  address: string
  phone: string
  manager_id: string | null
  allow_variants: boolean
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface LocationThreshold {
  locationId: string
  locationType: 'branch' | 'warehouse'
  locationName: string
  quantity: number | undefined
  minStockThreshold: number | undefined
}

interface LocationVariant {
  id: string
  locationId: string
  locationType: 'branch' | 'warehouse'
  elementType: 'color' | 'shape'
  elementId: string
  elementName: string
  quantity: number
  barcode: string
  image?: string
}

interface SelectedLocation {
  id: string
  name: string
  type: 'branch' | 'warehouse'
  totalQuantity: number
}

interface ProductColor {
  id: string
  name: string
  color: string
  image?: string // Add image field to preserve color images
  barcode?: string // Add barcode field for individual color barcodes
}

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

interface ProductSidebarProps {
  isOpen: boolean
  onClose: () => void
  onProductCreated?: () => void
  createProduct: (productData: Partial<Product>) => Promise<Product | null>
  updateProduct?: (productId: string, productData: Partial<Product>) => Promise<Product | null>
  categories: Category[]
  editProduct?: Product | null
  selectedCategory?: Category | null
}

// Image state interfaces
interface ImageFile {
  file: File
  preview: string
  id: string
}

interface ImageUploadAreaProps {
  onImageSelect: (files: File[]) => void
  images: ImageFile[]
  onImageRemove: (id: string) => void
  label: string
  multiple?: boolean
}

export default function ProductSidebar({ isOpen, onClose, onProductCreated, createProduct, updateProduct, categories, editProduct, selectedCategory }: ProductSidebarProps) {
  const [activeTab, setActiveTab] = useState('تفاصيل المنتج')
  const [activeShapeColorTab, setActiveShapeColorTab] = useState('شكل وصف')
  const [branches, setBranches] = useState<Branch[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [locationThresholds, setLocationThresholds] = useState<LocationThreshold[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const { shapes } = useShapes()
  const [productColors, setProductColors] = useState<ProductColor[]>([])
  const [colorName, setColorName] = useState('')
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [editingColorId, setEditingColorId] = useState<string | null>(null)
  const [colorBarcode, setColorBarcode] = useState('')
  const [colorImageFile, setColorImageFile] = useState<File | null>(null)
  const [colorImagePreview, setColorImagePreview] = useState<string | null>(null)
  const [colorImageDragActive, setColorImageDragActive] = useState(false)

  // Product shapes state (shapes linked to current product)
  const [productShapes, setProductShapes] = useState<any[]>([])
  const [isLoadingShapes, setIsLoadingShapes] = useState(false)
  const [shapeName, setShapeName] = useState('')
  const [shapeBarcode, setShapeBarcode] = useState('')
  const [shapeImageFile, setShapeImageFile] = useState<File | null>(null)
  const [shapeImagePreview, setShapeImagePreview] = useState<string | null>(null)
  const [shapeImageDragActive, setShapeImageDragActive] = useState(false)
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null)
  
  // New states for location variant management
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [locationVariants, setLocationVariants] = useState<LocationVariant[]>([])
  const [variantForm, setVariantForm] = useState({
    elementType: 'color' as 'color' | 'shape',
    elementId: '',
    quantity: 0,
    barcode: '',
    image: null as File | null
  })
  const [variantFormImageUrl, setVariantFormImageUrl] = useState<string | null>(null)
  const [editingVariant, setEditingVariant] = useState<LocationVariant | null>(null)
  
  // Image management states
  const [mainProductImages, setMainProductImages] = useState<ImageFile[]>([])
  const [additionalImages, setAdditionalImages] = useState<ImageFile[]>([])

  // Video management states
  const [productVideos, setProductVideos] = useState<ProductVideo[]>([])
  const [pendingVideos, setPendingVideos] = useState<File[]>([])
  const [videoUploadProgress, setVideoUploadProgress] = useState<{[key: string]: number}>({})
  const { getProductVideos, initializeBucket, uploadVideo } = useProductVideos()

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  
  // Edit mode detection
  const isEditMode = Boolean(editProduct)
  
  // Purchase history state
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryCheck>({
    hasPurchaseHistory: false,
    canEditCost: true,
    lastPurchaseDate: null,
    totalPurchases: 0
  })
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    barcode: '',
    categoryId: '',
    description: '',
    purchasePrice: '',
    salePrice: '',
    wholesalePrice: '',
    price1: '',
    price2: '',
    price3: '',
    price4: '',
    isActive: true,
    shapeDescription: '',
    productColor: '#000000'
  })
  
  // State for managing multiple barcodes
  const [productBarcodes, setProductBarcodes] = useState<string[]>([])
  const [editingBarcodeIndex, setEditingBarcodeIndex] = useState<number | null>(null)

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // Pre-fill form data when editProduct changes
  useEffect(() => {
    if (editProduct && isOpen) {
      
      // ✅ قراءة الوصف كنص عادي
      let descriptionText = editProduct.description || ''
      let savedColors: ProductColor[] = []

      // محاولة استخراج الألوان من JSON القديم (للتوافق مع البيانات القديمة فقط)
      try {
        if (editProduct.description && editProduct.description.startsWith('{')) {
          const descriptionData = JSON.parse(editProduct.description)
          descriptionText = descriptionData.text || editProduct.description
          savedColors = descriptionData.colors || []
          console.log('⚠️ Found old JSON format, extracting text and colors')
        }
      } catch (e) {
        // الوصف نص عادي - استخدمه كما هو
        descriptionText = editProduct.description || ''
        console.log('✅ Reading description as plain text')
      }
      
      setFormData({
        name: editProduct.name || '',
        code: editProduct.product_code || '',
        barcode: editProduct.barcode || '',
        categoryId: editProduct.category_id || '',
        description: descriptionText,
        purchasePrice: editProduct.cost_price?.toString() || '',
        salePrice: editProduct.price?.toString() || '',
        wholesalePrice: editProduct.wholesale_price?.toString() || '',
        price1: editProduct.price1?.toString() || '',
        price2: editProduct.price2?.toString() || '',
        price3: editProduct.price3?.toString() || '',
        price4: editProduct.price4?.toString() || '',
        isActive: editProduct.is_active ?? true,
        shapeDescription: '',
        productColor: '#000000'
      })
      
      // Set standalone colors from description field
      if (savedColors.length > 0) {
        console.log('🎨 Loading standalone colors from description:', savedColors)
        console.log('🎨 First color details:', savedColors[0])
        
        // Try to get additional images from video_url field
        let additionalImages: string[] = []
        try {
          if (editProduct.video_url) {
            additionalImages = JSON.parse(editProduct.video_url)
          }
        } catch (e) {
          console.warn('Failed to parse video_url as JSON:', e)
        }
        
        // Validate and fix color data structure - PRESERVE IMAGES and try to assign from video_url
        const validatedColors = savedColors.map((color: any, index: number) => {
          let colorImage = color.image || undefined
          let colorBarcode = color.barcode || undefined
          
          // If no image for this color, try to assign from additional images
          if (!colorImage && additionalImages.length > index) {
            colorImage = additionalImages[index]
            console.log(`🖼️ Assigned image ${index} to color ${color.name}:`, colorImage)
          }
          
          return {
            id: color.id || `color-${Date.now()}-${index}`,
            name: color.name || 'لون غير محدد',
            color: color.color || '#000000',
            image: colorImage,
            barcode: colorBarcode
          }
        })
        
        console.log('🖼️ Validated colors with images:', validatedColors)
        setProductColors(validatedColors)
        console.log('🎨 LOAD: Set productColors from description:', validatedColors)
      } else {
        console.log('🎨 No standalone colors found in description')
        
        // If no colors in description, try to extract from productColors field or variants data
        const extractedColors: ProductColor[] = []
        
        // First check if productColors field exists (from useProducts hook)
        if (editProduct.productColors && Array.isArray(editProduct.productColors) && editProduct.productColors.length > 0) {
          console.log('🎨 Found productColors field:', editProduct.productColors)
          extractedColors.push(...editProduct.productColors)
        } else if (editProduct.variantsData) {
          console.log('🎨 Checking variants data for colors:', editProduct.variantsData)
          
          // Extract unique colors from all locations
          const colorMap = new Map<string, ProductColor>()
          
          Object.values(editProduct.variantsData).forEach((variants: any) => {
            if (Array.isArray(variants)) {
              variants.forEach((variant: any) => {
                if (variant.variant_type === 'color' && variant.name && variant.name !== 'غير محدد') {
                  let colorValue = '#6B7280' // Default color
                  let imageUrl: string | undefined = variant.image_url // Get image from dedicated field
                  let barcodeValue: string | undefined = variant.barcode // Get barcode from variant
                  
                  // Try to get color and image from variant value JSON
                  try {
                    if (variant.value && variant.value.startsWith('{')) {
                      const valueData = JSON.parse(variant.value)
                      if (valueData.color) colorValue = valueData.color
                      if (valueData.image && !imageUrl) imageUrl = valueData.image
                      if (valueData.barcode && !barcodeValue) barcodeValue = valueData.barcode
                    }
                  } catch (e) {
                    console.warn('Failed to parse variant value JSON:', e)
                  }
                  
                  // If still no color, try color_hex field
                  if (colorValue === '#6B7280' && variant.color_hex) {
                    colorValue = variant.color_hex
                  }
                  
                  // Add to map to avoid duplicates
                  if (!colorMap.has(variant.name)) {
                    colorMap.set(variant.name, {
                      id: `variant-${variant.name}-${Date.now()}`,
                      name: variant.name,
                      color: colorValue,
                      image: imageUrl,
                      barcode: barcodeValue // Include barcode in extracted color data
                    })
                    
                    console.log(`🖼️ Extracted color ${variant.name}:`, {
                      color: colorValue,
                      image: imageUrl,
                      barcode: barcodeValue
                    })
                  }
                }
              })
            }
          })
          
          extractedColors.push(...Array.from(colorMap.values()))
        }
        
        if (extractedColors.length > 0) {
          console.log('🎨 LOAD: Extracted colors from variants:', extractedColors)
          setProductColors(extractedColors)
          console.log('🎨 LOAD: Set productColors from variants:', extractedColors)
        } else {
          console.log('🎨 LOAD: No colors found anywhere, setting empty array')
          setProductColors([])
        }
      }

      // Load product shapes if we're editing a product
      if (editProduct.variantsData) {
        console.log('🔶 Checking variants data for shapes:', editProduct.variantsData)

        // Extract unique shapes from all locations
        const shapeMap = new Map<string, any>()

        Object.values(editProduct.variantsData).forEach((variants: any) => {
          if (Array.isArray(variants)) {
            variants.forEach((variant: any) => {
              if (variant.variant_type === 'shape' && variant.name && variant.name !== 'غير محدد') {
                let imageUrl: string | undefined = variant.image_url // Get image from dedicated field
                let barcodeValue: string | undefined = variant.barcode // Get barcode from variant

                // Try to get image and barcode from variant value JSON
                try {
                  if (variant.value && variant.value.startsWith('{')) {
                    const valueData = JSON.parse(variant.value)
                    if (valueData.image && !imageUrl) imageUrl = valueData.image
                    if (valueData.barcode && !barcodeValue) barcodeValue = valueData.barcode
                  }
                } catch (e) {
                  console.warn('Failed to parse variant value JSON for shape:', e)
                }

                // Add to map to avoid duplicates
                if (!shapeMap.has(variant.name)) {
                  shapeMap.set(variant.name, {
                    id: `variant-${variant.name}-${Date.now()}`,
                    name: variant.name,
                    image: imageUrl,  // استخدام image بدلاً من image_url
                    barcode: barcodeValue
                  })

                  console.log(`🔶 Extracted shape ${variant.name}:`, {
                    image: imageUrl,
                    barcode: barcodeValue
                  })
                }
              }
            })
          }
        })

        const extractedShapes = Array.from(shapeMap.values())
        if (extractedShapes.length > 0) {
          console.log('🔶 LOAD: Extracted shapes from variants:', extractedShapes)
          setProductShapes(extractedShapes)
        } else {
          console.log('🔶 LOAD: No shapes found, setting empty array')
          setProductShapes([])
        }
      } else {
        console.log('🔶 LOAD: No variants data, setting empty shapes array')
        setProductShapes([])
      }
      
      // Set barcodes if available
      if (editProduct.barcodes && editProduct.barcodes.length > 0) {
        setProductBarcodes(editProduct.barcodes)
      } else if (editProduct.barcode) {
        setProductBarcodes([editProduct.barcode])
      }
      
      // Load existing images immediately (doesn't depend on branches/warehouses)
      loadExistingImages()

      // Load existing videos
      loadExistingVideos()

      // Check purchase history for cost editing permissions
      checkProductPurchasePermissions()
      
      // If branches/warehouses are already loaded, load variants immediately
      if (branches.length > 0 || warehouses.length > 0) {
        loadExistingInventoryData()
        // Load variants after a small delay to ensure productColors are set
        setTimeout(() => loadExistingVariantsData(), 100)
      }
      
      // Inventory and variants data will be loaded when branches/warehouses are available
    } else if (!editProduct && isOpen) {
      // Clear form for new product
      handleClearFields()

      // تعيين المجموعة المختارة تلقائياً عند إضافة منتج جديد
      if (selectedCategory) {
        console.log('🗂️ Auto-selecting category:', selectedCategory.name, selectedCategory.id)
        setFormData(prev => ({
          ...prev,
          categoryId: selectedCategory.id
        }))
      }

      // Reset purchase history for new product
      setPurchaseHistory({
        hasPurchaseHistory: false,
        canEditCost: true,
        lastPurchaseDate: null,
        totalPurchases: 0
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editProduct, isOpen, branches, warehouses, selectedCategory])

  // ✅ NEW: Load colors/shapes from product_color_shape_definitions
  useEffect(() => {
    const loadVariantDefinitions = async () => {
      if (!editProduct || !isOpen) return

      console.log('🔄 Loading variant definitions from database...')
      console.log('📦 Product ID for loading:', editProduct.id)

      // Fetch color/shape definitions
      const { data: definitions, error } = await supabase
        .from('product_color_shape_definitions')
        .select('*')
        .eq('product_id', editProduct.id)
        .order('sort_order')

      console.log('📥 Query result - definitions:', definitions)
      console.log('📥 Query result - error:', error)

      if (error) {
        console.error('❌ Error loading variant definitions:', error)
        return
      }

      if (definitions && definitions.length > 0) {
        console.log('✅ Loaded variant definitions:', definitions)

        // Separate colors and shapes
        const colors = definitions
          .filter(d => d.variant_type === 'color')
          .map(d => ({
            id: d.id,
            name: d.name,
            color: d.color_hex || '#000000',
            image: d.image_url || undefined,
            barcode: d.barcode || undefined
          }))

        const shapes = definitions
          .filter(d => d.variant_type === 'shape')
          .map(d => ({
            id: d.id,
            name: d.name || '',
            image: d.image_url || undefined,  // استخدام image بدلاً من image_url
            barcode: d.barcode || undefined
          }))

        console.log('🎨 Setting colors:', colors)
        console.log('🔶 Setting shapes:', shapes)

        setProductColors(colors as any)
        setProductShapes(shapes as any)

        // Now load quantities
        if (branches.length > 0) {
          console.log('💾 Loading variant quantities...')

          const { data: quantities, error: qtyError } = await supabase
            .from('product_variant_quantities')
            .select('*')
            .in('variant_definition_id', definitions.map(d => d.id))

          if (qtyError) {
            console.error('❌ Error loading variant quantities:', qtyError)
          } else if (quantities && quantities.length > 0) {
            console.log('✅ Loaded variant quantities:', quantities)

            // Build locationVariants from quantities and definitions
            const variants = quantities.map(qty => {
              const definition = definitions.find(d => d.id === qty.variant_definition_id)
              if (!definition) return null

              const branch = branches.find(b => b.id === qty.branch_id)
              if (!branch) return null

              return {
                id: qty.id,
                locationId: qty.branch_id,
                locationType: 'branch' as const,
                elementType: definition.variant_type as 'color' | 'shape',
                elementId: definition.id,
                elementName: definition.name || '',
                quantity: qty.quantity || 0,
                barcode: definition.barcode || '',
                image: definition.image_url || undefined
              }
            }).filter(v => v !== null)

            console.log('✅ Built locationVariants:', variants)
            setLocationVariants(variants as any)
          }
        }
      }
    }

    loadVariantDefinitions()
  }, [editProduct, isOpen, branches, supabase])

  const tabs = [
    'تفاصيل المنتج',
    'السعر', 
    'المخزون',
    'الصور',
    'الشكل واللون',
    'الإعدادات'
  ]

  // Fetch branches from database
  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      setBranches(data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  // Fetch warehouses from database
  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      setWarehouses(data || [])
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  // Check purchase history permissions
  const checkProductPurchasePermissions = async () => {
    if (!editProduct?.id) return
    
    try {
      const historyCheck = await checkProductPurchaseHistory(editProduct.id)
      setPurchaseHistory(historyCheck)
      console.log('📊 Purchase history check:', historyCheck)
    } catch (error) {
      console.error('Error checking purchase permissions:', error)
      setPurchaseHistory({
        hasPurchaseHistory: false,
        canEditCost: true,
        lastPurchaseDate: null,
        totalPurchases: 0,
        message: 'حدث خطأ في التحقق من الصلاحيات'
      })
    }
  }

  // Initialize location thresholds when branches and warehouses are loaded
  const initializeLocationThresholds = () => {
    console.log('🔄 Initializing location thresholds (new product mode)')
    const thresholds: LocationThreshold[] = []
    
    // Add all branches
    branches.forEach(branch => {
      thresholds.push({
        locationId: branch.id,
        locationType: 'branch',
        locationName: branch.name,
        quantity: undefined,
        minStockThreshold: undefined
      })
    })
    
    // Add all warehouses
    warehouses.forEach(warehouse => {
      thresholds.push({
        locationId: warehouse.id,
        locationType: 'warehouse',
        locationName: warehouse.name,
        quantity: undefined,
        minStockThreshold: undefined
      })
    })
    
    console.log('✅ Initialized empty thresholds:', thresholds)
    setLocationThresholds(thresholds)
  }

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoading(true)
        try {
          await Promise.all([fetchBranches(), fetchWarehouses()])
        } finally {
          setLoading(false)
        }
      }
      fetchData()
    }
  }, [isOpen])

  // Initialize location thresholds when branches/warehouses change
  useEffect(() => {
    if (branches.length > 0 || warehouses.length > 0) {
      if (isEditMode && editProduct) {
        // Load existing data in edit mode
        loadExistingInventoryData()
        // Load variants after a small delay to ensure productColors are set
        setTimeout(() => loadExistingVariantsData(), 100)
      } else if (!isEditMode) {
        // Initialize empty thresholds for new product only when NOT in edit mode
        initializeLocationThresholds()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, warehouses, isEditMode, editProduct])

  // Load existing inventory data for edit mode
  const loadExistingInventoryData = async () => {
    if (!editProduct || !editProduct.inventoryData) {
      console.log('No inventory data found for editProduct:', editProduct?.name, editProduct?.inventoryData)
      return
    }

    console.log('🔄 Loading existing inventory data for:', editProduct.name)
    console.log('📦 Raw inventory data:', editProduct.inventoryData)
    console.log('🏢 Available branches:', branches.map(b => `${b.name} (${b.id})`))
    console.log('🏪 Available warehouses:', warehouses.map(w => `${w.name} (${w.id})`))

    // Convert the inventoryData object to locationThresholds format
    const existingThresholds: LocationThreshold[] = []
    
    // Add inventory data for branches
    branches.forEach(branch => {
      const inventoryInfo = editProduct.inventoryData?.[branch.id]
      const threshold = {
        locationId: branch.id,
        locationType: 'branch' as const,
        locationName: branch.name,
        quantity: inventoryInfo?.quantity || 0,
        minStockThreshold: inventoryInfo?.min_stock || 0
      }
      existingThresholds.push(threshold)
      console.log(`📋 Branch ${branch.name}: qty=${threshold.quantity}, min=${threshold.minStockThreshold}`)
    })
    
    // Add inventory data for warehouses
    warehouses.forEach(warehouse => {
      const inventoryInfo = editProduct.inventoryData?.[warehouse.id]
      const threshold = {
        locationId: warehouse.id,
        locationType: 'warehouse' as const,
        locationName: warehouse.name,
        quantity: inventoryInfo?.quantity || 0,
        minStockThreshold: inventoryInfo?.min_stock || 0
      }
      existingThresholds.push(threshold)
      console.log(`📋 Warehouse ${warehouse.name}: qty=${threshold.quantity}, min=${threshold.minStockThreshold}`)
    })
    
    console.log('✅ Setting location thresholds:', existingThresholds)
    setLocationThresholds(existingThresholds)
  }

  // Load existing variants data for edit mode
  const loadExistingVariantsData = async () => {
    console.log('🔄 Loading existing variants data for:', editProduct?.name)
    console.log('📦 Raw variantsData:', editProduct?.variantsData)
    console.log('🏢 Available branches:', branches.map(b => `${b.name} (${b.id})`))
    console.log('🏪 Available warehouses:', warehouses.map(w => `${w.name} (${w.id})`))
    
    if (!editProduct || !editProduct.variantsData) {
      console.log('❌ No variants data found for editProduct')
      return
    }

    const existingVariants: LocationVariant[] = []
    const colors: ProductColor[] = []
    
    // Convert variantsData to locationVariants format
    Object.entries(editProduct.variantsData).forEach(([locationId, variants]) => {
      console.log(`🔍 Processing variants for location ${locationId}:`, variants)
      
      const location = [...branches, ...warehouses].find(loc => loc.id === locationId)
      if (!location) {
        console.log(`❌ Location ${locationId} not found in branches/warehouses`)
        return
      }
      
      const locationType = branches.find(b => b.id === locationId) ? 'branch' as const : 'warehouse' as const
      console.log(`📍 Location ${location.name} is a ${locationType}`)
      
      variants.forEach(variant => {
        console.log(`🎨 Processing variant:`, variant)
        
        // Get barcode from dedicated barcode field
        let barcode = variant.barcode || ''
        let variantImage: string | undefined = undefined
        
        // First try to get image from the dedicated image_url field
        if (variant.image_url) {
          variantImage = variant.image_url
          console.log(`🖼️ Found image in image_url field:`, variantImage)
        }
        
        console.log(`📄 Using barcode from barcode field:`, barcode)

        // For colors, try to find the color in productColors first, then create if needed
        let elementId = variant.id
        if (variant.variant_type === 'color') {
          // First try to find in existing productColors
          let existingColor = productColors.find(c => c.name === variant.name)
          
          if (!existingColor) {
            // Try to find in colors array being built
            existingColor = colors.find(c => c.name === variant.name)
          }
          
          if (!existingColor) {
            // Extract color info from variant data
            let colorHex = '#6B7280' // Default color
            let colorImage: string | undefined = variantImage
            
            // Try to get color from color_hex field
            if (variant.color_hex) {
              colorHex = variant.color_hex
            }
            
            // Try to get color and image from variant value JSON
            try {
              if ((variant as any).value && (variant as any).value.startsWith('{')) {
                const valueData = JSON.parse((variant as any).value)
                if (valueData.color) colorHex = valueData.color
                if (valueData.image && !colorImage) colorImage = valueData.image
              }
            } catch (e) {
              console.warn('Failed to parse variant value JSON:', e)
            }
            
            existingColor = {
              id: `color_${variant.name}_${Date.now()}`,
              name: variant.name,
              color: colorHex,
              image: colorImage
            }
            colors.push(existingColor)
            console.log(`🎨 Created new color from variant:`, existingColor)
          }
          elementId = existingColor.id
        } else if (variant.variant_type === 'shape') {
          // For shapes, try to find matching shape from localStorage
          const matchingShape = shapes.find(s => s.name === variant.name)
          if (matchingShape) {
            elementId = matchingShape.id
            console.log(`🔷 Found matching shape:`, matchingShape)
          } else {
            console.log(`❌ No matching shape found for:`, variant.name)
          }
        }

        const locationVariant = {
          id: variant.id,
          locationId: locationId,
          locationType: locationType,
          elementType: variant.variant_type,
          elementId: elementId,
          elementName: variant.name,
          quantity: variant.quantity,
          barcode: barcode,
          image: variantImage || undefined
        }
        
        existingVariants.push(locationVariant)
        console.log(`✅ Added location variant:`, locationVariant)
      })
    })
    
    console.log(`✅ Setting ${existingVariants.length} location variants:`, existingVariants)
    setLocationVariants(existingVariants)
    
    // Merge variant colors with existing standalone colors
    if (colors.length > 0) {
      // If we have no existing productColors, use all variant colors
      if (productColors.length === 0) {
        console.log(`🎨 Setting ${colors.length} product colors from variants:`, colors)
        setProductColors(colors)
      } else {
        // Merge new colors from variants with existing colors
        const mergedColors: ProductColor[] = [...productColors]
        
        colors.forEach(variantColor => {
          // Check if color exists in productColors
          const existingColorIndex = mergedColors.findIndex(pc => pc.name === variantColor.name)
          
          if (existingColorIndex === -1) {
            // Color doesn't exist, add it
            mergedColors.push(variantColor)
            console.log(`🎨 Added variant color to product colors:`, variantColor)
          } else {
            // Color exists, but update with variant data if it has more info
            const existingColor = mergedColors[existingColorIndex]
            let shouldUpdate = false
            
            // Update color hex if variant has a better value
            if (variantColor.color !== '#6B7280' && existingColor.color === '#000000') {
              existingColor.color = variantColor.color
              shouldUpdate = true
            }
            
            // Update image if variant has one and existing doesn't
            if (variantColor.image && !existingColor.image) {
              existingColor.image = variantColor.image
              shouldUpdate = true
            }
            
            // Update barcode if variant has one and existing doesn't
            if (variantColor.barcode && !existingColor.barcode) {
              existingColor.barcode = variantColor.barcode
              shouldUpdate = true
            }
            
            if (shouldUpdate) {
              console.log(`🎨 Updated existing color with variant data:`, existingColor)
            }
          }
        })
        
        if (mergedColors.length > productColors.length) {
          console.log(`🎨 Updated product colors with ${mergedColors.length - productColors.length} new variant colors`)
          setProductColors(mergedColors)
        } else {
          console.log(`🎨 Keeping existing product colors (${productColors.length} colors)`)
        }
      }
    }
  }

  // Load existing images for edit mode
  const loadExistingImages = async () => {
    if (!editProduct) return

    // Load main image if it exists
    if (editProduct.main_image_url) {
      try {
        const imageFile: ImageFile = {
          file: new File([], 'main-image.jpg'), // Empty file object for compatibility
          preview: editProduct.main_image_url,
          id: 'main-existing'
        }
        
        setMainProductImages([imageFile])
      } catch (error) {
        console.error('Error loading main image:', error)
      }
    }

    // Load additional images from video_url field (stored as JSON)
    if (editProduct.video_url) {
      try {
        const additionalImageUrls = JSON.parse(editProduct.video_url)
        if (Array.isArray(additionalImageUrls)) {
          const additionalImageFiles: ImageFile[] = additionalImageUrls.map((url, index) => ({
            file: new File([], `additional-image-${index}.jpg`),
            preview: url,
            id: `additional-existing-${index}`
          }))
          
          setAdditionalImages(additionalImageFiles)
        }
      } catch (error) {
        console.error('Error loading additional images:', error)
      }
    }
  }

  // Load existing videos for edit mode
  const loadExistingVideos = async () => {
    if (!editProduct) return

    try {
      // Initialize bucket first
      await initializeBucket()

      // Load videos from database
      const videos = await getProductVideos(editProduct.id)
      setProductVideos(videos)
    } catch (error) {
      console.error('Error loading product videos:', error)
    }
  }

  // Force re-render of shape image view when quantities change
  useEffect(() => {
    // This effect ensures the shape image view updates when quantities are modified
  }, [locationThresholds])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  const handleThresholdChange = (locationId: string, field: 'quantity' | 'minStockThreshold', value: number | undefined) => {
    setLocationThresholds(prev => {
      const updated = prev.map(threshold =>
        threshold.locationId === locationId
          ? { ...threshold, [field]: value }
          : threshold
      )
      // Force component re-render to update shape image display
      return [...updated]
    })
  }

  // Color management functions
  const addColor = () => {
    if (!colorName.trim()) {
      alert('يرجى إدخال اسم اللون')
      return
    }

    if (editingColorId) {
      // Update existing color
      setProductColors(prev =>
        prev.map(color =>
          color.id === editingColorId
            ? {
                ...color,
                name: colorName.trim(),
                color: selectedColor,
                barcode: colorBarcode.trim() || undefined,
                image: colorImagePreview || color.image
              }
            : color
        )
      )
      setEditingColorId(null)
    } else {
      // Add new color
      const newColor: ProductColor = {
        id: Date.now().toString(),
        name: colorName.trim(),
        color: selectedColor,
        barcode: colorBarcode.trim() || undefined,
        image: colorImagePreview || undefined
      }
      setProductColors(prev => [...prev, newColor])
    }

    // Reset form
    setColorName('')
    setSelectedColor('#000000')
    setColorBarcode('')
    setColorImageFile(null)
    setColorImagePreview(null)
  }

  const editColor = (color: ProductColor) => {
    setColorName(color.name)
    setSelectedColor(color.color)
    setEditingColorId(color.id)
    setColorBarcode(color.barcode || '')
    setColorImagePreview(color.image || null)
  }

  const deleteColor = (colorId: string) => {
    setProductColors(prev => prev.filter(color => color.id !== colorId))
    // If we were editing this color, reset the form
    if (editingColorId === colorId) {
      setColorName('')
      setSelectedColor('#000000')
      setEditingColorId(null)
      setColorBarcode('')
      setColorImageFile(null)
      setColorImagePreview(null)
    }
  }

  const cancelEdit = () => {
    setColorName('')
    setSelectedColor('#000000')
    setEditingColorId(null)
    setColorBarcode('')
    setColorImageFile(null)
    setColorImagePreview(null)
  }

  // Shape management functions
  const addShape = () => {
    // At least one of name or image must be present
    if (!shapeName.trim() && !shapeImagePreview) {
      alert('يرجى إدخال اسم الشكل أو رفع صورة على الأقل')
      return
    }

    if (editingShapeId) {
      // Update existing shape
      setProductShapes(prev =>
        prev.map(shape =>
          shape.id === editingShapeId
            ? {
                ...shape,
                name: shapeName.trim() || shape.name,
                barcode: shapeBarcode.trim() || undefined,
                image: shapeImagePreview || shape.image
              }
            : shape
        )
      )
      setEditingShapeId(null)
    } else {
      // Add new shape
      const newShape: any = {
        id: Date.now().toString(),
        name: shapeName.trim() || undefined,
        barcode: shapeBarcode.trim() || undefined,
        image: shapeImagePreview || undefined
      }
      setProductShapes(prev => [...prev, newShape])
    }

    // Reset form
    setShapeName('')
    setShapeBarcode('')
    setShapeImageFile(null)
    setShapeImagePreview(null)
  }

  const editShape = (shape: any) => {
    setShapeName(shape.name || '')
    setEditingShapeId(shape.id)
    setShapeBarcode(shape.barcode || '')
    setShapeImagePreview(shape.image || null)
  }

  const deleteShape = (shapeId: string) => {
    setProductShapes(prev => prev.filter(shape => shape.id !== shapeId))
    // If we were editing this shape, reset the form
    if (editingShapeId === shapeId) {
      setShapeName('')
      setEditingShapeId(null)
      setShapeBarcode('')
      setShapeImageFile(null)
      setShapeImagePreview(null)
    }
  }

  const cancelShapeEdit = () => {
    setShapeName('')
    setEditingShapeId(null)
    setShapeBarcode('')
    setShapeImageFile(null)
    setShapeImagePreview(null)
  }


  // Image handling functions
  const createImageFile = (file: File): ImageFile => ({
    file,
    preview: URL.createObjectURL(file),
    id: Math.random().toString(36).substr(2, 9)
  })

  const handleMainImageSelect = (files: File[]) => {
    const newImages = files.map(createImageFile)
    setMainProductImages(newImages.slice(0, 1)) // Only one main image
  }

  const handleAdditionalImageSelect = (files: File[]) => {
    const newImages = files.map(createImageFile)
    setAdditionalImages(prev => [...prev, ...newImages])
  }

  const removeMainImage = (id: string) => {
    setMainProductImages(prev => {
      const imageToRemove = prev.find(img => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview)
      }
      return prev.filter(img => img.id !== id)
    })
  }

  const removeAdditionalImage = (id: string) => {
    setAdditionalImages(prev => {
      const imageToRemove = prev.find(img => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview)
      }
      return prev.filter(img => img.id !== id)
    })
  }

  // Video handlers
  const handleVideoAdd = (video: ProductVideo) => {
    setProductVideos(prev => [...prev, video])
  }

  const handleVideoRemove = (videoId: string) => {
    setProductVideos(prev => prev.filter(v => v.id !== videoId))
  }

  const handleVideoReorder = (videos: ProductVideo[]) => {
    setProductVideos(videos)
  }

  // Helper functions for variant quantities management
  const getVariantQuantity = (branchId: string, elementId: string, elementType: 'color' | 'shape'): number => {
    const variant = locationVariants.find(v =>
      v.locationId === branchId &&
      v.elementId === elementId &&
      v.elementType === elementType
    )
    return variant?.quantity || 0
  }

  // Get total allocated quantity for a branch
  const getTotalAllocatedQuantity = (branchId: string, excludeElementId?: string): number => {
    return locationVariants
      .filter(v => v.locationId === branchId && v.elementId !== excludeElementId)
      .reduce((sum, v) => sum + v.quantity, 0)
  }

  // Get total quantity for a branch from locationThresholds
  const getBranchTotalQuantity = (branchId: string): number => {
    const threshold = locationThresholds.find(t => t.locationId === branchId)
    return threshold?.quantity || 0
  }

  const updateVariantQuantity = (branchId: string, elementId: string, elementType: 'color' | 'shape', quantity: number) => {
    const elementData = elementType === 'color'
      ? productColors.find(c => c.id === elementId)
      : productShapes.find(s => s.id === elementId)

    if (!elementData) return

    // Validation: Check if total allocated quantity doesn't exceed branch total
    const branchTotal = getBranchTotalQuantity(branchId)
    const currentAllocated = getTotalAllocatedQuantity(branchId, elementId)
    const newTotal = currentAllocated + quantity

    if (newTotal > branchTotal) {
      const maxAllowed = branchTotal - currentAllocated
      alert(`⚠️ تحذير!\n\nالكمية الإجمالية المتاحة في هذا الفرع: ${branchTotal} قطعة\nالكمية المخصصة حالياً: ${currentAllocated} قطعة\nالحد الأقصى المسموح: ${maxAllowed} قطعة\n\nلا يمكن تخصيص ${quantity} قطعة لأن المجموع سيتجاوز الكمية المتاحة.`)
      return
    }

    const existingVariantIndex = locationVariants.findIndex(v =>
      v.locationId === branchId &&
      v.elementId === elementId &&
      v.elementType === elementType
    )

    if (quantity > 0) {
      const variantData: LocationVariant = {
        id: existingVariantIndex >= 0 ? locationVariants[existingVariantIndex].id : `variant-${Date.now()}-${Math.random()}`,
        locationId: branchId,
        locationType: 'branch',
        elementType: elementType,
        elementId: elementId,
        elementName: elementType === 'color' ? elementData.name : (elementData.name || 'شكل'),
        quantity: quantity,
        barcode: elementData.barcode || generateBarcode(),
        image: elementData.image
      }

      if (existingVariantIndex >= 0) {
        // Update existing variant
        setLocationVariants(prev => prev.map((v, idx) => idx === existingVariantIndex ? variantData : v))
      } else {
        // Add new variant
        setLocationVariants(prev => [...prev, variantData])
      }
    } else {
      // Remove variant if quantity is 0
      if (existingVariantIndex >= 0) {
        setLocationVariants(prev => prev.filter((_, idx) => idx !== existingVariantIndex))
      }
    }
  }

  // Handle pending video upload for new products
  const handlePendingVideoUpload = (files: FileList) => {
    const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'))

    if (videoFiles.length === 0) {
      alert('يرجى اختيار ملفات فيديو صالحة')
      return
    }

    // Check file sizes
    const maxSize = 100 * 1024 * 1024 // 100MB
    const oversizedFiles = videoFiles.filter(file => file.size > maxSize)
    if (oversizedFiles.length > 0) {
      alert('بعض ملفات الفيديو كبيرة جداً. الحد الأقصى 100 ميجابايت لكل ملف')
      return
    }

    setPendingVideos(prev => [...prev, ...videoFiles])
  }

  // Remove pending video
  const removePendingVideo = (index: number) => {
    setPendingVideos(prev => prev.filter((_, i) => i !== index))
  }

  // Upload pending videos after product creation
  const uploadPendingVideos = async (productId: string) => {
    if (pendingVideos.length === 0) return

    for (let i = 0; i < pendingVideos.length; i++) {
      const file = pendingVideos[i]
      const fileId = `pending_${Date.now()}_${i}`

      try {
        // Initialize progress
        setVideoUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

        // Use the built-in progress tracking
        const result = await uploadVideo(productId, file, file.name, (progress) => {
          setVideoUploadProgress(prev => ({ ...prev, [fileId]: progress }))
        })

        if (result.success && result.video) {
          handleVideoAdd(result.video)

          // Clean up progress after showing completion
          setTimeout(() => {
            setVideoUploadProgress(prev => {
              const newProgress = { ...prev }
              delete newProgress[fileId]
              return newProgress
            })
          }, 1500)
        } else {
          console.error('Video upload failed:', result.error)
          setVideoUploadProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[fileId]
            return newProgress
          })
        }
      } catch (error) {
        console.error('Error uploading video:', error)
        setVideoUploadProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[fileId]
          return newProgress
        })
      }
    }

    setPendingVideos([])
  }

  // Video bucket initialization removed - buckets are pre-created in production

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      mainProductImages.forEach(img => URL.revokeObjectURL(img.preview))
      additionalImages.forEach(img => URL.revokeObjectURL(img.preview))
    }
  }, [])

  // Image Upload Area Component
  const ImageUploadArea = ({ onImageSelect, images, onImageRemove, label, multiple = false }: ImageUploadAreaProps) => {
    const [isDragOver, setIsDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      
      const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
      )
      
      if (files.length > 0) {
        onImageSelect(files)
      }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files) {
        onImageSelect(Array.from(files))
      }
      // Reset input value
      e.target.value = ''
    }

    const openFileDialog = () => {
      fileInputRef.current?.click()
    }

    return (
      <div className="space-y-3">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          {label}
        </label>
        
        {/* Drop Zone */}
        <div 
          className={`border-2 border-dashed p-8 text-center transition-all duration-200 ${
            isDragOver 
              ? 'border-blue-400 bg-blue-400/10' 
              : 'border-gray-600 bg-[#4A5568]/30'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-400 text-sm">
              {isDragOver ? 'أفلت الصورة هنا' : 'اسحب وأفلت الصورة هنا أو'}
            </p>
            <button 
              type="button"
              onClick={openFileDialog}
              className="bg-[#4A5568] hover:bg-[#5A6478] text-white px-4 py-2 text-sm border border-gray-600 transition-colors"
            >
              اختر الصورة
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={multiple}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <img 
                  src={image.preview} 
                  alt="معاينة الصورة"
                  className="w-full h-24 object-cover rounded border border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => onImageRemove(image.id)}
                  className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs p-1 rounded truncate">
                  {image.file.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Location variant management functions
  const handleLocationSelect = (location: Branch | Warehouse, type: 'branch' | 'warehouse') => {
    const totalQuantity = locationThresholds.find(t => t.locationId === location.id)?.quantity || 0
    
    // If clicking the same location, toggle it off
    if (selectedLocation?.id === location.id) {
      setSelectedLocation(null)
      setEditingVariant(null)
      setVariantFormImageUrl(null)
      setVariantForm({
        elementType: 'color',
        elementId: '',
        quantity: 0,
        barcode: generateBarcode(),
        image: null
      })
      return
    }
    
    setSelectedLocation({
      id: location.id,
      name: location.name,
      type: type,
      totalQuantity: totalQuantity
    })
    setEditingVariant(null)
    setVariantFormImageUrl(null)
    setVariantForm({
      elementType: 'color',
      elementId: '',
      quantity: 0,
      barcode: generateBarcode(),
      image: null
    })
  }

  const generateBarcode = () => {
    return (Math.floor(Math.random() * 9000000000) + 1000000000).toString()
  }
  
  // Functions for managing product barcodes
  const handleGenerateBarcode = () => {
    const newBarcode = generateBarcode()
    setFormData(prev => ({ ...prev, barcode: newBarcode }))
  }
  
  const handleAddBarcode = () => {
    const barcodeToAdd = formData.barcode.trim()
    if (!barcodeToAdd) return
    
    // Check if barcode already exists
    if (productBarcodes.includes(barcodeToAdd)) {
      alert('هذا الباركود موجود بالفعل')
      return
    }
    
    if (editingBarcodeIndex !== null) {
      // Update existing barcode
      setProductBarcodes(prev => 
        prev.map((barcode, index) => 
          index === editingBarcodeIndex ? barcodeToAdd : barcode
        )
      )
      setEditingBarcodeIndex(null)
    } else {
      // Add new barcode
      setProductBarcodes(prev => [...prev, barcodeToAdd])
    }
    
    // Clear the input field
    setFormData(prev => ({ ...prev, barcode: '' }))
  }
  
  const handleEditBarcode = (index: number) => {
    const barcodeToEdit = productBarcodes[index]
    setFormData(prev => ({ ...prev, barcode: barcodeToEdit }))
    setEditingBarcodeIndex(index)
  }
  
  const handleDeleteBarcode = (index: number) => {
    setProductBarcodes(prev => prev.filter((_, i) => i !== index))
    
    // If we were editing this barcode, reset the form
    if (editingBarcodeIndex === index) {
      setFormData(prev => ({ ...prev, barcode: '' }))
      setEditingBarcodeIndex(null)
    } else if (editingBarcodeIndex !== null && editingBarcodeIndex > index) {
      // Adjust editing index if necessary
      setEditingBarcodeIndex(prev => prev! - 1)
    }
  }
  
  const cancelBarcodeEdit = () => {
    setFormData(prev => ({ ...prev, barcode: '' }))
    setEditingBarcodeIndex(null)
  }

  const getAvailableElements = () => {
    if (variantForm.elementType === 'color') {
      return productColors
    } else {
      // Return shapes from useShapes hook
      return shapes
    }
  }

  // Helper function to identify if a variant is a purchase variant (should be hidden from UI)
  // This protects sensitive purchase data from accidental modification/deletion
  const isPurchaseVariant = (variant: any) => {
    if (!variant.elementName) return false
    
    const elementName = variant.elementName.toLowerCase()
    
    // Check for purchase-related keywords and patterns
    return (
      elementName.includes('جديد') ||           // New items from purchase
      elementName.includes('شراء') ||          // Purchase-related
      elementName.includes('غير محدد') ||      // Unspecified items (usually from purchase)
      elementName.length > 50 ||              // Very long descriptions are likely purchase descriptions
      elementName.includes('description') ||   // Purchase descriptions
      elementName.includes('color') ||         // Color specifications from purchase
      elementName.includes('#') ||             // Color codes from purchase
      elementName.includes('اللون') ||         // Arabic color references
      elementName.includes('لون') ||           // Color references
      /^\d+\s*-\s*/.test(elementName)         // Starts with numbers (quantity formats)
    )
  }

  const getUsedQuantity = (excludeVariantId?: string) => {
    if (!selectedLocation) return 0
    return locationVariants
      .filter(v => v.locationId === selectedLocation.id && v.id !== excludeVariantId)
      .reduce((sum, v) => sum + v.quantity, 0)
  }

  const getRemainingQuantity = (excludeVariantId?: string) => {
    return selectedLocation ? selectedLocation.totalQuantity - getUsedQuantity(excludeVariantId) : 0
  }

  const handleVariantSubmit = () => {
    if (!selectedLocation || !variantForm.elementId || variantForm.quantity <= 0) return
    
    const element = getAvailableElements().find(e => e.id === variantForm.elementId)
    if (!element) return

    // Calculate remaining quantity, excluding the current editing variant if any
    const remainingQuantity = getRemainingQuantity(editingVariant?.id)
    if (variantForm.quantity > remainingQuantity) {
      alert(`الكمية المتاحة هي ${remainingQuantity} قطعة فقط`)
      return
    }

    const newVariant: LocationVariant = {
      id: editingVariant?.id || Date.now().toString(),
      locationId: selectedLocation.id,
      locationType: selectedLocation.type,
      elementType: variantForm.elementType,
      elementId: variantForm.elementId,
      elementName: element.name,
      quantity: variantForm.quantity,
      barcode: variantForm.barcode,
      image: variantForm.image ? URL.createObjectURL(variantForm.image) : variantFormImageUrl || undefined
    }

    if (editingVariant) {
      console.log('✏️ Editing existing variant:', editingVariant)
      setLocationVariants(prev => prev.map(v => v.id === editingVariant.id ? newVariant : v))
    } else {
      console.log('➕ Adding new variant:', newVariant)
      setLocationVariants(prev => {
        const updated = [...prev, newVariant]
        console.log('📦 Updated location variants array:', updated)
        return updated
      })
    }

    // Reset form but keep location selected
    setVariantForm({
      elementType: 'color',
      elementId: '',
      quantity: 0,
      barcode: generateBarcode(),
      image: null
    })
    setVariantFormImageUrl(null)
    setEditingVariant(null)
  }

  const handleVariantEdit = (variant: LocationVariant) => {
    setEditingVariant(variant)
    setVariantForm({
      elementType: variant.elementType,
      elementId: variant.elementId,
      quantity: variant.quantity,
      barcode: variant.barcode,
      image: null // We can't restore file objects, so leave null
    })
    
    // Set the image URL if available
    setVariantFormImageUrl(variant.image || null)
    
    // Auto-select the location for this variant if not already selected
    if (!selectedLocation || selectedLocation.id !== variant.locationId) {
      const location = [...branches, ...warehouses].find(loc => loc.id === variant.locationId)
      if (location) {
        const locationType = branches.find(b => b.id === variant.locationId) ? 'branch' : 'warehouse'
        const totalQuantity = locationThresholds.find(t => t.locationId === variant.locationId)?.quantity || 0
        
        setSelectedLocation({
          id: location.id,
          name: location.name,
          type: locationType as 'branch' | 'warehouse',
          totalQuantity: totalQuantity
        })
      }
    }
  }

  const handleVariantDelete = (variantId: string) => {
    setLocationVariants(prev => prev.filter(v => v.id !== variantId))
  }


  // Upload color and shape images to Supabase Storage
  const uploadColorAndShapeImages = async (productId: string) => {
    console.log('📤 Uploading color and shape images...')

    // Upload color images
    const updatedColors = await Promise.all(
      productColors.map(async (color) => {
        if (color.image && (color.image.startsWith('blob:') || color.image.startsWith('data:'))) {
          console.log(`📤 Uploading image for color: ${color.name}`)
          try {
            // Convert blob URL or data URL to File
            const response = await fetch(color.image)
            const blob = await response.blob()
            const file = new File([blob], `color-${color.name}.jpg`, { type: 'image/jpeg' })

            // Upload to Supabase Storage
            const result = await uploadVersionedProductImage(file, productId, 'variant')

            if (result.success && result.publicUrl) {
              console.log(`✅ Uploaded image for color ${color.name}:`, result.publicUrl)
              return { ...color, image: result.publicUrl }
            }
          } catch (error) {
            console.error(`❌ Failed to upload image for color ${color.name}:`, error)
          }
        }
        return color
      })
    )

    // Upload shape images
    const updatedShapes = await Promise.all(
      productShapes.map(async (shape) => {
        if (shape.image && (shape.image.startsWith('blob:') || shape.image.startsWith('data:'))) {
          console.log(`📤 Uploading image for shape: ${shape.name || 'شكل'}`)
          try {
            // Convert blob URL or data URL to File
            const response = await fetch(shape.image)
            const blob = await response.blob()
            const file = new File([blob], `shape-${shape.name || 'shape'}.jpg`, { type: 'image/jpeg' })

            // Upload to Supabase Storage
            const result = await uploadVersionedProductImage(file, productId, 'variant')

            if (result.success && result.publicUrl) {
              console.log(`✅ Uploaded image for shape ${shape.name || 'شكل'}:`, result.publicUrl)
              return { ...shape, image: result.publicUrl }
            }
          } catch (error) {
            console.error(`❌ Failed to upload image for shape ${shape.name || 'شكل'}:`, error)
          }
        }
        return shape
      })
    )

    return { updatedColors, updatedShapes }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('يرجى إدخال اسم المنتج')
      return
    }

    console.log('🚀 Starting save process...')
    console.log('📦 Current locationVariants before save:', locationVariants)
    console.log('🎨 Current productColors before save:', productColors)
    console.log('📋 Current locationThresholds before save:', locationThresholds)

    setIsSaving(true)
    try {
      // For edit mode, upload images immediately using versioned upload
      let mainImageUrl = isEditMode ? editProduct?.main_image_url : ''
      if (isEditMode && mainProductImages.length > 0 && mainProductImages[0].id !== 'main-existing') {
        const productId = editProduct?.id
        if (productId) {
          const result = await uploadAndSetMainImage(
            mainProductImages[0].file,
            productId
          )
          
          if (!result.success) {
            console.error('Main image upload error:', result.error)
            alert('فشل في رفع الصورة الرئيسية')
            return
          }
          
          if (result.publicUrl) {
            mainImageUrl = result.publicUrl
          }
        }
      }
      // For new products, we'll upload images after product creation

      // Handle additional images for edit mode only - for new products, upload after creation
      let additionalImagesJson = null
      if (isEditMode && additionalImages.length > 0) {
        const additionalImageUrls: string[] = []
        
        for (const imageFile of additionalImages) {
          if (imageFile.id.startsWith('additional-existing')) {
            // Keep existing image URL
            additionalImageUrls.push(imageFile.preview)
          } else {
            // Upload new image using versioned upload
            const productId = editProduct?.id
            if (productId && imageFile.file) {
              const result = await addAdditionalVersionedImage(
                imageFile.file,
                productId
              )
              
              if (result.success && result.publicUrl) {
                additionalImageUrls.push(result.publicUrl)
              }
            }
          }
        }
        
        if (additionalImageUrls.length > 0) {
          additionalImagesJson = JSON.stringify(additionalImageUrls)
        }
      }

      // ✅ حفظ الوصف كنص عادي فقط (الألوان والأشكال في product_color_shape_definitions)
      const descriptionToSave = formData.description.trim() || ''
      console.log('✅ Saving description as plain text (colors/shapes stored in product_color_shape_definitions)')
      console.log('🎨 Current productColors to be saved in definitions:', productColors.length, 'colors')
      console.log('🔶 Current productShapes to be saved in definitions:', productShapes.length, 'shapes')

      // Prepare product data
      const productData: Partial<Product> = {
        name: formData.name.trim(),
        name_en: formData.name.trim(), // Could be separate field
        description: descriptionToSave,
        barcode: productBarcodes[0] || formData.barcode.trim() || undefined,
        barcodes: productBarcodes.length > 0 ? productBarcodes : (formData.barcode.trim() ? [formData.barcode.trim()] : []),
        price: parseFloat(formData.salePrice) || 0,
        cost_price: parseFloat(formData.purchasePrice) || 0,
        wholesale_price: parseFloat(formData.wholesalePrice) || 0,
        price1: parseFloat(formData.price1) || 0,
        price2: parseFloat(formData.price2) || 0,
        price3: parseFloat(formData.price3) || 0,
        price4: parseFloat(formData.price4) || 0,
        category_id: formData.categoryId || undefined,
        product_code: formData.code.trim() || undefined,
        main_image_url: mainImageUrl || undefined,
        additional_images: additionalImagesJson ? JSON.parse(additionalImagesJson) : undefined, // ✨ Store in new field
        is_active: formData.isActive,
        unit: 'قطعة'
      }

      let savedProduct: Product | null = null

      if (isEditMode && editProduct && updateProduct) {
        // Update existing product
        savedProduct = await updateProduct(editProduct.id, productData)

        if (savedProduct) {
          // Upload color and shape images first
          const { updatedColors, updatedShapes } = await uploadColorAndShapeImages(savedProduct.id)

          // Update productColors and productShapes with uploaded image URLs
          setProductColors(updatedColors)
          setProductShapes(updatedShapes)

          // Create updated locationVariants with new image URLs
          const updatedLocationVariants = locationVariants.map(variant => {
            if (variant.elementType === 'color') {
              const color = updatedColors.find(c => c.id === variant.elementId)
              if (color) {
                return { ...variant, image: color.image }
              }
            } else if (variant.elementType === 'shape') {
              const shape = updatedShapes.find(s => s.id === variant.elementId)
              if (shape) {
                return { ...variant, image: shape.image }
              }
            }
            return variant
          })

          // Update state for future use
          setLocationVariants(updatedLocationVariants)

          // Update inventory entries
          const inventoryPromises = locationThresholds
            .filter(threshold => (threshold.quantity !== undefined && threshold.quantity > 0) || (threshold.minStockThreshold !== undefined && threshold.minStockThreshold > 0))
            .map(async (threshold) => {
              const inventoryData: any = {
                product_id: savedProduct!.id,
                quantity: threshold.quantity ?? 0,
                min_stock: threshold.minStockThreshold ?? 0
              }
              
              if (threshold.locationType === 'branch') {
                inventoryData.branch_id = threshold.locationId
              } else {
                inventoryData.warehouse_id = threshold.locationId
              }
              
              // Try to update existing inventory entry, or insert if it doesn't exist
              const { error: upsertError } = await supabase
                .from('inventory')
                .upsert(inventoryData, {
                  onConflict: threshold.locationType === 'branch' ? 'product_id,branch_id' : 'product_id,warehouse_id'
                })
              
              if (upsertError) {
                console.error('Error updating inventory:', upsertError)
              }
            })

          await Promise.all(inventoryPromises)

          // ✅ NEW SYSTEM: Save colors/shapes via API (bypasses RLS with service_role_key)
          console.log('💾 Saving color/shape definitions via API...')
          console.log('🎨 updatedColors to save:', updatedColors)
          console.log('🔶 updatedShapes to save:', updatedShapes)
          console.log('📦 productId:', savedProduct.id)

          try {
            const saveResponse = await fetch('/api/products/save-color-shape-definitions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productId: savedProduct.id,
                colors: updatedColors,
                shapes: updatedShapes,
                quantities: locationVariants
              })
            })

            const saveResult = await saveResponse.json()

            if (!saveResult.success) {
              throw new Error(saveResult.error || 'Failed to save definitions')
            }

            console.log('✅ Successfully saved all variant data:', saveResult.data?.length || 0, 'definitions')
          } catch (error: any) {
            console.error('❌ Error saving variant definitions:', error)
            alert('فشل في حفظ الألوان والأشكال: ' + error.message)
          }
          
          // Trigger refresh and close
          onProductCreated?.()
          
          // Success - clear form and close AFTER everything is saved
          handleClearFields()
          alert('تم تحديث المنتج بنجاح!')
        }
      } else {
        // Create new product
        savedProduct = await createProduct(productData)

        if (savedProduct) {
          // Upload color and shape images first
          const { updatedColors, updatedShapes } = await uploadColorAndShapeImages(savedProduct.id)

          // Update productColors and productShapes with uploaded image URLs
          setProductColors(updatedColors)
          setProductShapes(updatedShapes)

          // Create updated locationVariants with new image URLs
          const updatedLocationVariants = locationVariants.map(variant => {
            if (variant.elementType === 'color') {
              const color = updatedColors.find(c => c.id === variant.elementId)
              if (color) {
                return { ...variant, image: color.image }
              }
            } else if (variant.elementType === 'shape') {
              const shape = updatedShapes.find(s => s.id === variant.elementId)
              if (shape) {
                return { ...variant, image: shape.image }
              }
            }
            return variant
          })

          // Update state for future use
          setLocationVariants(updatedLocationVariants)

          console.log('🔄 Creating inventory entries for new product:', savedProduct.name)
          console.log('📦 Location thresholds to save:', locationThresholds)

          // Create inventory entries for each location with quantities
          const inventoryEntriesToSave = locationThresholds
            .filter(threshold => (threshold.quantity !== undefined && threshold.quantity > 0) || (threshold.minStockThreshold !== undefined && threshold.minStockThreshold > 0))

          console.log('✅ Filtered inventory entries to save:', inventoryEntriesToSave)

          const inventoryPromises = inventoryEntriesToSave.map(threshold => {
              const inventoryData: any = {
                product_id: savedProduct!.id,
                quantity: threshold.quantity ?? 0,
                min_stock: threshold.minStockThreshold ?? 0
              }
              
              if (threshold.locationType === 'branch') {
                inventoryData.branch_id = threshold.locationId
              } else {
                inventoryData.warehouse_id = threshold.locationId
              }
              
              console.log('💾 Saving inventory entry:', inventoryData)
              return supabase.from('inventory').insert(inventoryData)
            })

          const inventoryResults = await Promise.all(inventoryPromises)
          console.log('✅ Inventory save results:', inventoryResults)

          // ✅ NEW SYSTEM: Save colors/shapes via API for new product (bypasses RLS)
          console.log('💾 Saving color/shape definitions for new product via API...')

          try {
            const saveResponse = await fetch('/api/products/save-color-shape-definitions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productId: savedProduct.id,
                colors: updatedColors,
                shapes: updatedShapes,
                quantities: locationVariants
              })
            })

            const saveResult = await saveResponse.json()

            if (!saveResult.success) {
              throw new Error(saveResult.error || 'Failed to save definitions')
            }

            console.log('✅ Successfully saved all variant data for new product:', saveResult.data?.length || 0, 'definitions')
          } catch (error: any) {
            console.error('❌ Error saving variant definitions:', error)
            alert('فشل في حفظ الألوان والأشكال: ' + error.message)
          }

          // Upload images for new product using versioned upload
          console.log('🖼️ Uploading images for new product:', savedProduct.name)

          let uploadedMainImageUrl = null
          const uploadedAdditionalImageUrls: string[] = []

          // Upload main image if exists
          if (mainProductImages.length > 0 && mainProductImages[0].id !== 'main-existing') {
            const mainImageResult = await uploadAndSetMainImage(
              mainProductImages[0].file,
              savedProduct.id
            )
            console.log('🖼️ Main image upload result:', mainImageResult)

            if (mainImageResult.success && mainImageResult.publicUrl) {
              uploadedMainImageUrl = mainImageResult.publicUrl
            }
          }

          // Upload additional images if exist
          if (additionalImages.length > 0) {
            for (const imageFile of additionalImages) {
              if (!imageFile.id.startsWith('additional-existing')) {
                const additionalResult = await addAdditionalVersionedImage(
                  imageFile.file,
                  savedProduct.id
                )
                console.log('🖼️ Additional image upload result:', additionalResult)

                if (additionalResult.success && additionalResult.publicUrl) {
                  uploadedAdditionalImageUrls.push(additionalResult.publicUrl)
                }
              }
            }
          }

          // Update product with uploaded image URLs
          if (uploadedMainImageUrl || uploadedAdditionalImageUrls.length > 0) {
            const updateData: any = {}

            if (uploadedMainImageUrl) {
              updateData.main_image_url = uploadedMainImageUrl
            }

            if (uploadedAdditionalImageUrls.length > 0) {
              updateData.additional_images_urls = uploadedAdditionalImageUrls // ✨ Store in new field
            }

            const { error: updateError } = await supabase
              .from('products')
              .update(updateData)
              .eq('id', savedProduct.id)

            if (updateError) {
              console.error('Error updating product with image URLs:', updateError)
            } else {
              console.log('✅ Successfully updated product with image URLs:', updateData)
            }
          }

          // Upload pending videos for new product
          console.log('🎬 Uploading pending videos for new product:', savedProduct.name)
          await uploadPendingVideos(savedProduct.id)

          // Add a small delay to ensure all database transactions are committed
          await new Promise(resolve => setTimeout(resolve, 500))

          // Trigger refresh of products list
          console.log('🔄 Triggering product list refresh after creation')
          onProductCreated?.()

          // Success - clear form and close AFTER everything is saved
          handleClearFields()
          alert('تم إنشاء المنتج بنجاح!')
        }
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} product:`, error)
      alert(`حدث خطأ أثناء ${isEditMode ? 'تحديث' : 'إنشاء'} المنتج`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: '',
      code: '',
      barcode: '',
      categoryId: '',
      description: '',
      purchasePrice: '',
      salePrice: '',
      wholesalePrice: '',
      price1: '',
      price2: '',
      price3: '',
      price4: '',
      isActive: true,
      shapeDescription: '',
      productColor: '#000000'
    })
    // Clear barcodes
    setProductBarcodes([])
    setEditingBarcodeIndex(null)
    onClose()
  }

  const handleClearFields = () => {
    // Instant clearing without confirmation
    setFormData({
      name: '',
      code: '',
      barcode: '',
      categoryId: '',
      description: '',
      purchasePrice: '',
      salePrice: '',
      wholesalePrice: '',
      price1: '',
      price2: '',
      price3: '',
      price4: '',
      isActive: true,
      shapeDescription: '',
      productColor: '#000000'
    })
    // Reset location thresholds
    initializeLocationThresholds()
    // Clear images
    mainProductImages.forEach(img => URL.revokeObjectURL(img.preview))
    additionalImages.forEach(img => URL.revokeObjectURL(img.preview))
    setMainProductImages([])
    setAdditionalImages([])
    // Clear barcodes
    setProductBarcodes([])
    setEditingBarcodeIndex(null)
    // Clear colors and variants
    setProductColors([])
    setProductShapes([])
    setLocationVariants([])
    setSelectedLocation(null)
    // Clear videos
    setProductVideos([])
    setPendingVideos([])
    setVideoUploadProgress({})
  }


  const renderTabContent = () => {
    switch (activeTab) {
      case 'تفاصيل المنتج':
        return (
          <div className="space-y-4">
            {/* Product Name */}
            <div>
              <label className="block text-white text-sm font-medium mb-2 text-right">
                اسم المنتج *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="أدخل اسم المنتج"
                className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
              />
            </div>

            {/* Product Code */}
            <div>
              <label className="block text-white text-sm font-medium mb-2 text-right">
                الكود
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="أدخل كود المنتج"
                className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
              />
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-white text-sm font-medium mb-2 text-right">
                الباركود
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => handleInputChange('barcode', e.target.value)}
                  placeholder="أدخل باركود جديد"
                  className="flex-1 px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
                />
                <button 
                  type="button"
                  onClick={handleAddBarcode}
                  disabled={!formData.barcode.trim()}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    !formData.barcode.trim() 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-[#10B981] hover:bg-[#059669] text-white'
                  }`}
                >
                  {editingBarcodeIndex !== null ? '✓' : '+'}
                </button>
                <button 
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-3 py-2 text-sm font-medium transition-colors"
                >
                  ↻
                </button>
                {editingBarcodeIndex !== null && (
                  <button 
                    type="button"
                    onClick={cancelBarcodeEdit}
                    className="bg-[#6B7280] hover:bg-[#4B5563] text-white px-3 py-2 text-sm font-medium transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
              
              {/* Display added barcodes */}
              {productBarcodes.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-gray-300 text-xs font-medium text-right">
                    الباركودات المضافة ({productBarcodes.length}):
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                    {productBarcodes.map((barcode, index) => (
                      <div key={index} className="bg-[#374151] rounded p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteBarcode(index)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditBarcode(index)}
                            className={`transition-colors ${
                              editingBarcodeIndex === index 
                                ? 'text-blue-300' 
                                : 'text-blue-400 hover:text-blue-300'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="text-white text-sm font-mono">
                          {barcode}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-white text-sm font-medium mb-2 text-right">
                المجموعة *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleInputChange('categoryId', e.target.value)}
                className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
              >
                <option value="">-- اختر المجموعة --</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-white text-sm font-medium mb-2 text-right">
                الوصف
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="أدخل وصف المنتج"
                rows={4}
                className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm resize-none"
              />
            </div>
          </div>
        )

      case 'السعر':
        return (
          <div className="space-y-4">
            {/* Purchase Price */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-white text-sm font-medium text-right">
                  سعر الشراء *
                </label>
                {!purchaseHistory.canEditCost && (
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-yellow-400">محسوب تلقائياً</span>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <input
                  type="number"
                  value={formData.purchasePrice}
                  onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
                  placeholder=""
                  disabled={!purchaseHistory.canEditCost}
                  className={`w-full px-3 py-2 border rounded text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    purchaseHistory.canEditCost
                      ? 'bg-[#2B3441] border-[#4A5568] text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2]'
                      : 'bg-gray-600/30 border-gray-600/50 text-gray-300 cursor-not-allowed'
                  }`}
                />
                {!purchaseHistory.canEditCost && (
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                    <LockClosedIcon className="h-4 w-4 text-gray-400" />
                  </div>
                )}
              </div>
              
            </div>

            {/* Sale Price */}
            <div>
              <label className="block text-white text-sm font-medium mb-2 text-right">
                سعر البيع *
              </label>
              <input
                type="number"
                value={formData.salePrice}
                onChange={(e) => handleInputChange('salePrice', e.target.value)}
                placeholder=""
                className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Wholesale Price */}
            <div>
              <label className="block text-white text-sm font-medium mb-2 text-right">
                سعر الجملة
              </label>
              <input
                type="number"
                value={formData.wholesalePrice}
                onChange={(e) => handleInputChange('wholesalePrice', e.target.value)}
                placeholder=""
                className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Additional Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2 text-right">
                  سعر 1
                </label>
                <input
                  type="number"
                  value={formData.price1}
                  onChange={(e) => handleInputChange('price1', e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2 text-right">
                  سعر 2
                </label>
                <input
                  type="number"
                  value={formData.price2}
                  onChange={(e) => handleInputChange('price2', e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2 text-right">
                  سعر 3
                </label>
                <input
                  type="number"
                  value={formData.price3}
                  onChange={(e) => handleInputChange('price3', e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2 text-right">
                  سعر 4
                </label>
                <input
                  type="number"
                  value={formData.price4}
                  onChange={(e) => handleInputChange('price4', e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>
        )

      case 'الصور':
        return (
          <div className="space-y-6">
            {/* Main Product Image */}
            <ImageUploadArea
              label="الصورة الرئيسية للمنتج"
              onImageSelect={handleMainImageSelect}
              images={mainProductImages}
              onImageRemove={removeMainImage}
              multiple={false}
            />

            {/* Additional Product Images */}
            <ImageUploadArea
              label="الصور الفرعية للمنتج"
              onImageSelect={handleAdditionalImageSelect}
              images={additionalImages}
              onImageRemove={removeAdditionalImage}
              multiple={true}
            />

            {/* Product Videos */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                فيديوهات المنتج
              </label>

              {editProduct ? (
                // For existing products, use the full video upload component
                <ProductVideoUpload
                  productId={editProduct.id}
                  videos={productVideos}
                  onVideoAdd={handleVideoAdd}
                  onVideoRemove={handleVideoRemove}
                  onVideoReorder={handleVideoReorder}
                  disabled={false}
                />
              ) : (
                // For new products, show a simplified video selection interface
                <div className="space-y-4">
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={(e) => e.target.files && handlePendingVideoUpload(e.target.files)}
                    className="hidden"
                    id="video-upload-input"
                  />

                  <div
                    onClick={() => document.getElementById('video-upload-input')?.click()}
                    className="flex items-center justify-center w-full px-4 py-8 bg-[#2B3544] border-2 border-dashed border-gray-600 rounded-lg cursor-pointer transition-all hover:border-gray-500 hover:bg-[#374151]"
                  >
                    <div className="text-center">
                      <svg className="h-8 w-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-300 text-sm">
                        انقر لاختيار فيديوهات المنتج
                      </span>
                      <p className="text-xs text-gray-400 mt-1">MP4, WebM, MOV - حتى 100MB لكل ملف</p>
                    </div>
                  </div>

                  {/* Show pending videos */}
                  {pendingVideos.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300">
                        الفيديوهات المختارة ({pendingVideos.length})
                      </h4>

                      {pendingVideos.map((video, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-[#374151] rounded-lg border border-gray-600">
                          <div className="flex-shrink-0">
                            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-white truncate text-sm">
                              {video.name}
                            </h5>
                            <p className="text-xs text-gray-400">
                              {(video.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>

                          <button
                            onClick={() => removePendingVideo(index)}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                            title="حذف الفيديو"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Video Upload Progress */}
                  {Object.keys(videoUploadProgress).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300">جاري رفع الفيديوهات...</h4>
                      {Object.entries(videoUploadProgress).map(([id, progress]) => (
                        <div key={id} className="bg-green-900/20 border border-green-600/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-green-400">جاري رفع الفيديو...</span>
                            <span className="text-sm text-green-300">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full bg-green-900/40 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingVideos.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-400">
                        سيتم رفع الفيديوهات تلقائياً بعد إنشاء المنتج
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )

      case 'الشكل واللون':
        return (
          <div className="flex flex-col h-full">
            {/* Shape & Color Sub-tabs */}
            <div className="border-b border-[#4A5568] flex-shrink-0">
              <div className="flex gap-0">
                <button
                  onClick={() => setActiveShapeColorTab('شكل وصف')}
                  className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                    activeShapeColorTab === 'شكل وصف'
                      ? 'text-[#5DADE2]'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  شكل وصف
                  {activeShapeColorTab === 'شكل وصف' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5DADE2]"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveShapeColorTab('لون المنتج')}
                  className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                    activeShapeColorTab === 'لون المنتج'
                      ? 'text-[#5DADE2]'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  لون المنتج
                  {activeShapeColorTab === 'لون المنتج' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5DADE2]"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveShapeColorTab('الكميه')}
                  className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                    activeShapeColorTab === 'الكميه'
                      ? 'text-[#5DADE2]'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  الكميه
                  {activeShapeColorTab === 'الكميه' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5DADE2]"></div>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-tab Content */}
            <div className="flex-1 pt-4 pb-8 md:pb-12">
            {activeShapeColorTab === 'شكل وصف' && (
              <div className="space-y-4 overflow-y-auto scrollbar-hide max-h-[calc(100vh-280px)] pb-8">
                {/* Shape Name Section */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2 text-right">
                    اسم الشكل
                  </label>
                  <input
                    type="text"
                    value={shapeName}
                    onChange={(e) => setShapeName(e.target.value)}
                    placeholder="مثال: دائري، مربع، بيضاوي..."
                    className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
                  />
                </div>

                {/* Barcode Section */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2 text-right">
                    الباركود
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shapeBarcode}
                      onChange={(e) => setShapeBarcode(e.target.value)}
                      placeholder="الباركود الخاص بالشكل"
                      className="flex-1 px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
                    />
                    <button
                      onClick={() => setShapeBarcode(generateBarcode())}
                      className="bg-[#5DADE2] hover:bg-[#4A9DD5] text-white px-3 py-2 rounded transition-colors flex items-center gap-1"
                      title="توليد باركود تلقائي"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Image Upload Section with Drag & Drop */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2 text-right">
                    صورة الشكل
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 ${
                      shapeImageDragActive
                        ? 'border-[#5DADE2] bg-[#5DADE2]/10'
                        : 'border-[#4A5568] hover:border-[#5DADE2]/50'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setShapeImageDragActive(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setShapeImageDragActive(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setShapeImageDragActive(false)
                      const file = e.dataTransfer.files[0]
                      if (file && file.type.startsWith('image/')) {
                        setShapeImageFile(file)
                        // Convert to data URL for persistent storage
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setShapeImagePreview(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  >
                    {shapeImagePreview ? (
                      <div className="space-y-2">
                        <img
                          src={shapeImagePreview}
                          alt="معاينة"
                          className="w-24 h-24 object-cover rounded mx-auto border border-[#4A5568]"
                        />
                        <p className="text-green-400 text-xs">{shapeImageFile?.name}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShapeImageFile(null)
                            setShapeImagePreview(null)
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          إزالة الصورة
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-gray-400 text-sm">اسحب وأفلت الصورة هنا</p>
                        <p className="text-gray-500 text-xs">أو</p>
                        <label className="inline-block bg-[#5DADE2] hover:bg-[#4A9DD5] text-white px-4 py-2 rounded cursor-pointer transition-colors text-sm">
                          اختر صورة
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setShapeImageFile(file)
                                // Convert to data URL for persistent storage
                                const reader = new FileReader()
                                reader.onloadend = () => {
                                  setShapeImagePreview(reader.result as string)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add/Update Button */}
                <div className="flex justify-end gap-2">
                  {editingShapeId && (
                    <button
                      onClick={cancelShapeEdit}
                      className="bg-[#6B7280] hover:bg-[#4B5563] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                    >
                      إلغاء
                    </button>
                  )}
                  <button
                    onClick={addShape}
                    className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    {editingShapeId ? 'تحديث الشكل' : 'إضافة الشكل'}
                  </button>
                </div>

                {/* Added Shapes Display */}
                {productShapes.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <h4 className="text-white text-sm font-medium text-right">الأشكال المضافة:</h4>
                    <div className="space-y-2">
                      {productShapes.map((shape) => (
                        <div
                          key={shape.id}
                          className="bg-[#2B3441] border border-[#4A5568] rounded p-3 flex items-center gap-3"
                        >
                          {/* Shape Image */}
                          {shape.image && (
                            <img
                              src={shape.image}
                              alt={shape.name || 'شكل'}
                              className="w-12 h-12 object-cover rounded border border-[#4A5568]"
                            />
                          )}

                          {/* Shape Info */}
                          <div className="flex-1 text-right">
                            {shape.name && (
                              <p className="text-white font-medium text-sm">{shape.name}</p>
                            )}
                            {shape.barcode && (
                              <p className="text-gray-400 text-xs">باركود: {shape.barcode}</p>
                            )}
                            {!shape.name && !shape.barcode && shape.image && (
                              <p className="text-gray-400 text-xs">شكل بصورة فقط</p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => editShape(shape)}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                              title="تعديل"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteShape(shape.id)}
                              className="text-red-400 hover:text-red-300 transition-colors p-1"
                              title="حذف"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeShapeColorTab === 'لون المنتج' && (
              <div className="space-y-4 overflow-y-auto scrollbar-hide max-h-[calc(100vh-280px)] pb-8">
                {/* Color Name Section */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2 text-right">
                    اسم اللون
                  </label>
                  <input
                    type="text"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    placeholder="مثالة: أزرق فاتح"
                    className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
                  />
                </div>

                {/* Color Selection Section */}
                <div className="flex items-center justify-end gap-3">
                  <span className="text-white text-sm">اللون</span>
                  <div className="flex items-center gap-2">
                    <label className="relative cursor-pointer">
                      <div
                        className="w-8 h-8 border border-[#4A5568] rounded cursor-pointer hover:border-[#5DADE2] transition-colors"
                        style={{ backgroundColor: selectedColor }}
                      />
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Barcode Section */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2 text-right">
                    الباركود
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={colorBarcode}
                      onChange={(e) => setColorBarcode(e.target.value)}
                      placeholder="الباركود الخاص باللون"
                      className="flex-1 px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
                    />
                    <button
                      onClick={() => setColorBarcode(generateBarcode())}
                      className="bg-[#5DADE2] hover:bg-[#4A9DD5] text-white px-3 py-2 rounded transition-colors flex items-center gap-1"
                      title="توليد باركود تلقائي"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Image Upload Section with Drag & Drop */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2 text-right">
                    صورة اللون
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 ${
                      colorImageDragActive
                        ? 'border-[#5DADE2] bg-[#5DADE2]/10'
                        : 'border-[#4A5568] hover:border-[#5DADE2]/50'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setColorImageDragActive(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setColorImageDragActive(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setColorImageDragActive(false)
                      const file = e.dataTransfer.files[0]
                      if (file && file.type.startsWith('image/')) {
                        setColorImageFile(file)
                        // Convert to data URL for persistent storage
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setColorImagePreview(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  >
                    {colorImagePreview ? (
                      <div className="space-y-2">
                        <img
                          src={colorImagePreview}
                          alt="معاينة"
                          className="w-24 h-24 object-cover rounded mx-auto border border-[#4A5568]"
                        />
                        <p className="text-green-400 text-xs">{colorImageFile?.name}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setColorImageFile(null)
                            setColorImagePreview(null)
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          إزالة الصورة
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-gray-400 text-sm">اسحب وأفلت الصورة هنا</p>
                        <p className="text-gray-500 text-xs">أو</p>
                        <label className="inline-block bg-[#5DADE2] hover:bg-[#4A9DD5] text-white px-4 py-2 rounded cursor-pointer transition-colors text-sm">
                          اختر صورة
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setColorImageFile(file)
                                // Convert to data URL for persistent storage
                                const reader = new FileReader()
                                reader.onloadend = () => {
                                  setColorImagePreview(reader.result as string)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add/Update Button */}
                <div className="flex justify-end gap-2">
                  {editingColorId && (
                    <button
                      onClick={cancelEdit}
                      className="bg-[#6B7280] hover:bg-[#4B5563] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                    >
                      إلغاء
                    </button>
                  )}
                  <button
                    onClick={addColor}
                    className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    {editingColorId ? 'تحديث اللون' : 'إضافة اللون'}
                  </button>
                </div>

                {/* Added Colors Display */}
                {productColors.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <h4 className="text-white text-sm font-medium text-right">الألوان المضافة:</h4>
                    <div className="space-y-2 max-h-[300px] md:max-h-[350px] overflow-y-auto scrollbar-hide pr-2 pb-2">
                      {productColors.map((color) => (
                        <div
                          key={color.id}
                          className="bg-[#2B3441] border border-[#4A5568] rounded p-3 flex items-center gap-3"
                        >
                          {/* Color Image */}
                          {color.image && (
                            <img
                              src={color.image}
                              alt={color.name}
                              className="w-12 h-12 object-cover rounded border border-[#4A5568]"
                            />
                          )}

                          {/* Color Swatch */}
                          <div
                            className="w-8 h-8 rounded border border-[#4A5568] flex-shrink-0"
                            style={{ backgroundColor: color.color || '#000000' }}
                          />

                          {/* Color Info */}
                          <div className="flex-1 text-right">
                            <p className="text-white font-medium text-sm">{color.name}</p>
                            {color.barcode && (
                              <p className="text-gray-400 text-xs">باركود: {color.barcode}</p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => editColor(color)}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                              title="تعديل"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteColor(color.id)}
                              className="text-red-400 hover:text-red-300 transition-colors p-1"
                              title="حذف"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeShapeColorTab === 'الكميه' && (
              <div className="space-y-6">
                {/* Check if colors or shapes are added */}
                {productColors.length === 0 && productShapes.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-gray-400 text-sm">
                      يرجى إضافة ألوان أو أشكال أولاً من التبويبات السابقة
                    </p>
                    <p className="text-gray-500 text-xs mt-2">
                      انتقل إلى تبويب "لون المنتج" أو "شكل وصف" لإضافة الألوان والأشكال أولاً
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Display branches */}
                    {branches.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-400 text-sm">
                          لا توجد فروع متاحة. يرجى إضافة فروع أولاً.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {branches.map((branch) => (
                          <div key={branch.id} className="bg-[#2B3441] border border-[#4A5568] rounded-lg p-4">
                            {/* Branch Header */}
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#4A5568]">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded bg-blue-600/20 text-blue-400">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-white font-medium text-lg">{branch.name}</h3>
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-600/30">
                                    فرع
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-gray-300 text-sm">
                                  الكمية الإجمالية: <span className="font-bold text-white">{getBranchTotalQuantity(branch.id)}</span> قطعة
                                </p>
                                <p className="text-blue-400 text-sm">
                                  المخصص: <span className="font-bold">{getTotalAllocatedQuantity(branch.id)}</span> قطعة
                                </p>
                                <p className="text-green-400 text-sm">
                                  المتبقي: <span className="font-bold">{getBranchTotalQuantity(branch.id) - getTotalAllocatedQuantity(branch.id)}</span> قطعة
                                </p>
                              </div>
                            </div>

                            {/* Colors Section */}
                            {productColors.length > 0 && (
                              <div className="mb-4">
                                <h4 className="text-white text-sm font-medium mb-3 text-right">الألوان:</h4>
                                <div className="space-y-2 max-h-[300px] md:max-h-[350px] overflow-y-auto scrollbar-hide pr-2 pb-2">
                                  {productColors.map((color) => (
                                    <div key={color.id} className="bg-[#374151] rounded p-3 flex items-center gap-3">
                                      {/* Color Image */}
                                      {color.image && (
                                        <img
                                          src={color.image}
                                          alt={color.name}
                                          className="w-12 h-12 object-cover rounded border border-[#4A5568]"
                                        />
                                      )}

                                      {/* Color Swatch */}
                                      <div
                                        className="w-8 h-8 rounded border border-[#4A5568] flex-shrink-0"
                                        style={{ backgroundColor: color.color || '#000000' }}
                                      />

                                      {/* Color Name */}
                                      <div className="flex-1 text-right">
                                        <p className="text-white font-medium text-sm">{color.name}</p>
                                        {color.barcode && (
                                          <p className="text-gray-400 text-xs">باركود: {color.barcode}</p>
                                        )}
                                      </div>

                                      {/* Quantity Input */}
                                      <div className="w-32">
                                        <input
                                          type="number"
                                          placeholder="الكمية"
                                          min="0"
                                          value={getVariantQuantity(branch.id, color.id, 'color') || ''}
                                          onChange={(e) => updateVariantQuantity(branch.id, color.id, 'color', parseInt(e.target.value) || 0)}
                                          className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Shapes Section */}
                            {productShapes.length > 0 && (
                              <div>
                                <h4 className="text-white text-sm font-medium mb-3 text-right">الأشكال:</h4>
                                <div className="space-y-2">
                                  {productShapes.map((shape) => (
                                    <div key={shape.id} className="bg-[#374151] rounded p-3 flex items-center gap-3">
                                      {/* Shape Image */}
                                      {shape.image && (
                                        <img
                                          src={shape.image}
                                          alt={shape.name || 'شكل'}
                                          className="w-12 h-12 object-cover rounded border border-[#4A5568]"
                                        />
                                      )}

                                      {/* Shape Name */}
                                      <div className="flex-1 text-right">
                                        {shape.name ? (
                                          <p className="text-white font-medium text-sm">{shape.name}</p>
                                        ) : (
                                          <p className="text-gray-400 text-sm italic">شكل بدون اسم</p>
                                        )}
                                        {shape.barcode && (
                                          <p className="text-gray-400 text-xs">باركود: {shape.barcode}</p>
                                        )}
                                      </div>

                                      {/* Quantity Input */}
                                      <div className="w-32">
                                        <input
                                          type="number"
                                          placeholder="الكمية"
                                          min="0"
                                          value={getVariantQuantity(branch.id, shape.id, 'shape') || ''}
                                          onChange={(e) => updateVariantQuantity(branch.id, shape.id, 'shape', parseInt(e.target.value) || 0)}
                                          className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            </div>
          </div>
        )

      case 'المخزون':
        return (
          <div className="space-y-4 flex flex-col h-full">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5DADE2]"></div>
              </div>
            ) : (
              <>
                {/* Locations and Minimum Stock Thresholds */}
                <div className="flex-1">
                  <label className="block text-white text-sm font-medium mb-4 text-right">
                    إدارة المخزون لكل موقع:
                  </label>
                  
                  {locationThresholds.length > 0 ? (
                    <div className="space-y-4 pb-8">
                      {locationThresholds.map((threshold) => (
                        <div key={threshold.locationId} className="bg-[#2B3441] border border-[#4A5568] rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                threshold.locationType === 'branch' 
                                  ? 'bg-blue-600/20 text-blue-400' 
                                  : 'bg-green-600/20 text-green-400'
                              }`}>
                                {threshold.locationType === 'branch' ? (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <h3 className="text-white font-medium">{threshold.locationName}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  threshold.locationType === 'branch'
                                    ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                                    : 'bg-green-600/20 text-green-300 border border-green-600/30'
                                }`}>
                                  {threshold.locationType === 'branch' ? 'فرع' : 'مخزن'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Two input fields side by side with action buttons */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Quantity field */}
                            <div>
                              <label className="block text-gray-300 text-sm font-medium mb-2 text-right">
                                إضافة الكمية
                              </label>
                              <input
                                type="number"
                                value={threshold.quantity !== undefined ? threshold.quantity : ''}
                                onChange={(e) => handleThresholdChange(threshold.locationId, 'quantity', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                placeholder=""
                                min="0"
                                className="w-full px-3 py-2 bg-[#374151] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                            
                            {/* Low stock threshold field */}
                            <div>
                              <label className="block text-gray-300 text-sm font-medium mb-2 text-right">
                                منخفض عند
                              </label>
                              <input
                                type="number"
                                value={threshold.minStockThreshold !== undefined ? threshold.minStockThreshold : ''}
                                onChange={(e) => handleThresholdChange(threshold.locationId, 'minStockThreshold', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                placeholder=""
                                min="0"
                                className="w-full px-3 py-2 bg-[#374151] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          </div>
                          
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 text-sm">
                        لا توجد فروع أو مخازن متاحة. يرجى إضافة فروع أو مخازن أولاً من إدارة الفروع والمخازن.
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )

      case 'الإعدادات':
        return (
          <div className="space-y-4">
            {/* Product Status */}
            <div>
              <label className="block text-white text-sm font-medium mb-4 text-right">
                حالة المنتج
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleInputChange('isActive', !formData.isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    formData.isActive ? 'bg-[#3B82F6]' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isActive ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
                <span className="text-gray-300 text-sm">
                  {formData.isActive ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            </div>

            {/* Additional Settings can be added here */}
            <div className="pt-4 border-t border-gray-600">
              <p className="text-gray-400 text-sm">
                إعدادات إضافية للمنتج يمكن إضافتها هنا
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
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

      {/* Sidebar - starts below header with exact dark theme colors */}
      <div className={`fixed top-12 right-0 h-[calc(100vh-3rem)] ${isMobile ? 'w-full' : 'w-[600px]'} bg-[#3A4553] z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } shadow-2xl flex flex-col`}>
        {/* Header - dark gray header matching design */}
        <div className={`bg-[#3A4553] ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} flex items-center justify-start border-b border-[#4A5568]`}>
          <h2 className={`text-white ${isMobile ? 'text-base' : 'text-lg'} font-medium flex-1 text-right`}>
            {isEditMode ? 'تحرير المنتج' : 'منتج جديد'}
          </h2>
          <button
            onClick={onClose}
            className={`text-white hover:text-gray-200 transition-colors ${isMobile ? 'ml-2' : 'ml-4'}`}
          >
            <ArrowRightIcon className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </button>
        </div>

        {/* Tab Navigation Bar - matching reference design */}
        <div className="bg-[#3A4553] border-b border-[#4A5568]">
          <div
            className={`flex overflow-x-auto ${isMobile ? 'scrollbar-hide' : ''}`}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative ${
                  isMobile
                    ? 'px-3 py-2 text-xs flex-shrink-0 min-w-fit'
                    : 'px-6 py-3 text-sm'
                } font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-[#5DADE2]' // Light blue text for selected
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {tab}
                {/* Light blue underline for active tab */}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5DADE2]"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className={`${isMobile ? 'p-3' : 'p-6'} flex-1 overflow-y-auto scrollbar-hide min-h-0 pb-24`}>
          {renderTabContent()}
        </div>

        {/* Action Buttons - exact design match */}
        <div className={`absolute bottom-0 left-0 right-0 ${isMobile ? 'p-3' : 'p-4'} bg-[#3A4553] border-t border-[#4A5568]`}>
          <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'}`}>
            {/* Clear Fields Button - matching reference design */}
            <button
              onClick={handleClearFields}
              className={`bg-transparent hover:bg-[#EF4444]/10 text-[#EF4444] ${isMobile ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'} rounded-md border border-[#EF4444] hover:border-[#DC2626] hover:text-[#DC2626] font-medium transition-all duration-200`}
            >
              تصفية الخلايا
            </button>

            <div className="flex-1"></div>

            {/* Cancel and Save buttons - exact styling */}
            <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'}`}>
              <button
                onClick={handleCancel}
                className={`bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500 ${isMobile ? 'px-2 py-1 text-xs min-w-[60px]' : 'px-4 py-2 text-sm min-w-[80px]'} font-medium transition-all duration-200 flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}
              >
                <svg className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`${isMobile ? 'px-2 py-1 text-xs min-w-[60px]' : 'px-4 py-2 text-sm min-w-[80px]'} font-medium transition-all duration-200 flex items-center ${isMobile ? 'gap-1' : 'gap-2'} ${
                  isSaving
                    ? 'bg-gray-600/50 text-gray-400 border border-gray-600 cursor-not-allowed'
                    : 'bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className={`animate-spin rounded-full ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} border-b-2 border-gray-400`}></div>
                    {isEditMode ? 'جاري التحديث...' : 'جاري الحفظ...'}
                  </>
                ) : (
                  <>
                    <svg className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {isEditMode ? 'تحديث' : 'حفظ'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Empty spacer area with same height as the tab navigation section - only on mobile/tablet */}
          <div className="h-14 bg-[#3A4553] md:hidden"></div>
        </div>
      </div>
    </>
  )
}