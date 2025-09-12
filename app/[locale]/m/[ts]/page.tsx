export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { formatISOAsNice } from '@/lib/date'
import { pool } from '@/lib/db'
import EditClient from './EditClient'

type Params = { locale: string; ts: string }
function safeDecode(v: string) { try { return decodeURIComponent(v) } catch { return v } }

async function getPublicState(tsISO: string): Promise<boolean> {
  try {
    const h = await headers()
    const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https'
    const host  = (h.get('host') || '').split(',')[0].trim()
    const url = host ? `${proto}://${host}/api/minutes/${encodeURIComponent(tsISO)}/public`
                     : `/api/minutes/${encodeURIComponent(tsISO)}/public`
    const r = await fetch(url, { cache:'no-store' })
    if (r.ok) { const j = await r.json(); return !!j?.is_public }
  } catch {}
  return false
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
  time_display: 'utc'|'utc+local'|'local+utc' | null
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
        where c.ts = $1::timestamptz`,
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
  } catch (e) { console.warn('[minute] getClaimForEdit error', e); return null }
}

async function getClaimMeta(tsISO: string) {
  try {
    const { rows } = await pool.query(
      `select id as claim_id, cert_hash from claims where ts=$1::timestamptz`,
      [tsISO]
    )
    if (!rows.length) return null
    return { claimId: String(rows[0].claim_id), hash: String(rows[0].cert_hash || '') }
  } catch { return null }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { locale = 'en', ts: tsParam = '' } = await params
  const decodedTs = safeDecode(tsParam)

  // Données “public/tech”
  const isPublic = await getPublicState(decodedTs)
  const meta = await getClaimMeta(decodedTs)

  // Données d’édition
  const claim = await getClaimForEdit(decodedTs)

  const pdfHref = `/api/cert/${encodeURIComponent(decodedTs)}`
  const homeHref = `/${locale}`
  const exploreHref = `/${locale}/explore`
  const verifyHref = `/api/verify?ts=${encodeURIComponent(decodedTs)}`

  let niceTs = decodedTs
  try { niceTs = formatISOAsNice(decodedTs) } catch {}

  const togglePublic = async (formData: FormData) => {
    'use server'
    const ts = String(formData.get('ts') || '')
    const next = String(formData.get('next') || '0') === '1'
    let ok = false
    try {
      const h = await headers()
      const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https'
      const host  = (h.get('host') || '').split(',')[0].trim()
      const url = host ? `${proto}://${host}/api/minutes/${encodeURIComponent(ts)}/public`
                       : `/api/minutes/${encodeURIComponent(ts)}/public`
      const res = await fetch(url, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ is_public: next }), cache:'no-store'
      })
      ok = res.ok
    } catch {}
    revalidatePath(`/${locale}/m/${encodeURIComponent(ts)}`)
    redirect(`/${locale}/m/${encodeURIComponent(ts)}?ok=${ok?'1':'0'}`)
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
        background:'var(--color-bg)', color:'var(--color-text)', minHeight:'100vh', fontFamily:'Inter, system-ui',
      }}
    >
      <section style={{ maxWidth:1200, margin:'0 auto', padding:'48px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <a href={homeHref} style={{ textDecoration:'none', color:'var(--color-text)', opacity:.85 }}>&larr; Parcels of Time</a>
          <div style={{ fontSize:12, color:'var(--color-muted)' }}>Paiement sécurisé <strong>Stripe</strong></div>
        </div>

        <header style={{ marginBottom:16 }}>
          <h1 style={{ fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:'0 0 6px' }}>
            Merci ❤ Votre journée est réservée
          </h1>
          <p style={{ fontSize:16, opacity:.9, margin:0 }}>{niceTs}</p>
        </header>

        <div style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:18 }}>
          {/* Certificat */}
          <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:18, boxShadow:'var(--shadow-elev1)' }}>
            <div style={{ fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:10 }}>
              Votre certificat
            </div>
            <a href={pdfHref} target="_blank" rel="noreferrer"
               style={{ display:'inline-flex', gap:10, background:'var(--color-primary)', color:'var(--color-on-primary)',
                        padding:'14px 18px', borderRadius:12, fontWeight:800, textDecoration:'none', border:'1px solid transparent' }}>
              Télécharger le certificat (PDF)
            </a>
            <p style={{ margin:'12px 0 0', fontSize:13, color:'var(--color-muted)' }}>
              Le PDF est également envoyé par e-mail (pensez aux indésirables).
            </p>
          </div>

          {/* Registre public */}
          <aside style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)' }}>
                Registre public
              </div>
              <span style={{
                padding:'6px 10px', borderRadius:999,
                background: isPublic ? 'rgba(14,170,80,.18)' : 'rgba(120,130,150,.18)',
                border:'1px solid var(--color-border)', fontSize:12,
              }}>
                Statut : <strong>{isPublic ? 'Public' : 'Privé'}</strong>
              </span>
            </div>

            <form action={togglePublic} style={{ display:'flex', gap:10 }}>
              <input type="hidden" name="ts" value={decodedTs} />
              <input type="hidden" name="next" value={isPublic ? '0' : '1'} />
              <button type="submit"
                      style={{
                        padding:'10px 12px', borderRadius:10,
                        background: isPublic ? 'var(--color-surface)' : 'var(--color-primary)',
                        color: isPublic ? 'var(--color-text)' : 'var(--color-on-primary)',
                        border:'1px solid var(--color-border)', fontWeight:800, cursor:'pointer'
                      }}>
                {isPublic ? 'Rendre privé (supprimer du registre)' : 'Rendre public'}
              </button>
              <a href={exploreHref}
                 style={{ textDecoration:'none', background:'transparent', color:'var(--color-text)',
                          border:'1px solid var(--color-border)', borderRadius:10, padding:'10px 12px' }}>
                Voir le registre →
              </a>
            </form>
          </aside>
        </div>

        {/* Preuve & intégrité */}
        <aside
          style={{
            marginTop:18,
            background:'var(--color-surface)',
            border:'1px solid var(--color-border)',
            borderRadius:16, padding:16
          }}
        >
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)' }}>
              Preuve & intégrité
            </div>
            <a href={verifyHref}
               style={{fontSize:12, textDecoration:'none', border:'1px solid var(--color-border)', borderRadius:999, padding:'6px 10px', color:'var(--color-text)'}}>
              API : vérifier →
            </a>
          </div>

          {meta ? (
            <div style={{ display:'grid', gap:10 }}>
              <div style={{display:'grid', gridTemplateColumns:'140px 1fr auto', gap:10, alignItems:'center'}}>
                <div style={{color:'var(--color-muted)', fontSize:13}}>ID du certificat</div>
                <code style={{fontSize:13, wordBreak:'break-all'}}>{meta.claimId}</code>
                <button
                  data-copy={meta.claimId}
                  type="button"
                  style={{padding:'8px 10px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', cursor:'pointer'}}
                >
                  Copier
                </button>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'140px 1fr auto', gap:10, alignItems:'center'}}>
                <div style={{color:'var(--color-muted)', fontSize:13}}>SHA-256</div>
                <code style={{fontSize:13, wordBreak:'break-all'}}>{meta.hash}</code>
                <button
                  data-copy={meta.hash}
                  type="button"
                  style={{padding:'8px 10px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', cursor:'pointer'}}
                >
                  Copier
                </button>
              </div>

              <p style={{margin:'6px 0 0', fontSize:12, color:'var(--color-muted)'}}>
                Comparez ce hash avec celui imprimé dans le PDF, ou utilisez l’API ci-dessus.
              </p>
            </div>
          ) : (
            <div style={{fontSize:13, color:'var(--color-muted)'}}>Métadonnées non disponibles.</div>
          )}
        </aside>

        {/* ======= ÉDITION (9,99 €) ======= */}
        <section style={{ marginTop:24 }}>
          <h2 style={{ fontFamily:'Fraunces, serif', fontSize:28, margin:'0 0 12px' }}>
            Modifier votre certificat <small style={{fontSize:14, opacity:.7}}>(9,99 €)</small>
          </h2>

          {claim ? (
            <EditClient
              tsISO={decodedTs}
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
            <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:16 }}>
              <p style={{ margin:0 }}>Aucune donnée trouvée pour cette journée. Assurez-vous que l’URL contient bien un horodatage valide.</p>
            </div>
          )}
        </section>

        <div style={{ marginTop:18, display:'flex', gap:12, flexWrap:'wrap' }}>
          <a href={pdfHref} target="_blank" rel="noreferrer"
             style={{ textDecoration:'none', background:'var(--color-primary)', color:'var(--color-on-primary)',
                      borderRadius:12, padding:'12px 16px', fontWeight:800, border:'1px solid transparent' }}>
            Ouvrir le PDF
          </a>
          <a href={homeHref}
             style={{ textDecoration:'none', background:'var(--color-surface)', color:'var(--color-text)',
                      border:'1px solid var(--color-border)', borderRadius:12, padding:'12px 16px', fontWeight:700 }}>
            Retour à l’accueil
          </a>
        </div>
      </section>
    </main>
  )
}
