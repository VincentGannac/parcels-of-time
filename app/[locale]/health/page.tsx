// app/[[locale]]/health/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import Stripe from 'stripe'
import { headers } from 'next/headers'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

type Row = { ok: boolean; detail?: string }
type Json = Record<string, any>

function toIsoDayUTC(input: string) {
  if (!input) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T00:00:00.000Z`
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
async function exists(table: string) {
  try {
    const { rows } = await pool.query(`select to_regclass($1) as x`, [`public.${table}`])
    return !!rows?.[0]?.x
  } catch { return false }
}
async function hasColumn(table: string, col: string) {
  try {
    const { rows } = await pool.query(
      `select 1
         from information_schema.columns
        where table_schema='public' and table_name=$1 and column_name=$2
        limit 1`,
      [table, col]
    )
    return !!rows.length
  } catch { return false }
}
async function countOf(table: string) {
  try {
    const { rows } = await pool.query(`select count(*)::int as n from public.${table}`)
    return rows[0]?.n ?? 0
  } catch { return -1 }
}
function bytesOf(s: string) { return Buffer.byteLength(s, 'utf8') }
function estMetaRisk(payload: Json) {
  const keys = Object.keys(payload)
  const tooManyKeys = keys.length > 45
  const tooLongKey = keys.some(k => k.length > 40)
  const tooLongVal = keys.some(k => String(payload[k] ?? '').length > 500)
  const jsonStr = JSON.stringify(payload)
  const jsonBytes = bytesOf(jsonStr)
  return { keys: keys.length, tooManyKeys, tooLongKey, tooLongVal, jsonBytes, jsonPreview: jsonStr.slice(0, 1800) }
}
function unwrapStripe<T>(x: any): T {
  return (x && typeof x === 'object' && 'data' in x && x.data) ? (x.data as T) : (x as T)
}

export default async function Health(props: {
  params: Promise<{ locale?: 'fr' | 'en' }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await props.params
  const sp = await props.searchParams

  // --- Base URL ---
  const h = await headers()
  const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0].trim() || 'https'
  const host = (h.get('host') ?? '').split(',')[0].trim()
  const base = host ? `${proto}://${host}` : ''


  let accountProbe: any = null
  if (base) {
    try {
      const r = await fetch(`${base}/fr/account`, { redirect: 'manual', cache: 'no-store' })
      accountProbe = { ok: r.status >= 200 && r.status < 400, status: r.status, location: r.headers.get('location') }
    } catch (e: any) {
      accountProbe = { ok: false, error: e?.message || 'fetch_err' }
    }
  }

  // --- Env ---
  const checks: Record<string, Row> = {}
  checks.env_DATABASE_URL = { ok: !!process.env.DATABASE_URL }
  checks.env_STRIPE_SECRET_KEY = { ok: !!process.env.STRIPE_SECRET_KEY }
  checks.env_RESEND_API_KEY = { ok: !!process.env.RESEND_API_KEY }
  checks.env_PUBLIC_BASE = { ok: !!(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL) }
  const COOKIE_DOMAIN = (process.env.COOKIE_DOMAIN || '').trim()

  // --- DB core tables ---
  try { await pool.query('select 1'); checks.db_connect = { ok: true } }
  catch (e: any) { checks.db_connect = { ok: false, detail: e?.message } }

  const hasClaims = await exists('claims')
  const hasMinutePublic = await exists('minute_public')
  const hasOwners = await exists('owners')
  const hasClaimCustomBg = await exists('claim_custom_bg')
  const hasListings = await exists('listings')
  const hasMerchantAccounts = await exists('merchant_accounts')
  const hasPayloadTemp = await exists('checkout_payload_temp')
  const hasSecondarySales = await exists('secondary_sales')

  checks.table_claims = { ok: hasClaims }
  checks.table_minute_public = { ok: hasMinutePublic }
  checks.table_owners = { ok: hasOwners }
  checks.table_claim_custom_bg = { ok: hasClaimCustomBg }
  checks.table_listings = { ok: hasListings }
  checks.table_merchant_accounts = { ok: hasMerchantAccounts }
  checks.table_checkout_payload_temp = { ok: hasPayloadTemp }
  checks.table_secondary_sales = { ok: hasSecondarySales }

  const claimsCount = await countOf('claims')
  const publicCount = await countOf('minute_public')
  const listingsCount = hasListings ? await countOf('listings') : -1
  const merchantsCount = hasMerchantAccounts ? await countOf('merchant_accounts') : -1

  // --- Stripe platform ---
  let stripeInfo: any = null
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' } as any)
      const acctRaw = await stripe.accounts.retrieve()
      const acct = unwrapStripe<Stripe.Account>(acctRaw)

      // ✅ 'livemode' n'existe pas sur Account : on déduit le mode via la clé
      const key = process.env.STRIPE_SECRET_KEY || ''
      const mode = key.includes('_live_') ? 'live' : 'test'

      stripeInfo = {
        configured: true,
        mode,
        platform: {
          id: acct.id,
          charges_enabled: acct.charges_enabled,
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          default_currency: acct.default_currency,
          requirements_currently_due: acct.requirements?.currently_due ?? [],
          capabilities: acct.capabilities ?? null
        }
      }
    } catch (e: any) { stripeInfo = { configured: false, error: e?.message || String(e) } }
  } else {
    stripeInfo = { configured: false }
  }

  // --- Params de test ---
  const dayParam = (Array.isArray(sp?.day) ? sp!.day[0] : sp?.day) || (Array.isArray(sp?.ts) ? sp!.ts[0] : sp?.ts) || ''
  const listingIdParam = (Array.isArray(sp?.listing_id) ? sp!.listing_id[0] : sp?.listing_id) || ''
  const listingId = listingIdParam ? String(listingIdParam) : ''
  const wantFat = ((Array.isArray(sp?.fat) ? sp!.fat[0] : sp?.fat) || '') === '1'
  const fatChars = Math.max(0, parseInt(((Array.isArray(sp?.fatChars) ? sp!.fatChars[0] : sp?.fatChars) || '1200'), 10) || 0)
  const testRoundTrip = ((Array.isArray(sp?.roundtrip) ? sp!.roundtrip[0] : sp?.roundtrip) || '') === '1'

  let probeISO = toIsoDayUTC(dayParam)
  if (!probeISO && hasClaims) {
    try {
      const { rows } = await pool.query(`select ts from claims order by ts desc limit 1`)
      probeISO = rows[0]?.ts ? toIsoDayUTC(rows[0].ts) : ''
    } catch { /* noop */ }
  }
  const probeDay = probeISO ? probeISO.slice(0, 10) : ''

  // --- Day checks ---
  const dayResults: any = { base, probeISO, probeDay }
  if (base && probeDay) {
    try {
      const r = await fetch(`${base}/api/verify?ts=${encodeURIComponent(probeDay)}`, { cache: 'no-store' })
      dayResults.verify = { ok: r.ok, status: r.status, body: r.ok ? await r.json() : await r.text() }
    } catch (e: any) { dayResults.verify = { ok: false, error: e?.message || 'fetch_err' } }

    try {
      const r = await fetch(`${base}/api/cert/${encodeURIComponent(probeDay)}`, { cache: 'no-store' })
      dayResults.cert = { ok: r.ok, status: r.status, type: r.headers.get('content-type') }
    } catch (e: any) { dayResults.cert = { ok: false, error: e?.message || 'fetch_err' } }

    try {
      const q1 = await pool.query(`select ts from minute_public where date_trunc('day', ts) = $1::timestamptz limit 1`, [probeISO || null])
      if (q1.rows.length) {
        dayResults.db = { ok: true, source: 'minute_public', id: String(q1.rows[0].ts) }
      } else {
        const q2 = await pool.query(`select id, ts from claims where date_trunc('day', ts) = $1::timestamptz limit 1`, [probeISO || null])
        dayResults.db = q2.rows.length ? { ok: true, source: 'claims', id: String(q2.rows[0].id) } : { ok: false, source: 'none' }
      }
    } catch (e: any) { dayResults.db = { ok: false, error: e?.message || 'db_err' } }

    // preview by ts
    try {
      const r = await fetch(`${base}/api/claim/preview/by-ts/${encodeURIComponent(probeDay)}`, { cache: 'no-store' })
      dayResults.preview = { ok: r.ok, status: r.status, body: r.ok ? await r.json() : await r.text() }
    } catch (e: any) { dayResults.preview = { ok: false, error: e?.message || 'fetch_err' } }
  }

  // --- Marketplace: listing & seller ---
  let listingBlob: any = null
  let connectedAccountInfo: any = null
  if (listingId) {
    try {
      const { rows } = await pool.query(
        `select l.id, l.ts, l.price_cents, l.currency, l.status,
                m.stripe_account_id, m.charges_enabled, m.payouts_enabled, m.requirements_due
           from listings l
           join owners o on o.id = l.seller_owner_id
           join merchant_accounts m on m.owner_id = o.id
          where l.id = $1::int limit 1`,
        [listingId]
      )
      const r = rows[0]
      if (r) {
        listingBlob = {
          id: String(r.id),
          ts: new Date(r.ts).toISOString(),
          price_cents: r.price_cents,
          currency: r.currency || 'EUR',
          status: r.status,
          seller: {
            id: r.stripe_account_id,
            charges_enabled: !!r.charges_enabled,
            payouts_enabled: !!r.payouts_enabled,
            requirements_currently_due: Array.isArray(r.requirements_due) ? r.requirements_due : []
          }
        }
        if (process.env.STRIPE_SECRET_KEY && r.stripe_account_id) {
          try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' } as any)
            const acctRaw = await stripe.accounts.retrieve(r.stripe_account_id)
            const acct = unwrapStripe<Stripe.Account>(acctRaw)
            connectedAccountInfo = {
              id: acct.id,
              charges_enabled: acct.charges_enabled,
              payouts_enabled: acct.payouts_enabled,
              details_submitted: acct.details_submitted,
              default_currency: acct.default_currency,
              requirements_currently_due: acct.requirements?.currently_due ?? [],
              capabilities: acct.capabilities ?? null
            }
          } catch (e: any) {
            connectedAccountInfo = { error: e?.message || 'cannot_retrieve_connected_account' }
          }
        }
      }
    } catch (e: any) {
      listingBlob = { error: e?.message || 'db_err' }
    }
  }

  // --- Simulateurs checkout ---
  async function postJSON(url: string, body: any) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      const ct = r.headers.get('content-type') || ''
      const data = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text().catch(() => '')
      return { ok: r.ok, status: r.status, data }
    } catch (e: any) {
      return { ok: false, status: 0, data: { error: e?.message || 'fetch_failed' } }
    }
  }

  const minimalPayload = listingId ? {
    listing_id: String(listingId),
    buyer_email: 'healthcheck@parcelsoftime.com',
    locale: 'fr'
  } : null

  const fat = (() => {
    if (!listingBlob || !listingBlob.ts) return null
    const ymd = (listingBlob.ts || '').slice(0, 10)
    const att = `Ce certificat atteste que Anonyme est reconnu(e) comme propriétaire symbolique de la journée du ${ymd}. Le présent document confirme la validité et l'authenticité de cette acquisition.`
    const longMsg = ('x '.repeat(Math.ceil(fatChars / 2))).slice(0, fatChars)
    const finalMessage = [longMsg.trim(), att, 'Gifted by: Someone', '[[HIDE_OWNED_BY]]'].join('\n')
    const payload = {
      listing_id: String(listingId),
      buyer_email: 'healthcheck+fat@parcelsoftime.com',
      locale: 'fr',
      display_name: 'Anonyme',
      title: 'Titre très long (test)',
      message: finalMessage,
      link_url: '',
      cert_style: 'neutral',
      time_display: 'local+utc',
      local_date_only: '1',
      text_color: '#1A1F2A',
      title_public: '0',
      message_public: '0',
      public_registry: '0'
    }
    return { payload, risk: estMetaRisk({ ...payload, message: finalMessage }) }
  })()

  const mkResults: any = {}
  if (base && minimalPayload) {
    mkResults.minimal = await postJSON(`${base}/api/marketplace/checkout`, minimalPayload)
  }
  if (base && wantFat && fat?.payload) {
    mkResults.fat = await postJSON(`${base}/api/marketplace/checkout`, fat.payload)
  }

  // --- Round-trip DB sur checkout_payload_temp ---
  let roundtrip: any = null
  if (testRoundTrip && hasPayloadTemp) {
    const key = `health_pl_${crypto.randomUUID()}`
    const data = { kind: 'health', note: 'roundtrip', when: new Date().toISOString(), sample: { a: 1, b: 'x' } }
    const out: any = { key, steps: [] }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      try {
        await client.query(
          `insert into checkout_payload_temp(key, kind, data)
           values ($1, 'health', $2::jsonb)
           on conflict (key) do update set data = excluded.data, created_at = now()`,
          [key, JSON.stringify(data)]
        )
        out.steps.push('insert_ok')
      } catch (e: any) { out.steps.push({ insert_err: e?.message || 'insert_failed' }) }

      try {
        const { rows } = await client.query(`select key, kind, data, created_at from checkout_payload_temp where key=$1`, [key])
        out.steps.push({ select_ok: rows[0] || null })
      } catch (e: any) { out.steps.push({ select_err: e?.message || 'select_failed' }) }

      try {
        await client.query(`delete from checkout_payload_temp where key=$1`, [key])
        out.steps.push('delete_ok')
      } catch (e: any) { out.steps.push({ delete_err: e?.message || 'delete_failed' }) }

      await client.query('COMMIT')
    } catch (e: any) {
      out.error = e?.message || 'roundtrip_tx_failed'
      try { await client.query('ROLLBACK') } catch { /* noop */ }
    } finally {
      client.release()
    }
    roundtrip = out
  }

  // --- Findings ---
  const findings: string[] = []
  if (mkResults.minimal && mkResults.minimal.ok && wantFat && mkResults.fat && !mkResults.fat.ok) {
    const msg = (mkResults.fat.data?.message || mkResults.fat.data?.error || '').toString().toLowerCase()
    const risk = fat?.risk
    const looksMeta =
      msg.includes('metadata') ||
      msg.includes('value too long') ||
      (msg.includes('parameter') && msg.includes('too long')) ||
      msg.includes('invalid_request')
    if (looksMeta || (risk && (risk.tooManyKeys || risk.tooLongKey || risk.tooLongVal))) {
      findings.push('❌ Échec Marketplace uniquement avec “gros payload” → probable dépassement des contraintes metadata Stripe (clé/valeur trop longues).')
    } else {
      findings.push('⚠️ Échec Marketplace “gros payload”, cause exacte non devinée (voir message Stripe renvoyé ci-dessous).')
    }
  }
  if (hasPayloadTemp) findings.push('✅ Table checkout_payload_temp présente — payloads riches correctement déportés hors de Stripe.')
  else findings.push('❌ Table checkout_payload_temp absente — crée cette table pour stocker le payload riche et ne transmettre à Stripe qu’un payload_key.')
  if (listingBlob?.seller && (!listingBlob.seller.charges_enabled || !listingBlob.seller.payouts_enabled)) {
    findings.push('❌ Compte vendeur incomplet (charges_enabled/payouts_enabled requis pour Connect).')
  }
  if (roundtrip && roundtrip.steps?.some((s: any) => typeof s === 'object' && (s.insert_err || s.select_err || s.delete_err))) {
    findings.push('❌ Problème d’écriture/lecture/suppression sur checkout_payload_temp → vérifier RLS/droits/colonnes.')
  }

  // --- UI ---
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, Segoe UI, Roboto, Inter, sans-serif' }}>
      <h1>Health — Marketplace & Days</h1>
      <p>
        Paramètres utiles :
        {' '}<code>?day=YYYY-MM-DD</code> ou <code>?listing_id=123</code>.
        {' '}Pour tester un <em>gros payload</em> côté Marketplace, ajoute <code>&fat=1&amp;fatChars=1200</code>.
        {' '}Pour tester un round-trip DB sur <code>checkout_payload_temp</code>, ajoute <code>&roundtrip=1</code>.
      </p>

      <h2>Environment</h2>
      <ul>
        <li><strong>DATABASE_URL</strong>: {checks.env_DATABASE_URL.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>STRIPE_SECRET_KEY</strong>: {checks.env_STRIPE_SECRET_KEY.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>RESEND_API_KEY</strong>: {checks.env_RESEND_API_KEY.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>NEXT_PUBLIC_BASE_URL|SITE_URL</strong>: {checks.env_PUBLIC_BASE.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>COOKIE_DOMAIN</strong>: {(COOKIE_DOMAIN || '(none)')}</li>
        <li><strong>Host</strong>: {host} — <strong>Proto</strong>: {proto}</li>
      </ul>

      <h2>Account probe (unauthenticated)</h2>
      <pre>{JSON.stringify(accountProbe, null, 2)}</pre>

      <h2>Database</h2>
      <ul>
        <li><strong>connect</strong>: {checks.db_connect.ok ? 'OK' : `FAIL — ${checks.db_connect.detail || ''}`}</li>
        <li><strong>table: claims</strong>: {checks.table_claims.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: minute_public</strong>: {checks.table_minute_public.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: owners</strong>: {checks.table_owners.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: claim_custom_bg</strong>: {checks.table_claim_custom_bg.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: listings</strong>: {checks.table_listings.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: merchant_accounts</strong>: {checks.table_merchant_accounts.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: checkout_payload_temp</strong>: {checks.table_checkout_payload_temp.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: secondary_sales</strong>: {checks.table_secondary_sales.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>claims count</strong>: {claimsCount}</li>
        <li><strong>minute_public count</strong>: {publicCount}</li>
        <li><strong>listings count</strong>: {listingsCount}</li>
        <li><strong>merchant_accounts count</strong>: {merchantsCount}</li>
      </ul>

      <h2>Stripe — Platform</h2>
      <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(stripeInfo, null, 2)}
      </pre>

      {!!listingBlob && (
        <>
          <h2>Marketplace — Listing & Seller</h2>
          <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
            {JSON.stringify({ listing: listingBlob }, null, 2)}
          </pre>
          {!!connectedAccountInfo && (
            <>
              <h3>Stripe — Connected account</h3>
              <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
                {JSON.stringify(connectedAccountInfo, null, 2)}
              </pre>
            </>
          )}
        </>
      )}

      <h2>Day probe</h2>
      <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(dayResults, null, 2)}
      </pre>

      {minimalPayload && (
        <>
          <h2>Stripe Checkout — Marketplace (payload minimal)</h2>
          <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(mkResults.minimal, null, 2)}
          </pre>
        </>
      )}

      {wantFat && fat && (
        <>
          <h2>Stripe Checkout — Marketplace (payload “riche” façon ClientClaim)</h2>
          <p style={{ marginTop: 0 }}>Estimation du risque metadata (clé/valeur/bytes) envoyée si l’API propageait ces champs vers Stripe.</p>
          <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(fat.risk, null, 2)}
          </pre>
          <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(mkResults.fat, null, 2)}
          </pre>
        </>
      )}

      {roundtrip && (
        <>
          <h2>DB Round-trip — checkout_payload_temp</h2>
          <pre style={{ background: '#0b0e14', color: '#e6eaf2', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(roundtrip, null, 2)}
          </pre>
        </>
      )}

      <h2>Findings</h2>
      <ul>
        {findings.length ? findings.map((f, i) => <li key={i}>{f}</li>) : <li>Aucun problème évident détecté.</li>}
      </ul>

      <h2>Conseils de débogage (marketplace)</h2>
      <ul>
        <li>
          Ne passe à Stripe que <em>listing_id</em>, <em>buyer_email</em>, les paramètres Checkout et au maximum&nbsp;
          <code>metadata: {'{ listing_id, payload_key }'}</code>.
        </li>
        <li>Stocke toutes les infos éditoriales dans <code>checkout_payload_temp</code> et référence-les via <code>payload_key</code>.</li>
        <li>Cap tes longueurs (ex: <code>message</code> ≤ 500 chars) si jamais tu laisses encore transiter du texte dans <code>metadata</code>.</li>
        <li>Vérifie <em>on_behalf_of</em>, <em>transfer_data.destination</em>, <em>application_fee_amount</em> (les erreurs Stripe s’affichent ci-dessus).</li>
        <li>Utilise <code>&roundtrip=1</code> pour valider l’écriture/lecture/suppression côté Supabase sans passer par Stripe.</li>
      </ul>
    </main>
  )
}
