import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'
import { ProductColor } from '../../../components/website/shared/types'
import { usePreFetchedData } from '@/lib/contexts/PreFetchedDataContext'

export interface Product {
  id: string
  name: string
  name_en?: string | null
  description?: string | null
  description_en?: string | null
  barcode?: string | null
  price: number
  cost_price: number
  category_id?: string | null
  video_url?: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  product_code?: string | null
  wholesale_price?: number | null
  price1?: number | null
  price2?: number | null
  price3?: number | null
  price4?: number | null
  main_image_url?: string | null
  sub_image_url?: string | null
  additional_images_urls?: string[] | null // الحقل الجديد للصور الإضافية
  barcodes?: string[] | null
  unit?: string | null
  stock?: number | null
  min_stock?: number | null
  max_stock?: number | null
  location?: string | null
  status?: string | null
  warehouse?: string | null
  branch?: string | null
  tax_price?: number | null
  // New rating and discount fields
  rating?: number | null
  rating_count?: number | null
  discount_percentage?: number | null
  discount_amount?: number | null
  discount_start_date?: string | null
  discount_end_date?: string | null
  // New management fields
  is_hidden?: boolean | null
  is_featured?: boolean | null
  display_order?: number | null
  suggested_products?: string[] | null
  additional_images?: any[] | null
  actualVideoUrl?: string | null // Actual video URL (not images array)
  productVideos?: ProductVideo[] // ✨ قائمة الفيديوهات من جدول product_videos
  // Relations
  category?: {
    id: string
    name: string
    name_en?: string | null
  } | null
  // Computed fields for table display
  totalQuantity?: number
  inventoryData?: Record<string, { quantity: number, min_stock: number, audit_status: string }>
  variantsData?: Record<string, ProductVariant[]>
  productColors?: Array<{id: string, name: string, color: string}>
  allImages?: string[]
  productSizes?: ProductSize[]
  productRatings?: ProductRating[]
  // Helper computed fields
  finalPrice?: number // Price after discount
  isDiscounted?: boolean
  discountLabel?: string
  colors?: ProductColor[] // Color variants
}

// ✨ Interface للفيديوهات
export interface ProductVideo {
  id: string
  product_id: string
  video_url: string
  video_name?: string | null
  video_size?: number | null
  duration?: number | null
  thumbnail_url?: string | null
  sort_order?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductVariant {
  id: string
  product_id: string
  branch_id: string
  variant_type: 'color' | 'shape'
  name: string
  quantity: number
  barcode?: string | null // Barcode stored in dedicated field
  image_url?: string | null // Image URL in dedicated field
  color_hex?: string | null // Color hex value for color variants
  color_name?: string | null // Color name for color variants
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductSize {
  id: string
  product_id: string
  size_name: string
  size_code?: string | null
  size_value?: string | null
  size_category?: string | null
  price_adjustment: number
  is_available: boolean
  stock_quantity: number
  min_stock: number
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductRating {
  id: string
  product_id: string
  customer_id?: string | null
  customer_name?: string | null
  customer_email?: string | null
  rating: number
  review_title?: string | null
  review_text?: string | null
  is_verified_purchase: boolean
  is_approved: boolean
  is_featured: boolean
  helpful_count: number
  created_at?: string | null
  updated_at?: string | null
}

export interface InventoryItem {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  min_stock: number
  max_stock: number
  location?: string
}

export interface Branch {
  id: string
  name: string
  name_en?: string | null
  address?: string
  is_active?: boolean | null
}

export function useProducts() {
  // Check if we have pre-fetched data from server
  const preFetchedData = usePreFetchedData()
  const hasPreFetchedData = preFetchedData?.products && preFetchedData.products.length > 0

  const [products, setProducts] = useState<Product[]>(hasPreFetchedData ? preFetchedData.products : [])
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(!hasPreFetchedData) // Start as loaded if we have pre-fetched data
  const [error, setError] = useState<string | null>(null)

  // Fetch all products with categories and inventory data
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch products with categories
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(
            id,
            name,
            name_en
          )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (productsError) throw productsError

      // Fetch branches (handle potential auth errors)
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (branchesError) {
        console.warn('Unable to fetch branches (likely auth required):', branchesError)
        setBranches([])
      } else {
        setBranches(branchesData || [])
      }

      // Load selected branches from product_display_settings (once for all products)
      let selectedBranchIds: string[] = []
      try {
        const { data: settingsData, error: settingsError } = await supabase
          .from('product_display_settings')
          .select('selected_branches')
          .single()

        if (!settingsError && settingsData && settingsData.selected_branches) {
          selectedBranchIds = settingsData.selected_branches
        }
      } catch (err) {
        console.warn('Unable to fetch display settings:', err)
      }

      // For each product, fetch inventory and variants data
      const enrichedProducts = await Promise.all(
        (productsData || []).map(async (rawProduct) => {
          // Cast to our Product type to include new fields
          const product = rawProduct as any
          // Parse product colors and description from description field
          let productColors: any[] = []
          let actualDescription: string = product.description || ""

          try {
            if (product.description && product.description.startsWith('{')) {
              const descriptionData = JSON.parse(product.description)
              productColors = descriptionData.colors || []
              actualDescription = descriptionData.text || ""

              // Try to assign images from video_url to colors
              if (productColors.length > 0 && product.video_url) {
                try {
                  const additionalImages = JSON.parse(product.video_url)
                  if (Array.isArray(additionalImages)) {
                    productColors = productColors.map((color: any, index: number) => ({
                      ...color,
                      image: color.image || (additionalImages[index] || undefined)
                    }))
                  }
                } catch (imageParseError) {
                  // Ignore image parsing errors
                }
              }
            }
          } catch (e) {
            // If parsing fails, use original description and empty colors array
            productColors = []
            actualDescription = product.description || ""
          }

          // Fetch inventory data for all branches (handle auth errors gracefully)
          let inventoryData: any[] = []
          try {
            const { data, error } = await supabase
              .from('inventory')
              .select('branch_id, warehouse_id, quantity, min_stock')
              .eq('product_id', product.id)

            if (!error && data) {
              inventoryData = data
            }
          } catch (err) {
            console.warn('Unable to fetch inventory data (likely auth required):', err)
          }

          // Fetch variant definitions and quantities
          let variantsData: any[] = []
          try {
            console.log(`🔍 Loading variants for product: ${product.name} (${product.id})`)

            // First, load variant definitions (colors and shapes)
            const { data: definitions, error: defError } = await supabase
              .from('product_color_shape_definitions')
              .select('*')
              .eq('product_id', product.id)

            console.log(`📊 Definitions query result:`, { definitions, defError })

            if (defError) {
              console.error('❌ Error loading definitions:', defError)
            }

            if (!defError && definitions && definitions.length > 0) {
              console.log(`✅ Found ${definitions.length} definitions for ${product.name}`)

              // Build productColors from color definitions
              const colorDefinitions = definitions.filter(d => d.variant_type === 'color')
              if (colorDefinitions.length > 0) {
                productColors = colorDefinitions.map(d => ({
                  id: d.id,
                  name: d.name || '',
                  color: d.color_hex || '#6B7280',
                  image: d.image_url || undefined
                }))
                console.log(`🎨 Built ${productColors.length} productColors:`, productColors)
              }

              // Load quantities for these definitions
              const { data: quantities, error: qtyError } = await supabase
                .from('product_variant_quantities')
                .select('*')
                .in('variant_definition_id', definitions.map(d => d.id))

              console.log(`📦 Quantities query result:`, { quantities, qtyError })

              if (qtyError) {
                console.error('❌ Error loading quantities:', qtyError)
              }

              if (!qtyError && quantities && quantities.length > 0) {
                console.log(`✅ Found ${quantities.length} quantities for ${product.name}`)

                // Build variantsData from definitions + quantities
                variantsData = quantities.map(qty => {
                  const definition = definitions.find(d => d.id === qty.variant_definition_id)
                  if (!definition) {
                    console.warn(`⚠️ No definition found for quantity:`, qty)
                    return null
                  }

                  return {
                    branch_id: qty.branch_id,
                    warehouse_id: null, // We only support branches for now
                    variant_type: definition.variant_type,
                    name: definition.name,
                    value: definition.color_hex || '',
                    quantity: qty.quantity || 0,
                    image_url: definition.image_url,
                    barcode: definition.barcode
                  }
                }).filter(v => v !== null)

                console.log(`✅ Built ${variantsData.length} variantsData for ${product.name}:`, variantsData)
              } else {
                console.log(`⚠️ No quantities found for ${product.name}`)
              }
            } else {
              console.log(`⚠️ No definitions found for ${product.name}`)
            }
          } catch (err) {
            console.error('❌ Error fetching variants data:', err)
          }

          // ✨ Fetch product videos from product_videos table
          let productVideos: ProductVideo[] = []
          try {
            const { data, error } = await (supabase as any)
              .from('product_videos')
              .select('*')
              .eq('product_id', product.id)
              .order('sort_order', { ascending: true })

            if (!error && data) {
              productVideos = data as ProductVideo[]
            }
          } catch (err) {
            console.warn('Unable to fetch product videos:', err)
          }

          // Group inventory by branch/warehouse
          const inventoryByBranch: Record<string, { quantity: number, min_stock: number }> = {}
          let totalQuantity = 0

          inventoryData.forEach((inv: any) => {
            const locationId = inv.branch_id || inv.warehouse_id
            if (locationId) {
              inventoryByBranch[locationId] = {
                quantity: inv.quantity || 0,
                min_stock: inv.min_stock || 0
              }
              // Only count quantity from selected branches (if any are selected)
              // If no branches selected, count from all branches
              if (selectedBranchIds.length === 0 || selectedBranchIds.includes(locationId)) {
                totalQuantity += inv.quantity || 0
              }
            }
          })

          // Group variants by location (branch or warehouse) and collect all images
          const variantsByLocation: Record<string, ProductVariant[]> = {}
          const allProductImages: string[] = []
          
          // Add main image if exists
          if (product.main_image_url) {
            allProductImages.push(product.main_image_url)
          }
          
          variantsData.forEach((variant: any) => {
            const locationId = variant.branch_id || variant.warehouse_id
            if (locationId) {
              if (!variantsByLocation[locationId]) {
                variantsByLocation[locationId] = []
              }
              variantsByLocation[locationId].push({
                ...variant,
                variant_type: variant.variant_type as 'color' | 'shape'
              })
              
              // Extract images from image_url field
              if (variant.image_url) {
                allProductImages.push(variant.image_url)
              }
            }
          })
          
          // ✨ HIGHEST PRIORITY: Add sub-images from additional_images_urls (new field)
          if (product.additional_images_urls && Array.isArray(product.additional_images_urls)) {
            allProductImages.push(...product.additional_images_urls);
          } else {
            // FALLBACK: Add sub-images from video_url field (old system)
            if (product.video_url) {
              try {
                const additionalImages = JSON.parse(product.video_url);
                if (Array.isArray(additionalImages)) {
                  allProductImages.push(...additionalImages);
                }
              } catch (parseError) {
                // video_url is a real video URL, not JSON - ignore
              }
            }
          }

          // Remove duplicates from images
          const uniqueImages = Array.from(new Set(allProductImages.filter(img => img && img.trim() !== '')))
          
          // Add sub_image_url to images if it exists and is not already included
          if (product.sub_image_url && !uniqueImages.includes(product.sub_image_url)) {
            uniqueImages.push(product.sub_image_url)
          }

          // Calculate discount information
          const now = new Date()
          const discountStart = product.discount_start_date ? new Date(product.discount_start_date) : null
          const discountEnd = product.discount_end_date ? new Date(product.discount_end_date) : null
          
          const isDiscountActive = (
            (product.discount_percentage > 0 || product.discount_amount > 0) &&
            (!discountStart || now >= discountStart) &&
            (!discountEnd || now <= discountEnd)
          )
          
          let finalPrice = product.price
          let discountLabel = ''
          
          if (isDiscountActive) {
            if (product.discount_percentage > 0) {
              finalPrice = product.price * (1 - (product.discount_percentage / 100))
              discountLabel = `-${product.discount_percentage}%`
            } else if (product.discount_amount > 0) {
              finalPrice = Math.max(0, product.price - product.discount_amount)
              discountLabel = `-${product.discount_amount}`
            }
          }

          // Extract color variants for website format and sort by quantity (highest first)
          const colorVariants = variantsData
            .filter((variant: any) => variant.variant_type === 'color' && variant.color_hex && variant.color_name)
            .map((variant: any) => ({
              id: variant.id,
              name: variant.color_name,
              hex: variant.color_hex,
              image_url: variant.image_url,
              quantity: variant.quantity || 0
            }))
            .sort((a: any, b: any) => b.quantity - a.quantity); // Sort by quantity descending

          // ✨ استخدام الحقل الجديد مع fallback للصيغة القديمة
          let parsedAdditionalImages = product.additional_images_urls || []
          let actualVideoUrl = product.video_url || null

          // 🔄 FALLBACK: إذا لم تكن هناك صور في الحقل الجديد، حاول القراءة من الحقول القديمة
          if (parsedAdditionalImages.length === 0) {
            // محاولة قراءة من sub_image_url
            if (product.sub_image_url) {
              try {
                const parsed = JSON.parse(product.sub_image_url)
                if (Array.isArray(parsed)) {
                  parsedAdditionalImages = parsed
                }
              } catch (e) {
                // Ignore
              }
            }

            // محاولة قراءة من video_url إذا كان يحتوي على صور
            if (parsedAdditionalImages.length === 0 && product.video_url) {
              try {
                const parsed = JSON.parse(product.video_url)
                if (Array.isArray(parsed)) {
                  parsedAdditionalImages = parsed
                  actualVideoUrl = null // video_url كان يحتوي على صور، وليس فيديو
                }
              } catch (e) {
                // video_url هو رابط فيديو فعلي
              }
            }
          }

          console.log(`🔍 Processing product: ${product.name}`)
          console.log('  - additional_images:', parsedAdditionalImages.length, 'images')
          console.log('  - productVideos:', productVideos.length, 'videos')
          console.log('  - actualVideoUrl:', actualVideoUrl ? 'Has video' : 'No video')

          return {
            ...product,
            description: actualDescription, // Use parsed description text only
            totalQuantity,
            inventoryData: inventoryByBranch,
            variantsData: variantsByLocation,
            productColors: productColors, // Add parsed colors
            colors: colorVariants, // Add formatted colors for website
            allImages: uniqueImages, // Add all product images including sub_image
            additional_images: parsedAdditionalImages, // ✨ الصور الإضافية من الحقل الجديد
            productVideos: productVideos, // ✨ قائمة الفيديوهات من جدول product_videos
            actualVideoUrl: actualVideoUrl, // ✨ رابط الفيديو الفعلي فقط
            finalPrice: finalPrice,
            isDiscounted: isDiscountActive,
            discountLabel: discountLabel
          }
        })
      )

      setProducts(enrichedProducts)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update existing product
  const updateProduct = useCallback(async (productId: string, productData: Partial<Product>): Promise<Product | null> => {
    try {
      // ✨ استخدام الحقل الجديد المبسط للصور الإضافية
      const additionalImagesValue = productData.additional_images || productData.additional_images_urls
      const videoUrlValue = productData.actualVideoUrl !== undefined ? productData.actualVideoUrl : productData.video_url

      const { data, error } = await supabase
        .from('products')
        .update({
          name: productData.name!,
          name_en: productData.name_en,
          description: productData.description,
          description_en: productData.description_en,
          barcode: productData.barcode,
          price: productData.price || 0,
          cost_price: productData.cost_price || 0,
          wholesale_price: productData.wholesale_price || 0,
          price1: productData.price1 || 0,
          price2: productData.price2 || 0,
          price3: productData.price3 || 0,
          price4: productData.price4 || 0,
          category_id: productData.category_id,
          product_code: productData.product_code,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          additional_images_urls: additionalImagesValue, // ✨ الحقل الجديد للصور الإضافية
          video_url: videoUrlValue, // ✨ فقط للفيديوهات
          barcodes: productData.barcodes || [],
          unit: productData.unit || 'قطعة',
          stock: productData.stock,
          min_stock: productData.min_stock,
          max_stock: productData.max_stock,
          location: productData.location,
          warehouse: productData.warehouse,
          branch: productData.branch,
          tax_price: productData.tax_price,
          rating: productData.rating || 0,
          rating_count: productData.rating_count || 0,
          discount_percentage: productData.discount_percentage || 0,
          discount_amount: productData.discount_amount || 0,
          discount_start_date: productData.discount_start_date,
          discount_end_date: productData.discount_end_date,
          is_hidden: productData.is_hidden,
          is_featured: productData.is_featured,
          display_order: productData.display_order,
          suggested_products: productData.suggested_products,
          is_active: productData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          category:categories(
            id,
            name,
            name_en
          )
        `)
        .single()

      if (error) throw error

      return data as any
    } catch (err) {
      console.error('Error updating product:', err)
      throw err
    }
  }, [])

  // Create new product
  const createProduct = useCallback(async (productData: Partial<Product>): Promise<Product | null> => {
    try {
      // ✨ استخدام الحقل الجديد المبسط للصور الإضافية
      const additionalImagesValue = productData.additional_images || productData.additional_images_urls || []
      const videoUrlValue = productData.actualVideoUrl || productData.video_url || null

      console.log('💾 CreateProduct Debug:')
      console.log('  - additional_images:', additionalImagesValue.length, 'images')
      console.log('  - video_url:', videoUrlValue)

      const { data, error } = await supabase
        .from('products')
        .insert({
          name: productData.name!,
          name_en: productData.name_en,
          description: productData.description,
          description_en: productData.description_en,
          barcode: productData.barcode,
          price: productData.price || 0,
          cost_price: productData.cost_price || 0,
          category_id: productData.category_id,
          video_url: videoUrlValue, // ✨ فقط للفيديوهات
          product_code: productData.product_code,
          wholesale_price: productData.wholesale_price || 0,
          price1: productData.price1 || 0,
          price2: productData.price2 || 0,
          price3: productData.price3 || 0,
          price4: productData.price4 || 0,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          additional_images_urls: additionalImagesValue, // ✨ الحقل الجديد للصور الإضافية
          barcodes: productData.barcodes || [],
          unit: productData.unit || 'قطعة',
          stock: productData.stock || 0,
          min_stock: productData.min_stock || 0,
          max_stock: productData.max_stock || 100,
          location: productData.location,
          warehouse: productData.warehouse,
          branch: productData.branch,
          tax_price: productData.tax_price || 0,
          rating: 0,
          rating_count: 0,
          discount_percentage: productData.discount_percentage || 0,
          discount_amount: productData.discount_amount || 0,
          discount_start_date: productData.discount_start_date,
          discount_end_date: productData.discount_end_date,
          is_hidden: productData.is_hidden || false,
          is_featured: productData.is_featured || false,
          display_order: productData.display_order || 0,
          suggested_products: productData.suggested_products || [],
          is_active: true
        })
        .select(`
          *,
          category:categories(
            id,
            name,
            name_en
          )
        `)
        .single()

      if (error) throw error

      return data as any
    } catch (err) {
      console.error('Error creating product:', err)
      throw err
    }
  }, [])

  // Delete product
  const deleteProduct = useCallback(async (productId: string): Promise<void> => {
    try {
      // Check if product exists in sales invoices
      const { data: saleItems, error: saleError } = await supabase
        .from('sale_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1)

      if (saleError) throw saleError

      if (saleItems && saleItems.length > 0) {
        throw new Error('المنتج موجود في فواتير لا يمكن حذفه')
      }

      // Check if product exists in purchase invoices
      const { data: purchaseItems, error: purchaseError } = await supabase
        .from('purchase_invoice_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1)

      if (purchaseError) throw purchaseError

      if (purchaseItems && purchaseItems.length > 0) {
        throw new Error('المنتج موجود في فواتير لا يمكن حذفه')
      }

      // Check if product exists in orders
      const { data: orderItems, error: orderError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1)

      if (orderError) throw orderError

      if (orderItems && orderItems.length > 0) {
        throw new Error('المنتج موجود في فواتير لا يمكن حذفه')
      }

      // If no invoice references found, proceed with deletion
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error
    } catch (err) {
      console.error('Error deleting product:', err)
      throw err
    }
  }, [])

  // Setup real-time subscriptions
  useEffect(() => {
    // Products subscription
    const productsChannel = supabase
      .channel('products_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the new product with category data
            const { data: newProduct } = await supabase
              .from('products')
              .select(`
                *,
                category:categories(
                  id,
                  name,
                  name_en
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (newProduct) {
              // Parse product colors and description from description field
              let productColors: any[] = []
              let actualDescription: string = newProduct.description || ""
              
              try {
                if (newProduct.description && newProduct.description.startsWith('{')) {
                  const descriptionData = JSON.parse(newProduct.description)
                  productColors = descriptionData.colors || []
                  actualDescription = descriptionData.text || ""
                  
                  // Try to assign images from video_url to colors
                  if (productColors.length > 0 && newProduct.video_url) {
                    try {
                      const additionalImages = JSON.parse(newProduct.video_url)
                      if (Array.isArray(additionalImages)) {
                        productColors = productColors.map((color: any, index: number) => ({
                          ...color,
                          image: color.image || (additionalImages[index] || undefined)
                        }))
                      }
                    } catch (imageParseError) {
                      // Ignore image parsing errors
                    }
                  }
                }
              } catch (e) {
                // If parsing fails, use original description and empty colors array
                productColors = []
                actualDescription = newProduct.description || ""
              }

              // ✨ استخدام الحقل الجديد المبسط
              const product = newProduct as any // Cast for new field
              const parsedAdditionalImages = product.additional_images_urls || []
              const actualVideoUrl = product.video_url || null

              // ✨ Fetch product videos for the new product
              let productVideos: ProductVideo[] = []
              try {
                const { data: videosData } = await (supabase as any)
                  .from('product_videos')
                  .select('*')
                  .eq('product_id', newProduct.id)
                  .order('sort_order', { ascending: true })

                if (videosData) {
                  productVideos = videosData as ProductVideo[]
                }
              } catch (err) {
                console.warn('Unable to fetch product videos for new product:', err)
              }

              // Build allImages array with main image and sub-images
              const allImages: string[] = []
              if (newProduct.main_image_url) {
                allImages.push(newProduct.main_image_url)
              }
              // Add sub-images from additional_images_urls
              if (parsedAdditionalImages && Array.isArray(parsedAdditionalImages)) {
                allImages.push(...parsedAdditionalImages)
              }

              // Add inventory and variants data
              const enrichedProduct = {
                ...newProduct,
                description: actualDescription, // Use parsed description text only
                productColors: productColors, // Add parsed colors
                additional_images: parsedAdditionalImages, // ✨ من الحقل الجديد
                productVideos: productVideos, // ✨ قائمة الفيديوهات
                actualVideoUrl: actualVideoUrl, // ✨ رابط الفيديو فقط
                totalQuantity: 0,
                inventoryData: {},
                variantsData: {},
                allImages: allImages // ✨ Now includes sub-images
              }

              // Check if product already exists before adding (prevents duplicates during bulk imports)
              setProducts(prev => {
                const exists = prev.some(p => p.id === enrichedProduct.id)
                if (exists) {
                  return prev // Don't add duplicate
                }
                return [enrichedProduct as any, ...prev]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            // Fetch the updated product with category data
            const { data: updatedProduct } = await supabase
              .from('products')
              .select(`
                *,
                category:categories(
                  id,
                  name,
                  name_en
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (updatedProduct) {
              // Parse product colors and description from updated description field
              let productColors: any[] = []
              let actualDescription: string = updatedProduct.description || ""
              
              try {
                if (updatedProduct.description && updatedProduct.description.startsWith('{')) {
                  const descriptionData = JSON.parse(updatedProduct.description)
                  productColors = descriptionData.colors || []
                  actualDescription = descriptionData.text || ""
                  
                  // Try to assign images from video_url to colors
                  if (productColors.length > 0 && updatedProduct.video_url) {
                    try {
                      const additionalImages = JSON.parse(updatedProduct.video_url)
                      if (Array.isArray(additionalImages)) {
                        productColors = productColors.map((color: any, index: number) => ({
                          ...color,
                          image: color.image || (additionalImages[index] || undefined)
                        }))
                      }
                    } catch (imageParseError) {
                      // Ignore image parsing errors
                    }
                  }
                }
              } catch (e) {
                // If parsing fails, use original description and empty colors array
                productColors = []
                actualDescription = updatedProduct.description || ""
              }

              // ✨ استخدام الحقل الجديد المبسط
              const product = updatedProduct as any // Cast for new field
              const parsedAdditionalImages = product.additional_images_urls || []
              const actualVideoUrl = product.video_url || null

              // ✨ Fetch product videos for the updated product
              let productVideos: ProductVideo[] = []
              try {
                const { data: videosData } = await (supabase as any)
                  .from('product_videos')
                  .select('*')
                  .eq('product_id', updatedProduct.id)
                  .order('sort_order', { ascending: true })

                if (videosData) {
                  productVideos = videosData as ProductVideo[]
                }
              } catch (err) {
                console.warn('Unable to fetch product videos for updated product:', err)
              }

              // Build allImages array with main image and sub-images
              const updatedAllImages: string[] = []
              if (updatedProduct.main_image_url) {
                updatedAllImages.push(updatedProduct.main_image_url)
              }
              // Add sub-images from additional_images_urls
              if (parsedAdditionalImages && Array.isArray(parsedAdditionalImages)) {
                updatedAllImages.push(...parsedAdditionalImages)
              }

              setProducts(prev => prev.map(product =>
                product.id === payload.new.id
                  ? {
                      ...product,
                      ...updatedProduct,
                      description: actualDescription, // Use parsed description text only
                      productColors: productColors, // Add parsed colors from updated product
                      additional_images: parsedAdditionalImages, // ✨ من الحقل الجديد
                      productVideos: productVideos, // ✨ قائمة الفيديوهات
                      actualVideoUrl: actualVideoUrl, // ✨ رابط الفيديو فقط
                      allImages: updatedAllImages, // ✨ Now includes sub-images
                      // Preserve existing inventory and variants data
                      inventoryData: product.inventoryData,
                      variantsData: product.variantsData,
                      totalQuantity: product.totalQuantity
                    }
                  : product
              ) as Product[])
            }
          } else if (payload.eventType === 'DELETE') {
            setProducts(prev => prev.filter(product => product.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Inventory subscription
    const inventoryChannel = supabase
      .channel('inventory_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        (payload: any) => {
          if (payload.new && payload.new.product_id) {
            const productId = payload.new.product_id
            const locationId = payload.new.branch_id || payload.new.warehouse_id
            const quantity = payload.new.quantity || 0
            const minStock = payload.new.min_stock || 0

            if (locationId) {
              setProducts(prev => prev.map(product => {
                if (product.id === productId) {
                  const updatedInventoryData = {
                    ...product.inventoryData,
                    [locationId]: { quantity, min_stock: minStock }
                  }
                  
                  // Recalculate total quantity
                  const totalQuantity = Object.values(updatedInventoryData)
                    .reduce((sum, inv: any) => sum + (inv?.quantity || 0), 0)

                  return {
                    ...product,
                    inventoryData: updatedInventoryData,
                    totalQuantity
                  } as Product
                }
                return product
              }))
            }
          }
        }
      )
      .subscribe()

    // Variants subscription
    const variantsChannel = supabase
      .channel('variants_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'product_variants' },
        async (payload: any) => {
          if (payload.new && payload.new.product_id && (payload.new.branch_id || payload.new.warehouse_id)) {
            const productId = payload.new.product_id
            const locationId = payload.new.branch_id || payload.new.warehouse_id
            
            // Refetch variants for this product and location
            const { data: variants } = await supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', productId)
              .or(`branch_id.eq.${locationId},warehouse_id.eq.${locationId}`)

            setProducts(prev => prev.map(product => {
              if (product.id === productId) {
                const updatedVariantsData = {
                  ...product.variantsData,
                  [locationId]: (variants || []).map(v => ({
                    ...v,
                    variant_type: v.variant_type as 'color' | 'shape'
                  }))
                }
                
                return {
                  ...product,
                  variantsData: updatedVariantsData
                }
              }
              return product
            }))
          }
        }
      )
      .subscribe()

    // Product display settings subscription - reload products when branch selection changes
    const settingsChannel = supabase
      .channel('product_display_settings_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'product_display_settings' },
        async () => {
          // Reload all products when settings change
          await fetchProducts()
        }
      )
      .subscribe()

    return () => {
      productsChannel.unsubscribe()
      inventoryChannel.unsubscribe()
      variantsChannel.unsubscribe()
      settingsChannel.unsubscribe()
    }
  }, [])

  // Initial data fetch (skip if we have pre-fetched data)
  useEffect(() => {
    if (!hasPreFetchedData) {
      fetchProducts()
    }
  }, [fetchProducts, hasPreFetchedData])

  return {
    products,
    branches,
    isLoading,
    error,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct
  }
}