/**
 * Optimized Admin Data Fetching
 *
 * This file contains optimized server-side data fetching for admin/employee pages
 * Key optimizations:
 * 1. Combines multiple queries into fewer queries (solves N+1 problem)
 * 2. Selective field fetching (reduces bandwidth)
 * 3. Batch processing for related data
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient<Database, 'hegazy'>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'hegazy' // Use hegazy schema for multi-tenant architecture
  },
  auth: {
    persistSession: false,
  },
});

/**
 * ✨ OPTIMIZED: Get all products with inventory and variants
 *
 * Before: 1 + (N * 2) queries (1 products + N inventory + N variants)
 * After: 3 queries total (products + all inventory + all variants)
 *
 * Performance gain: For 100 products: 201 queries → 3 queries (98.5% reduction!)
 */
export async function getProductsWithInventory() {
  try {
    // Query 1: Get all products with categories (selective fields)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        barcode,
        price,
        cost_price,
        main_image_url,
        category_id,
        is_active,
        display_order,
        stock,
        min_stock,
        max_stock,
        categories (
          id,
          name
        )
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (productsError) throw productsError;
    if (!products || products.length === 0) return { products: [], inventory: [], variants: [] };

    const productIds = products.map(p => p.id);

    // Query 2: Get ALL inventory for ALL products in ONE query
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('product_id, branch_id, warehouse_id, quantity, min_stock, audit_status')
      .in('product_id', productIds);

    if (inventoryError) {
      console.warn('Error fetching inventory:', inventoryError);
    }

    // Query 3a: Get ALL color/shape definitions for ALL products
    const { data: variantDefs, error: variantDefsError } = await supabase
      .from('product_color_shape_definitions')
      .select('id, product_id, variant_type, name, color_hex, image_url')
      .in('product_id', productIds);

    if (variantDefsError) {
      console.warn('Error fetching variant definitions:', variantDefsError);
    }

    // Query 3b: Get ALL variant quantities
    const defIds = (variantDefs || []).map(d => d.id);
    let variantQuantities: any[] = [];
    if (defIds.length > 0) {
      const { data: quantities, error: quantitiesError } = await supabase
        .from('product_variant_quantities')
        .select('variant_definition_id, branch_id, quantity')
        .in('variant_definition_id', defIds);

      if (quantitiesError) {
        console.warn('Error fetching variant quantities:', quantitiesError);
      } else {
        variantQuantities = quantities || [];
      }
    }

    // Merge definitions with quantities to match old format
    const variants = (variantDefs || []).flatMap(def => {
      // Get all quantities for this definition
      const defsQuantities = variantQuantities.filter(q => q.variant_definition_id === def.id);

      // If no quantities, return a single entry with quantity 0
      if (defsQuantities.length === 0) {
        return [{
          product_id: def.product_id,
          variant_type: def.variant_type,
          name: def.name,
          quantity: 0,
          color_hex: def.color_hex,
          color_name: def.name,
          image_url: def.image_url,
          branch_id: null
        }];
      }

      // For each quantity entry, create a variant record
      return defsQuantities.map(q => ({
        product_id: def.product_id,
        variant_type: def.variant_type,
        name: def.name,
        quantity: q.quantity,
        color_hex: def.color_hex,
        color_name: def.name,
        image_url: def.image_url,
        branch_id: q.branch_id
      }));
    });

    return {
      products: products || [],
      inventory: inventory || [],
      variants: variants || [],
    };
  } catch (error) {
    console.error('Error in getProductsWithInventory:', error);
    return { products: [], inventory: [], variants: [] };
  }
}

/**
 * ✨ OPTIMIZED: Get inventory summary per branch
 * Single query instead of multiple queries per branch
 */
export async function getInventorySummary() {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        product_id,
        branch_id,
        warehouse_id,
        quantity,
        min_stock,
        products (
          id,
          name,
          barcode,
          main_image_url
        )
      `)
      .order('quantity', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    return [];
  }
}

/**
 * ✨ OPTIMIZED: Get low stock products
 * Fetches all inventory and filters in-memory (fast!)
 */
export async function getLowStockProducts(branchId?: string) {
  try {
    let query = supabase
      .from('inventory')
      .select(`
        product_id,
        branch_id,
        quantity,
        min_stock,
        products (
          id,
          name,
          barcode,
          main_image_url,
          category:categories (
            name
          )
        )
      `);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter in-memory: quantity < min_stock (very fast!)
    const lowStock = (data || []).filter((item: any) => item.quantity < item.min_stock);

    return lowStock;
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    return [];
  }
}

/**
 * ✨ Helper: Group inventory by product
 */
export function groupInventoryByProduct(inventory: any[]) {
  const grouped = new Map<string, any[]>();

  inventory.forEach(item => {
    const existing = grouped.get(item.product_id) || [];
    existing.push(item);
    grouped.set(item.product_id, existing);
  });

  return grouped;
}

/**
 * ✨ Helper: Group variants by product
 */
export function groupVariantsByProduct(variants: any[]) {
  const grouped = new Map<string, any[]>();

  variants.forEach(item => {
    const existing = grouped.get(item.product_id) || [];
    existing.push(item);
    grouped.set(item.product_id, existing);
  });

  return grouped;
}

/**
 * ✨ Helper: Calculate total stock across all branches
 */
export function calculateTotalStock(inventory: any[], productId: string, selectedBranches?: string[]) {
  const productInventory = inventory.filter(inv => inv.product_id === productId);

  if (selectedBranches && selectedBranches.length > 0) {
    return productInventory
      .filter(inv => selectedBranches.includes(inv.branch_id || inv.warehouse_id))
      .reduce((sum, inv) => sum + (inv.quantity || 0), 0);
  }

  return productInventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
}
