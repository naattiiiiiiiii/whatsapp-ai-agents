import type { Context } from 'hono';
import type { Env } from '../index';
import { createDb, getUserByPhone, createUser, authorizeUser, revokeUser, logMessage, initDb } from '../db/turso';
import { createCache, checkRateLimit, addToConversation, getConversationContext, queueMCPRequest, getMCPResponse } from '../db/redis';
import { routeMessage } from '../router/groq';
import { sendTelegramMessage } from './telegram';
import { generateAuthCode } from '@whatsapp-agents/shared';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

export async function telegramWebhookHandler(c: Context<{ Bindings: Env }>) {
  try {
    const update: TelegramUpdate = await c.req.json();

    // Verificar que es un mensaje de texto
    if (!update.message?.text) {
      return c.json({ status: 'no text message' });
    }

    const message = update.message;
    const chatId = message.chat.id.toString();
    const telegramUserId = `tg_${message.from.id}`;
    const messageText = message.text;
    const userName = message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : '');

    console.log(`[Telegram] Message from ${userName} (${chatId}): ${messageText}`);

    // Inicializar DB y cache
    const db = createDb(c.env);
    await initDb(db);
    const cache = createCache(c.env);

    // Rate limiting
    const withinLimit = await checkRateLimit(cache, chatId);
    if (!withinLimit) {
      await sendTelegramMessage(c.env, chatId, '⚠️ Has enviado demasiados mensajes. Espera un momento.');
      return c.json({ status: 'rate limited' });
    }

    // Verificar si es admin (por Telegram ID)
    const isAdmin = chatId === c.env.TELEGRAM_ADMIN_CHAT_ID;

    // Procesar comandos de admin
    if (isAdmin && messageText.startsWith('/')) {
      await handleAdminCommand(c.env, db, chatId, messageText);
      return c.json({ status: 'admin command processed' });
    }

    // Buscar usuario por su ID de Telegram
    let user = await getUserByPhone(db, telegramUserId);

    // Usuario nuevo - crear y enviar código
    if (!user) {
      const authCode = generateAuthCode();
      const newUser = {
        id: crypto.randomUUID(),
        phone: telegramUserId,
        name: userName,
        status: 'pending' as const,
        authCode,
        createdAt: Date.now(),
      };

      await createUser(db, newUser);

      // Notificar al usuario
      await sendTelegramMessage(
        c.env,
        chatId,
        `👋 ¡Bienvenido al Sistema de Agentes IA!\n\n` +
        `Tu código de autorización es: *${authCode}*\n\n` +
        `Comparte este código con el administrador para obtener acceso.`
      );

      // Notificar al admin si está configurado
      if (c.env.TELEGRAM_ADMIN_CHAT_ID) {
        await sendTelegramMessage(
          c.env,
          c.env.TELEGRAM_ADMIN_CHAT_ID,
          `🆕 *Nuevo usuario Telegram:*\n` +
          `👤 Nombre: ${userName}\n` +
          `🆔 ID: ${chatId}\n` +
          `🔑 Código: \`${authCode}\`\n\n` +
          `Para autorizar: \`/autorizar ${authCode} ${userName}\``
        );
      }

      return c.json({ status: 'new user created' });
    }

    // Usuario revocado
    if (user.status === 'revoked') {
      await sendTelegramMessage(c.env, chatId, '❌ Tu acceso ha sido revocado. Contacta al administrador.');
      return c.json({ status: 'user revoked' });
    }

    // Usuario pendiente
    if (user.status === 'pending') {
      await sendTelegramMessage(
        c.env,
        chatId,
        `⏳ Tu acceso está pendiente de autorización.\n\nTu código es: *${user.authCode}*`
      );
      return c.json({ status: 'user pending' });
    }

    // Usuario autorizado - procesar mensaje
    await logMessage(db, user.id, 'in', messageText);
    await addToConversation(cache, chatId, `Usuario: ${messageText}`);

    // Obtener contexto de conversación
    const conversationContext = await getConversationContext(cache, chatId);

    // Enrutar mensaje al agente apropiado usando Groq
    const routingResult = await routeMessage(c.env, messageText, conversationContext);

    if (routingResult.requiresLocalAgent) {
      // Encolar request para el agente local
      const requestId = crypto.randomUUID();
      await queueMCPRequest(cache, {
        id: requestId,
        userId: user.id,
        phone: chatId,
        platform: 'telegram',
        agent: routingResult.agent,
        tool: routingResult.tool,
        params: routingResult.params,
        timestamp: Date.now(),
      });

      // Enviar mensaje de espera
      await sendTelegramMessage(
        c.env,
        chatId,
        `${routingResult.agentEmoji} ${routingResult.agentName} está procesando tu solicitud...`
      );

      // Esperar respuesta (con timeout)
      const response = await waitForResponse(cache, requestId, 30000);

      if (response) {
        const finalResponse = await formatResponse(c.env, routingResult, response);
        await sendTelegramMessage(c.env, chatId, finalResponse);
        await logMessage(db, user.id, 'out', finalResponse, routingResult.agent, routingResult.tool);
        await addToConversation(cache, chatId, `Asistente: ${finalResponse}`);
      } else {
        await sendTelegramMessage(
          c.env,
          chatId,
          '⏱️ La operación está tardando más de lo esperado. Te notificaré cuando esté lista.'
        );
      }
    } else {
      // Respuesta directa (no requiere agente local)
      await sendTelegramMessage(c.env, chatId, routingResult.response);
      await logMessage(db, user.id, 'out', routingResult.response);
      await addToConversation(cache, chatId, `Asistente: ${routingResult.response}`);
    }

    return c.json({ status: 'processed' });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return c.json({ status: 'error', message: String(error) }, 500);
  }
}

async function handleAdminCommand(env: Env, db: ReturnType<typeof createDb>, chatId: string, command: string) {
  const parts = command.split(' ');
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/autorizar': {
      const code = parts[1];
      const name = parts.slice(2).join(' ') || 'Usuario';

      if (!code) {
        await sendTelegramMessage(env, chatId, '❌ Uso: `/autorizar <código> <nombre>`');
        return;
      }

      const user = await authorizeUser(db, code, name, chatId);
      if (user) {
        await sendTelegramMessage(env, chatId, `✅ Usuario autorizado:\n🆔 ${user.phone}\n👤 ${name}`);

        // Notificar al usuario si es de Telegram
        if (user.phone.startsWith('tg_')) {
          const userChatId = user.phone.replace('tg_', '');
          await sendTelegramMessage(
            env,
            userChatId,
            `🎉 *¡Tu acceso ha sido autorizado!*\n\n` +
            `Ahora puedes usar los siguientes agentes:\n` +
            `📁 *Archivos* - Buscar, leer y organizar archivos\n` +
            `🌐 *Web* - Buscar en Google, extraer contenido\n` +
            `📅 *Productividad* - Calendario, notas, tareas\n` +
            `💬 *Comunicación* - Email\n\n` +
            `Simplemente escribe lo que necesites.`
          );
        }
      } else {
        await sendTelegramMessage(env, chatId, '❌ Código no encontrado o ya autorizado');
      }
      break;
    }

    case '/revocar': {
      const identifier = parts[1] || '';
      if (!identifier) {
        await sendTelegramMessage(env, chatId, '❌ Uso: `/revocar <teléfono o tg_id>`');
        return;
      }

      const success = await revokeUser(db, identifier);
      if (success) {
        await sendTelegramMessage(env, chatId, `✅ Acceso revocado para ${identifier}`);
      } else {
        await sendTelegramMessage(env, chatId, '❌ Usuario no encontrado');
      }
      break;
    }

    case '/usuarios': {
      const result = await db.execute("SELECT phone, name, status FROM users ORDER BY created_at DESC LIMIT 20");
      const userList = result.rows.map(row => {
        const platform = (row.phone as string).startsWith('tg_') ? '📱TG' : '💬WA';
        const status = row.status === 'authorized' ? '✅' : row.status === 'pending' ? '⏳' : '❌';
        return `${status} ${platform} ${row.name || 'Sin nombre'}`;
      }).join('\n');

      await sendTelegramMessage(env, chatId, `👥 *Usuarios:*\n\n${userList || 'No hay usuarios'}`);
      break;
    }

    case '/start': {
      await sendTelegramMessage(
        env,
        chatId,
        `🤖 *Panel de Admin - WhatsApp AI Agents*\n\n` +
        `Comandos disponibles:\n` +
        `/autorizar <código> <nombre>` + ` - Autorizar usuario\n` +
        `/revocar <id>` + ` - Revocar acceso\n` +
        `/usuarios` + ` - Ver lista de usuarios\n` +
        `/ayuda` + ` - Ver esta ayuda`
      );
      break;
    }

    case '/ayuda':
    case '/help': {
      await sendTelegramMessage(
        env,
        chatId,
        `🔧 *Comandos de Admin:*\n\n` +
        `\`/autorizar <código> <nombre>\` - Autorizar usuario\n` +
        `\`/revocar <id>\` - Revocar acceso\n` +
        `\`/usuarios\` - Ver lista de usuarios\n` +
        `\`/ayuda\` - Ver esta ayuda`
      );
      break;
    }

    default:
      await sendTelegramMessage(env, chatId, '❌ Comando no reconocido. Usa `/ayuda`');
  }
}

async function waitForResponse(cache: ReturnType<typeof createCache>, requestId: string, timeoutMs: number): Promise<object | null> {
  const startTime = Date.now();
  const pollInterval = 1000;

  while (Date.now() - startTime < timeoutMs) {
    const response = await getMCPResponse(cache, requestId);
    if (response) {
      return response;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return null;
}

async function formatResponse(env: Env, routingResult: any, agentResponse: any): Promise<string> {
  if (agentResponse.error) {
    return `❌ Error: ${agentResponse.error}`;
  }

  // Usar Groq para formatear la respuesta de manera amigable
  const Groq = (await import('groq-sdk')).default;
  const groq = new Groq({ apiKey: env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `Eres un asistente que formatea respuestas para Telegram.
                  Convierte los datos técnicos en mensajes claros y concisos.
                  Usa emojis apropiados. Usa *negrita* para destacar.
                  Mantén el mensaje corto (máx 500 caracteres).
                  El agente ${routingResult.agentName} (${routingResult.agentEmoji}) ejecutó: ${routingResult.tool}`
      },
      {
        role: 'user',
        content: `Formatea esta respuesta para el usuario:\n${JSON.stringify(agentResponse.result)}`
      }
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content || `${routingResult.agentEmoji} Operación completada`;
}
