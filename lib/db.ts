//app/lib/db.ts
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10, // ← un peu plus de marge pour le rendu PDF en parallèle
  });

if (process.env.NODE_ENV !== 'production') global.__pgPool = pool;

pool.on('error', (err) => {
  console.error('PG pool error:', err.message);
});
