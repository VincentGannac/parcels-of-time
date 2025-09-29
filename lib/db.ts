// lib/db.ts
import { Pool } from 'pg'

declare global { var __pgPool: Pool | undefined }

const CONN = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL

// Important: en serverless, on garde un pool tout petit et on
// laisse PgBouncer faire le boulot. 1–3 connexions max par instance.
export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: CONN,
    // Supabase Pooler attend SSL + transaction pooling
    ssl: CONN?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    keepAlive: true,
    // Faille vite si saturé (évite LCP énormes) :
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    max: parseInt(process.env.PGPOOL_MAX || '2', 10), // 1–3 recommandé
    allowExitOnIdle: true,
  })

if (process.env.NODE_ENV !== 'production') global.__pgPool = pool

pool.on('error', (err: unknown) => {
  const e = err as { code?: string; message?: string }
  const code = e?.code ?? '(no-code)'
  const message = e?.message ?? String(err)
  console.error('PG pool error:', code, message)
})
