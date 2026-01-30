import { Redis } from '@upstash/redis/cloudflare';
import type { Env } from '../index';

export function createCache(env: Env): Redis {
  return new Redis({
    url: env.UPSTASH_REDIS_URL,
    token: env.UPSTASH_REDIS_TOKEN,
  });
}

export interface CacheOperations {
  // Rate limiting
  checkRateLimit(phone: string, limit: number, windowSeconds: number): Promise<boolean>;

  // Conversation context
  getConversationContext(phone: string): Promise<string[]>;
  addToConversation(phone: string, message: string): Promise<void>;

  // MCP queue
  queueMCPRequest(request: object): Promise<void>;
  getMCPResponse(requestId: string): Promise<object | null>;
}

export async function checkRateLimit(
  cache: Redis,
  phone: string,
  limit: number = 30,
  windowSeconds: number = 60
): Promise<boolean> {
  const key = `ratelimit:${phone}`;
  const current = await cache.incr(key);

  if (current === 1) {
    await cache.expire(key, windowSeconds);
  }

  return current <= limit;
}

export async function getConversationContext(cache: Redis, phone: string): Promise<string[]> {
  const key = `conversation:${phone}`;
  const messages = await cache.lrange(key, -10, -1); // Últimos 10 mensajes
  return messages as string[];
}

export async function addToConversation(cache: Redis, phone: string, message: string): Promise<void> {
  const key = `conversation:${phone}`;
  await cache.rpush(key, message);
  await cache.ltrim(key, -20, -1); // Mantener solo últimos 20
  await cache.expire(key, 3600); // Expira en 1 hora
}

export async function queueMCPRequest(cache: Redis, request: object): Promise<void> {
  await cache.rpush('mcp:pending', JSON.stringify(request));
}

export async function getMCPResponse(cache: Redis, requestId: string): Promise<object | null> {
  const key = `mcp:response:${requestId}`;
  const response = await cache.get(key);
  if (response) {
    await cache.del(key);
    return typeof response === 'string' ? JSON.parse(response) : response;
  }
  return null;
}
