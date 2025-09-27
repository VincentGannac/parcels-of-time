// app/[[locale]]/health/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { headers } from 'next/headers'
import { pool } from '@/lib/db'
import { debugSessionSnapshot } from '@/lib/auth'
import Stripe from 'stripe'

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
function mask(id?: string) {
  if (!id) return ''
  if (id.length <= 6) return id
  return `${id.slice(0,4)}…${id.slice(-4)}`
}
function yn(b?: boolean) { return b ? 'YES' : 'NO' }

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

  // --- Params ---
  const dayParam =
    (Array.isArray(sp?.day) ? sp.day[0] : sp?.day) ||
    (Array.isArray(sp?.ts) ? sp.ts[0] : sp?.ts) ||
    ''
  const tryCheckout = (Array.isArray(sp?.tryCheckout) ? sp.tryCheckout[0] : sp?.tryCheckout) === '1'
  const explicitListingId = Number((Array.isArray(sp?.listing_id) ? sp!.listing_id[0] : sp?.listing_id) || 0)

  const probeISO = toIsoDayUTC(dayParam)
  const probeDay = probeISO ? probeISO.slice(0,10) : ''

  // --- Env (sans exposer les valeurs) ---
  const checks: Record<string, Row> = {}
  checks.env_DATABASE_URL       = { ok: !!process.env.DATABASE_URL }
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
  checks.env_STRIPE_SECRET_KEY  = { ok: !!STRIPE_SECRET_KEY }
  checks.env_RESEND_API_KEY     = { ok: !!process.env.RESEND_API_KEY }
  checks.env_PUBLIC_BASE        = { ok: !!(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL) }
  const COOKIE_DOMAIN = (process.env.COOKIE_DOMAIN || '').trim()
  const stripeMode = STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live'
                   : STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : '(unknown)'

  // --- DB connect & tables ---
  try { await pool.query('select 1'); checks.db_connect = { ok:true } }
  catch (e:any) { checks.db_connect = { ok:false, detail:e?.message } }

  checks.table_claims            = { ok: await exists('claims') }
  checks.table_minute_public     = { ok: await exists('minute_public') }
  checks.table_owners            = { ok: await exists('owners') }
  checks.table_claim_custom_bg   = { ok: await exists('claim_custom_bg') }
  // Marketplace & payload
  const t_listings               = await exists('listings')
  const t_merchant_accounts      = await exists('merchant_accounts')
  const t_checkout_payload_temp  = await exists('checkout_payload_temp')
  const t_custom_bg_temp         = await exists('custom_bg_temp')
  checks.table_listings               = { ok: t_listings }
  checks.table_merchant_accounts      = { ok: t_merchant_accounts }
  checks.table_checkout_payload_temp  = { ok: t_checkout_payload_temp }
  checks.table_custom_bg_temp         = { ok: t_custom_bg_temp }

  const claimsCount        = await countOf('claims')
  const publicCount        = await countOf('minute_public')
  const listingsCount      = t_listings ? await countOf('listings') : -1
  const merchantsCount     = t_merchant_accounts ? await countOf('merchant_accounts') : -1

  // --- Auth snapshot ---
  const authSnap = await debugSessionSnapshot()

  // --- Stripe platform account ---
  const stripeSummary: any = { configured: !!STRIPE_SECRET_KEY, mode: stripeMode }
  let stripe: Stripe | null = null
  if (STRIPE_SECRET_KEY) {
    try {
      stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' } as any)
      const acct = await stripe.accounts.retrieve()
      stripeSummary.platform = {
        id: mask(acct.id),
        charges_enabled: acct.charges_enabled,
        payouts_enabled: acct.payouts_enabled,
        details_submitted: acct.details_submitted,
        default_currency: (acct as any).default_currency || null,
        requirements_currently_due: (acct.requirements?.currently_due || []).slice(0,5),
        capabilities: acct.capabilities || {},
      }
    } catch (e:any) {
      stripeSummary.error = e?.message || String(e)
    }
  }

  // --- Marketplace probe : listing + seller account ---
  const marketplace: any = {}
  let listingRow: any = null
  let sellerAccountId: string | null = null

  try {
    if (explicitListingId) {
      const { rows } = await pool.query(
        `select l.*, c.owner_id as seller_owner_id, ma.stripe_account_id
           from listings l
           join claims c on c.ts = l.ts
      left join merchant_accounts ma on ma.owner_id = c.owner_id
          where l.id = $1
          limit 1`,
        [explicitListingId]
      )
      listingRow = rows[0] || null
    } else if (probeISO) {
      const { rows } = await pool.query(
        `select l.*, c.owner_id as seller_owner_id, ma.stripe_account_id
           from listings l
           join claims c on c.ts = l.ts
      left join merchant_accounts ma on ma.owner_id = c.owner_id
          where date_trunc('day', l.ts) = $1::timestamptz
          order by (l.status = 'active') desc, l.id asc
          limit 1`,
        [probeISO]
      )
      listingRow = rows[0] || null
    }
  } catch (e:any) {
    marketplace.listingError = e?.message || 'db_err'
  }

  if (listingRow) {
    sellerAccountId = listingRow?.stripe_account_id || null
    marketplace.listing = {
      id: listingRow.id,
      status: listingRow.status,
      ts: listingRow.ts,
      tsYMD: String(listingRow.ts).slice(0,10),
      price_cents: Number(listingRow.price_cents) | 0,
      currency: (listingRow.currency || '').toUpperCase(),
      seller_owner_id: String(listingRow.seller_owner_id || ''),
      has_stripe_account: !!sellerAccountId,
      stripe_account_id_masked: mask(sellerAccountId || ''),
    }
  } else {
    marketplace.listing = null
  }

  // Seller Stripe account status
  if (stripe && sellerAccountId) {
    try {
      const acc = await stripe.accounts.retrieve(sellerAccountId)
      marketplace.seller = {
        id: mask(acc.id),
        type: acc.type,
        charges_enabled: acc.charges_enabled,
        payouts_enabled: acc.payouts_enabled,
        details_submitted: acc.details_submitted,
        default_currency: (acc as any).default_currency || null,
        capabilities: acc.capabilities || {},
        requirements_currently_due: (acc.requirements?.currently_due || []).slice(0,8),
        disabled_reason: acc.requirements?.disabled_reason || null,
      }
    } catch (e:any) {
      marketplace.seller = { error: e?.message || 'stripe_fetch_err' }
    }
  }

  // --- Optional: attempt to create a Checkout Session like the marketplace route ---
  let checkoutAttempt: any = null
  if (tryCheckout && stripe && listingRow && sellerAccountId) {
    const price = Number(listingRow.price_cents) | 0
    const currency = String(listingRow.currency || 'eur').toLowerCase()
    const applicationFee = Math.max(100, Math.floor(price * 0.10))
    const ymd = (new Date(listingRow.ts)).toISOString().slice(0,10)

    try {
      const successUrl = `${base}/health?ok=1`
      const cancelUrl  = `${base}/health?canceled=1`

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: price,
            product_data: { name: `Health probe — Day ${ymd}` },
          },
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_intent_data: {
          on_behalf_of: sellerAccountId!,
          application_fee_amount: applicationFee,
          transfer_data: { destination: sellerAccountId! },
        },
        automatic_tax: { enabled: false },
      })

      checkoutAttempt = {
        ok: true,
        session_id_masked: mask(session.id || ''),
        url_present: !!session.url,
      }
    } catch (e:any) {
      // Remonter l’erreur Stripe exactement comme elle revient
      checkoutAttempt = {
        ok: false,
        name: e?.name || null,
        type: e?.type || null,
        code: e?.code || null,
        message: e?.message || String(e),
        param: e?.param || null,
        requestId: e?.requestId || null,
        raw: e?.raw || null,
      }
    }
  }

  // --- Quick diagnosis rules (what likely causes "Erreur Stripe côté serveur") ---
  const findings: string[] = []
  if (!STRIPE_SECRET_KEY) findings.push('STRIPE_SECRET_KEY absente.')
  if (stripeSummary.error) findings.push(`Erreur lecture compte plateforme Stripe: ${stripeSummary.error}`)
  if (stripeSummary.platform && !stripeSummary.platform.charges_enabled) findings.push('Compte plateforme: charges_disabled.')
  if (!t_listings) findings.push('Table listings manquante.')
  if (!t_merchant_accounts) findings.push('Table merchant_accounts manquante.')
  if (listingRow) {
    if (listingRow.status !== 'active') findings.push(`Annonce #${listingRow.id} non active.`)
    if (!sellerAccountId) findings.push('Vendeur non onboardé (stripe_account_id absent).')
    if ((Number(listingRow.price_cents) | 0) < 1) findings.push('price_cents invalide (<1).')
  } else {
    findings.push('Aucune annonce à sonder (utilise ?listing_id=… ou ?day=YYYY-MM-DD).')
  }
  if (marketplace.seller && !marketplace.seller.error) {
    const s = marketplace.seller
    if (!s.charges_enabled) findings.push('Compte vendeur: charges_disabled.')
    if (!s.payouts_enabled) findings.push('Compte vendeur: payouts_disabled.')
    const caps = s.capabilities || {}
    if (caps.card_payments && caps.card_payments !== 'active') findings.push(`Capability card_payments = ${caps.card_payments}`)
    if (caps.transfers && caps.transfers !== 'active') findings.push(`Capability transfers = ${caps.transfers}`)
    if (s.disabled_reason) findings.push(`Vendeur disabled_reason: ${s.disabled_reason}`)
  }
  if (checkoutAttempt && !checkoutAttempt.ok) {
    findings.push(`Stripe Checkout create error: ${checkoutAttempt.message || checkoutAttempt.code || 'unknown'}`)
  }

  // --- Tests « jour »
  const results: any = { base, probeISO, probeDay }
  if (base && probeDay) {
    try {
      const r = await fetch(`${base}/api/verify?ts=${encodeURIComponent(probeDay)}`, { cache:'no-store' })
      results.verify = { ok: r.ok, status: r.status, body: r.ok ? await r.json() : await r.text() }
    } catch (e:any) { results.verify = { ok:false, error: e?.message || 'fetch_err' } }
  }
  if (base && probeDay) {
    try {
      const r = await fetch(`${base}/api/cert/${encodeURIComponent(probeDay)}`, { cache:'no-store' })
      results.cert = { ok: r.ok, status: r.status, type: r.headers.get('content-type') }
    } catch (e:any) { results.cert = { ok:false, error: e?.message || 'fetch_err' } }
  }
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

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, Segoe UI, Roboto, Inter, sans-serif' }}>
      <h1>Health — Marketplace & Days</h1>
      <p>
        Paramètres utiles : <code>?day=YYYY-MM-DD</code> ou <code>?listing_id=123</code>.
        Pour tester la création d’une session Checkout (sans débit), ajoute <code>&amp;tryCheckout=1</code>.
      </p>

      <h2>Environment</h2>
      <ul>
        <li><strong>DATABASE_URL</strong>: {checks.env_DATABASE_URL.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>STRIPE_SECRET_KEY</strong>: {checks.env_STRIPE_SECRET_KEY.ok ? `OK (${stripeMode})` : 'FAIL'}</li>
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
        <li><strong>table: listings</strong>: {checks.table_listings.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: merchant_accounts</strong>: {checks.table_merchant_accounts.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: checkout_payload_temp</strong>: {checks.table_checkout_payload_temp.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>table: custom_bg_temp</strong>: {checks.table_custom_bg_temp.ok ? 'OK' : 'FAIL'}</li>
        <li><strong>claims count</strong>: {claimsCount}</li>
        <li><strong>minute_public count</strong>: {publicCount}</li>
        <li><strong>listings count</strong>: {listingsCount}</li>
        <li><strong>merchant_accounts count</strong>: {merchantsCount}</li>
      </ul>

      <h2>Stripe — Platform</h2>
      <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8 }}>
        {JSON.stringify(stripeSummary, null, 2)}
      </pre>

      <h2>Marketplace — Listing & Seller</h2>
      <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8 }}>
        {JSON.stringify({ listing: marketplace.listing, seller: marketplace.seller || null, listingError: marketplace.listingError || null }, null, 2)}
      </pre>

      {tryCheckout && (
        <>
          <h2>Stripe Checkout — Attempt (tryCheckout=1)</h2>
          <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8 }}>
            {JSON.stringify(checkoutAttempt, null, 2)}
          </pre>
          <p style={{fontSize:12, opacity:.7}}>
            Astuce: si <code>ok: false</code>, le champ <code>message</code> contient la vraie erreur Stripe.
            Les causes fréquentes : compte vendeur non onboardé, capabilities <code>card_payments/transfers</code> inactives,
            compte plateforme en mode test avec compte vendeur live (ou inversement), <code>price_cents</code> invalide.
          </p>
        </>
      )}

      <h2>Day probe</h2>
      <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8 }}>
        {JSON.stringify({ base, probeISO, probeDay, results }, null, 2)}
      </pre>

      <h2>Findings</h2>
      {findings.length ? (
        <ul>
          {findings.map((f,i)=><li key={i} style={{color:'#ffb2b2'}}>{f}</li>)}
        </ul>
      ) : (
        <p style={{color:'#0BBF6A'}}>Aucun problème évident détecté.</p>
      )}

      <hr style={{opacity:.2, margin:'24px 0'}} />

      <details>
        <summary>Conseils de débogage (marketplace)</summary>
        <ul>
          <li>Le vendeur doit avoir <code>charges_enabled</code> et la capacité <code>card_payments</code> = <code>active</code> et <code>transfers</code> = <code>active</code>.</li>
          <li>La clé Stripe utilisée doit correspondre au même <strong>mode</strong> (test vs live) que le compte connecté vendeur.</li>
          <li><code>price_cents</code> doit être &gt;= 1 et <code>currency</code> supportée.</li>
          <li>Si l’erreur Stripe mentionne <em>“on_behalf_of not allowed”</em>, vérifie le type de charge (destination/direct) et les capabilities du compte connecté.</li>
        </ul>
      </details>
    </main>
  )
}
