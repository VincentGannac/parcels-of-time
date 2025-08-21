// app/m/[ts]/page.tsx
import { formatISOAsNice } from '@/lib/date'
import { absoluteUrl } from '@/lib/url'

type Params = { ts: string }

type PublicMinute =
  | { found: false }
  | { found: true; id: string; ts: string; title: string | null; message: string | null }

async function getPublicMinute(ts: string): Promise<PublicMinute> {
  const url = await absoluteUrl(`/api/minutes/${encodeURIComponent(ts)}`)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return { found: false }
  return res.json()
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
  const { ts } = await params
  const decodedTs = decodeURIComponent(ts)

  // Registre public minimal (optionnel)
  const pub = await getPublicMinute(decodedTs)

  const pdfHref = `/api/cert/${encodeURIComponent(decodedTs)}`
  const homeHref = `/`
  const exploreHref = `/explore` // page d’exploration du registre (adapter si nécessaire)

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
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <a href={homeHref} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>&larr; Parcels of Time</a>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Paiement sécurisé <strong>Stripe</strong></div>
        </div>

        {/* Titre + minute */}
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, lineHeight: '48px', margin: '0 0 6px' }}>
            Merci ❤ Votre minute est réservée
          </h1>
          <p style={{ fontSize: 16, opacity: 0.9, margin: 0 }}>{formatISOAsNice(decodedTs)}</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, alignItems: 'start' }}>
          {/* -------- Colonne principale : Certificat -------- */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-elev1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-muted)' }}>Votre certificat</div>
                <div style={{ fontSize: 16, opacity: .9 }}>Téléchargez le PDF officiel immédiatement.</div>
              </div>
            </div>

            <a
              href={pdfHref}
              target="_blank"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
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
              Le certificat vous est également envoyé par e-mail.<br />
              Pensez à vérifier votre boîte de réception (et vos indésirables).
            </p>
          </div>

          {/* -------- Colonne secondaire : Registre public -------- */}
          <aside
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-muted)', marginBottom: 8 }}>
              Registre public (art participatif)
            </div>

            {pub.found ? (
              <div>
                {pub.title && (
                  <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700 }}>{pub.title}</h3>
                )}
                {pub.message && (
                  <blockquote style={{ margin: '0 0 10px', fontStyle: 'italic', opacity: .95 }}>
                    &ldquo;{pub.message}&rdquo;
                  </blockquote>
                )}
                {!pub.title && !pub.message && (
                  <p style={{ margin: 0, opacity: .8 }}>Cette minute est visible dans le registre public, sans texte associé.</p>
                )}
                <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  Entrée anonyme — uniquement les éléments rendus publics par le·la propriétaire.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ margin: 0, opacity: .9 }}>
                  Cette minute n’a <strong>pas d’entrée publique</strong> (titre et message privés).
                </p>
                <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  Le registre public est une œuvre participative célébrant l’amour et les réussites — anonyme et optionnelle.
                </p>
              </div>
            )}

            <a
              href={exploreHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                textDecoration: 'none',
                background: 'transparent',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                padding: '10px 12px',
                borderRadius: 10,
              }}
            >
              Découvrir le registre public →
            </a>
          </aside>
        </div>

        {/* CTA bas de page */}
        <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href={pdfHref}
            target="_blank"
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
