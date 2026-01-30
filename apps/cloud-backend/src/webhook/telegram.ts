import type { Env } from '../index';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export async function sendTelegramMessage(
  env: Env,
  chatId: string | number,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

export async function setTelegramWebhook(env: Env, webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${webhookUrl}/telegram`,
          allowed_updates: ['message'],
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error setting Telegram webhook:', error);
    return false;
  }
}
