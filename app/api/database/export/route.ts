import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    // Define all tables to export (excluding system tables)
    const tables = [
      'products',
      'categories',
      'customers',
      'suppliers',
      'branches',
      'branch_stocks',
      'sales',
      'sale_items',
      'warehouses',
      'orders',
      'order_items',
      'purchase_invoices',
      'purchase_invoice_items',
      'customer_payments',
      'supplier_payments',
      'expenses',
      'records',
      'user_profiles',
      'system_settings',
      'product_ratings',
      'product_reviews'
    ];

    const exportData: any = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      tables: {},
      auth_users: [],
      storage: {
        product_images: [],
        product_videos: []
      }
    };

    // Export table data
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*');

        if (error) {
          console.error(`Error exporting ${table}:`, error);
          continue;
        }

        exportData.tables[table] = data || [];
      } catch (err) {
        console.error(`Error exporting ${table}:`, err);
        exportData.tables[table] = [];
      }
    }

    // Export auth users (if possible)
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      if (!authError && authData) {
        exportData.auth_users = authData.users.map((user: any) => ({
          id: user.id,
          email: user.email,
          phone: user.phone,
          email_confirmed_at: user.email_confirmed_at,
          phone_confirmed_at: user.phone_confirmed_at,
          created_at: user.created_at,
          updated_at: user.updated_at,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata,
          role: user.role
        }));
      }
    } catch (err) {
      console.error('Error exporting auth users:', err);
    }

    // Export storage files (product images and videos)
    try {
      // Export product images
      const { data: imagesList, error: imagesError } = await supabase
        .storage
        .from('product_images')
        .list();

      if (!imagesError && imagesList) {
        for (const file of imagesList) {
          try {
            const { data: fileData } = await supabase
              .storage
              .from('product_images')
              .download(file.name);

            if (fileData) {
              const base64 = await fileToBase64(fileData);
              exportData.storage.product_images.push({
                name: file.name,
                data: base64,
                metadata: file.metadata
              });
            }
          } catch (err) {
            console.error(`Error downloading image ${file.name}:`, err);
          }
        }
      }

      // Export product videos
      const { data: videosList, error: videosError } = await supabase
        .storage
        .from('product_videos')
        .list('products');

      if (!videosError && videosList) {
        for (const file of videosList) {
          if (file.name === '.emptyFolderPlaceholder') continue;

          try {
            const { data: fileData } = await supabase
              .storage
              .from('product_videos')
              .download(`products/${file.name}`);

            if (fileData) {
              const base64 = await fileToBase64(fileData);
              exportData.storage.product_videos.push({
                name: file.name,
                data: base64,
                metadata: file.metadata
              });
            }
          } catch (err) {
            console.error(`Error downloading video ${file.name}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error exporting storage files:', err);
    }

    // Return as JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="database-backup-${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    console.error('Error exporting database:', error);
    return NextResponse.json(
      { error: 'فشل تصدير قاعدة البيانات' },
      { status: 500 }
    );
  }
}

// Helper function to convert File/Blob to base64
async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
  });
}
