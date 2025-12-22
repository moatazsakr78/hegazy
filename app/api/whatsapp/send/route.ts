import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/app/lib/whatsapp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { to, message } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      );
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanNumber = to.replace(/[\s\-\(\)]/g, '');

    const result = await sendWhatsAppMessage(cleanNumber, message);

    if (result.success) {
      // Try to store in database
      try {
        await supabase.from('whatsapp_messages').insert({
          message_id: result.messageId,
          from_number: cleanNumber,
          customer_name: 'الفاروق جروب',
          message_text: message,
          message_type: 'outgoing',
          created_at: new Date().toISOString(),
        });
      } catch (dbError) {
        console.log('Note: Could not save to database');
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
