// app/[locale]/m/[ts]/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const preferredRegion = ['cdg1','fra1']

import { redirect } from 'next/navigation'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'
import EditClient from './EditClient'
import DangerRelease from './DangerRelease'

type Params = { locale: string; ts: string }
type SearchParams = {
  autopub?: string
  ok?: string
  debug?: string
  listing?: string
  reg?: 'pub' | 'priv'
}

function safeDecode(v: string) { try { return decodeURIComponent(v) } catch { return v } }
function formatISOAsNiceSafe(iso: string) {
  try { const d = new Date(iso); if (isNaN(d.getTime())) return iso; return d.toISOString().slice(0,10) } catch { return iso }
}
function normalizeTs(input: string): { tsISO: string | null; tsYMD: string | null } {
  if (!input) return { tsISO: null, tsYMD: null }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T00:00:00.000Z`) : new Date(input)
  if (isNaN(d.getTime())) return { tsISO: null, tsYMD: null }
  d.setUTCHours(0, 0, 0, 0)
  const tsISO = d.toISOString()
  const tsYMD = tsISO.slice(0, 10)
  return { tsISO, tsYMD }
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

/** Public registry (per day, ISO midnight) */
async function getPublicStateDb(tsISO: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `select exists(select 1 from minute_public where date_trunc('day', ts) = $1::timestamptz) as ok`,
      [tsISO]
    )
    return !!rows[0]?.ok
  } catch { return false }
}
async function setPublicDb(tsISO: string, next: boolean): Promise<boolean> {
  const client = await pool.connect()
  try {
    if (next) {
      await client.query(
        `insert into minute_public (ts) values ($1::timestamptz)
         on conflict (ts) do nothing`,
        [tsISO]
      )
    } else {
      await client.query(`delete from minute_public where ts = $1::timestamptz`, [tsISO])
    }
    return true
  } catch { return false } finally { client.release() }
}

/** Dark theme tokens */
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

type ClaimForEdit = {
  email: string | null
  display_name: string | null
  title: string | null
  message: string | null
  link_url: string | null
  cert_style: string | null
  time_display: 'utc' | 'utc+local' | 'local+utc' | null
  local_date_only: boolean | null
  text_color: string | null
  title_public: boolean | null
  message_public: boolean | null
}
async function getClaimForEdit(tsISO: string): Promise<ClaimForEdit | null> {
  try {
    const { rows } = await pool.query(
      `select o.email, c.display_name,
              c.title, c.message, c.link_url,
              c.cert_style, c.time_display, c.local_date_only, c.text_color,
              c.title_public, c.message_public
         from claims c
         left join owners o on o.id = c.owner_id
        where date_trunc('day', c.ts) = $1::timestamptz`,
      [tsISO]
    )
    if (!rows.length) return null
    const r = rows[0]
    return {
      email: r.email ?? null,
      display_name: r.display_name ?? null,
      title: r.title ?? null,
      message: r.message ?? null,
      link_url: r.link_url ?? null,
      cert_style: r.cert_style ?? 'neutral',
      time_display: (r.time_display ?? 'local+utc') as any,
      local_date_only: !!r.local_date_only,
      text_color: (r.text_color ?? '#1a1f2a'),
      title_public: !!r.title_public,
      message_public: !!r.message_public,
    }
  } catch { return null }
}
async function getClaimMeta(tsISO: string) {
  try {
    const { rows } = await pool.query(
      `select id as claim_id, cert_hash
         from claims
        where date_trunc('day', ts) = $1::timestamptz`,
      [tsISO]
    )
    if (!rows.length) return null
    return { claimId: String(rows[0].claim_id), hash: String(rows[0].cert_hash || '') }
  } catch { return null }
}

type ListingRow = {
  id: string
  ts: string
  price_cents: number
  currency: string
  status: 'active' | 'sold' | 'canceled'
  seller_display_name: string | null
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
      ts: new Date(r.ts).toISOString(),
      price_cents: r.price_cents,
      currency: r.currency || 'EUR',
      status: r.status
    }))
  } catch { return [] }
}
async function readActiveListing(tsISO: string): Promise<ListingRow | null> {
  try {
    const { rows } = await pool.query(
      `select l.id, l.ts, l.price_cents, l.currency, l.status,
              o.display_name as seller_display_name
         from listings l
         join owners o on o.id = l.seller_owner_id
        where l.ts = $1::timestamptz
          and l.status = 'active'
        limit 1`,
      [tsISO]
    )
    return rows[0] || null
  } catch { return null }
}

/** Merchant status (for owner only) */
type MerchantRow = {
  stripe_account_id: string | null
  charges_enabled: boolean | null
  payouts_enabled: boolean | null
}
async function readMerchant(ownerId: string): Promise<MerchantRow | null> {
  try {
    const { rows } = await pool.query(
      `select stripe_account_id, charges_enabled, payouts_enabled
         from merchant_accounts where owner_id = $1`,
      [ownerId]
    )
    const r = rows[0]
    if (!r) return null
    return {
      stripe_account_id: r.stripe_account_id ?? null,
      charges_enabled: !!r.charges_enabled,
      payouts_enabled: !!r.payouts_enabled,
    }
  } catch { return null }
}

/** Robust ownerId lookup (ISO or YMD) */
async function ownerIdForDaySafe(tsISO: string, tsYMD: string): Promise<string | null> {
  try { const a = await ownerIdForDay(tsISO); if (a) return a as any } catch {}
  try { const b = await ownerIdForDay(tsYMD); if (b) return b as any } catch {}
  return null
}

export default async function Page({
  params,
  searchParams,
}: { params: Promise<Params>, searchParams: Promise<SearchParams> }) {
  const { locale = 'en', ts: tsParam = '' } = await params
  const sp = (await searchParams) || {}

  const decodedTs = safeDecode(tsParam)
  const { tsISO, tsYMD } = normalizeTs(decodedTs)
  if (!tsISO || !tsYMD) redirect(`/${locale}/account?err=bad_ts`)

  // session & access
  const session = await readSession()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/m/${encodeURIComponent(decodedTs)}`)}`)

  const ownerId = await ownerIdForDaySafe(tsISO!, tsYMD!)
  const isOwner = !!ownerId && ownerId === session.ownerId

  // If not owner, page is shown only when the listing is public/active
  const listing = isOwner ? null : await readActiveListing(tsISO!)
  if (!isOwner && !listing) redirect(`/${locale}/account?err=not_owner`)

  // Owner’s active listings + merchant status
  let myListings: MyListing[] = []
  let merchant: MerchantRow | null = null
  if (isOwner) {
    myListings = await readMyActiveListings(session.ownerId)
    merchant = await readMerchant(session.ownerId)
  }

  const myListingForThisDay = isOwner ? myListings.find(l => (ymdSafe(l.ts) === tsYMD)) : null

  const isPublic = await getPublicStateDb(tsISO!)

  // claim data
  const meta = await getClaimMeta(tsISO!)
  const claim = await getClaimForEdit(tsISO!)

  // links
  const pdfHref = `/api/cert/${encodeURIComponent(tsYMD!)}`
  const invoiceHref = `/api/invoice/${encodeURIComponent(tsYMD!)}`
  const accountHref = `/${locale}/account`
  const exploreHref = `/${locale}/explore`
  const verifyHref = `/api/verify?ts=${encodeURIComponent(tsISO!)}`
  const niceTs = formatISOAsNiceSafe(tsISO!)

  // UI logic
  const listingJustPublished = (sp.listing === 'ok')
  const regAction = sp.reg === 'pub' ? 'pub' : (sp.reg === 'priv' ? 'priv' : null)

  const canSell =
    isOwner &&
    !!merchant?.stripe_account_id &&
    !!merchant?.charges_enabled &&
    !myListingForThisDay &&
    !listingJustPublished

  const togglePublic = async (formData: FormData) => {
    'use server'
    const tsY = String(formData.get('ts') || '')
    const norm = normalizeTs(tsY)
    if (!norm.tsISO || !norm.tsYMD) redirect(`/${locale}/account?err=bad_ts`)
    const next = String(formData.get('next') || '0') === '1'
    const s = await readSession()
    if (!s) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/m/${encodeURIComponent(norm.tsYMD)}`)}`)
    const oid = await ownerIdForDaySafe(norm.tsISO, norm.tsYMD)
    if (!oid || oid !== s!.ownerId) redirect(`/${locale}/account?err=not_owner`)
    await setPublicDb(norm.tsISO, next)
    redirect(`/${locale}/m/${encodeURIComponent(norm.tsYMD)}?reg=${next ? 'pub' : 'priv'}`)
  }

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
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <a href={accountHref} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>
            &larr; {locale==='fr' ? 'Mon compte' : 'My account'}
          </a>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Stripe • {locale==='fr' ? 'Paiements sécurisés' : 'Secure payments'}
          </div>
        </div>

        {/* Heading */}
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, lineHeight: '48px', margin: '0 0 6px' }}>
            {locale==='fr' ? 'Merci ❤ Votre journée est réservée' : 'Thank you ❤ Your day is reserved'}
          </h1>
          <p style={{ fontSize: 16, opacity: 0.9, margin: 0 }}>{niceTs}</p>
        </header>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18 }}>
          {/* Left column */}
          <div style={{ display:'grid', gap:18 }}>
            {/* Certificate actions (ONLY TWO BUTTONS) */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 16,
                padding: 18,
                boxShadow: 'var(--shadow-elev1)',
              }}
            >
              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-muted)', marginBottom: 10 }}>
                {locale==='fr' ? 'Votre certificat' : 'Your certificate'}
              </div>

              <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                {/* PDF (certificat) */}
                <a
                  href={pdfHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    gap: 10,
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    padding: '14px 18px',
                    borderRadius: 12,
                    fontWeight: 800,
                    textDecoration: 'none',
                    border: '1px solid transparent',
                  }}
                >
                  {locale==='fr' ? 'PDF (certificat)' : 'PDF (certificate)'}
                </a>

                {/* Facture / Reçu (owner only) */}
                {isOwner && (
                  <a
                    href={invoiceHref}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      gap: 10,
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      padding: '12px 16px',
                      borderRadius: 12,
                      fontWeight: 800,
                      textDecoration: 'none',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {locale==='fr' ? 'Facture' : 'Invoice'}
                  </a>
                )}
              </div>

              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
                {locale==='fr'
                  ? 'Le PDF est aussi envoyé par e-mail (vérifiez vos indésirables).'
                  : 'The PDF is also sent by email (check your spam).'}
              </p>
              {isOwner && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  {locale==='fr'
                    ? 'La facture reflète le montant réellement payé (29 € ou prix Marketplace).'
                    : 'The invoice reflects the amount actually paid (€29 or marketplace price).'}
                </p>
              )}
            </div>

            {/* Marketplace — SELL (owner) */}
            {isOwner && canSell && (
              <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
                <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                  {locale==='fr' ? 'Revendre ce certificat (Marketplace)' : 'Resell this certificate (Marketplace)'}
                </div>
                <form method="post" action="/api/marketplace/listing">
                  <input type="hidden" name="ts" value={tsYMD!} />
                  <input type="hidden" name="locale" value={locale} />
                  <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                    <label style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{opacity:.85}}>{locale==='fr' ? 'Prix (€)' : 'Price (€)'}</span>
                      <input name="price" type="number" min={1} step={1} required
                             style={{padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}} />
                    </label>

                    <div style={{display:'grid', gap:6, fontSize:12}}>
                      <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                        <input type="checkbox" name="seller_terms" required />
                        <span>J’accepte les <a href={`/${locale}/legal/seller`} style={{color:'var(--color-text)'}}>Conditions Vendeur</a> (commission 15% min 1 €) et les <a href={`/${locale}/legal/terms`} style={{color:'var(--color-text)'}}>CGU/CGV</a>.</span>
                      </label>
                      <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                        <input type="checkbox" name="seller_rights" required />
                        <span>Je certifie être l’unique titulaire des droits nécessaires et déclare les revenus conformément à la réglementation fiscale applicable.</span>
                      </label>
                    </div>

                    <button type="submit"
                      style={{padding:'12px 14px', borderRadius:12, border:'1px solid var(--color-border)', background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800}}
                    >{locale==='fr' ? 'Mettre en vente' : 'List for sale'}</button>
                  </div>
                  <p style={{fontSize:12, opacity:.7, marginTop:8}}>
                    {locale==='fr'
                      ? 'Commission 10% (min 1 €) lors de la vente.'
                      : '10% commission (min €1) at sale time.'}
                  </p>
                </form>
              </section>
            )}

            {/* Nudges / status … (inchangé) */}
            {isOwner && !merchant?.stripe_account_id && (
              <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
                <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                  {locale==='fr' ? 'Vendre sur la marketplace' : 'Sell on the marketplace'}
                </div>
                <p style={{margin:'0 0 10px', opacity:.85}}>
                  {locale==='fr'
                    ? 'Pour revendre ce certificat, créez d’abord votre compte vendeur.'
                    : 'To resell this certificate, please create your seller account first.'}
                </p>
                <a href={`/${locale}/account`} style={{textDecoration:'none', padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, color:'var(--color-text)'}}>
                  {locale==='fr' ? 'Ouvrir mon compte vendeur' : 'Open my seller account'}
                </a>
              </section>
            )}

            {isOwner && (sp.listing === 'ok' || myListingForThisDay) && (
              <div style={{
                padding:'10px 12px',
                border:'1px solid rgba(14,170,80,.4)',
                background:'rgba(14,170,80,.12)',
                borderRadius:10,
                fontSize:14
              }}>
                ✅ {locale==='fr' ? 'Votre annonce a été publiée sur la marketplace.' : 'Your listing is live on the marketplace.'}
              </div>
            )}

            {isOwner && (sp.reg === 'pub' || sp.reg === 'priv') && (
              <div style={{
                padding:'10px 12px',
                border:'1px solid rgba(14,170,80,.4)',
                background: sp.reg === 'pub' ? 'rgba(14,170,80,.12)' : 'rgba(120,130,150,.12)',
                borderRadius:10,
                fontSize:14
              }}>
                {sp.reg === 'pub'
                  ? (locale==='fr' ? '✅ Votre certificat a été publié dans le registre public.' : '✅ Your certificate is now public in the registry.')
                  : (locale==='fr' ? '🔒 Votre certificat est maintenant privé.' : '🔒 Your certificate is now private.')
                }
              </div>
            )}

            {/* Owner: active listing */}
            {isOwner && myListingForThisDay && (
              <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
                <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                  {locale==='fr' ? 'Annonce active' : 'Active listing'}
                </div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
                  <div style={{fontSize:16}}>
                    {(myListingForThisDay.price_cents/100).toFixed(0)} € — statut : <strong>active</strong>
                  </div>
                  <form method="post" action={`/api/marketplace/listing/${myListingForThisDay.id}/status`}>
                    <input type="hidden" name="status" value="canceled" />
                    <input type="hidden" name="next" value={`/${locale}/m/${encodeURIComponent(tsYMD)}?listing=off`} />
                    <button
                      type="submit"
                      style={{padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', fontWeight:800}}
                    >
                      {locale==='fr' ? 'Retirer de la vente' : 'Cancel listing'}
                    </button>
                  </form>
                </div>
              </section>
            )}

            {/* Buyer: active public listing */}
            {!isOwner && listing && (
              <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)'}}>{locale==='fr'?'Annonce':'Listing'}</div>
                    <div style={{fontSize:18, fontWeight:800, marginTop:4}}>
                      {listing.price_cents/100} € — {listing.seller_display_name || (locale==='fr'?'Vendeur':'Seller')}
                    </div>
                  </div>
                  <form method="post" action="/api/marketplace/checkout" style={{display:'grid', gap:10}}>
                    <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                      <input type="hidden" name="listing_id" value={String(listing.id)} />
                      <input type="hidden" name="locale" value={locale} />
                      <input type="email" required name="buyer_email" placeholder="vous@exemple.com"
                        style={{padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}} />
                      <button style={{padding:'12px 14px', borderRadius:12, border:'none', background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800}}>
                        {locale==='fr' ? 'Acheter' : 'Buy'}
                      </button>
                    </div>
                    <div style={{display:'grid', gap:6, fontSize:12}}>
                      <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                        <input type="checkbox" name="accept_terms" required />
                        <span>J’accepte les <a href={`/${locale}/legal/terms`} style={{color:'var(--color-text)'}}>CGU/CGV</a> et j’ai lu la <a href={`/${locale}/legal/privacy`} style={{color:'var(--color-text)'}}>Politique de confidentialité</a>.</span>
                      </label>
                      <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                        <input type="checkbox" name="withdrawal_waiver" required />
                        <span>Je demande l’<strong>exécution immédiate</strong> et <strong>renonce</strong> à mon droit de rétractation (contenu numérique).</span>
                      </label>
                      <small style={{opacity:.75}}>
                        Le vendeur est l’auteur du certificat ; Parcels of Time opère la plateforme et l’encaissement via Stripe Connect.
                      </small>
                    </div>
                  </form>
                </div>
                <p style={{fontSize:12, opacity:.7, marginTop:8}}>{locale==='fr'?'Paiement sécurisé Stripe. PDF transmis au nouvel acquéreur.':'Secure Stripe checkout. PDF transferred to the buyer.'}</p>
              </section>
            )}

            {/* Public registry */}
            <aside style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-muted)' }}>
                  {locale==='fr' ? 'Registre public' : 'Public registry'}
                </div>
                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: isPublic ? 'rgba(14,170,80,.18)' : 'rgba(120,130,150,.18)',
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                  }}
                >
                  {locale==='fr' ? 'Statut' : 'Status'} : <strong>{isPublic ? 'Public' : 'Privé'}</strong>
                </span>
              </div>
              {isOwner && (
                <form action={togglePublic} style={{ display: 'flex', gap: 10 }}>
                  <input type="hidden" name="ts" value={tsYMD!} />
                  <input type="hidden" name="next" value={isPublic ? '0' : '1'} />
                  <button
                    type="submit"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: isPublic ? 'var(--color-surface)' : 'var(--color-primary)',
                      color: isPublic ? 'var(--color-text)' : 'var(--color-on-primary)',
                      border: '1px solid var(--color-border)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {isPublic ? (locale==='fr' ? 'Rendre privé' : 'Make private') : (locale==='fr' ? 'Rendre public' : 'Make public')}
                  </button>
                  <a
                    href={exploreHref}
                    style={{ textDecoration: 'none', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px' }}
                  >
                    {locale==='fr'?'Voir le registre':'Open registry'} →
                  </a>
                </form>
              )}
            </aside>
          </div>

          {/* Right column — PDF preview (sans boutons) */}
          <aside
            aria-label="Aperçu du certificat (PDF)"
            style={{
              position:'sticky',
              top:24,
              background:'var(--color-surface)',
              border:'1px solid var(--color-border)',
              borderRadius:16,
              padding:12,
              boxShadow:'var(--shadow-elev1)'
            }}
          >
            <div style={{width:'100%', aspectRatio:'595.28/841.89', border:'1px solid var(--color-border)', borderRadius:12, overflow:'hidden'}}>
              <object
                data={pdfHref}
                type="application/pdf"
                aria-label="Prévisualisation PDF du certificat"
                style={{ width:'100%', height:'100%', border:'none' }}
              >
                <div style={{padding:12, fontSize:14}}>
                  {locale==='fr'
                    ? <>Votre navigateur ne peut pas afficher le PDF. <a href={pdfHref} target="_blank" rel="noreferrer" style={{color:'var(--color-text)'}}>Ouvrir le PDF dans un nouvel onglet</a>.</>
                    : <>Your browser cannot display the PDF. <a href={pdfHref} target="_blank" rel="noreferrer" style={{color:'var(--color-text)'}}>Open the PDF in a new tab</a>.</>}
                </div>
              </object>
            </div>
          </aside>
        </div>

        {/* Integrity */}
        <aside style={{ marginTop: 18, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-muted)' }}>
              {locale==='fr' ? 'Preuve & intégrité' : 'Proof & integrity'}
            </div>
            <a href={verifyHref} style={{ fontSize: 12, textDecoration: 'none', border: '1px solid var(--color-border)', borderRadius: 999, padding: '6px 10px', color: 'var(--color-text)' }}>
              API: verify →
            </a>
          </div>
          {meta ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>{locale==='fr'?'ID du certificat':'Certificate ID'}</div>
                <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{meta.claimId}</code>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>SHA-256</div>
                <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{meta.hash}</code>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{locale==='fr' ? 'Métadonnées indisponibles.' : 'Metadata unavailable.'}</div>
          )}
        </aside>

        {/* Edition + Danger zone (inchangés) */}
        <section style={{ marginTop: 24 }}>
          <details style={{ border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
            <summary
              style={{
                listStyle: 'none',
                cursor: 'pointer',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: 20 }}>{locale==='fr'?'Modifier votre certificat':'Edit your certificate'}</span>
                <small style={{ fontSize: 13, opacity: 0.75 }}>(9,99 €)</small>
              </span>
              <span aria-hidden style={{ opacity: 0.7 }}>▼</span>
            </summary>

            <div style={{ padding: 16, borderTop: '1px solid var(--color-border)' }}>
              {claim ? (
                <EditClient
                  tsISO={tsISO!}
                  locale={locale}
                  initial={{
                    email: claim.email || '',
                    display_name: claim.display_name || '',
                    title: claim.title || '',
                    message: claim.message || '',
                    link_url: claim.link_url || '',
                    cert_style: (claim.cert_style as any) || 'neutral',
                    time_display: (claim.time_display as any) || 'local+utc',
                    local_date_only: !!claim.local_date_only,
                    text_color: claim.text_color || '#1a1f2a',
                    title_public: !!claim.title_public,
                    message_public: !!claim.message_public,
                  }}
                />
              ) : (
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <p style={{ margin: 0 }}>
                    {locale==='fr' ? 'Aucune donnée trouvée pour cette journée.' : 'No data for this day.'}
                  </p>
                </div>
              )}
            </div>
          </details>
        </section>

        <DangerRelease locale={locale} tsYMD={tsYMD!} />
      </section>
    </main>
  )
}
