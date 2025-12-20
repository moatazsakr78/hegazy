'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase/client'

export interface Customer {
  id: string
  name: string
  phone: string | null
  backup_phone: string | null
  email: string | null
  address: string | null
  city: string | null
  loyalty_points: number | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  group_id: string | null
  rank: string | null
  category: string | null
  credit_limit: number | null
  account_balance: number | null
  company_name: string | null
  contact_person: string | null
  country: string | null
  tax_id: string | null
  notes: string | null
  user_id: string | null
  profile_image_url: string | null
  governorate: string | null
}

// Default customer ID that should never be deleted
export const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001'

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)

  // ✨ OPTIMIZED: Memoized fetch function with caching
  const fetchCustomers = useCallback(async (force = false) => {
    try {
      // Simple cache: don't refetch if less than 5 seconds since last fetch (unless forced)
      const now = Date.now()
      if (!force && lastFetch && now - lastFetch < 5000) {
        console.log('⚡ Using cached customers data (< 5s old)')
        return
      }

      setIsLoading(true)
      setError(null)

      console.time('⚡ Fetch customers')

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or('is_active.is.null,is_active.eq.true')
        .order('created_at', { ascending: false })

      if (error) throw error

      console.timeEnd('⚡ Fetch customers')

      setCustomers(data || [])
      setLastFetch(now)
      setError(null)
    } catch (err) {
      console.error('❌ Error fetching customers:', err)
      setError('فشل في تحميل العملاء')
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }, [lastFetch])

  // ✨ OPTIMIZED: Debounced real-time handler
  const handleCustomerChange = useCallback((payload: any) => {
    console.log('📡 Customer change detected:', payload.eventType)

    if (payload.eventType === 'INSERT') {
      setCustomers(prev => [payload.new, ...prev])
    } else if (payload.eventType === 'UPDATE') {
      setCustomers(prev => prev.map(customer =>
        customer.id === payload.new.id ? payload.new : customer
      ))
    } else if (payload.eventType === 'DELETE') {
      setCustomers(prev => prev.filter(customer => customer.id !== payload.old.id))
    }
  }, [])

  // ✨ OPTIMIZED: Memoized helper functions
  const isDefaultCustomer = useCallback((customerId: string): boolean => {
    return customerId === DEFAULT_CUSTOMER_ID
  }, [])

  const getDefaultCustomer = useCallback((): Customer | null => {
    return customers.find(customer => customer.id === DEFAULT_CUSTOMER_ID) || null
  }, [customers])

  // Initial fetch
  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // ✨ OPTIMIZED: Real-time subscription with cleanup
  useEffect(() => {
    console.log('🔴 Setting up customers real-time subscription')

    const subscription = supabase
      .channel('customers_changes_optimized')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        handleCustomerChange
      )
      .subscribe()

    return () => {
      console.log('🔴 Cleaning up customers subscription')
      subscription.unsubscribe()
    }
  }, [handleCustomerChange])

  return {
    customers,
    setCustomers, // ✨ Expose for optimistic updates
    isLoading,
    error,
    refetch: () => fetchCustomers(true), // Force refetch
    isDefaultCustomer,
    getDefaultCustomer
  }
}