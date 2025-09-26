export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { headers } from 'next/headers'
import { pool } from '@/lib/db'
import { debugSessionSnapshot } from '@/lib/auth'

type Row = { ok: boolean; detail?: string }

async function exists(table: string) {
  try {
    const { rows } = await pool.query(`select to_regclass($1) as x`, [`public.${table}`])
    return !!rows?.[0]?.x
  } catch { return false }
}
async function countOf(table: string) {
  try {
    const { rows } = await pool.query(`select count(*)::int as n from public.${table}`)
    return rows[0]?.n ?? 0
  } catch { return -1 }
}
function toIsoDayUTC(input: string) {
  if (!input) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T00:00:00.000Z`
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  d.setUTCHours(0,0,0,0)
  return d.toISOString()
}

export default async function Health(props: {
  params: Promise<{ locale: 'fr' | 'en' }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await props.params
  const sp = await props.searchParams

  // --- Base URL absolue (pour tous les fetchs) ---
  const h = await headers()
  const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0].trim() || 'https'
  const host  = (h.get('host') ?? '').split(',')[0].trim()
  const base  = host ? `${proto}://${host}` : ''

  // --- Env (sans exposer les valeurs) ---
  const checks: Record<string, Row> = {}
  checks.env_DATABASE_URL       = { ok: !!process.env.DATABASE_URL }
  checks.env_STRIPE_SECRET_KEY  = { ok: !!process.env.STRIPE_SECRET_KEY }
  checks.env_RESEND_API_KEY     = { ok: !!process.env.RESEND_API_KEY }
  checks.env_PUBLIC_BASE        = { ok: !!(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL) }
  const COOKIE_DOMAIN = (process.env.COOKIE_DOMAIN || '').trim()

  // --- DB connect & tables ---
  try { await pool.query('select 1'); checks.db_connect = { ok:true } }
  catch (e:any) { checks.db_connect = { ok:false, detail:e?.message } }

  checks.table_claims         = { ok: await exists('claims') }
  checks.table_minute_public  = { ok: await exists('minute_public') }
  checks.table_owners         = { ok: await exists('owners') }
  checks.table_claim_custom_bg= { ok: await exists('claim_custom_bg') }

  // (Triggers/policies facultatifs - on n'en dépend pas strictement pour la page m/[ts])
  const claimsCount  = await countOf('claims')
  const publicCount  = await countOf('minute_public')

  // --- Jour à sonder ---
  const dayParam = (Array.isArray(sp?.day) ? sp!.day[0] : sp?.day) || (Array.isArray(sp?.ts) ? sp!.ts[0] : sp?.ts) || ''
  let probeISO = toIsoDayUTC(dayParam)
  if (!probeISO) {
    try {
      const { rows } = await pool.query(`select ts from claims order by ts desc limit 1`)
      probeISO = rows[0]?.ts ? toIsoDayUTC(rows[0].ts) : ''
    } catch {}
  }
  const probeDay = probeISO ? probeISO.slice(0,10) : ''

  // --- Auth snapshot (très utile pour le bug actuel) ---
  const authSnap = await debugSessionSnapshot()

  // --- Tests « jour » (tout en absolu) ---
  const results: any = { base, probeISO, probeDay }

  // 1) /api/verify?ts=YYYY-MM-DD
  if (base && probeDay) {
    try {
      const r = await fetch(`${base}/api/verify?ts=${encodeURIComponent(probeDay)}`, { cache:'no-store' })
      results.verify = { ok: r.ok, status: r.status, body: r.ok ? await r.json() : await r.text() }
    } catch (e:any) { results.verify = { ok:false, error: e?.message || 'fetch_err' } }
  }

  // 2) /api/cert/YYYY-MM-DD (PDF inline)
  if (base && probeDay) {
    try {
      const r = await fetch(`${base}/api/cert/${encodeURIComponent(probeDay)}`, { cache:'no-store' })
      results.cert = { ok: r.ok, status: r.status, type: r.headers.get('content-type') }
    } catch (e:any) { results.cert = { ok:false, error: e?.message || 'fetch_err' } }
  }

  // 3) DB : minute_public ou claims au niveau JOUR
  try {
    const q1 = await pool.query(`select ts from minute_public where date_trunc('day', ts) = $1::timestamptz limit 1`, [probeISO || null])
    if (q1.rows.length) {
      results.db = { ok:true, source:'minute_public', id:String(q1.rows[0].ts) }
    } else {
      const q2 = await pool.query(
        `select id, ts from claims where date_trunc('day', ts) = $1::timestamptz limit 1`,
        [probeISO || null]
      )
      results.db = q2.rows.length ? { ok:true, source:'claims', id:String(q2.rows[0].id) } : { ok:false, source:'none' }
    }
  } catch (e:any) { results.db = { ok:false, error: e?.message || 'db_err' } }

  // --- UI ---
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, Segoe UI, Roboto, Inter, sans-serif' }}>
      <h1>Health (jours)</h1>
      <p>Diag env/DB + auth + tests au <strong>jour</strong>. Paramètres&nbsp;: <code>?day=YYYY-MM-DD</code> (ou <code>?ts=…</code>).</p>

      <h2>Environment</h2>
      <ul>
        <li><strong>DATABASE_URL</strong>: {checks.env_DATABASE_URL.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>STRIPE_SECRET_KEY</strong>: {checks.env_STRIPE_SECRET_KEY.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>RESEND_API_KEY</strong>: {checks.env_RESEND_API_KEY.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>NEXT_PUBLIC_BASE_URL|SITE_URL</strong>: {checks.env_PUBLIC_BASE.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>COOKIE_DOMAIN</strong>: {COOKIE_DOMAIN || '(none)'}</li>
        <li><strong>Host</strong>: {host} — <strong>Proto</strong>: {proto}</li>
      </ul>

      <h2>Database</h2>
      <ul>
        <li><strong>connect</strong>: {checks.db_connect.ok ? 'OK' : `FAIL — ${checks.db_connect.detail || ''}`}</li>
        <li><strong>table: claims</strong>: {checks.table_claims.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: minute_public</strong>: {checks.table_minute_public.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: owners</strong>: {checks.table_owners.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: claim_custom_bg</strong>: {checks.table_claim_custom_bg.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>claims count</strong>: {claimsCount}</li>
        <li><strong>minute_public count</strong>: {publicCount}</li>
      </ul>

      <h2>Auth snapshot</h2>
      <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8 }}>
        {JSON.stringify(authSnap, null, 2)}
      </pre>

      <h2>Day probe</h2>
      <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8 }}>
        {JSON.stringify(results, null, 2)}
      </pre>
    </main>
  )
}
