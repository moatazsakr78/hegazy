import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'hegazy' // Use hegazy schema for multi-tenant architecture
    }
  }
)

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "البريد الإلكتروني وكلمة المرور مطلوبان" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Call Postgres function to register user
    const { data, error } = await supabase.rpc('register_user', {
      user_email: email,
      user_password: passwordHash,
      user_name: name || email.split('@')[0]
    })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: "حدث خطأ أثناء إنشاء الحساب" },
        { status: 500 }
      )
    }

    // Check if registration was successful
    if (!data.success) {
      return NextResponse.json(
        { error: data.error || "فشل إنشاء الحساب" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "تم إنشاء الحساب بنجاح",
      user: data.user
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء التسجيل" },
      { status: 500 }
    )
  }
}
