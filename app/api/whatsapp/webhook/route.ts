import { NextRequest, NextResponse } from 'next/server';
import { parseIncomingMessage, markMessageAsRead, IncomingMessage } from '@/app/lib/whatsapp';
import { createClient } from '@supabase/supabase-js';

// In-memory store for messages (will be replaced with database later)
// This is exported so the chat page can access it
export const messageStore: Map<string, IncomingMessage[]> = new Map();

// Supabase client for storing messages
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Webhook verification (required by Meta)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Check if this is a verification request
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.log('❌ Webhook verification failed');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// POST - Receive incoming messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📩 Webhook received:', JSON.stringify(body, null, 2));

    // Verify this is a WhatsApp message webhook
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    // Process each entry
    for (const entry of body.entry || []) {
      const message = parseIncomingMessage(entry);

      if (message) {
        console.log('📱 New message from:', message.customerName, '-', message.text);

        // Store message in memory (grouped by phone number)
        const existingMessages = messageStore.get(message.from) || [];
        existingMessages.push(message);
        messageStore.set(message.from, existingMessages);

        // Also try to store in database (whatsapp_messages table)
        try {
          await supabase.from('whatsapp_messages').insert({
            message_id: message.messageId,
            from_number: message.from,
            customer_name: message.customerName,
            message_text: message.text,
            message_type: 'incoming',
            created_at: message.timestamp.toISOString(),
          });
        } catch (dbError) {
          // Table might not exist yet - that's okay
          console.log('Note: Could not save to database (table may not exist)');
        }

        // Mark message as read
        await markMessageAsRead(message.messageId);
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
