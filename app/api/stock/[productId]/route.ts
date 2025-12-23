import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient<Database, 'hegazy'>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'hegazy' // Use hegazy schema for multi-tenant architecture
  }
});

/**
 * GET /api/stock/[productId]
 *
 * Returns real-time stock quantity for a product
 *
 * Caching Strategy:
 * - CDN Cache: 60 seconds (s-maxage)
 * - Stale-While-Revalidate: 30 seconds
 * - Result: Fast response + accurate data
 *
 * Performance:
 * - Even with 1000 concurrent users, the CDN serves most requests
 * - Database queries: ~1-2 per minute per product (instead of 1000!)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;

    // Fetch stock from ALL inventory records (all branches)
    const { data: inventoryRecords, error } = await supabase
      .from('inventory')
      .select('quantity, min_stock')
      .eq('product_id', productId);

    if (error) {
      console.error('Error fetching inventory:', error);
      // If no inventory record exists, return zero stock
      return NextResponse.json(
        {
          productId,
          quantity: 0,
          available: false,
          low_stock: false,
          min_stock: 10
        },
        {
          headers: {
            // Short cache for non-existent items
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
          },
        }
      );
    }

    if (!inventoryRecords || inventoryRecords.length === 0) {
      // No inventory records found
      return NextResponse.json(
        {
          productId,
          quantity: 0,
          available: false,
          low_stock: false,
          min_stock: 10
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
          },
        }
      );
    }

    // Calculate total quantity across all branches
    const totalQuantity = inventoryRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);
    const min_stock = inventoryRecords[0]?.min_stock || 10;
    const isLowStock = totalQuantity < min_stock;
    const isAvailable = totalQuantity > 0;

    return NextResponse.json(
      {
        productId,
        quantity: totalQuantity,
        available: isAvailable,
        low_stock: isLowStock,
        min_stock
      },
      {
        headers: {
          // Cache for 60 seconds, allow stale for 30 seconds while revalidating
          // This means most users get cached response (fast!)
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching stock:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock' },
      { status: 500 }
    );
  }
}
