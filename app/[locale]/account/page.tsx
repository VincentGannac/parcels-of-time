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

type ClaimRow = { ts: string; title: string | null; message: string | null; cert_style: string | null }
async function listClaims(ownerId: string): Promise<ClaimRow[]> {
  try {
    const { rows } = await pool.query(
      `select to_char(date_trunc('day', ts) at time zone 'UTC', 'YYYY-MM-DD') as ts,
              title, message, cert_style
       from claims
       where owner_id = $1
       order by ts desc
       limit 200`,
      [ownerId]
    )
    return rows.map(r => ({ ts: String(r.ts), title: r.title ?? null, message: r.message ?? null, cert_style: r.cert_style ?? 'neutral' }))
  } catch { return [] }
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
    try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed.map(x => String(x)) : [] } catch { return [] }
  }
  return []
}

function ymdSafe(input: string) {
  try {
    const d = new Date(input)
    if (isNaN(d.getTime())) return String(input).slice(0, 10)
    return d.toISOString().slice(0, 10)
  } catch {
    return String(input).slice(0, 10)
  }
}

async function readMerchant(ownerId: string): Promise<MerchantRow | null> {
  const { rows } = await pool.query(
    `select stripe_account_id, charges_enabled, payouts_enabled, requirements_due
       from merchant_accounts where owner_id=$1`,
    [ownerId]
  )
  const r = rows[0]
  if (!r) return null
  return {
    stripe_account_id: r.stripe_account_id ?? null,
    charges_enabled:   !!r.charges_enabled,
    payouts_enabled:   !!r.payouts_enabled,
    requirements_due:  asStringArray(r.requirements_due),
  }
}

// 🔁 Lazy-import Stripe ici
async function syncMerchantNow(ownerId: string): Promise<MerchantRow | null> {
  const { default: Stripe } = await import('stripe')
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  const stripe = new Stripe(key as string)
  const { rows } = await pool.query(`select stripe_account_id from merchant_accounts where owner_id=$1`, [ownerId])
  const acctId = rows[0]?.stripe_account_id
  if (!acctId) return null
  const acct = await stripe.accounts.retrieve(acctId)
  await pool.query(
    `update merchant_accounts
        set charges_enabled=$2,
            payouts_enabled=$3,
            requirements_due=$4::jsonb
      where owner_id=$1`,
    [ownerId, !!acct.charges_enabled, !!acct.payouts_enabled, acct.requirements?.currently_due || []]
  )
  return {
    stripe_account_id: acct.id,
    charges_enabled: !!acct.charges_enabled,
    payouts_enabled: !!acct.payouts_enabled,
    requirements_due: (acct.requirements?.currently_due || []) as any,
  }
}

type MyListing = { id: string; ts: string; price_cents: number; currency: string; status: 'active'|'sold'|'canceled' }
async function readMyActiveListings(ownerId: string): Promise<MyListing[]> {
  try {
    const { rows } = await pool.query(
      `select id, ts, price_cents, currency, status
         from listings
        where seller_owner_id = $1
          and status = 'active'
        order by ts asc`,
      [ownerId]
    )
    return rows.map(r => ({
      id: String(r.id),
      ts: (()=>{ try { return new Date(r.ts).toISOString() } catch { return new Date(String(r.ts)).toISOString() } })(),
      price_cents: r.price_cents,
      currency: r.currency || 'EUR',
      status: r.status
    }))
  } catch { return [] }
}

export default async function Page({
  params,
  searchParams,
}: { params: Promise<Params>, searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params
  const sp = await searchParams
  const sess = await readSession()
  if (!sess) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)

  let merchant = await readMerchant(sess.ownerId)

  // ✅ Ne resynchroniser Stripe QUE sur retour d’onboarding
  const needsSync = sp?.connect === 'done'
  if (needsSync) { try { merchant = await syncMerchantNow(sess.ownerId) || merchant } catch {} }

  const claims = await listClaims(sess.ownerId)
  const listings = await readMyActiveListings(sess.ownerId)
  const year = new Date().getUTCFullYear()

  // Vignettes : badge “En vente” pour les dates listées (safe)
  const activeYmd = new Set(listings.map(l => ymdSafe(l.ts)))

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
              {/* On passe la locale au backend */}
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

          {/* Active listings */}
          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:14}}>
            <h2 style={{fontSize:18, margin:'0 0 10px'}}>
              {locale==='fr' ? 'Mes annonces actives' : 'My active listings'}
            </h2>
            {listings.length === 0 ? (
              <p style={{margin:0, opacity:.8}}>
                {locale==='fr' ? 'Aucune date en vente pour l’instant.' : 'No active listings yet.'}
              </p>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:10}}>
                {listings.map(item=>{
                  const ymd = ymdSafe(item.ts)
                  return (
                    <div key={item.id} style={{border:'1px solid var(--color-border)', borderRadius:12, padding:12, background:'rgba(255,255,255,.02)'}}>
                      <div style={{fontWeight:800, fontSize:16}}>{ymd}</div>
                      <div style={{marginTop:4, opacity:.85}}>{(item.price_cents/100).toFixed(0)} €</div>
                      <div style={{display:'flex', gap:8, marginTop:10}}>
                        <a href={`/${locale}/m/${encodeURIComponent(ymd)}`} style={{textDecoration:'none', padding:'8px 10px', borderRadius:10, border:'1px solid var(--color-border)', color:'var(--color-text)'}}>
                          {locale==='fr' ? 'Ouvrir' : 'Open'}
                        </a>
                        <form method="post" action={`/api/marketplace/listing/${item.id}/status`}>
                          <input type="hidden" name="action" value="cancel" />
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="next" value={`/${locale}/account`} />
                          <button type="submit" style={{padding:'8px 10px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'#ffb2b2'}}>
                            {locale==='fr' ? 'Retirer' : 'Cancel'}
                          </button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p style={{marginTop:10, fontSize:12, opacity:.7}}>
              {locale==='fr' ? 'Commission 10% (min 1 €) appliquée lors de la vente.' : '10% commission (min €1) on sale.'}
            </p>
          </section>
        </div>

        {/* Certificates gallery — date first */}
        <section style={{marginTop:18}}>
          <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:14}}>
            <h2 style={{fontSize:18, margin:'0 0 10px'}}>{locale === 'fr' ? 'Mes certificats' : 'My certificates'}</h2>

            {claims.length === 0 ? (
              <div style={{border:'1px dashed var(--color-border)', padding:16, borderRadius:12, opacity:.8}}>
                {locale === 'fr' ? 'Aucun certificat pour le moment.' : 'No certificates yet.'}
              </div>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                {claims.map(c => {
                  const href = `/${locale}/m/${encodeURIComponent(c.ts)}`
                  const isOnSale = activeYmd.has(c.ts)

                  return (
                    <a key={c.ts} href={href}
                      style={{
                        display:'grid',
                        gridTemplateRows:'140px auto',
                        border:'1px solid var(--color-border)',
                        borderRadius:12,
                        overflow:'hidden',
                        textDecoration:'none',
                        color:'var(--color-text)',
                        background:'rgba(255,255,255,.02)',
                        boxShadow:'var(--shadow-elev1)'
                      }}
                    >
                      {/* Vignette simple : date très lisible */}
                      <div style={{position:'relative', display:'grid', placeItems:'center', background:'linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))', borderBottom:'1px solid var(--color-border)'}}>
                        {isOnSale && (
                          <span style={{
                            position:'absolute', top:8, left:8,
                            padding:'6px 10px',
                            borderRadius:999,
                            background:'rgba(14,170,80,.18)',
                            border:'1px solid rgba(14,170,80,.4)',
                            fontSize:12
                          }}>
                            {locale==='fr' ? 'En vente' : 'On sale'}
                          </span>
                        )}
                        <div style={{textAlign:'center', lineHeight:1.06}}>
                          <div style={{fontFamily:'Fraunces, serif', fontWeight:900, fontSize:32}}>
                            {c.ts}
                          </div>
                        </div>
                      </div>

                      {/* Infos */}
                      <div style={{padding:12}}>
                        {c.title && <div style={{fontWeight:800}}>{c.title}</div>}
                        <div style={{opacity:.75, marginTop: c.title ? 6 : 0, whiteSpace:'pre-wrap', maxHeight:48, overflow:'hidden', textOverflow:'ellipsis'}}>
                          {c.message || (locale==='fr' ? 'Ouvrir le certificat' : 'Open certificate')}
                        </div>
                      </div>
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
