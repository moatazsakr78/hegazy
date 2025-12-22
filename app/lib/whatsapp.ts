// WhatsApp Business API Utility Functions

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
}

interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface IncomingMessage {
  messageId: string;
  from: string;
  customerName: string;
  text: string;
  timestamp: Date;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Send a text message via WhatsApp
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendMessageResponse> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: 'WhatsApp credentials not configured',
    };
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } else {
      console.error('WhatsApp API Error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to send message',
      };
    }
  } catch (error) {
    console.error('WhatsApp Send Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Parse incoming webhook message
export function parseIncomingMessage(
  entry: any
): IncomingMessage | null {
  try {
    const changes = entry.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) {
      return null;
    }

    const message: WhatsAppMessage = value.messages[0];
    const contact: WhatsAppContact = value.contacts?.[0];

    // Only handle text messages for now
    if (message.type !== 'text' || !message.text?.body) {
      return null;
    }

    return {
      messageId: message.id,
      from: message.from,
      customerName: contact?.profile?.name || message.from,
      text: message.text.body,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
    };
  } catch (error) {
    console.error('Error parsing incoming message:', error);
    return null;
  }
}

// Mark message as read
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return false;
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
}

// Send a template message (for initiating conversations after 24h)
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'ar'
): Promise<SendMessageResponse> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: 'WhatsApp credentials not configured',
    };
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } else {
      return {
        success: false,
        error: data.error?.message || 'Failed to send template message',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
