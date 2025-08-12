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
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') global.__pgPool = pool;

// éviter un crash de Node si le pool émet 'error'
pool.on('error', (err) => {
  console.error('PG pool error:', err.message);
});
