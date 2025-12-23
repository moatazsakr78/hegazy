import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth.config'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'hegazy' // Use hegazy schema for multi-tenant architecture
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
)

export async function GET() {
  try {
    // Get session from NextAuth
    const session = await auth()

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - No valid session' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Fetch user profile using service role (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
