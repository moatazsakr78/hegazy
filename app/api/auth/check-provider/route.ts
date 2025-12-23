import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'hegazy'
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user exists and has no password (Google user)
    const { data: authUsers, error: authError } = await supabase
      .from('auth_users')
      .select('id, password_hash')
      .eq('email', email)
      .limit(1);

    if (authError) {
      console.error('Error checking user:', authError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // User doesn't exist
    if (!authUsers || authUsers.length === 0) {
      return NextResponse.json({ isGoogleUser: false, userExists: false });
    }

    const user = authUsers[0];

    // User exists but has no password (registered with Google)
    const isGoogleUser = !user.password_hash || user.password_hash === '';

    return NextResponse.json({
      isGoogleUser,
      userExists: true
    });

  } catch (error) {
    console.error('Error in check-provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
