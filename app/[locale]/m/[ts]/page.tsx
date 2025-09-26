// app/[locale]/m/[ts]/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { formatISOAsNice } from '@/lib/date'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'
import EditClient from './EditClient'

type Params = { locale: string; ts: string }
type SearchParams = { autopub?: string; ok?: string } 

function safeDecode(v: string) { try { return decodeURIComponent(v) } catch { return v } }

/** Normalise au jour UTC (00:00:00.000Z) — accepte YYYY-MM-DD ou un ISO */
function asDayIsoUTC(ts: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ts) ? new Date(`${ts}T00:00:00.000Z`) : new Date(ts)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0)
  return d.toISOString()
}

/** Helpers searchParams (compatible objet ou URLSearchParams) */
function getQ(sp: SearchParams | undefined, key: string): string | undefined {
  if (!sp) return undefined
  if (typeof (sp as any)?.get === 'function') return (sp as any).get(key) ?? undefined
  return (sp as any)?.[key]
}

/** Lecture état public (par jour) */
async function getPublicStateDb(tsISO: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `select exists(
         select 1 from minute_public where date_trunc('day', ts) = $1::timestamptz
       ) as ok`,
      [tsISO]
    )
    return !!rows[0]?.ok
  } catch { return false }
}

/** Écriture état public (par jour) */
async function setPublicDb(tsISO: string, next: boolean): Promise<boolean> {
  const client = await pool.connect()
  try {
    if (next) {
      await client.query(
        `insert into minute_public (ts)
         values ($1::timestamptz)
         on conflict (ts) do nothing`,
        [tsISO]
      )
    } else {
      await client.query(`delete from minute_public where ts = $1::timestamptz`, [tsISO])
    }
    return true
  } catch { return false } finally { client.release() }
}

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
      `select o.email, o.display_name,
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
async function readActiveListing(tsISO: string): Promise<ListingRow | null> {
  try {
    const { rows } = await pool.query(
      `select l.id, l.ts, l.price_cents, l.currency, l.status,
              o.display_name as seller_display_name
         from listings l
         join owners o on o.id = l.seller_owner_id
        where date_trunc('day', l.ts) = $1::timestamptz
          and l.status = 'active'
        limit 1`,
      [tsISO]
    )
    return rows[0] || null
  } catch { return null }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params> | Params
  searchParams: Promise<SearchParams> | SearchParams
}) {
  // Accepte Promise ou objet (différences de types Next 15)
  const p = await params as Params
  const sp = await searchParams as SearchParams

  const { locale = 'en', ts: tsParam = '' } = p
  const decodedTs = safeDecode(tsParam)

  // 🔒 Normalisation unique pour TOUTE la page
  const tsISO = asDayIsoUTC(decodedTs)
  if (!tsISO) redirect(`/${locale}/account?err=bad_ts`)
  const tsDay = tsISO.slice(0, 10) // utile pour certaines routes publiques

  // 1) Auth
  let session = null as null | { ownerId: string }
  try { session = await readSession() } catch { /* durcit contre erreurs réseau */ }
  if (!session) {
    // Non connecté → on laisse entrer seulement si une annonce active existe (vue publique)
    const listing = await readActiveListing(tsISO)
    if (listing) {
      // vue publique autorisée
    } else {
      redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/m/${encodeURIComponent(decodedTs)}`)}`)
    }
  }

  // 2) Ownership strict OU annonce active publique
  let ownerId: string | null = null
  try { ownerId = await ownerIdForDay(tsISO) } catch { ownerId = null } // ✅ toujours passer le ts normalisé
  const isOwner = !!session && !!ownerId && ownerId === session.ownerId
  const listing = isOwner ? null : await readActiveListing(tsISO)

  if (!isOwner && !listing) {
    // ni owner ni annonce → compte
    redirect(`/${locale}/account?err=not_owner`)
  }

  // 3) État public + autopub (owner only)
  const isPublicDb = await getPublicStateDb(tsISO)
  const wantsAutopub = getQ(sp, 'autopub') === '1'
  if (isOwner && wantsAutopub && !isPublicDb) {
    await setPublicDb(tsISO, true)
    revalidatePath(`/${locale}/m/${encodeURIComponent(tsDay)}`)
    redirect(`/${locale}/m/${encodeURIComponent(tsDay)}?ok=1`)
  }
  const isPublic = isPublicDb

  // 4) Données claim / meta (si claim absent, on ne casse pas l’affichage d’annonce)
  const meta = await getClaimMeta(tsISO)
  const claim = await getClaimForEdit(tsISO)

  // 🔗 URLs (utiliser le *jour* pour les endpoints jour-based)
  const pdfHref = `/api/cert/${encodeURIComponent(tsDay)}`
  const homeHref = `/${locale}`
  const exploreHref = `/${locale}/explore`
  const verifyHref = `/api/verify?ts=${encodeURIComponent(tsDay)}`
  let niceTs = tsDay
  try { niceTs = formatISOAsNice(tsISO) } catch {}

  // Action serveur (toggle registre public)
  const togglePublic = async (formData: FormData) => {
    'use server'
    const raw = String(formData.get('ts') || '')
    const tsFix = asDayIsoUTC(raw)
    const next = String(formData.get('next') || '0') === '1'
    const s = await readSession()

    if (!s || !tsFix) {
      redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/m/${encodeURIComponent(raw)}`)}`)
    }

    let oid: string | null = null
    try { oid = await ownerIdForDay(tsFix) } catch { oid = null }
    if (!oid || oid !== s.ownerId) {
      redirect(`/${locale}/account?err=not_owner`)
    }

    const ok = await setPublicDb(tsFix, next)
    revalidatePath(`/${locale}/m/${encodeURIComponent(tsFix.slice(0,10))}`)
    redirect(`/${locale}/m/${encodeURIComponent(tsFix.slice(0,10))}?ok=${ok ? '1' : '0'}`)
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <a href={homeHref} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>
            &larr; Parcels of Time
          </a>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Paiement sécurisé <strong>Stripe</strong>
          </div>
        </div>

        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, lineHeight: '48px', margin: '0 0 6px' }}>
            Merci ❤ Votre journée est réservée
          </h1>
          <p style={{ fontSize: 16, opacity: 0.9, margin: 0 }}>{niceTs}</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18 }}>
          {/* Certificat */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: 18,
              boxShadow: 'var(--shadow-elev1)',
            }}
          >
            <div
              style={{
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: 'var(--color-muted)',
                marginBottom: 10,
              }}
            >
              Votre certificat
            </div>
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
              Télécharger le certificat (PDF)
            </a>
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
              Le PDF est également envoyé par e-mail (pensez aux indésirables).
            </p>
          </div>

          {/* Bloc Marketplace (owner → vendre) */}
          {isOwner && (
            <section style={{marginTop:18, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                Revendre ce certificat (Marketplace)
              </div>
              <form onSubmit={(e)=>{ /* hydratation client si besoin */ }} method="dialog">
                <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                  <label>Prix (€) <input name="price" type="number" min={1} step={1} style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}} /></label>
                  <button formAction={`/api/marketplace/listing`} formMethod="post"
                    style={{padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-primary)', color:'var(--color-on-primary)'}}
                  >Mettre en vente</button>
                </div>
                <p style={{fontSize:12, opacity:.7, marginTop:8}}>Commission 10% (min 1€) prélevée par Parcels of Time.</p>
              </form>
            </section>
          )}

          {/* Bloc Marketplace (acheteur → acheter) */}
          {!isOwner && listing && (
            <section style={{marginTop:18, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)'}}>Annonce</div>
                  <div style={{fontSize:18, fontWeight:800, marginTop:4}}>
                    {listing.price_cents/100} € — {listing.seller_display_name || 'Vendeur'}
                  </div>
                </div>
                <form id="mk-checkout" method="post" action="/api/marketplace/checkout" style={{display:'flex', gap:8}}>
                  <input type="hidden" name="listing_id" value={String(listing.id)} />
                  <input type="email" required name="buyer_email" placeholder="vous@exemple.com"
                        style={{padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10}} />
                  <button style={{padding:'12px 14px', borderRadius:12, border:'none', background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800}}>
                    Acheter
                  </button>
                </form>
              </div>
              <p style={{fontSize:12, opacity:.7, marginTop:8}}>Paiement sécurisé Stripe. PDF transféré au nouvel acquéreur.</p>
            </section>
          )}

          {/* Registre public */}
          <aside
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-muted)' }}>
                Registre public
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
                Statut : <strong>{isPublic ? 'Public' : 'Privé'}</strong>
              </span>
            </div>

            <form action={togglePublic} style={{ display: 'flex', gap: 10 }}>
              <input type="hidden" name="ts" value={tsDay} />
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
                {isPublic ? 'Rendre privé (supprimer du registre)' : 'Rendre public'}
              </button>
              <a
                href={exploreHref}
                style={{
                  textDecoration: 'none',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                Voir le registre →
              </a>
            </form>
          </aside>
        </div>

        {/* Preuve & intégrité */}
        <aside
          style={{
            marginTop: 18,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-muted)' }}>
              Preuve & intégrité
            </div>
            <a
              href={verifyHref}
              style={{
                fontSize: 12,
                textDecoration: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 999,
                padding: '6px 10px',
                color: 'var(--color-text)',
              }}
            >
              API : vérifier →
            </a>
          </div>

          {meta ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, alignItems: 'center' }}>
                <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>ID du certificat</div>
                <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{meta.claimId}</code>
                <button
                  data-copy={meta.claimId}
                  type="button"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  Copier
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, alignItems: 'center' }}>
                <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>SHA-256</div>
                <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{meta.hash}</code>
                <button
                  data-copy={meta.hash}
                  type="button"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  Copier
                </button>
              </div>

              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                Comparez ce hash avec celui imprimé dans le PDF, ou utilisez l’API ci-dessus.
              </p>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Métadonnées non disponibles.</div>
          )}
        </aside>

        {/* ===== ÉDITION (dépliante) ===== */}
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
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: 20 }}>Modifier votre certificat</span>
                <small style={{ fontSize: 13, opacity: 0.75 }}>(9,99 €)</small>
              </span>
              <span aria-hidden style={{ opacity: 0.7 }}>▼</span>
            </summary>

            <div style={{ padding: 16, borderTop: '1px solid var(--color-border)' }}>
              {claim ? (
                <EditClient
                  tsISO={tsDay}
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
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
                  <p style={{ margin: 0 }}>Aucune donnée trouvée pour cette journée.</p>
                </div>
              )}
            </div>
          </details>
        </section>

        <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: 'none',
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              borderRadius: 12,
              padding: '12px 16px',
              fontWeight: 800,
              border: '1px solid transparent',
            }}
          >
            Ouvrir le PDF
          </a>
          <a
            href={homeHref}
            style={{
              textDecoration: 'none',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '12px 16px',
              fontWeight: 700,
            }}
          >
            Retour à l’accueil
          </a>
        </div>
      </section>
    </main>
  )
}
