import type { Context } from 'hono';
import type { Env } from '../index';
import { createDb, getUserByPhone, createUser, authorizeUser, revokeUser, logMessage, initDb } from '../db/turso';
import { createCache, checkRateLimit, addToConversation, getConversationContext, queueMCPRequest, getMCPResponse } from '../db/redis';
import { routeMessage } from '../router/groq';
import { sendWhatsAppMessage } from './whatsapp';
import { generateAuthCode, formatPhone } from '@whatsapp-agents/shared';

// Verificación del webhook (GET)
export async function webhookVerify(c: Context<{ Bindings: Env }>) {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified');
    return c.text(challenge || '');
  }

  return c.text('Forbidden', 403);
}

// Recepción de mensajes (POST)
export async function webhookHandler(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json();

    // Verificar estructura del mensaje
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return c.json({ status: 'no messages' });
    }

    const message = messages[0];
    const phone = formatPhone(message.from);
    const messageId = message.id;
    const messageText = message.text?.body || '';

    console.log(`Message from ${phone}: ${messageText}`);

    // Inicializar DB y cache
    const db = createDb(c.env);
    await initDb(db);
    const cache = createCache(c.env);

    // Rate limiting
    const withinLimit = await checkRateLimit(cache, phone);
    if (!withinLimit) {
      await sendWhatsAppMessage(c.env, phone, '⚠️ Has enviado demasiados mensajes. Espera un momento.');
      return c.json({ status: 'rate limited' });
    }

    // Verificar si es admin
    const isAdmin = phone === formatPhone(c.env.ADMIN_PHONE);

    // Procesar comandos de admin
    if (isAdmin && messageText.startsWith('/')) {
      await handleAdminCommand(c.env, db, phone, messageText);
      return c.json({ status: 'admin command processed' });
    }

    // Buscar usuario
    let user = await getUserByPhone(db, phone);

    // Usuario nuevo - crear y enviar código
    if (!user) {
      const authCode = generateAuthCode();
      const newUser = {
        id: crypto.randomUUID(),
        phone,
        name: '',
        status: 'pending' as const,
        authCode,
        createdAt: Date.now(),
      };

      await createUser(db, newUser);

      // Notificar al usuario
      await sendWhatsAppMessage(
        c.env,
        phone,
        `👋 ¡Bienvenido al Sistema de Agentes IA!\n\n` +
        `Tu código de autorización es: *${authCode}*\n\n` +
        `Comparte este código con el administrador para obtener acceso.`
      );

      // Notificar al admin
      await sendWhatsAppMessage(
        c.env,
        c.env.ADMIN_PHONE,
        `🆕 Nuevo usuario pendiente:\n` +
        `📱 Teléfono: ${phone}\n` +
        `🔑 Código: ${authCode}\n\n` +
        `Para autorizar: /autorizar ${authCode} <nombre>`
      );

      return c.json({ status: 'new user created' });
    }

    // Usuario revocado
    if (user.status === 'revoked') {
      await sendWhatsAppMessage(
        c.env,
        phone,
        '❌ Tu acceso ha sido revocado. Contacta al administrador.'
      );
      return c.json({ status: 'user revoked' });
    }

    // Usuario pendiente
    if (user.status === 'pending') {
      await sendWhatsAppMessage(
        c.env,
        phone,
        `⏳ Tu acceso está pendiente de autorización.\n\n` +
        `Tu código es: *${user.authCode}*\n\n` +
        `Compártelo con el administrador.`
      );
      return c.json({ status: 'user pending' });
    }

    // Usuario autorizado - procesar mensaje
    await logMessage(db, user.id, 'in', messageText);
    await addToConversation(cache, phone, `Usuario: ${messageText}`);

    // Obtener contexto de conversación
    const conversationContext = await getConversationContext(cache, phone);

    // Enrutar mensaje al agente apropiado usando Groq
    const routingResult = await routeMessage(c.env, messageText, conversationContext);

    if (routingResult.requiresLocalAgent) {
      // Encolar request para el agente local
      const requestId = crypto.randomUUID();
      await queueMCPRequest(cache, {
        id: requestId,
        userId: user.id,
        phone,
        agent: routingResult.agent,
        tool: routingResult.tool,
        params: routingResult.params,
        timestamp: Date.now(),
      });

      // Enviar mensaje de espera
      await sendWhatsAppMessage(
        c.env,
        phone,
        `${routingResult.agentEmoji} ${routingResult.agentName} está procesando tu solicitud...`
      );

      // Esperar respuesta (con timeout)
      const response = await waitForResponse(cache, requestId, 30000);

      if (response) {
        const finalResponse = await formatResponse(c.env, routingResult, response);
        await sendWhatsAppMessage(c.env, phone, finalResponse);
        await logMessage(db, user.id, 'out', finalResponse, routingResult.agent, routingResult.tool);
        await addToConversation(cache, phone, `Asistente: ${finalResponse}`);
      } else {
        await sendWhatsAppMessage(
          c.env,
          phone,
          '⏱️ La operación está tardando más de lo esperado. Te notificaré cuando esté lista.'
        );
      }
    } else {
      // Respuesta directa (no requiere agente local)
      await sendWhatsAppMessage(c.env, phone, routingResult.response);
      await logMessage(db, user.id, 'out', routingResult.response);
      await addToConversation(cache, phone, `Asistente: ${routingResult.response}`);
    }

    return c.json({ status: 'processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ status: 'error', message: String(error) }, 500);
  }
}

async function handleAdminCommand(env: Env, db: ReturnType<typeof createDb>, adminPhone: string, command: string) {
  const parts = command.split(' ');
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/autorizar': {
      const code = parts[1];
      const name = parts.slice(2).join(' ') || 'Usuario';

      if (!code) {
        await sendWhatsAppMessage(env, adminPhone, '❌ Uso: /autorizar <código> <nombre>');
        return;
      }

      const user = await authorizeUser(db, code, name, adminPhone);
      if (user) {
        await sendWhatsAppMessage(
          env,
          adminPhone,
          `✅ Usuario autorizado:\n📱 ${user.phone}\n👤 ${name}`
        );
        await sendWhatsAppMessage(
          env,
          user.phone,
          `🎉 ¡Tu acceso ha sido autorizado!\n\n` +
          `Ahora puedes usar los siguientes agentes:\n` +
          `📁 *Archivos* - Buscar, leer y organizar archivos\n` +
          `🌐 *Web* - Buscar en Google, extraer contenido\n` +
          `📅 *Productividad* - Calendario, notas, tareas\n` +
          `💬 *Comunicación* - Email\n\n` +
          `Simplemente escribe lo que necesites y el sistema elegirá el agente adecuado.`
        );
      } else {
        await sendWhatsAppMessage(env, adminPhone, '❌ Código no encontrado o ya autorizado');
      }
      break;
    }

    case '/revocar': {
      const phone = formatPhone(parts[1] || '');
      if (!phone) {
        await sendWhatsAppMessage(env, adminPhone, '❌ Uso: /revocar <teléfono>');
        return;
      }

      const success = await revokeUser(db, phone);
      if (success) {
        await sendWhatsAppMessage(env, adminPhone, `✅ Acceso revocado para ${phone}`);
      } else {
        await sendWhatsAppMessage(env, adminPhone, '❌ Usuario no encontrado');
      }
      break;
    }

    case '/usuarios': {
      const result = await db.execute("SELECT phone, name, status FROM users ORDER BY created_at DESC LIMIT 20");
      const userList = result.rows.map(row =>
        `${row.status === 'authorized' ? '✅' : row.status === 'pending' ? '⏳' : '❌'} ${row.phone} - ${row.name || 'Sin nombre'}`
      ).join('\n');

      await sendWhatsAppMessage(
        env,
        adminPhone,
        `👥 *Usuarios*:\n\n${userList || 'No hay usuarios'}`
      );
      break;
    }

    case '/ayuda': {
      await sendWhatsAppMessage(
        env,
        adminPhone,
        `🔧 *Comandos de Admin*:\n\n` +
        `/autorizar <código> <nombre> - Autorizar usuario\n` +
        `/revocar <teléfono> - Revocar acceso\n` +
        `/usuarios - Ver lista de usuarios\n` +
        `/ayuda - Ver esta ayuda`
      );
      break;
    }

    default:
      await sendWhatsAppMessage(env, adminPhone, '❌ Comando no reconocido. Usa /ayuda');
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
        content: `Eres un asistente que formatea respuestas para WhatsApp.
                  Convierte los datos técnicos en mensajes claros y concisos.
                  Usa emojis apropiados. Mantén el mensaje corto (máx 500 caracteres).
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
