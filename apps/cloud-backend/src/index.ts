import { Hono } from 'hono';
import { webhookHandler, webhookVerify } from './webhook/handler';
import { createDb } from './db/turso';
import { createCache } from './db/redis';

export interface Env {
  // WhatsApp
  WHATSAPP_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_PHONE_ID: string;

  // Admin
  ADMIN_PHONE: string;

  // Groq
  GROQ_API_KEY: string;

  // Turso
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;

  // Upstash
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;

  // Local Agent
  LOCAL_AGENT_URL: string;
  LOCAL_AGENT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'whatsapp-ai-agents' }));

// WhatsApp Webhook - Verificación
app.get('/webhook', webhookVerify);

// WhatsApp Webhook - Recepción de mensajes
app.post('/webhook', webhookHandler);

// Endpoint para el agente local (polling)
app.get('/mcp/pending', async (c) => {
  const secret = c.req.header('X-Agent-Secret');
  if (secret !== c.env.LOCAL_AGENT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const cache = createCache(c.env);
  const pendingRequests = await cache.lrange('mcp:pending', 0, -1);

  return c.json({ requests: pendingRequests.map(r => JSON.parse(r)) });
});

// Endpoint para recibir respuestas del agente local
app.post('/mcp/response', async (c) => {
  const secret = c.req.header('X-Agent-Secret');
  if (secret !== c.env.LOCAL_AGENT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { requestId, result, error } = body;

  const cache = createCache(c.env);

  // Guardar respuesta
  await cache.set(`mcp:response:${requestId}`, JSON.stringify({ result, error }), { ex: 300 });

  // Remover de pendientes
  const pending = await cache.lrange('mcp:pending', 0, -1);
  for (const item of pending) {
    const parsed = JSON.parse(item);
    if (parsed.id === requestId) {
      await cache.lrem('mcp:pending', 1, item);
      break;
    }
  }

  return c.json({ success: true });
});

// Admin endpoints
app.get('/admin/users', async (c) => {
  const secret = c.req.header('X-Admin-Secret');
  if (secret !== c.env.LOCAL_AGENT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = createDb(c.env);
  const users = await db.execute('SELECT * FROM users ORDER BY created_at DESC');

  return c.json({ users: users.rows });
});

export default app;
