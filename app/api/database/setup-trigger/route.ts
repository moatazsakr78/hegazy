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

    // SQL to create the trigger
    const triggerSQL = `
      -- Function to automatically update role when is_admin changes
      CREATE OR REPLACE FUNCTION auto_update_role_on_admin_change()
      RETURNS TRIGGER AS $$
      BEGIN
        -- If is_admin is set to true, automatically update role to 'أدمن رئيسي'
        IF NEW.is_admin = true AND (OLD.is_admin IS NULL OR OLD.is_admin = false) THEN
          NEW.role = 'أدمن رئيسي';
        END IF;

        -- If is_admin is set to false, and role was 'أدمن رئيسي', change it back to 'عميل'
        IF NEW.is_admin = false AND OLD.role = 'أدمن رئيسي' THEN
          NEW.role = 'عميل';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Drop trigger if exists
      DROP TRIGGER IF EXISTS trigger_auto_update_role ON user_profiles;

      -- Create trigger on user_profiles table
      CREATE TRIGGER trigger_auto_update_role
        BEFORE INSERT OR UPDATE OF is_admin
        ON user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION auto_update_role_on_admin_change();
    `;

    // Execute the SQL
    const { error: sqlError } = await (supabase as any).rpc('exec_sql', {
      sql_query: triggerSQL
    });

    if (sqlError) {
      // If RPC doesn't exist, try direct execution (this might not work with service key)
      console.error('Error with RPC, trying direct execution:', sqlError);

      return NextResponse.json(
        {
          error: 'لم يتم تنفيذ الـ Trigger تلقائياً',
          message: 'يرجى تطبيق الكود التالي في Supabase SQL Editor',
          sql: triggerSQL
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'تم تطبيق Database Trigger بنجاح!' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error setting up trigger:', error);
    return NextResponse.json(
      { error: 'فشل إعداد Database Trigger' },
      { status: 500 }
    );
  }
}
