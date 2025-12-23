import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Singleton instance for admin client
let supabaseAdminInstance: SupabaseClient<Database, 'hegazy'> | null = null

/**
 * Get Supabase Admin Client (Server-side only!)
 * This client bypasses RLS policies - use with caution
 * Only use in API routes with proper authorization checks
 */
export const getSupabaseAdmin = (): SupabaseClient<Database, 'hegazy'> => {
  if (!supabaseAdminInstance) {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase admin environment variables')
    }

    supabaseAdminInstance = createClient<Database, 'hegazy'>(supabaseUrl, supabaseServiceRoleKey, {
      db: {
        schema: 'hegazy' // Use hegazy schema for multi-tenant architecture
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  return supabaseAdminInstance
}

// Export singleton instance
export const supabaseAdmin = getSupabaseAdmin()
