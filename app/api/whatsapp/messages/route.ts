import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all messages (for chat UI)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get('phone');

    // Try to fetch from database first
    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (phoneNumber) {
      query = query.eq('from_number', phoneNumber);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      console.log('Database query error:', error.message);
      return NextResponse.json({ messages: [], conversations: [] });
    }

    // Group messages by phone number for conversations view
    const conversations = new Map<string, {
      phoneNumber: string;
      customerName: string;
      lastMessage: string;
      lastMessageTime: string;
      unreadCount: number;
    }>();

    for (const msg of data || []) {
      const existing = conversations.get(msg.from_number);
      if (!existing || new Date(msg.created_at) > new Date(existing.lastMessageTime)) {
        conversations.set(msg.from_number, {
          phoneNumber: msg.from_number,
          customerName: msg.customer_name,
          lastMessage: msg.message_text,
          lastMessageTime: msg.created_at,
          unreadCount: msg.message_type === 'incoming' && !msg.is_read ? 1 : 0,
        });
      } else if (msg.message_type === 'incoming' && !msg.is_read) {
        existing.unreadCount++;
      }
    }

    return NextResponse.json({
      messages: data || [],
      conversations: Array.from(conversations.values()),
    });
  } catch (error) {
    console.error('Fetch messages error:', error);
    return NextResponse.json({ messages: [], conversations: [] });
  }
}
