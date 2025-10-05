// app/[locale]/account/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const preferredRegion = ['cdg1', 'fra1']

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

type OwnerProfile = { email: string; display_name: string | null; username: string | null }
async function readOwnerProfile(ownerId: string): Promise<OwnerProfile | null> {
  const { rows } = await q<OwnerProfile>(
    `select email, display_name, username from owners where id = $1 limit 1`,
    [ownerId]
  )
  return rows[0] || null
}

async function q<T = any>(text: string, params?: any[]) {
  try {
    // @ts-ignore
    return await pool.query<T>(text, params)
  } catch (e1: any) {
    await new Promise(r => setTimeout(r, 50))
    // @ts-ignore
    return await pool.query<T>(text, params)
  }
}

type ClaimRow = { ts: string; title: string | null; message: string | null; cert_style: string | null }
async function listClaims(ownerId: string): Promise<ClaimRow[]> {
  const { rows } = await q(
    `select to_char(date_trunc('day', ts) at time zone 'UTC', 'YYYY-MM-DD') as ts,
            title, message, cert_style
       from claims
      where owner_id = $1
      order by ts desc
      limit 200`,
    [ownerId]
  )
  return rows.map((r: any) => ({
    ts: String(r.ts),
    title: r.title ?? null,
    message: r.message ?? null,
    cert_style: r.cert_style ?? 'neutral',
  }))
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
  if (typeof v === 'object') return []
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
  const { rows } = await q(
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

// 🔁 lecture ponctuelle du type (individual/company) depuis Stripe
async function readMerchantKind(ownerId: string): Promise<'individual'|'company'|null> {
  try {
    const { default: Stripe } = await import('stripe')
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return null
    const { rows } = await q(`select stripe_account_id from merchant_accounts where owner_id=$1`, [ownerId])
    const acctId = rows[0]?.stripe_account_id
    if (!acctId) return null
    const stripe = new Stripe(key as string)
    const acct = await stripe.accounts.retrieve(acctId)
    const metaKind = (acct.metadata as any)?.seller_kind
    const kind = (metaKind === 'company' || acct.business_type === 'company') ? 'company' : 'individual'
    return kind
  } catch { return null }
}

async function syncMerchantNow(ownerId: string): Promise<MerchantRow | null> {
  try {
    const { default: Stripe } = await import('stripe')
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return null

    const { rows } = await q(
      `select stripe_account_id from merchant_accounts where owner_id=$1`,
      [ownerId]
    )
    const acctId = rows[0]?.stripe_account_id
    if (!acctId) return null

    const stripe = new Stripe(key as string)
    const acct = await stripe.accounts.retrieve(acctId)

    await q(
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
    console.error('[account] syncMerchantNow failed:', e?.message)
    return null
  }
}

type MyListing = { id: string; ts: string; price_cents: number; currency: string; status: 'active'|'sold'|'canceled' }
async function readMyActiveListings(ownerId: string): Promise<MyListing[]> {
  const { rows } = await q(
    `select id, ts, price_cents, currency, status
       from listings
      where seller_owner_id = $1
        and status = 'active'
      order by ts asc`,
    [ownerId]
  )
  return rows.map((r: any) => ({
    id: String(r.id),
    ts: (()=>{ try { return new Date(r.ts).toISOString() } catch { return new Date(String(r.ts)).toISOString() } })(),
    price_cents: r.price_cents,
    currency: r.currency || 'EUR',
    status: r.status
  }))
}

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

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

  let sess: Awaited<ReturnType<typeof readSession>> | null = null
  try {
    sess = await readSession()
  } catch (e: any) {
    console.error('[account] readSession threw:', e?.message)
  }
  if (!sess) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)
  }

  const [claimsRes, listingsRes, merchantRes, ownerRes] = await Promise.allSettled([
    listClaims(sess.ownerId),
    readMyActiveListings(sess.ownerId),
    readMerchant(sess.ownerId),
    readOwnerProfile(sess.ownerId),
  ])
  const claims     = claimsRes.status === 'fulfilled'   ? claimsRes.value   : []
  const listings   = listingsRes.status === 'fulfilled' ? listingsRes.value : []
  let merchant     = merchantRes.status === 'fulfilled' ? merchantRes.value : null
  const owner      = ownerRes.status === 'fulfilled'    ? ownerRes.value    : null
  const claimsErr  = claimsRes.status === 'rejected'
  const listsErr   = listingsRes.status === 'rejected'
  let merchErr     = merchantRes.status === 'rejected'

  const connectParam = firstString(sp?.connect)
  const needsSync = connectParam === 'done'
  if (needsSync) {
    try {
      const updated = await syncMerchantNow(sess.ownerId)
      if (updated) {
        merchant = updated
        merchErr = false
      }
    } catch (e: any) {
      console.error('[account] syncMerchantNow outer failed:', e?.message)
      merchErr = true
    }
  }

  const year = new Date().getUTCFullYear()
  const activeYmd = new Set(listings.map(l => ymdSafe(l.ts)))

  const hasMerchant = !!merchant?.stripe_account_id
  const due = Array.isArray(merchant?.requirements_due) ? merchant.requirements_due! : []
  const chargesOk = !!merchant?.charges_enabled
  const payoutsOk = !!merchant?.payouts_enabled
  const isReady = hasMerchant && chargesOk && payoutsOk && due.length === 0
  const labelCharges = locale === 'fr' ? 'Encaissements' : 'Charges'
  const labelPayouts = locale === 'fr' ? 'Virements' : 'Payouts'

  // Type marchand depuis Stripe (individual/company)
  let merchantKind: 'individual'|'company'|null = null
  if (hasMerchant) {
    try { merchantKind = await readMerchantKind(sess.ownerId) } catch {}
  }
  const merchantKindLabel =
    merchantKind
      ? (locale === 'fr'
          ? (merchantKind === 'company' ? 'professionnel' : 'particulier')
          : (merchantKind === 'company' ? 'business' : 'individual'))
      : null

  function StatusPill({ ok, label }: { ok: boolean, label: string }) {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'6px 10px',
        borderRadius:999, border:'1px solid var(--color-border)',
        background: ok ? 'rgba(14,170,80,.12)' : 'rgba(255,186,0,.12)',
        fontSize:12
      }}>
        <span style={{fontSize:14}}>{ok ? '✅' : '⚠️'}</span>
        <span>{label}</span>
      </span>
    )
  }

  const displayName = owner?.display_name ?? owner?.username ?? sess.displayName ?? null
  const email = owner?.email ?? sess.email

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
          {displayName ? `${displayName} — ` : ''}{email}
        </p>

        {(claimsErr || listsErr || merchErr) && (
          <div style={{
            marginTop: 10,
            padding: '10px 12px',
            border: '1px solid rgba(255,120,120,.45)',
            background: 'rgba(255,120,120,.10)',
            borderRadius: 10,
            fontSize: 14
          }}>
            {locale==='fr'
              ? 'Le service est momentanément indisponible. Certaines informations peuvent être incomplètes. Réessayez dans quelques secondes.'
              : 'Service is temporarily unavailable. Some information may be incomplete. Please try again in a few seconds.'}
          </div>
        )}

        {/* Grid */}
        <div style={{display:'grid', gridTemplateColumns:'1fr', gap:18, marginTop:18}}>

          {/* Merchant card */}
          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:16, display:'grid', gap:14}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
              <h2 style={{fontSize:18, margin:0}}>
                {locale==='fr' ? 'Compte marchand' : 'Merchant account'}
                {hasMerchant && merchantKindLabel ? <> — {merchantKindLabel}</> : null}
              </h2>
              {hasMerchant ? (
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  <StatusPill ok={isReady} label={isReady
                    ? (locale==='fr' ? 'Prêt à vendre' : 'Ready to sell')
                    : (locale==='fr' ? 'À compléter' : 'Needs completion')} />
                  <StatusPill ok={chargesOk} label={`${labelCharges}: ${chargesOk ? 'ON' : 'OFF'}`} />
                  <StatusPill ok={payoutsOk} label={`${labelPayouts}: ${payoutsOk ? 'ON' : 'OFF'}`} />
                </div>
              ) : null}
            </div>

            {/* Intro quand aucun compte n'existe */}
            {!hasMerchant && (
              <div style={{border:'1px solid var(--color-border)', borderRadius:12, padding:12, background:'rgba(255,255,255,.02)', lineHeight:1.5}}>
                {locale==='fr'
                  ? <>Le mode marchand vous permet d’<strong>encaisser des paiements</strong> via Stripe, puis de <strong>recevoir vos virements</strong> sur votre IBAN. Il est requis pour <strong>revendre vos certificats</strong> sur la place de marché. Les frais de plateforme standard s’appliquent.</>
                  : <>Merchant mode lets you <strong>accept payments</strong> via Stripe and <strong>receive payouts</strong> to your bank account. It’s required to <strong>resell your certificates</strong> on the marketplace. Standard platform fees apply.</>}
              </div>
            )}

            {/* Message réglementation Particulier — visible uniquement si compte en mode Particulier */}
            {hasMerchant && merchantKind === 'individual' && (
              <div style={{background:'rgba(255,235,186,.08)', border:'1px solid rgba(245,227,161,.26)', borderRadius:10, padding:'10px 12px', fontSize:13, lineHeight:1.35}}>
                {locale==='fr'
                  ? <>Vous vendez en tant que <strong>particulier</strong> ? C’est autorisé pour des ventes occasionnelles. Si vous vendez régulièrement ou pour en tirer un revenu, vous devez vous <strong>déclarer (micro-entrepreneur, BIC)</strong>.</>
                  : <>Selling as an <strong>individual</strong>? Occasional sales are fine. If sales are regular or for profit, you must <strong>register as a business</strong>.</>}
              </div>
            )}

            {/* Bloc infos Stripe — visible si compte existe */}
            {hasMerchant && (
              <div style={{display:'grid', gap:6, border:'1px solid var(--color-border)', borderRadius:10, padding:12, background:'rgba(255,255,255,.02)'}}>
                <div style={{display:'grid', gap:4, fontSize:14}}>
                  <div>Stripe: <code>{merchant!.stripe_account_id}</code></div>
                  <div style={{opacity:.85}}>
                    {labelCharges}: <strong>{chargesOk ? '✅' : '❌'}</strong> — {labelPayouts}: <strong>{payoutsOk ? '✅' : '❌'}</strong>
                  </div>
                  {due.length > 0 && (
                    <div style={{fontSize:13, color:'#ffb2b2'}}>
                      {locale==='fr' ? 'Éléments requis' : 'Required info'}: {due.join(', ')}
                    </div>
                  )}
                </div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:6}}>
                  {!isReady && (
                    <form method="post" action="/api/connect/sync">
                      <button style={{padding:'8px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)'}}>
                        {locale==='fr' ? 'Rafraîchir statut' : 'Refresh status'}
                      </button>
                    </form>
                  )}
                  {isReady && (
                    <a
                      href={`/api/connect/dashboard`}
                      style={{textDecoration:'none', padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800}}
                    >
                      {locale==='fr' ? 'Ouvrir le tableau de bord Stripe' : 'Open Stripe Dashboard'}
                    </a>
                  )}
                </div>

                {/* Lien discret : passer Particulier → Pro (conserve l'historique) */}
                {isReady && merchantKind === 'individual' && (
                  <form method="post" action="/api/connect/onboard" style={{marginTop:6}}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="seller_kind" value="company" />
                    <button
                      type="submit"
                      style={{background:'transparent', border:'none', color:'var(--color-text)', opacity:.8, textDecoration:'underline', cursor:'pointer', fontSize:12}}
                    >
                      {locale==='fr' ? 'Passer en compte professionnel (conserve vos ventes)' : 'Switch to business (keep your sales history)'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Formulaire d’onboarding — uniquement si aucun compte n’existe */}
            {!hasMerchant && (
              <form method="post" action="/api/connect/onboard" style={{display:'grid', gap:10}} data-merchant-form>
                <input type="hidden" name="locale" value={locale} />

                {/* Choix Particulier / Pro (aucun coché par défaut) */}
                <fieldset style={{border:'1px solid var(--color-border)', borderRadius:10, padding:12}}>
                  <legend style={{padding:'0 6px'}}>
                    {locale==='fr' ? 'Je vends en tant que :' : 'I sell as:'}
                  </legend>

                  <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'center'}}>
                    <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                      <input type="radio" name="seller_kind" value="individual" required />
                      {locale==='fr' ? 'Particulier' : 'Individual'}
                    </label>
                    <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                      <input type="radio" name="seller_kind" value="company" />
                      {locale==='fr' ? 'Professionnel' : 'Business'}
                    </label>
                  </div>

                  {/* Hints dynamiques sous le choix */}
                  <div style={{marginTop:8, fontSize:12, lineHeight:1.45}}>
                    <div id="hint-individual" style={{display:'none', opacity:.9}}>
                      {locale==='fr'
                        ? <>Idéal pour des <strong>ventes occasionnelles</strong>. Stripe vous demandera une <strong>vérification d’identité</strong> et un <strong>IBAN</strong> pour les virements. Si l’activité devient régulière ou lucrative, pensez à vous <strong>déclarer (micro-entrepreneur, BIC)</strong>.</>
                        : <>Best for <strong>occasional sales</strong>. Stripe will ask for <strong>identity verification</strong> and a <strong>bank account (IBAN)</strong> for payouts. For regular/profit activity, you must <strong>register as a business</strong>.</>}
                    </div>
                    <div id="hint-company" style={{display:'none', opacity:.9}}>
                      {locale==='fr'
                        ? <>Pour les <strong>professionnels</strong> : votre <strong>n° SIRET</strong> et les <strong>informations légales</strong> de l’entreprise (adresse, représentant, IBAN) vous seront demandés par Stripe.</>
                        : <>For <strong>businesses</strong>: Stripe will request your company’s <strong>registration number</strong> and <strong>legal details</strong> (address, representative, bank account).</>}
                    </div>
                  </div>
                </fieldset>

                {/* Consentements */}
                <div style={{display:'grid', gap:8, fontSize:12, marginTop:4}}>
                  <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                    <input type="checkbox" name="accept_seller_terms" required />
                    <span>J’ai lu et j’accepte les <a href={`/${locale}/legal/seller`} style={{color:'var(--color-text)'}}>Conditions Vendeur</a> et les <a href={`/${locale}/legal/terms`} style={{color:'var(--color-text)'}}>CGU/CGV</a>.</span>
                  </label>
                  <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                    <input type="checkbox" name="confirm_age" required />
                    <span>Je confirme être majeur.</span>
                  </label>
                  <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                    <input type="checkbox" name="confirm_rights" required />
                    <span>Je certifie détenir les droits nécessaires sur tous les contenus publiés (pas de données personnelles sensibles ni de contenus illicites).</span>
                  </label>
                  <small style={{opacity:.75}}>
                    Vos données sont transmises à Stripe pour la vérification KYC/KYB — voir <a href={`/${locale}/legal/privacy`} style={{color:'var(--color-text)'}}>Confidentialité</a>.
                  </small>
                </div>

                {/* CTA création */}
                <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                  <button
                    data-merchant-submit
                    style={{padding:'10px 14px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-primary)', color:'var(--color-on-primary)', cursor:'pointer', fontWeight:800}}
                  >
                    {locale==='fr' ? 'Créer mon compte marchand' : 'Create my merchant account'}
                  </button>
                </div>

                {/* Petit JS progressif : active le CTA + bascule les hints */}
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
(function(){
  try {
    var form = document.querySelector('[data-merchant-form]');
    if(!form) return;
    var radios = form.querySelectorAll('input[name="seller_kind"]');
    var hintInd = form.querySelector('#hint-individual');
    var hintPro = form.querySelector('#hint-company');
    var submit = form.querySelector('[data-merchant-submit]');
    var checks = form.querySelectorAll('input[type="checkbox"][required]');
    function update(){
      var val = '';
      radios.forEach(function(r){ if(r.checked) val = r.value; });
      if(hintInd) hintInd.style.display = (val==='individual') ? 'block' : 'none';
      if(hintPro) hintPro.style.display = (val==='company') ? 'block' : 'none';
      var okRadio = !!val;
      var okChecks = true; checks.forEach(function(c){ if(!c.checked) okChecks=false; });
      if(submit){
        submit.disabled = !(okRadio && okChecks);
        submit.style.opacity = submit.disabled ? '.6' : '1';
        submit.style.cursor = submit.disabled ? 'not-allowed' : 'pointer';
      }
    }
    radios.forEach(function(r){ r.addEventListener('change', update); });
    checks.forEach(function(c){ c.addEventListener('change', update); });
    update();
  } catch(_) {}
})();
`}}
                />
              </form>
            )}

            {/* Transparence plateforme */}
            <div style={{background:'rgba(255,255,255,.03)', border:'1px solid var(--color-border)', borderRadius:10, padding:'10px 12px', fontSize:12, lineHeight:1.35}}>
              Parcels of Time agit en tant qu’<strong>opérateur de plateforme</strong> et mandataire d’encaissement via <strong>Stripe Connect</strong>.
              Le vendeur demeure responsable de ses offres et obligations (garanties légales, fiscalité).
            </div>
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

        {/* Certificates gallery */}
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
