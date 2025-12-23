/**
 * Server-side data fetching functions for products
 * These functions run on the server and support Static Generation & ISR
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a server-side Supabase client
const supabase = createClient<Database, 'hegazy'>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'hegazy' // Use hegazy schema for multi-tenant architecture
  },
  auth: {
    persistSession: false, // Don't persist sessions on server
  },
});

/**
 * Get all active products for the website
 * Supports Static Generation with ISR (revalidate every 60 seconds)
 *
 * ✨ Optimized strategy:
 * - Product colors (static - rarely change) ✅
 * - Stock quantities (static - updated every 60s via ISR) ✅
 * - Result: 1 DB query serves 1000s of users, fresh data every minute!
 */
export async function getWebsiteProducts() {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        main_image_url,
        category_id,
        is_active,
        is_hidden,
        is_featured,
        discount_percentage,
        discount_amount,
        discount_start_date,
        discount_end_date,
        rating,
        rating_count,
        display_order,
        stock,
        categories (
          id,
          name
        )
      `)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Get product colors & inventory for all products in ONE optimized query
    if (products && products.length > 0) {
      const productIds = products.map(p => p.id);

      // Query 1: Fetch colors
      const { data: colorsData } = await supabase
        .from('product_color_shape_definitions')
        .select('id, product_id, name, color_hex, image_url, sort_order')
        .in('product_id', productIds)
        .eq('variant_type', 'color')
        .order('sort_order', { ascending: true });

      // Query 2: Fetch inventory totals
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('product_id, quantity')
        .in('product_id', productIds);

      // Process colors
      if (colorsData) {
        const colorsMap = new Map<string, any[]>();
        colorsData.forEach(color => {
          if (!colorsMap.has(color.product_id)) {
            colorsMap.set(color.product_id, []);
          }
          colorsMap.get(color.product_id)!.push({
            id: color.id,
            name: color.name,
            hex: color.color_hex,
            image_url: color.image_url
          });
        });

        // Attach colors to products
        products.forEach((product: any) => {
          product.colors = colorsMap.get(product.id) || [];
        });
      }

      // Process inventory (sum across all branches)
      if (inventoryData) {
        const stockMap = new Map<string, number>();
        inventoryData.forEach(item => {
          const currentStock = stockMap.get(item.product_id) || 0;
          stockMap.set(item.product_id, currentStock + (item.quantity || 0));
        });

        // Override stock values with actual inventory totals
        products.forEach((product: any) => {
          product.stock = stockMap.get(product.id) || 0;
        });
      }
    }

    return products || [];
  } catch (error) {
    console.error('Error fetching website products:', error);
    return [];
  }
}

/**
 * Get product by ID for product detail page
 * Supports Static Generation with ISR
 */
export async function getProductById(productId: string) {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name,
          name_en
        )
      `)
      .eq('id', productId)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .single();

    if (error) throw error;

    return product;
  } catch (error) {
    console.error(`Error fetching product ${productId}:`, error);
    return null;
  }
}

/**
 * Get product with ALL related data (variants, videos, suggested products)
 * ✨ Optimized: Combines 7 client queries into 2-3 server queries
 * Supports Static Generation with ISR
 */
export async function getProductWithAllData(productId: string) {
  try {
    // Query 1: Get main product data with category
    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name,
          name_en
        )
      `)
      .eq('id', productId)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .single();

    // Get total inventory quantity from all branches
    let totalStock = 0;
    if (product) {
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', productId);

      if (inventoryData && inventoryData.length > 0) {
        totalStock = inventoryData.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }

      // Override product.stock with actual inventory total
      (product as any).stock = totalStock;
    }

    if (productError || !product) {
      console.error('Error fetching product:', productError);
      return null;
    }

    // Query 2: Get color & shape definitions from the correct table
    const { data: colorShapeDefinitions, error: definitionsError } = await supabase
      .from('product_color_shape_definitions')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (definitionsError) {
      console.error('Error fetching color/shape definitions:', definitionsError);
    }

    // Transform definitions to match expected format
    const variants = colorShapeDefinitions || [];

    // Query 3: Get product videos (if table exists - optional)
    let videos: any[] = [];
    try {
      const { data: videoData } = await (supabase as any)
        .from('product_videos')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      videos = videoData || [];
    } catch (error) {
      console.log('Product videos table not found or error:', error);
    }

    // Query 4: Get suggested products (if any)
    let suggestedProducts: any[] = [];
    const suggestedProductIds = (product as any).suggested_products;
    if (suggestedProductIds && Array.isArray(suggestedProductIds) && suggestedProductIds.length > 0) {
      const { data: suggested, error: suggestedError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          price,
          main_image_url,
          discount_percentage,
          discount_amount,
          discount_start_date,
          discount_end_date,
          rating,
          rating_count,
          categories (
            id,
            name
          )
        `)
        .in('id', suggestedProductIds)
        .eq('is_active', true)
        .eq('is_hidden', false);

      if (!suggestedError && suggested) {
        suggestedProducts = suggested;
      }
    }

    // Query 5: Get related size products (if product name contains size indicators)
    let relatedSizeProducts: any[] = [];
    try {
      const productName = (product as any).name || '';
      const baseName = productName
        .replace(/\s*مقاس\s*\d+\s*/g, '')
        .replace(/\s*مقياس\s*\d+\s*/g, '')
        .replace(/\s*حجم\s*(صغير|متوسط|كبير)\s*/g, '')
        .trim();

      if (baseName && baseName !== productName) {
        const { data: relatedProducts } = await supabase
          .from('products')
          .select('id, name, price')
          .ilike('name', `%${baseName}%`)
          .neq('id', productId)
          .eq('is_active', true)
          .limit(10);

        if (relatedProducts && relatedProducts.length > 0) {
          relatedSizeProducts = relatedProducts.filter(p =>
            /مقاس|مقياس|حجم/.test(p.name)
          );
        }
      }
    } catch (error) {
      console.log('Error finding related size products:', error);
    }

    // Combine all data
    return {
      product,
      variants: variants || [],
      videos: videos || [],
      suggestedProducts: suggestedProducts || [],
      relatedSizeProducts: relatedSizeProducts || []
    };
  } catch (error) {
    console.error(`Error fetching product with all data ${productId}:`, error);
    return null;
  }
}

/**
 * Get store categories with their products
 * Used for category carousels
 */
export async function getStoreCategoriesWithProducts() {
  try {
    const { data: categories, error } = await supabase
      .from('store_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // For each category, get its products via the junction table
    const categoriesWithProducts = await Promise.all(
      (categories || []).map(async (category) => {
        // Get product IDs from junction table
        const { data: categoryProducts } = await supabase
          .from('store_category_products')
          .select('product_id')
          .eq('store_category_id', category.id)
          .order('sort_order', { ascending: true });

        const productIds = (categoryProducts?.map(cp => cp.product_id).filter((id): id is string => id !== null)) || [];

        if (productIds.length === 0) {
          return { ...category, products: [] };
        }

        const { data: products } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            main_image_url,
            discount_percentage,
            discount_amount,
            discount_start_date,
            discount_end_date,
            rating,
            rating_count
          `)
          .in('id', productIds)
          .eq('is_active', true)
          .eq('is_hidden', false);

        return {
          ...category,
          products: products || [],
        };
      })
    );

    return categoriesWithProducts;
  } catch (error) {
    console.error('Error fetching store categories:', error);
    return [];
  }
}

/**
 * Get custom sections with their products
 * Used for custom product sections
 *
 * Note: Custom sections table doesn't exist yet in this database
 * Returning empty array for now - can be implemented when table is created
 */
export async function getCustomSections() {
  // TODO: Implement when custom_sections table is created
  return [];
}

/**
 * Get company settings
 *
 * Note: This will be implemented based on your actual settings table structure
 * For now, returning null
 */
export async function getCompanySettings() {
  // TODO: Implement when company settings table structure is confirmed
  return null;
}

/**
 * Get store theme colors
 *
 * Note: Returning default theme colors for now
 * Can be connected to actual theme table when available
 */
export async function getStoreTheme() {
  // TODO: Connect to actual theme table if exists
  return {
    primary_color: '#DC2626',
    primary_hover_color: '#B91C1C',
    interactive_color: '#EF4444'
  };
}

/**
 * Get product display settings
 *
 * Note: Returning default settings for now
 * Can be connected to actual settings table when available
 */
export async function getProductDisplaySettings() {
  // TODO: Connect to actual settings table if exists
  return {
    show_ratings: true,
    show_stock: true,
    show_prices: true
  };
}
