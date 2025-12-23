import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth.config';

// Force Node.js runtime (required for auth)
export const runtime = 'nodejs';

// Create Supabase client with service role for admin operations
const supabaseAdmin = createClient(
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

// GET - Fetch all themes
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('store_theme_colors')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching themes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add new theme
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, primaryColor, primaryHoverColor, interactiveColor, buttonColor, buttonHoverColor } = body;

    if (!name || !primaryColor || !primaryHoverColor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('store_theme_colors')
      .insert({
        name,
        primary_color: primaryColor,
        primary_hover_color: primaryHoverColor,
        interactive_color: interactiveColor || '#EF4444',
        button_color: buttonColor || primaryColor,
        button_hover_color: buttonHoverColor || primaryHoverColor,
        is_active: false,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding theme:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update theme
export async function PATCH(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, primaryColor, primaryHoverColor, interactiveColor, buttonColor, buttonHoverColor } = body;

    if (!id) {
      return NextResponse.json({ error: 'Theme ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('store_theme_colors')
      .update({
        primary_color: primaryColor,
        primary_hover_color: primaryHoverColor,
        interactive_color: interactiveColor,
        button_color: buttonColor,
        button_hover_color: buttonHoverColor,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating theme:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete theme
export async function DELETE(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Theme ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('store_theme_colors')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting theme:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
