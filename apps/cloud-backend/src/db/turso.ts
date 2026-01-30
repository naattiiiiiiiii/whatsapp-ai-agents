import { createClient, type Client } from '@libsql/client/web';
import type { Env } from '../index';
import type { User } from '@whatsapp-agents/shared';

let dbClient: Client | null = null;

export function createDb(env: Env): Client {
  if (!dbClient) {
    dbClient = createClient({
      url: env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
  }
  return dbClient;
}

// Inicializar tablas
export async function initDb(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      status TEXT DEFAULT 'pending',
      auth_code TEXT,
      created_at INTEGER NOT NULL,
      authorized_at INTEGER,
      authorized_by TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      agent TEXT,
      tool TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      due_date TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      remind_at INTEGER NOT NULL,
      sent INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

// Funciones de usuario
export async function getUserByPhone(db: Client, phone: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE phone = ?',
    args: [phone]
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    phone: row.phone as string,
    name: row.name as string,
    status: row.status as User['status'],
    authCode: row.auth_code as string | undefined,
    createdAt: row.created_at as number,
    authorizedAt: row.authorized_at as number | undefined,
    authorizedBy: row.authorized_by as string | undefined,
  };
}

export async function createUser(db: Client, user: User): Promise<void> {
  await db.execute({
    sql: `INSERT INTO users (id, phone, name, status, auth_code, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [user.id, user.phone, user.name, user.status, user.authCode, user.createdAt]
  });
}

export async function authorizeUser(db: Client, authCode: string, name: string, adminPhone: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE auth_code = ? AND status = ?',
    args: [authCode, 'pending']
  });

  if (result.rows.length === 0) return null;

  const now = Date.now();
  await db.execute({
    sql: `UPDATE users SET status = ?, name = ?, authorized_at = ?, authorized_by = ?, auth_code = NULL
          WHERE auth_code = ?`,
    args: ['authorized', name, now, adminPhone, authCode]
  });

  return getUserByPhone(db, result.rows[0].phone as string);
}

export async function revokeUser(db: Client, phone: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'UPDATE users SET status = ? WHERE phone = ?',
    args: ['revoked', phone]
  });

  return result.rowsAffected > 0;
}

export async function getUserByAuthCode(db: Client, code: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE auth_code = ?',
    args: [code]
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    phone: row.phone as string,
    name: row.name as string,
    status: row.status as User['status'],
    authCode: row.auth_code as string | undefined,
    createdAt: row.created_at as number,
    authorizedAt: row.authorized_at as number | undefined,
    authorizedBy: row.authorized_by as string | undefined,
  };
}

export async function logMessage(
  db: Client,
  userId: string,
  direction: 'in' | 'out',
  content: string,
  agent?: string,
  tool?: string
): Promise<void> {
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO messages (id, user_id, direction, content, agent, tool, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, userId, direction, content, agent || null, tool || null, Date.now()]
  });
}
