// app/[locale]/account/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import { pool } from '@/lib/db'
import Stripe from 'stripe'

type Params = { locale: 'fr' | 'en' }

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
    return rows.map(r => ({ ts: String(r.ts), title: r.title ?? null, message: r.message ?? null, cert_style: r.cert_style ?? null }))
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
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed.map(x => String(x)) : []
    } catch { return [] }
  }
  return []
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

async function syncMerchantNow(ownerId: string): Promise<MerchantRow | null> {
  const { rows } = await pool.query(`select stripe_account_id from merchant_accounts where owner_id=$1`, [ownerId])
  const acctId = rows[0]?.stripe_account_id
  if (!acctId) return null
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
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

  const needsSync =
    sp?.connect === 'done' ||
    (merchant && (
      !merchant.charges_enabled ||
      !merchant.payouts_enabled ||
      (Array.isArray(merchant.requirements_due) && merchant.requirements_due.length > 0)
    ))

  if (needsSync) {
    try { merchant = await syncMerchantNow(sess.ownerId) || merchant } catch {}
  }

  const claims = await listClaims(sess.ownerId)
  const listings = await readMyActiveListings(sess.ownerId)

  const year = new Date().getUTCFullYear()

  return (
    <main style={{maxWidth: 900, margin: '0 auto', padding: '32px 20px', fontFamily: 'Inter, system-ui'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 18}}>
        <a href={`/${locale}`} style={{textDecoration:'none', opacity:.85}}>&larr; Parcels of Time</a>
        <form method="post" action="/api/auth/logout">
          <button style={{padding:'10px 14px', borderRadius:10, border:'1px solid #ddd', cursor:'pointer'}}>Log out</button>
        </form>
      </header>

      <h1 style={{fontFamily:'Fraunces, serif', fontSize:36, margin:'0 0 6px'}}>
        {locale === 'fr' ? 'Mon compte' : 'My account'}
      </h1>
      <p style={{opacity:.8, marginTop:0}}>
        {sess.displayName ? `${sess.displayName} — ` : ''}{sess.email}
      </p>

      <section style={{marginTop:18}}>
        <h2 style={{fontSize:18, margin:'0 0 10px'}}>
          {locale==='fr' ? 'Compte marchand' : 'Merchant account'}
        </h2>

        <div style={{border:'1px solid #eee', borderRadius:12, padding:14, display:'grid', gap:10}}>
          {/* Bandeau d'info “Particulier vs Professionnel” */}
          <div style={{background:'#fffbea', border:'1px solid #f5e3a1', borderRadius:10, padding:'10px 12px', fontSize:13, lineHeight:1.35}}>
            {locale==='fr'
              ? <>Vous vendez en tant que <strong>particulier</strong> ? C’est autorisé pour des ventes occasionnelles. Si vous vendez régulièrement ou pour en tirer un revenu, vous devez vous <strong>déclarer (micro-entrepreneur, BIC)</strong>.</>
              : <>Selling as an <strong>individual</strong>? Occasional sales are fine. If sales are regular or for profit, you must <strong>register as a business</strong> (e.g., sole trader).</>}
          </div>

          {/* Bloc statut compte existant */}
          {merchant ? (
            <>
              <div>Stripe: <code>{merchant.stripe_account_id}</code></div>
              <div>Charges: <strong>{merchant.charges_enabled ? '✅' : '❌'}</strong> — Payouts: <strong>{merchant.payouts_enabled ? '✅' : '❌'}</strong></div>
              {Array.isArray(merchant.requirements_due) && merchant.requirements_due.length > 0 && (
                <div style={{fontSize:13, color:'#b36'}}>
                  {locale==='fr' ? 'Éléments requis' : 'Required info'}: {merchant.requirements_due.join(', ')}
                </div>
              )}
              <form method="post" action="/api/connect/sync">
                <button style={{padding:'8px 12px', borderRadius:10, border:'1px solid #ddd'}}>Rafraîchir statut</button>
              </form>
            </>
          ) : (
            <p style={{margin:0, opacity:.85}}>
              {locale==='fr' ? 'Pour revendre vos certificats, créez un compte vendeur.' : 'Create a seller account to resell your certificates.'}
            </p>
          )}

          {/* Formulaire d’onboarding avec sélecteur Particulier / Professionnel */}
          <form method="post" action="/api/connect/onboard" style={{display:'grid', gap:10}}>
            <fieldset style={{border:'1px solid #eee', borderRadius:10, padding:12}}>
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
                  ? 'En “Particulier”, nous pré-remplissons votre secteur d’activité et site pour accélérer l’inscription. Stripe demandera au minimum votre identité et votre IBAN.'
                  : 'With “Individual”, we prefill industry and website to speed up onboarding. Stripe will ask at minimum for your identity and your IBAN.'}
              </div>
            </fieldset>

            <button style={{padding:'10px 14px', borderRadius:10, border:'1px solid #ddd', cursor:'pointer'}}>
              {merchant ? (locale==='fr' ? 'Mettre à jour / compléter' : 'Update / complete') : (locale==='fr' ? 'Devenir vendeur' : 'Become a seller')}
            </button>
          </form>

          {/* Récap annuel (CSV) */}
          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:6}}>
            <a
              href={`/api/reports/sales?year=${year}&format=csv`}
              style={{textDecoration:'none', padding:'8px 12px', border:'1px solid #ddd', borderRadius:10}}
            >
              {locale==='fr' ? `Télécharger mon récapitulatif ${year} (CSV)` : `Download my ${year} sales recap (CSV)`}
            </a>
            <a
              href={`/api/reports/sales?year=${year}&format=json`}
              style={{textDecoration:'none', padding:'8px 12px', border:'1px solid #eee', borderRadius:10, opacity:.75}}
            >
              JSON
            </a>
          </div>
        </div>
      </section>

      <section style={{marginTop:18}}>
        <h2 style={{fontSize:18, margin:'0 0 10px'}}>
          {locale==='fr' ? 'Mes annonces actives' : 'My active listings'}
        </h2>
        <div style={{border:'1px solid #eee', borderRadius:12, padding:14}}>
          {listings.length === 0 ? (
            <p style={{margin:0, opacity:.8}}>
              {locale==='fr' ? 'Aucune date en vente pour l’instant.' : 'No active listings yet.'}
            </p>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:10}}>
              {listings.map(item=>{
                const ymd = new Date(item.ts).toISOString().slice(0,10)
                return (
                  <div key={item.id} style={{border:'1px solid #eee', borderRadius:12, padding:12}}>
                    <div style={{fontWeight:800, fontSize:16}}>{ymd}</div>
                    <div style={{marginTop:4, opacity:.85}}>{(item.price_cents/100).toFixed(0)} €</div>
                    <div style={{display:'flex', gap:8, marginTop:10}}>
                      <a href={`/${locale}/m/${encodeURIComponent(ymd)}`} style={{textDecoration:'none', padding:'8px 10px', borderRadius:10, border:'1px solid #ddd', color:'inherit'}}>
                        {locale==='fr' ? 'Ouvrir' : 'Open'}
                      </a>
                      <form method="post" action={`/api/marketplace/listing/${item.id}/status`}>
                        <input type="hidden" name="action" value="cancel" />
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="next" value={`/${locale}/account`} />
                        <button type="submit" style={{padding:'8px 10px', borderRadius:10, border:'1px solid #ddd', background:'transparent', color:'#b33'}}>
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
        </div>
      </section>

      <section style={{marginTop:18}}>
        <h2 style={{fontSize:18, margin:'0 0 10px'}}>{locale === 'fr' ? 'Mes certificats' : 'My certificates'}</h2>
        {claims.length === 0 ? (
          <div style={{border:'1px dashed #ddd', padding:16, borderRadius:12, opacity:.8}}>
            {locale === 'fr' ? 'Aucun certificat pour le moment.' : 'No certificates yet.'}
          </div>
        ) : (
          <div style={{display:'grid', gap:10}}>
            {claims.map(c => {
              const href = `/${locale}/m/${encodeURIComponent(c.ts)}`
              return (
                <a key={c.ts} href={href}
                   style={{display:'block', padding:14, border:'1px solid #eee', borderRadius:12, textDecoration:'none', color:'inherit'}}>
                  <div style={{fontWeight:700}}>{c.ts}</div>
                  {c.title && <div style={{opacity:.85, marginTop:4}}>{c.title}</div>}
                  {c.message && <div style={{opacity:.65, marginTop:2, whiteSpace:'pre-wrap'}}>{c.message}</div>}
                </a>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
