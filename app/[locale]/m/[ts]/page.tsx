// app/[locale]/m/[ts]/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { headers } from 'next/headers'
import { pool } from '@/lib/db'
import { formatISOAsNice } from '@/lib/date'

type PublicMinute =
  | { found: false }
  | { found: true; id: string; ts: string; title: string | null; message: string | null }

function safeDecode(v: string) {
  try { return decodeURIComponent(v) } catch { return v }
}

async function getPublicMinuteSafe(tsISO: string): Promise<PublicMinute> {
  // 1) fetch absolu
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

  // 2) fetch relatif
  try {
    const rel = `/api/minutes/${encodeURIComponent(tsISO)}`
    const res = await fetch(rel, { cache: 'no-store' })
    if (res.ok) return res.json()
  } catch {}

  // 3) fallback DB direct (jamais throw)
  try {
    const { rows } = await pool.query(
      `select id, ts, title, message from minute_public where ts=$1::timestamptz`,
      [tsISO]
    )
    if (rows.length) {
      const r = rows[0]
      return {
        found: true,
        id: String(r.id),
        ts: new Date(r.ts).toISOString(),
        title: r.title ?? null,
        message: r.message ?? null,
      }
    }
    const q2 = await pool.query(
      `select c.id, c.ts,
              case when c.title_public   then c.title   else null end as title,
              case when c.message_public then c.message else null end as message
         from claims c
        where c.ts=$1::timestamptz`,
      [tsISO]
    )
    if (q2.rows.length) {
      const r = q2.rows[0]
      return {
        found: true,
        id: String(r.id),
        ts: new Date(r.ts).toISOString(),
        title: r.title,
        message: r.message,
      }
    }
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

export default async function Page(
  { params }: { params: Promise<{ locale: string; ts: string }> }
) {
  // ← Next 15 : params est une Promise
  let locale = 'en'
  let tsParam = ''
  try {
    const p = await params
    locale = p.locale || 'en'
    tsParam = p.ts || ''
  } catch {}

  const decodedTs = safeDecode(tsParam)

  // Lis le registre public (sans jamais throw)
  const pub = await getPublicMinuteSafe(decodedTs)

  // URLs UI
  const pdfHref = `/api/cert/${encodeURIComponent(decodedTs)}`
  const homeHref = `/${locale}`
  const exploreHref = `/${locale}/explore`

  // format lisible : si ça jette, on garde l’ISO brut
  let niceTs = decodedTs
  try { niceTs = formatISOAsNice(decodedTs) } catch {}

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <a href={homeHref} style={{ textDecoration:'none', color:'var(--color-text)', opacity:.85 }}>&larr; Parcels of Time</a>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Paiement sécurisé <strong>Stripe</strong></div>
        </div>

        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, lineHeight: '48px', margin: '0 0 6px' }}>
            Merci ❤ Votre minute est réservée
          </h1>
          <p style={{ fontSize: 16, opacity: .9, margin: 0 }}>{niceTs}</p>
        </header>

        <div style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:18, alignItems:'start' }}>
          <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:18, boxShadow:'var(--shadow-elev1)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)' }}>Votre certificat</div>
                <div style={{ fontSize:16, opacity:.9 }}>Téléchargez le PDF officiel immédiatement.</div>
              </div>
            </div>

            <a href={pdfHref} target="_blank"
               style={{ display:'inline-flex', alignItems:'center', gap:10, background:'var(--color-primary)', color:'var(--color-on-primary)',
                        padding:'14px 18px', borderRadius:12, fontWeight:800, textDecoration:'none', border:'1px solid transparent' }}>
              Télécharger le certificat (PDF)
            </a>

            <p style={{ margin:'12px 0 0', fontSize:13, color:'var(--color-muted)' }}>
              Le certificat vous est également envoyé par e-mail.<br/>Vérifiez vos indésirables si besoin.
            </p>
          </div>

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

            <a href={exploreHref}
               style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12, textDecoration:'none',
                        background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)',
                        padding:'10px 12px', borderRadius:10 }}>
              Découvrir le registre public →
            </a>
          </aside>
        </div>

        <div style={{ marginTop:18, display:'flex', gap:12, flexWrap:'wrap' }}>
          <a href={pdfHref} target="_blank"
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
