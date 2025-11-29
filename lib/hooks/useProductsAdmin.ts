/**
 * ✨ SUPER OPTIMIZED Products Hook for Admin Pages
 *
 * Performance improvements:
 * - Reduces 201 queries to 3 queries (for 100 products)
 * - Uses client-side caching
 * - Selective field fetching
 * - Batch processing
 *
 * Use this for: Inventory, POS, Admin Products pages
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/app/lib/supabase/client';

// ✨ Video interface for product_videos table
export interface ProductVideo {
  id: string;
  product_id: string;
  video_url: string;
  thumbnail_url?: string | null;
  video_name?: string | null;
  video_size?: number | null;
  duration?: number | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface Product {
  id: string;
  name: string;
  name_en?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number;
  main_image_url?: string | null;
  sub_image_url?: string | null;
  additional_images_urls?: string[] | null;
  category_id?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  unit?: string | null;
  description?: string | null;
  description_en?: string | null;
  wholesale_price?: number | null;
  price1?: number | null;
  price2?: number | null;
  price3?: number | null;
  price4?: number | null;
  product_code?: string | null;
  // New rating and discount fields
  rating?: number | null;
  rating_count?: number | null;
  discount_percentage?: number | null;
  discount_amount?: number | null;
  discount_start_date?: string | null;
  discount_end_date?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  // Computed fields
  totalQuantity?: number;
  inventoryData?: Record<string, { quantity: number; min_stock: number; audit_status: string }>;
  variantsData?: Record<string, any[]>;
  productColors?: Array<{id: string; name: string; color: string}>;
  allImages?: string[];
  // ✨ Export fields
  additional_images?: any[] | null; // Mapped from additional_images_urls for export
  productVideos?: ProductVideo[]; // Videos from product_videos table
  // Helper computed fields
  finalPrice?: number; // Price after discount
  isDiscounted?: boolean;
  discountLabel?: string;
}

export interface Branch {
  id: string;
  name: string;
  name_en?: string | null;
  address?: string;
  is_active?: boolean | null;
}

export function useProductsAdmin(options?: { selectedBranches?: string[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  // Memoize selected branches to prevent unnecessary re-fetches
  const selectedBranches = useMemo(() => options?.selectedBranches || [], [options?.selectedBranches]);

  const fetchProducts = useCallback(async (force = false) => {
    try {
      // Simple cache: don't refetch if less than 5 seconds since last fetch (unless forced)
      const now = Date.now();
      if (!force && lastFetch && now - lastFetch < 5000) {
        console.log('⚡ Using cached data (< 5s old)');
        return;
      }

      setIsLoading(true);
      setError(null);

      console.time('⚡ Fetch products with inventory');

      // ✨ Query 1: Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (branchesError) {
        console.warn('Unable to fetch branches:', branchesError);
      } else {
        setBranches(branchesData || []);
      }

      // ✨ Query 2: Get all products with categories
      const { data: rawProducts, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          barcode,
          price,
          cost_price,
          main_image_url,
          sub_image_url,
          additional_images_urls,
          category_id,
          is_active,
          display_order,
          stock,
          min_stock,
          max_stock,
          unit,
          description,
          wholesale_price,
          price1,
          price2,
          price3,
          price4,
          rating,
          rating_count,
          discount_percentage,
          discount_amount,
          discount_start_date,
          discount_end_date,
          categories (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (productsError) {
        throw productsError;
      }

      if (!rawProducts || rawProducts.length === 0) {
        console.log('⚠️ No products found!');
        setProducts([]);
        setIsLoading(false);
        return;
      }

      console.log('🔍 Total products fetched from DB:', rawProducts.length);

      const productIds = (rawProducts as any[]).map(p => p.id);

      // ✨ Query 3: Get ALL inventory for ALL products in ONE query
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .select('product_id, branch_id, warehouse_id, quantity, min_stock, audit_status')
        .in('product_id', productIds);

      if (inventoryError) {
        console.warn('Error fetching inventory:', inventoryError);
      }

      // ✨ Query 4a: Get ALL variant DEFINITIONS for ALL products
      const { data: variantDefinitions, error: definitionsError } = await supabase
        .from('product_color_shape_definitions')
        .select('id, product_id, variant_type, name, color_hex, image_url, barcode, sort_order')
        .in('product_id', productIds);

      if (definitionsError) {
        console.warn('Error fetching variant definitions:', definitionsError);
      }

      // ✨ Query 4b: Get ALL variant QUANTITIES for ALL products
      let variants: any[] = [];
      if (variantDefinitions && variantDefinitions.length > 0) {
        const definitionIds = variantDefinitions.map(d => d.id);
        const { data: quantities, error: quantitiesError } = await supabase
          .from('product_variant_quantities')
          .select('variant_definition_id, branch_id, quantity')
          .in('variant_definition_id', definitionIds);

        if (quantitiesError) {
          console.warn('Error fetching variant quantities:', quantitiesError);
        }

        // Build variants array from definitions + quantities
        if (quantities && quantities.length > 0) {
          variants = quantities.map(qty => {
            const definition = variantDefinitions.find(d => d.id === qty.variant_definition_id);
            if (!definition) return null;

            return {
              product_id: definition.product_id,
              variant_type: definition.variant_type,
              name: definition.name,
              quantity: qty.quantity || 0,
              color_hex: definition.color_hex,
              color_name: definition.name, // Use name as color_name for compatibility
              image_url: definition.image_url,
              branch_id: qty.branch_id
            };
          }).filter(v => v !== null);
        }

        console.log(`✅ Loaded ${variants.length} variant quantities from ${variantDefinitions.length} definitions`);
      }

      // ✨ Query 5: Get ALL videos for ALL products in ONE query
      const { data: videos, error: videosError } = await (supabase as any)
        .from('product_videos')
        .select('id, product_id, video_url, thumbnail_url, video_name, video_size, duration, sort_order, created_at')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true });

      if (videosError) {
        console.warn('Error fetching videos:', videosError);
      }

      console.timeEnd('⚡ Fetch products with inventory');

      // Group inventory, variants, videos, and color definitions by product ID for O(1) lookup
      const inventoryMap = new Map<string, any[]>();
      const variantsMap = new Map<string, any[]>();
      const videosMap = new Map<string, ProductVideo[]>();
      const colorsMap = new Map<string, any[]>();

      (inventory || []).forEach(item => {
        const existing = inventoryMap.get(item.product_id) || [];
        existing.push(item);
        inventoryMap.set(item.product_id, existing);
      });

      (variants || []).forEach(item => {
        const existing = variantsMap.get(item.product_id) || [];
        existing.push(item);
        variantsMap.set(item.product_id, existing);
      });

      (videos || []).forEach((item: any) => {
        const existing = videosMap.get(item.product_id) || [];
        existing.push(item as ProductVideo);
        videosMap.set(item.product_id, existing);
      });

      // Build productColors map from color definitions
      (variantDefinitions || [])
        .filter(d => d.variant_type === 'color')
        .forEach(colorDef => {
          const existing = colorsMap.get(colorDef.product_id) || [];
          existing.push({
            id: colorDef.id,
            name: colorDef.name || '',
            color: colorDef.color_hex || '#6B7280',
            image: colorDef.image_url || undefined
          });
          colorsMap.set(colorDef.product_id, existing);
        });

      // Enrich products with computed data (client-side - fast!)
      const enrichedProducts: Product[] = rawProducts.map((product: any) => {
        const productInventory = inventoryMap.get(product.id) || [];
        const productVariants = variantsMap.get(product.id) || [];
        const productVideos = videosMap.get(product.id) || [];
        const productColors = colorsMap.get(product.id) || [];

        // Calculate total stock
        let totalQuantity = 0;
        productInventory.forEach((inv: any) => {
          const locationId = inv.branch_id || inv.warehouse_id;
          // Only count if no branch filter, or if branch is in selected branches
          if (selectedBranches.length === 0 || selectedBranches.includes(locationId)) {
            totalQuantity += inv.quantity || 0;
          }
        });

        // Group inventory by branch for easy lookup
        const inventoryData: Record<string, any> = {};
        productInventory.forEach((inv: any) => {
          const locationId = inv.branch_id || inv.warehouse_id;
          if (locationId) {
            inventoryData[locationId] = {
              quantity: inv.quantity || 0,
              min_stock: inv.min_stock || 0,
              audit_status: inv.audit_status || 'غير مجرود',
            };
          }
        });

        // Group variants by branch
        const variantsData: Record<string, any[]> = {};
        productVariants.forEach((variant: any) => {
          if (variant.branch_id) {
            if (!variantsData[variant.branch_id]) {
              variantsData[variant.branch_id] = [];
            }
            variantsData[variant.branch_id].push(variant);
          }
        });

        // ✨ Process product images (main + sub + additional + variants)
        const allProductImages: string[] = [];
        if (product.main_image_url) allProductImages.push(product.main_image_url);
        if (product.sub_image_url) allProductImages.push(product.sub_image_url);

        // ✨ Add additional images from JSONB field
        const additionalImages = (product as any).additional_images_urls;
        if (additionalImages && Array.isArray(additionalImages)) {
          additionalImages.forEach((imgUrl: string) => {
            if (imgUrl && imgUrl.trim() !== '') {
              allProductImages.push(imgUrl);
            }
          });
        }

        // Add variant images
        productVariants.forEach((variant: any) => {
          if (variant.image_url) allProductImages.push(variant.image_url);
        });

        // Remove duplicates
        const allImages = Array.from(new Set(allProductImages.filter(img => img && img.trim() !== '')));

        // Calculate discount information
        const now = new Date();
        const discountStart = product.discount_start_date ? new Date(product.discount_start_date) : null;
        const discountEnd = product.discount_end_date ? new Date(product.discount_end_date) : null;

        const isDiscountActive = (
          (product.discount_percentage > 0 || product.discount_amount > 0) &&
          (!discountStart || now >= discountStart) &&
          (!discountEnd || now <= discountEnd)
        );

        let finalPrice = product.price;
        let discountLabel = '';

        if (isDiscountActive) {
          if (product.discount_percentage > 0) {
            finalPrice = product.price * (1 - (product.discount_percentage / 100));
            discountLabel = `-${product.discount_percentage}%`;
          } else if (product.discount_amount > 0) {
            finalPrice = Math.max(0, product.price - product.discount_amount);
            discountLabel = `-${product.discount_amount}`;
          }
        }

        // ✨ Map additional_images for export (from additional_images_urls)
        const exportAdditionalImages = (product as any).additional_images_urls || [];

        return {
          ...product,
          totalQuantity,
          inventoryData,
          variantsData,
          productColors, // ✨ Colors from variant definitions
          allImages,
          additional_images: exportAdditionalImages, // ✨ For export modal
          productVideos: productVideos, // ✨ Videos from product_videos table
          finalPrice,
          isDiscounted: isDiscountActive,
          discountLabel,
        };
      });

      console.log('✅ Enriched products ready:', enrichedProducts.length);

      setProducts(enrichedProducts);
      setLastFetch(now);
    } catch (err) {
      console.error('❌ Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'فشل في جلب المنتجات');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranches, lastFetch]);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ✨ Real-time updates (optimized - single subscription for ALL products)
  useEffect(() => {
    console.log('🔴 Setting up real-time subscription');

    // Subscribe to products changes
    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          console.log('📡 Products change detected:', payload.eventType);
          // Debounce: wait 500ms before refetching
          setTimeout(() => fetchProducts(true), 500);
        }
      )
      .subscribe();

    // Subscribe to inventory changes
    const inventoryChannel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        (payload) => {
          console.log('📡 Inventory change detected:', payload.eventType);
          setTimeout(() => fetchProducts(true), 500);
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      console.log('🔴 Cleaning up real-time subscriptions');
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, [fetchProducts]);

  // ✨ Create new product
  const createProduct = useCallback(async (productData: Partial<Product>): Promise<Product | null> => {
    try {
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
          product_code: productData.product_code,
          wholesale_price: productData.wholesale_price || 0,
          price1: productData.price1 || 0,
          price2: productData.price2 || 0,
          price3: productData.price3 || 0,
          price4: productData.price4 || 0,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          unit: productData.unit || 'قطعة',
          is_active: true
        })
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .single()

      if (error) throw error
      return data as Product
    } catch (err) {
      console.error('Error creating product:', err)
      throw err
    }
  }, [])

  // ✨ Update existing product
  const updateProduct = useCallback(async (productId: string, productData: Partial<Product>): Promise<Product | null> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          name: productData.name,
          name_en: productData.name_en,
          description: productData.description,
          description_en: productData.description_en,
          barcode: productData.barcode,
          price: productData.price,
          cost_price: productData.cost_price,
          wholesale_price: productData.wholesale_price,
          price1: productData.price1,
          price2: productData.price2,
          price3: productData.price3,
          price4: productData.price4,
          category_id: productData.category_id,
          product_code: productData.product_code,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          unit: productData.unit,
          is_active: productData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .single()

      if (error) throw error
      return data as Product
    } catch (err) {
      console.error('Error updating product:', err)
      throw err
    }
  }, [])

  // ✨ Delete product
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

  return {
    products,
    setProducts, // ✨ Expose setProducts for optimistic updates
    branches, // ✨ Expose branches for UI components
    isLoading,
    error,
    fetchProducts: () => fetchProducts(true), // Force refetch
    createProduct, // ✨ Expose createProduct
    updateProduct, // ✨ Expose updateProduct
    deleteProduct, // ✨ Expose deleteProduct
  };
}
