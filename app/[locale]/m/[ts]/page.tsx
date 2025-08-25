// app/[locale]/m/[ts]/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { formatISOAsNice } from '@/lib/date'

type Params = { locale: string; ts: string }

type PublicMinute =
  | { found: false }
  | { found: true; id: string; ts: string; title: string | null; message: string | null }

function safeDecode(v: string) {
  try { return decodeURIComponent(v) } catch { return v }
}

async function getPublicMinuteSafe(tsISO: string): Promise<PublicMinute> {
  // 1) tentative absolue
  try {
    const h = await headers()
    const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https'
    const host  = (h.get('host') || '').split(',')[0].trim()
    if (host) {
      const abs = `${proto}://${host}/api/minutes/${encodeURIComponent(tsISO)}`
      const res = await fetch(abs, { cache: 'no-store' })
      if (res.ok) return res.json()
    }
  } catch {}

  // 2) tentative relative
  try {
    const rel = `/api/minutes/${encodeURIComponent(tsISO)}`
    const res = await fetch(rel, { cache: 'no-store' })
    if (res.ok) return res.json()
  } catch {}

  return { found: false }
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

export default async function Page({ params }: { params: Promise<Params> }) {
  // Next 15: params est une Promise
  const { locale = 'en', ts: tsParam = '' } = await params
  const decodedTs = safeDecode(tsParam)

  // Lecture registre public (sans throw)
  const pub = await getPublicMinuteSafe(decodedTs)

  // URLs
  const pdfHref = `/api/cert/${encodeURIComponent(decodedTs)}`
  const homeHref = `/${locale}`
  const exploreHref = `/${locale}/explore`

  // Format lisible
  let niceTs = decodedTs
  try { niceTs = formatISOAsNice(decodedTs) } catch {}

  // -------- Server Action pour publier/retirer --------
  const togglePublic = async (formData: FormData) => {
    'use server'
    const ts = String(formData.get('ts') || '')
    const next = String(formData.get('next') || '0') === '1'

    // Appel absolu si possible
    let ok = false
    try {
      const h = await headers()
      const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https'
      const host  = (h.get('host') || '').split(',')[0].trim()
      const url = host
        ? `${proto}://${host}/api/minutes/${encodeURIComponent(ts)}/public`
        : `/api/minutes/${encodeURIComponent(ts)}/public`
      const res = await fetch(url, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ is_public: next }),
        cache: 'no-store',
      })
      ok = res.ok
    } catch {}

    // Force un refresh de la page
    revalidatePath(`/${locale}/m/${encodeURIComponent(ts)}`)
    redirect(`/${locale}/m/${encodeURIComponent(ts)}?${ok ? 'ok=1' : 'ok=0'}`)
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
        background: 'var(--color-bg)', color: 'var(--color-text)',
        minHeight: '100vh', fontFamily: 'Inter, system-ui',
      }}
    >
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <a href={homeHref} style={{ textDecoration:'none', color:'var(--color-text)', opacity:.85 }}>&larr; Parcels of Time</a>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Paiement sécurisé <strong>Stripe</strong></div>
        </div>

        {/* Titre + minute */}
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, lineHeight: '48px', margin: '0 0 6px' }}>
            Merci ❤ Votre minute est réservée
          </h1>
          <p style={{ fontSize: 16, opacity: .9, margin: 0 }}>{niceTs}</p>
        </header>

        <div style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:18, alignItems:'start' }}>
          {/* -------- Colonne principale : Certificat -------- */}
          <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:18, boxShadow:'var(--shadow-elev1)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)' }}>Votre certificat</div>
                <div style={{ fontSize:16, opacity:.9 }}>Téléchargez le PDF officiel immédiatement.</div>
              </div>
            </div>

            <a href={pdfHref} target="_blank" rel="noreferrer"
               style={{ display:'inline-flex', alignItems:'center', gap:10, background:'var(--color-primary)', color:'var(--color-on-primary)',
                        padding:'14px 18px', borderRadius:12, fontWeight:800, textDecoration:'none', border:'1px solid transparent' }}>
              Télécharger le certificat (PDF)
            </a>

            <p style={{ margin:'12px 0 0', fontSize:13, color:'var(--color-muted)' }}>
              Le certificat vous est également envoyé par e-mail.<br/>Vérifiez vos indésirables si besoin.
            </p>
          </div>

          {/* -------- Colonne secondaire : Registre public -------- */}
          <aside style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16 }}>
            <div style={{ fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8 }}>
              Registre public (art participatif)
            </div>

            {pub.found ? (
              <div>
                {pub.title && <h3 style={{ margin:'0 0 10px', fontSize:18, fontWeight:700 }}>{pub.title}</h3>}
                {pub.message && (
                  <blockquote style={{ margin:'0 0 10px', fontStyle:'italic', opacity:.95 }}>
                    &ldquo;{pub.message}&rdquo;
                  </blockquote>
                )}
                {!pub.title && !pub.message && (
                  <p style={{ margin:0, opacity:.8 }}>Cette minute est visible dans le registre public, sans texte associé.</p>
                )}
                <p style={{ margin:'10px 0 0', fontSize:12, color:'var(--color-muted)' }}>
                  Entrée anonyme — uniquement les éléments rendus publics.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ margin:0, opacity:.9 }}>
                  Cette minute n’a <strong>pas d’entrée publique</strong> (titre et message privés).
                </p>
                <p style={{ margin:'10px 0 0', fontSize:12, color:'var(--color-muted)' }}>
                  Le registre public est une œuvre participative célébrant l’amour et les réussites — anonyme et optionnelle.
                </p>
              </div>
            )}

            {/* Toggle publier/retirer (Server Action) */}
            <form action={togglePublic}
                  style={{marginTop:12, padding:12, border:'1px solid var(--color-border)', borderRadius:12}}>
              <input type="hidden" name="ts" value={decodedTs} />
              <input type="hidden" name="next" value={pub.found ? '0' : '1'} />
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                <div>
                  <strong>Publier dans le Registre public</strong>
                  <div style={{fontSize:12, color:'var(--color-muted)'}}>
                    Anonyme, modéré. Réversible à tout moment.
                  </div>
                </div>
                <button type="submit"
                        style={{
                          padding:'10px 12px', borderRadius:10,
                          background: pub.found ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: pub.found ? 'var(--color-on-primary)' : 'var(--color-text)',
                          border:'1px solid var(--color-border)', fontWeight:800, cursor:'pointer'
                        }}>
                  {pub.found ? 'Retirer' : 'Publier'}
                </button>
              </div>
            </form>

            <a href={exploreHref}
               style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12, textDecoration:'none',
                        background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)',
                        padding:'10px 12px', borderRadius:10 }}>
              Découvrir le registre public →
            </a>
          </aside>
        </div>

        {/* CTA bas de page */}
        <div style={{ marginTop:18, display:'flex', gap:12, flexWrap:'wrap' }}>
          <a href={pdfHref} target="_blank" rel="noreferrer"
             style={{ textDecoration:'none', background:'var(--color-primary)', color:'var(--color-on-primary)', borderRadius:12,
                      padding:'12px 16px', fontWeight:800, border:'1px solid transparent' }}>
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
