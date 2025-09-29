// app/[locale]/account/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import { pool } from '@/lib/db'

type Params = { locale: 'fr' | 'en' }

const TOKENS = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-border': '#1E2A3C',
  '--shadow-elev1': '0 6px 20px rgba(0,0,0,.35)',
} as const

/** ----- Utils ----- */
function ymdSafe(input: string) {
  try {
    const d = new Date(input)
    if (isNaN(d.getTime())) return String(input).slice(0, 10)
    return d.toISOString().slice(0, 10)
  } catch {
    return String(input).slice(0, 10)
  }
}
function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 2): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e: any) {
      lastErr = e
      // petite pause pour laisser le pool respirer
      await new Promise(r => setTimeout(r, 80))
    }
  }
  console.error(`[account] ${label} failed after ${attempts} attempts:`, lastErr?.message || lastErr)
  throw lastErr
}

/** ----- Queries (allégées) ----- */
type ClaimDateRow = { ymd: string }
async function listClaimDays(ownerId: string): Promise<ClaimDateRow[]> {
  try {
    return await withRetry(async () => {
      const { rows } = await pool.query(
        `select to_char(date_trunc('day', ts) at time zone 'UTC', 'YYYY-MM-DD') as ymd
           from claims
          where owner_id = $1
          order by ts desc
          limit 200`,
        [ownerId]
      )
      return rows.map(r => ({ ymd: String(r.ymd) }))
    }, 'listClaimDays')
  } catch {
    return []
  }
}

type ListingDayRow = { ymd: string }
async function listMyActiveListingDays(ownerId: string): Promise<ListingDayRow[]> {
  try {
    return await withRetry(async () => {
      const { rows } = await pool.query(
        `select to_char(date_trunc('day', ts) at time zone 'UTC', 'YYYY-MM-DD') as ymd
           from listings
          where seller_owner_id = $1
            and status = 'active'
          order by ts asc`,
        [ownerId]
      )
      return rows.map(r => ({ ymd: String(r.ymd) }))
    }, 'listMyActiveListingDays')
  } catch {
    return []
  }
}

type MerchantRow = {
  stripe_account_id: string | null
  charges_enabled: boolean | null
  payouts_enabled: boolean | null
  requirements_due: string[] | null
}
function asStringArray(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(x => String(x))
  if (typeof v === 'string') {
    try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed.map(String) : [] } catch { return [] }
  }
  return []
}
async function readMerchant(ownerId: string): Promise<MerchantRow | null> {
  try {
    return await withRetry(async () => {
      const { rows } = await pool.query(
        `select stripe_account_id, charges_enabled, payouts_enabled, requirements_due
           from merchant_accounts where owner_id=$1`,
        [ownerId]
      )
      const r = rows[0]
      if (!r) return null
      return {
        stripe_account_id: r.stripe_account_id ?? null,
        charges_enabled: !!r.charges_enabled,
        payouts_enabled: !!r.payouts_enabled,
        requirements_due: asStringArray(r.requirements_due),
      }
    }, 'readMerchant')
  } catch {
    return null
  }
}

// 🔁 Resync Stripe uniquement si retour d’onboarding (cast JSONB correct)
async function syncMerchantNow(ownerId: string): Promise<MerchantRow | null> {
  try {
    const { default: Stripe } = await import('stripe')
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return null
    const stripe = new Stripe(key as string)

    const { rows } = await pool.query(
      `select stripe_account_id from merchant_accounts where owner_id=$1`,
      [ownerId]
    )
    const acctId = rows[0]?.stripe_account_id
    if (!acctId) return null

    const acct = await stripe.accounts.retrieve(acctId)
    await pool.query(
      `update merchant_accounts
          set charges_enabled=$2,
              payouts_enabled=$3,
              requirements_due=$4::jsonb
        where owner_id=$1`,
      [
        ownerId,
        !!acct.charges_enabled,
        !!acct.payouts_enabled,
        JSON.stringify(acct.requirements?.currently_due || []),
      ]
    )
    return {
      stripe_account_id: acct.id,
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      requirements_due: (acct.requirements?.currently_due || []) as any,
    }
  } catch (e: any) {
    console.error('[account] syncMerchantNow inner failed:', e?.message)
    return null
  }
}

/** ----- Page ----- */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>,
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale: rawLocale } = await params
  const locale: 'fr' | 'en' = rawLocale === 'fr' ? 'fr' : 'en'
  const sp = await searchParams

  // Session robuste
  let sess: Awaited<ReturnType<typeof readSession>> | null = null
  try { sess = await readSession() } catch (e: any) { console.error('[account] readSession threw:', e?.message) }
  if (!sess) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)

  // Chargements parallèles et légers
  const [claimsRes, listingsRes, merchantRes] = await Promise.allSettled([
    listClaimDays(sess.ownerId),
    listMyActiveListingDays(sess.ownerId),
    readMerchant(sess.ownerId),
  ])
  let claims = claimsRes.status === 'fulfilled' ? claimsRes.value : []
  let listingDays = listingsRes.status === 'fulfilled' ? listingsRes.value : []
  let merchant = merchantRes.status === 'fulfilled' ? merchantRes.value : null

  // Resync Stripe si retour onboarding
  const connectParam = firstString(sp?.connect)
  if (connectParam === 'done') {
    try { merchant = await syncMerchantNow(sess.ownerId) || merchant } catch (e: any) {
      console.error('[account] syncMerchantNow failed:', e?.message)
    }
  }

  const year = new Date().getUTCFullYear()

  return (
    <main
      style={{
        ['--color-bg' as any]: TOKENS['--color-bg'],
        ['--color-surface' as any]: TOKENS['--color-surface'],
        ['--color-text' as any]: TOKENS['--color-text'],
        ['--color-muted' as any]: TOKENS['--color-muted'],
        ['--color-primary' as any]: TOKENS['--color-primary'],
        ['--color-on-primary' as any]: TOKENS['--color-on-primary'],
        ['--color-border' as any]: TOKENS['--color-border'],
        ['--shadow-elev1' as any]: TOKENS['--shadow-elev1'],
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui',
      }}
    >
      <section style={{maxWidth: 1100, margin: '0 auto', padding: '32px 20px'}}>
        {/* Header */}
        <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 18}}>
          <a href={`/${locale}`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; Parcels of Time</a>
          <form method="post" action="/api/auth/logout">
            <button style={{padding:'10px 14px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', cursor:'pointer'}}>Log out</button>
          </form>
        </header>

        {/* Identity */}
        <h1 style={{fontFamily:'Fraunces, serif', fontSize:36, margin:'0 0 6px'}}>
          {locale === 'fr' ? 'Mon compte' : 'My account'}
        </h1>
        <p style={{opacity:.8, marginTop:0}}>
          {sess.displayName ? `${sess.displayName} — ` : ''}{sess.email}
        </p>

        {/* Grid: merchant + listings */}
        <div style={{display:'grid', gridTemplateColumns:'1fr', gap:18, marginTop:18}}>
          {/* Merchant card */}
          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:14, display:'grid', gap:12}}>
            <h2 style={{fontSize:18, margin:'0 0 2px'}}>
              {locale==='fr' ? 'Compte marchand' : 'Merchant account'}
            </h2>

            <div style={{background:'rgba(255,235,186,.08)', border:'1px solid rgba(245,227,161,.26)', borderRadius:10, padding:'10px 12px', fontSize:13, lineHeight:1.35}}>
              {locale==='fr'
                ? <>Vous vendez en tant que <strong>particulier</strong> ? C’est autorisé pour des ventes occasionnelles. Si vous vendez régulièrement ou pour en tirer un revenu, vous devez vous <strong>déclarer (micro-entrepreneur, BIC)</strong>.</>
                : <>Selling as an <strong>individual</strong>? Occasional sales are fine. If sales are regular or for profit, you must <strong>register as a business</strong>.</>}
            </div>

            {merchant ? (
              <div style={{display:'grid', gap:6}}>
                <div>Stripe: <code>{merchant.stripe_account_id}</code></div>
                <div>Charges: <strong>{merchant.charges_enabled ? '✅' : '❌'}</strong> — Payouts: <strong>{merchant.payouts_enabled ? '✅' : '❌'}</strong></div>
                {Array.isArray(merchant.requirements_due) && merchant.requirements_due.length > 0 && (
                  <div style={{fontSize:13, color:'#ffb2b2'}}>
                    {locale==='fr' ? 'Éléments requis' : 'Required info'}: {merchant.requirements_due.join(', ')}
                  </div>
                )}
                <form method="post" action="/api/connect/sync">
                  <button style={{padding:'8px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)'}}>
                    {locale==='fr' ? 'Rafraîchir statut' : 'Refresh status'}
                  </button>
                </form>
              </div>
            ) : (
              <p style={{margin:0, opacity:.85}}>
                {locale==='fr' ? 'Pour revendre vos certificats, créez un compte vendeur.' : 'Create a seller account to resell your certificates.'}
              </p>
            )}

            {/* Onboarding selector */}
            <form method="post" action="/api/connect/onboard" style={{display:'grid', gap:10}}>
              <input type="hidden" name="locale" value={locale} />
              <fieldset style={{border:'1px solid var(--color-border)', borderRadius:10, padding:12}}>
                <legend style={{padding:'0 6px'}}>
                  {locale==='fr' ? 'Je vends en tant que :' : 'I sell as:'}
                </legend>
                <label style={{display:'inline-flex', alignItems:'center', gap:8, marginRight:16}}>
                  <input type="radio" name="seller_kind" value="individual" defaultChecked />
                  {locale==='fr' ? 'Particulier' : 'Individual'}
                </label>
                <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <input type="radio" name="seller_kind" value="company" />
                  {locale==='fr' ? 'Professionnel' : 'Business'}
                </label>
                <div style={{fontSize:12, opacity:.75, marginTop:8}}>
                  {locale==='fr'
                    ? 'En “Particulier”, nous pré-remplissons secteur & site pour accélérer l’inscription. Stripe demandera identité + IBAN.'
                    : 'With “Individual”, we prefill industry & website. Stripe will ask for identity + IBAN.'}
                </div>
              </fieldset>

              <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                <button style={{padding:'10px 14px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-primary)', color:'var(--color-on-primary)', cursor:'pointer', fontWeight:800}}>
                  {merchant ? (locale==='fr' ? 'Mettre à jour / compléter' : 'Update / complete') : (locale==='fr' ? 'Devenir vendeur' : 'Become a seller')}
                </button>
                <a
                  href={`/api/reports/sales?year=${year}&format=csv`}
                  style={{textDecoration:'none', padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, color:'var(--color-text)'}}
                >
                  {locale==='fr' ? `Récapitulatif ${year} (CSV)` : `${year} recap (CSV)`}
                </a>
                <a
                  href={`/api/reports/sales?year=${year}&format=json`}
                  style={{textDecoration:'none', padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, color:'var(--color-text)', opacity:.85}}
                >
                  JSON
                </a>
              </div>
            </form>
          </section>

          {/* Active listings — only dates → /m/YYYY-MM-DD */}
          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:14}}>
            <h2 style={{fontSize:18, margin:'0 0 10px'}}>
              {locale==='fr' ? 'Mes annonces actives' : 'My active listings'}
            </h2>

            {listingDays.length === 0 ? (
              <p style={{margin:0, opacity:.8}}>
                {locale==='fr' ? 'Aucune date en vente pour l’instant.' : 'No active listings yet.'}
              </p>
            ) : (
              <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                {listingDays.map(d => {
                  const ymd = ymdSafe(d.ymd)
                  return (
                    <a key={ymd} href={`/${locale}/m/${encodeURIComponent(ymd)}`}
                      style={{
                        textDecoration:'none',
                        padding:'8px 12px',
                        borderRadius:10,
                        border:'1px solid var(--color-border)',
                        background:'rgba(255,255,255,.02)',
                        color:'var(--color-text)',
                        fontWeight:700
                      }}
                    >
                      {ymd}
                    </a>
                  )
                })}
              </div>
            )}

            <p style={{marginTop:10, fontSize:12, opacity:.7}}>
              {locale==='fr' ? 'Commission 10% (min 1 €) appliquée lors de la vente.' : '10% commission (min €1) on sale.'}
            </p>
          </section>
        </div>

        {/* Certificates — only dates → /m/YYYY-MM-DD */}
        <section style={{marginTop:18}}>
          <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:14}}>
            <h2 style={{fontSize:18, margin:'0 0 10px'}}>{locale === 'fr' ? 'Mes certificats' : 'My certificates'}</h2>

            {claims.length === 0 ? (
              <div style={{border:'1px dashed var(--color-border)', padding:16, borderRadius:12, opacity:.8}}>
                {locale === 'fr' ? 'Aucun certificat pour le moment.' : 'No certificates yet.'}
              </div>
            ) : (
              <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                {claims.map(c => {
                  const ymd = ymdSafe(c.ymd)
                  return (
                    <a key={ymd} href={`/${locale}/m/${encodeURIComponent(ymd)}`}
                      style={{
                        textDecoration:'none',
                        padding:'10px 14px',
                        borderRadius:10,
                        border:'1px solid var(--color-border)',
                        background:'rgba(255,255,255,.02)',
                        color:'var(--color-text)',
                        fontWeight:800
                      }}
                    >
                      {ymd}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
