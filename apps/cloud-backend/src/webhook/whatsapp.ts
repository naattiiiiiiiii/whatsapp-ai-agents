import type { Env } from '../index';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

export async function sendWhatsAppMessage(
  env: Env,
  to: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

export async function sendWhatsAppImage(
  env: Env,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'image',
          image: {
            link: imageUrl,
            caption: caption,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp image:', error);
    return false;
  }
}

export async function sendWhatsAppDocument(
  env: Env,
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'document',
          document: {
            link: documentUrl,
            filename: filename,
            caption: caption,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp document:', error);
    return false;
  }
}

export async function sendWhatsAppButtons(
  env: Env,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
              buttons: buttons.map(b => ({
                type: 'reply',
                reply: { id: b.id, title: b.title }
              }))
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp buttons:', error);
    return false;
  }
}
