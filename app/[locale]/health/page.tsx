// app/[locale]/health/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { headers } from 'next/headers'
import { pool } from '@/lib/db'

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


async function testMinuteRead(tsISO: string) {
  // headers() is async in Next 15
  let proto = 'https'
  let host = ''

  try {
    const h = await headers()
    proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0].trim() || 'https'
    host  = (h.get('host') ?? '').split(',')[0].trim()
  } catch {
    // ok if unavailable; we'll skip absolute fetch
  }

  const absUrl = host ? `${proto}://${host}/api/minutes/${encodeURIComponent(tsISO)}` : null

  const out: any = { tsISO }

  // 1) absolute fetch (if host computed)
  if (absUrl) {
    try {
      const r = await fetch(absUrl, { cache: 'no-store' })
      out.abs = { ok: r.ok, status: r.status, body: r.ok ? await r.json() : null }
    } catch (e:any) { out.abs = { ok:false, error: e?.message || 'fetch_err' } }
  }

  // 2) relative fetch
 
  try {
    const r = await fetch(`/api/minutes/${encodeURIComponent(tsISO)}`, { cache: 'no-store' })
    out.rel = { ok: r.ok, status: r.status, body: r.ok ? await r.json() : null }
  } catch (e:any) {
    out.rel = { ok:false, error: e?.message || 'fetch_err' }
  }


  // 3) direct DB probe
  try {
    // minute_public n'a que ts (+ created_at)
    const { rows } = await pool.query(
      `select ts from minute_public where ts=$1::timestamptz`,
      [tsISO]
    )
    if (rows.length) {
      out.db = { ok:true, source:'minute_public', id: String(rows[0].ts) }
    } else {
      const q2 = await pool.query(
        `select c.id, c.ts,
                case when c.title_public   then c.title   else null end as title,
                case when c.message_public then c.message else null end as message
          from claims c
          where c.ts = $1::timestamptz`,
        [tsISO]
      )
      if (q2.rows.length) out.db = { ok:true, source:'claims', id:String(q2.rows[0].id) }
      else out.db = { ok:false, source:'none' }
    }
  } catch (e:any) {
    out.db = { ok:false, error: e?.message || 'db_err' }
  }

  return out
}


export default async function Health(props: {
  params: Promise<{ locale: 'fr' | 'en' }>
  // ✅ Next 15 : searchParams est aussi un Promise
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await props.params // on n'a pas besoin de la valeur ici
  const sp = await props.searchParams
  const tsParam = sp?.ts
  const tsISO = Array.isArray(tsParam) ? tsParam[0] : (tsParam || '')

  const checks: Record<string, Row> = {}

  // Env (ne pas exposer les valeurs)
  checks.env_DATABASE_URL = { ok: !!process.env.DATABASE_URL }
  checks.env_STRIPE_SECRET_KEY = { ok: !!process.env.STRIPE_SECRET_KEY }
  checks.env_RESEND_API_KEY = { ok: !!process.env.RESEND_API_KEY }
  checks.env_PUBLIC_BASE = { ok: !!(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL) }

  // DB connect
  try { await pool.query('select 1'); checks.db_connect = { ok:true } }
  catch (e:any) { checks.db_connect = { ok:false, detail:e?.message } }

  // Tables
  checks.table_claims = { ok: await exists('claims') }
  checks.table_minute_public = { ok: await exists('minute_public') }
  checks.table_owners = { ok: await exists('owners') }
  checks.table_claim_custom_bg = { ok: await exists('claim_custom_bg') }

  // Trigger minute_public
  try {
    const { rows } = await pool.query(`
      select tgname
      from pg_trigger t
      join pg_class c on t.tgrelid=c.oid
      join pg_namespace n on c.relnamespace=n.oid
      where n.nspname='public'
        and c.relname='claims'
        and tgname='trg_sync_minute_public'
        and not t.tgisinternal
    `)
    checks.trigger_trg_sync_minute_public = { ok: rows.length > 0 }
  } catch (e:any) { checks.trigger_trg_sync_minute_public = { ok:false, detail:e?.message } }

  // Policy lecture minute_public (optionnelle si RLS activée)
  try {
    const { rows } = await pool.query(`
      select 1
      from pg_policies
      where schemaname='public' and tablename='minute_public' and polname='read_public_register'
    `)
    checks.policy_minute_public_read = { ok: rows.length > 0 }
  } catch (e:any) { checks.policy_minute_public_read = { ok:false, detail:e?.message } }

  // Compteurs
  const claimsCount = await countOf('claims')
  const publicCount = await countOf('minute_public')

  // Minute test
  let probeTs = tsISO
  if (!probeTs) {
    try {
      const { rows } = await pool.query(`select ts from claims order by ts desc limit 1`)
      probeTs = rows[0]?.ts ? new Date(rows[0].ts).toISOString() : ''
    } catch {}
  }
  const minuteProbe = probeTs ? await testMinuteRead(probeTs) : { note: 'Aucune ts trouvée' }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, Segoe UI, Roboto, Inter, sans-serif' }}>
      <h1>Health (locale)</h1>
      <p>Diag env/DB/tables/trigger/policies + test lecture minute via API et DB.</p>

      <h2>Environment</h2>
      <ul>
        <li><strong>DATABASE_URL</strong>: {checks.env_DATABASE_URL.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>STRIPE_SECRET_KEY</strong>: {checks.env_STRIPE_SECRET_KEY.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>RESEND_API_KEY</strong>: {checks.env_RESEND_API_KEY.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>NEXT_PUBLIC_BASE_URL|SITE_URL</strong>: {checks.env_PUBLIC_BASE.ok ? 'OK' : 'FAIL'}</li>
      </ul>

      <h2>Database</h2>
      <ul>
        <li><strong>connect</strong>: {checks.db_connect.ok ? 'OK' : `FAIL — ${checks.db_connect.detail || ''}`}</li>
        <li><strong>table: claims</strong>: {checks.table_claims.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: minute_public</strong>: {checks.table_minute_public.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: owners</strong>: {checks.table_owners.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: claim_custom_bg</strong>: {checks.table_claim_custom_bg.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>trigger trg_sync_minute_public</strong>: {checks.trigger_trg_sync_minute_public.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>policy read_public_register</strong>: {checks.policy_minute_public_read.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>claims count</strong>: {claimsCount}</li>
        <li><strong>minute_public count</strong>: {publicCount}</li>
      </ul>

      <h2>Minute probe</h2>
      <p>Ajoute <code>?ts=YYYY-MM-DDTHH:MM:00.000Z</code> à l’URL pour tester une minute précise.</p>
      <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8 }}>
        {JSON.stringify(minuteProbe, null, 2)}
      </pre>
    </main>
  )
}
