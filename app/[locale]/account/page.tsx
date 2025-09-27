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

async function readMerchant(ownerId: string): Promise<MerchantRow | null> {
  const { rows } = await pool.query(
    `select stripe_account_id, charges_enabled, payouts_enabled, requirements_due
       from merchant_accounts where owner_id=$1`,
    [ownerId]
  )
  return rows[0] || null
}

async function syncMerchantNow(ownerId: string): Promise<MerchantRow | null> {
  // lit l’acct id
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
    [ownerId, !!acct.charges_enabled, !!acct.payouts_enabled, JSON.stringify(acct.requirements?.currently_due || [])]
  )
  return {
    stripe_account_id: acct.id,
    charges_enabled: !!acct.charges_enabled,
    payouts_enabled: !!acct.payouts_enabled,
    requirements_due: (acct.requirements?.currently_due || []) as any,
  }
}

export default async function Page({
  params,
  searchParams,
}: { params: Promise<Params>, searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params
  const sp = await searchParams
  const sess = await readSession()
  if (!sess) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)

  // 1) lecture DB
  let merchant = await readMerchant(sess.ownerId)

  // 2) conditions d’auto-sync : retour d’onboarding OU statut incomplet
  const needsSync =
    sp?.connect === 'done' ||
    (merchant && (
      !merchant.charges_enabled ||
      !merchant.payouts_enabled ||
      (merchant.requirements_due && merchant.requirements_due.length > 0)
    ))

  if (needsSync) {
    try { merchant = await syncMerchantNow(sess.ownerId) || merchant } catch {}
  }

  const claims = await listClaims(sess.ownerId)

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
        {merchant ? (
          <>
            <div>Stripe: <code>{merchant.stripe_account_id}</code></div>
            <div>Charges: <strong>{merchant.charges_enabled ? '✅' : '❌'}</strong> — Payouts: <strong>{merchant.payouts_enabled ? '✅' : '❌'}</strong></div>
            {!!merchant.requirements_due?.length && (
              <div style={{fontSize:13, color:'#b36'}}>Éléments requis: {merchant.requirements_due.join(', ')}</div>
            )}
            <form method="post" action="/api/connect/sync"><button style={{padding:'8px 12px', borderRadius:10, border:'1px solid #ddd'}}>Rafraîchir statut</button></form>
          </>
        ) : (
          <p style={{margin:0, opacity:.85}}>
            {locale==='fr' ? 'Pour revendre vos certificats, créez un compte vendeur.' : 'Create a seller account to resell your certificates.'}
          </p>
        )}
        <form method="post" action="/api/connect/onboard">
          <button style={{padding:'10px 14px', borderRadius:10, border:'1px solid #ddd', cursor:'pointer'}}>
            {merchant ? (locale==='fr' ? 'Mettre à jour / compléter' : 'Update / complete') : (locale==='fr' ? 'Devenir vendeur' : 'Become a seller')}
          </button>
        </form>
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
