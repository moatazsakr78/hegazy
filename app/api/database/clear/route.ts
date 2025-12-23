import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Essential data that should not be deleted
const ESSENTIAL_CATEGORIES = ['منتجات', 'عملاء', 'موردين'];
const ESSENTIAL_BUCKET_FILES = ['products/.emptyFolderPlaceholder'];

export async function POST(request: NextRequest) {
  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'hegazy' // Use hegazy schema for multi-tenant architecture
      }
    });

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح - يجب تسجيل الدخول' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح - جلسة غير صالحة' },
        { status: 401 }
      );
    }

    // Check user permissions
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'أدمن رئيسي' || profile.is_admin !== true) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحيات كافية - يجب أن تكون أدمن رئيسي' },
        { status: 403 }
      );
    }

    // Clear all data (except current user)
    await clearDatabase(supabase, user.id);

    return NextResponse.json(
      { message: 'تم مسح قاعدة البيانات بنجاح' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json(
      { error: 'فشل مسح قاعدة البيانات' },
      { status: 500 }
    );
  }
}

async function clearDatabase(supabase: any, currentUserId: string) {
  // Define all tables to clear (in proper order to respect foreign keys)
  const tablesToClear = [
    'sale_items',
    'sales',
    'order_items',
    'orders',
    'purchase_invoice_items',
    'purchase_invoices',
    'customer_payments',
    'supplier_payments',
    'expenses',
    'branch_stocks',
    'product_ratings',
    'product_reviews',
    'products',
    'records',
    'warehouses',
    'customers',
    'suppliers',
    'branches'
  ];

  // Clear tables
  for (const table of tablesToClear) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) {
        console.error(`Error clearing ${table}:`, error);
      }
    } catch (err) {
      console.error(`Error clearing ${table}:`, err);
    }
  }

  // Clear user_profiles except current user
  try {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .neq('id', currentUserId);

    if (error) {
      console.error('Error clearing user_profiles:', error);
    }
  } catch (err) {
    console.error('Error clearing user_profiles:', err);
  }

  // Clear categories except essential ones
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .not('name', 'in', `(${ESSENTIAL_CATEGORIES.join(',')})`);

    if (error) {
      console.error('Error clearing categories:', error);
    }
  } catch (err) {
    console.error('Error clearing categories:', err);
  }

  // Clear system_settings except essential ones
  try {
    // Keep currency and rating settings
    const { error } = await supabase
      .from('system_settings')
      .delete()
      .not('setting_key', 'in', '(currency_mode,system_currency,website_currency,unified_currency,show_ratings)');

    if (error) {
      console.error('Error clearing system_settings:', error);
    }
  } catch (err) {
    console.error('Error clearing system_settings:', err);
  }

  // Clear auth users (except current user)
  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    if (users && users.users) {
      for (const authUser of users.users) {
        // Skip current user
        if (authUser.id === currentUserId) continue;

        try {
          await supabase.auth.admin.deleteUser(authUser.id);
        } catch (err) {
          console.error(`Error deleting user ${authUser.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error clearing auth users:', err);
  }

  // Clear storage buckets (except essential files)
  try {
    // Clear product images
    const { data: imagesList } = await supabase
      .storage
      .from('product_images')
      .list();

    if (imagesList) {
      const filesToDelete = imagesList
        .map((file: any) => file.name)
        .filter((name: string) => !ESSENTIAL_BUCKET_FILES.includes(name) && name !== '.emptyFolderPlaceholder');

      if (filesToDelete.length > 0) {
        await supabase
          .storage
          .from('product_images')
          .remove(filesToDelete);
      }
    }

    // Clear product videos
    const { data: videosList } = await supabase
      .storage
      .from('product_videos')
      .list('products');

    if (videosList) {
      const filesToDelete = videosList
        .map((file: any) => `products/${file.name}`)
        .filter((path: string) =>
          !ESSENTIAL_BUCKET_FILES.includes(path) &&
          !path.includes('.emptyFolderPlaceholder')
        );

      if (filesToDelete.length > 0) {
        await supabase
          .storage
          .from('product_videos')
          .remove(filesToDelete);
      }
    }
  } catch (err) {
    console.error('Error clearing storage:', err);
  }
}
