// lib/db.ts
import { Pool, types, QueryResultRow, QueryResult, PoolClient } from 'pg'

/**
 * ---------- Parsers ----------
 * 1114 = timestamp (sans TZ) -> on l'interprète en UTC
 * 1184 = timestamptz -> Date JS
 * 1700 = numeric -> string (évite les arrondis surprises)
 */
types.setTypeParser(1114, (v: string) => new Date(v + 'Z'))
types.setTypeParser(1184, (v: string) => new Date(v))
types.setTypeParser(1700, (v: string) => v)

/**
 * ---------- Choix de l'URL ----------
 * Si tu as un pooler (Supabase port 6543 / “pooler”), privilégie-le.
 * Mets l’une de ces variables dans tes env :
 * - PG_POOL_URL (recommandé si tu as un pooler)
 * - DATABASE_URL (fallback)
 */
const CONNECTION_STRING =
  process.env.PG_POOL_URL ||
  process.env.DATABASE_URL ||
  ''

if (!CONNECTION_STRING) {
  // Laisse une erreur bruyante en dev; en prod, on veut voir ça dans les logs
  console.warn('[db] Missing DATABASE_URL / PG_POOL_URL')
}

/**
 * ---------- Config Pool ----------
 * Ajuste PGPOOL_MAX si besoin (évite > 10-20 sur Supabase/Neon sans pooler).
 * keepAlive = true combat les resets côté PaaS.
 */
const POOL_MAX = Number(process.env.PGPOOL_MAX || 10)

function createPool() {
  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    max: POOL_MAX,
    idleTimeoutMillis: 30_000,        // recycle les idles
    connectionTimeoutMillis: 5_000,   // évite d'attendre trop
    keepAlive: true,                  // sockets keep-alive
    keepAliveInitialDelayMillis: 5_000,
    ssl: /localhost|127\.0\.0\.1/.test(CONNECTION_STRING) ? undefined : { rejectUnauthorized: false },
    application_name: process.env.VERCEL ? 'parcelsoftime-vercel' : 'parcelsoftime-local',
  })

  // Log les erreurs de clients idles
  pool.on('error', (err) => {
    console.error('[db] Pool idle client error:', err?.message || err)
  })

  return pool
}

/**
 * ---------- Singleton global ----------
 * Évite la multiplication de pools en dev/hot-reload & sur serverless (Node runtime).
 */
const g = globalThis as unknown as { __pgPool?: Pool }
export const pool: Pool = g.__pgPool ?? (g.__pgPool = createPool())

/**
 * ---------- Helpers ----------
 * - query() : wrapper avec mesure + slowlog + retry court
 * - withClient() : pour transactions / multi-queries atomiques
 */

type QueryOpts = {
  label?: string
  slowMs?: number
  retries?: number
  statementTimeoutMs?: number  // appliqué via SET LOCAL statement_timeout
}

const DEFAULT_SLOW_MS = Number(process.env.PG_SLOW_MS || 400) // log si > 400ms
const DEFAULT_RETRIES = 1                                     // 1 retry léger

const RETRYABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  '57P01', // admin_shutdown
  '53300', // too_many_connections
  '40001', // serialization_failure
  '55P03', // lock_not_available
])

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = [],
  opts: QueryOpts = {}
): Promise<QueryResult<T>> {
  const slowMs = opts.slowMs ?? DEFAULT_SLOW_MS
  const retries = Math.max(0, opts.retries ?? DEFAULT_RETRIES)
  const statementTimeoutMs = opts.statementTimeoutMs ?? 7000

  let lastErr: any
  for (let attempt = 0; attempt <= retries; attempt++) {
    const t0 = Date.now()
    const client = await pool.connect()
    try {
      // Sécurise la session
      // - timezone UTC (cohérence)
      // - statement_timeout court pour éviter les requêtes qui s'éternisent
      await client.query(`BEGIN`)
      await client.query(`SET LOCAL TIME ZONE 'UTC'`)
      await client.query(`SET LOCAL statement_timeout = ${Math.max(1000, statementTimeoutMs)}`)
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = 5000`)
      const res = await client.query<T>(text, params)
      await client.query(`COMMIT`)

      const dt = Date.now() - t0
      if (dt > slowMs) {
        console.warn('[db] slow query',
          { ms: dt, label: opts.label, text: trimSql(text), params: previewParams(params) }
        )
      }
      return res
    } catch (e: any) {
      await safeRollback(client)
      lastErr = e
      const code = e?.code || e?.errno || e?.name
      const retryable = RETRYABLE_CODES.has(String(code)) || RETRYABLE_CODES.has(String(e?.message || '').trim())

      console.warn('[db] query error',
        { attempt, code, retryable, label: opts.label, msg: e?.message || e }
      )

      if (!(retryable && attempt < retries)) throw e
      // backoff léger
      await sleep(150 * (attempt + 1))
    } finally {
      client.release()
    }
  }
  throw lastErr
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL TIME ZONE 'UTC'`)
    await client.query(`SET LOCAL statement_timeout = 7000`)
    await client.query(`SET LOCAL idle_in_transaction_session_timeout = 5000`)

    const out = await fn(client as any)
    await client.query('COMMIT')
    return out
  } catch (e) {
    await safeRollback(client)
    throw e
  } finally {
    client.release()
  }
}

async function safeRollback(client: any) {
  try { await client.query('ROLLBACK') } catch {}
}

function trimSql(sql: string, max = 300) {
  const s = sql.replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) + '…' : s
}
function previewParams(p: any[], max = 6) {
  const arr = (p || []).slice(0, max).map(x => (typeof x === 'string' && x.length > 60 ? x.slice(0, 57) + '…' : x))
  if (p.length > max) arr.push(`(+${p.length - max} more)`)
  return arr
}

// Petit utilitaire pour tests/healthchecks
export async function isDbHealthy(timeoutMs = 2000): Promise<boolean> {
  try {
    const c = await pool.connect()
    try {
      await c.query(`SET LOCAL statement_timeout = ${timeoutMs}`)
      await c.query('select 1')
      return true
    } finally {
      c.release()
    }
  } catch {
    return false
  }
}

// Backoff utilitaire
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
