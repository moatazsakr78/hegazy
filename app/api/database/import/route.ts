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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'لم يتم تحديد ملف' },
        { status: 400 }
      );
    }

    // Read and parse the JSON file
    const fileText = await file.text();
    const importData = JSON.parse(fileText);

    // Validate import data structure
    if (!importData.version || !importData.tables) {
      return NextResponse.json(
        { error: 'ملف النسخة الاحتياطية غير صالح - البيانات مفقودة' },
        { status: 400 }
      );
    }

    // Additional safety check: Get current user profile before clearing
    const { data: currentUserProfile, error: profileFetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileFetchError || !currentUserProfile) {
      return NextResponse.json(
        { error: 'فشل الحصول على بيانات المستخدم الحالي' },
        { status: 500 }
      );
    }

    // Step 1: Clear existing data (except essential items and current user)
    await clearDatabase(supabase, user.id);

    // Step 2: Import table data
    if (importData.tables) {
      // Define allowed tables to prevent injection
      const allowedTables = [
        'products', 'categories', 'customers', 'suppliers', 'branches',
        'branch_stocks', 'sales', 'sale_items', 'warehouses', 'orders',
        'order_items', 'purchase_invoices', 'purchase_invoice_items',
        'customer_payments', 'supplier_payments', 'expenses', 'records',
        'user_profiles', 'system_settings', 'product_ratings', 'product_reviews'
      ];

      for (const [tableName, tableData] of Object.entries(importData.tables)) {
        // Security: Only allow whitelisted tables
        if (!allowedTables.includes(tableName)) {
          console.warn(`Skipping unauthorized table: ${tableName}`);
          continue;
        }

        if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
          continue;
        }

        try {
          // Special handling for categories to preserve essential ones
          if (tableName === 'categories') {
            const nonEssentialData = (tableData as any[]).filter(
              (item: any) => !ESSENTIAL_CATEGORIES.includes(item.name)
            );

            if (nonEssentialData.length > 0) {
              const { error } = await supabase
                .from(tableName)
                .insert(nonEssentialData);

              if (error) {
                console.error(`Error importing ${tableName}:`, error);
              }
            }
          } else if (tableName === 'user_profiles') {
            // Skip current user's profile to preserve it
            const otherProfiles = (tableData as any[]).filter(
              (item: any) => item.id !== user.id
            );

            // Additional security: Don't allow importing profiles with is_admin=true
            // unless the imported profile already existed and had admin rights
            const safeProfiles = otherProfiles.map((profile: any) => {
              // Reset is_admin to false for safety (admin rights must be granted manually)
              return {
                ...profile,
                is_admin: false,
                role: profile.role === 'أدمن رئيسي' ? 'عميل' : profile.role
              };
            });

            if (safeProfiles.length > 0) {
              const { error } = await supabase
                .from(tableName)
                .insert(safeProfiles);

              if (error) {
                console.error(`Error importing ${tableName}:`, error);
              }
            }
          } else if (tableName === 'system_settings') {
            // Skip essential system settings to preserve them
            const essentialSettings = ['currency_mode', 'system_currency', 'website_currency', 'unified_currency', 'show_ratings'];
            const nonEssentialSettings = (tableData as any[]).filter(
              (item: any) => !essentialSettings.includes(item.setting_key)
            );

            if (nonEssentialSettings.length > 0) {
              const { error } = await supabase
                .from(tableName)
                .insert(nonEssentialSettings);

              if (error) {
                console.error(`Error importing ${tableName}:`, error);
              }
            }
          } else {
            // Import all data for other tables
            const { error } = await supabase
              .from(tableName)
              .insert(tableData as any[]);

            if (error) {
              console.error(`Error importing ${tableName}:`, error);
            }
          }
        } catch (err) {
          console.error(`Error importing ${tableName}:`, err);
        }
      }
    }

    // Step 2.5: Restore current user profile if it was accidentally affected
    try {
      const { data: checkProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!checkProfile) {
        // Restore current user profile
        await supabase
          .from('user_profiles')
          .insert(currentUserProfile);
      }
    } catch (err) {
      console.error('Error checking/restoring user profile:', err);
    }

    // Step 3: Import auth users (except current user)
    if (importData.auth_users && Array.isArray(importData.auth_users)) {
      for (const importUser of importData.auth_users) {
        // Skip current user
        if (importUser.id === user.id) continue;

        try {
          // Create user with admin API
          const { data, error } = await supabase.auth.admin.createUser({
            email: importUser.email,
            phone: importUser.phone,
            email_confirm: !!importUser.email_confirmed_at,
            phone_confirm: !!importUser.phone_confirmed_at,
            user_metadata: importUser.user_metadata || {},
            app_metadata: importUser.app_metadata || {},
          });

          if (error) {
            console.error(`Error importing user ${importUser.email}:`, error);
          }
        } catch (err) {
          console.error(`Error importing user ${importUser.email}:`, err);
        }
      }
    }

    // Step 4: Import storage files
    if (importData.storage) {
      // Import product images
      if (importData.storage.product_images && Array.isArray(importData.storage.product_images)) {
        for (const image of importData.storage.product_images) {
          try {
            const blob = base64ToBlob(image.data);
            const { error } = await supabase
              .storage
              .from('product_images')
              .upload(image.name, blob, {
                upsert: true,
                contentType: image.metadata?.mimetype || 'image/webp'
              });

            if (error) {
              console.error(`Error uploading image ${image.name}:`, error);
            }
          } catch (err) {
            console.error(`Error uploading image ${image.name}:`, err);
          }
        }
      }

      // Import product videos
      if (importData.storage.product_videos && Array.isArray(importData.storage.product_videos)) {
        for (const video of importData.storage.product_videos) {
          try {
            const blob = base64ToBlob(video.data);
            const { error } = await supabase
              .storage
              .from('product_videos')
              .upload(`products/${video.name}`, blob, {
                upsert: true,
                contentType: video.metadata?.mimetype || 'video/mp4'
              });

            if (error) {
              console.error(`Error uploading video ${video.name}:`, error);
            }
          } catch (err) {
            console.error(`Error uploading video ${video.name}:`, err);
          }
        }
      }
    }

    return NextResponse.json(
      { message: 'تم استيراد قاعدة البيانات بنجاح' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error importing database:', error);
    return NextResponse.json(
      { error: 'فشل استيراد قاعدة البيانات' },
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
        .filter((name: string) => !ESSENTIAL_BUCKET_FILES.includes(name));

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
        .filter((path: string) => !ESSENTIAL_BUCKET_FILES.includes(path));

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

function base64ToBlob(base64: string): Blob {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray]);
}
