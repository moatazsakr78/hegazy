import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'

// Lightweight interface for admin products management
export interface AdminProduct {
  id: string
  name: string
  description: string
  price: number
  main_image_url: string | null
  category: {
    id: string
    name: string
  } | null
  is_hidden: boolean
  is_featured: boolean
  display_order: number
  suggested_products: string[]
}

export function useProductsAdmin() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch products optimized for admin management
  // Single query - no N+1 problem!
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Single optimized query with category join
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          price,
          main_image_url,
          is_hidden,
          is_featured,
          display_order,
          suggested_products,
          category:categories(
            id,
            name
          )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (productsError) throw productsError

      // Minimal data processing - just extract description text if needed
      const processedProducts: AdminProduct[] = (productsData || []).map((product: any) => {
        // Extract actual description text (handle JSON format if present)
        let actualDescription = product.description || ''
        try {
          if (actualDescription.startsWith('{')) {
            const descData = JSON.parse(actualDescription)
            actualDescription = descData.text || ''
          }
        } catch (e) {
          // Use as-is if not JSON
        }

        return {
          id: product.id,
          name: product.name || 'منتج بدون اسم',
          description: actualDescription,
          price: product.price || 0,
          main_image_url: product.main_image_url,
          category: product.category,
          is_hidden: product.is_hidden || false,
          is_featured: product.is_featured || false,
          display_order: product.display_order || 0,
          suggested_products: product.suggested_products || []
        }
      })

      setProducts(processedProducts)
    } catch (err) {
      console.error('Error fetching admin products:', err)
      setError(err instanceof Error ? err.message : 'فشل تحميل المنتجات')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch only - NO real-time subscriptions!
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return {
    products,
    isLoading,
    error,
    fetchProducts
  }
}
