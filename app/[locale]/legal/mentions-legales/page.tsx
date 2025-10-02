// app/legal/mentions-legales/page.tsx
/**
 * Mentions légales (FR)
 * Remplissez les TODO (raison sociale, SIREN/SIRET, adresse, direction de la publication).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const preferredRegion = ['cdg1', 'fra1']

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

export default function Page() {
  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const COMPANY_LEGAL_NAME = process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || '*** Raison sociale à compléter ***'
  const COMPANY_ADDRESS = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '*** Adresse du siège à compléter ***'
  const COMPANY_SIREN = process.env.NEXT_PUBLIC_COMPANY_SIREN || '*** SIREN/SIRET ***'
  const COMPANY_PUBLICATION = process.env.NEXT_PUBLIC_PUBLICATION_DIRECTOR || '*** Directeur·rice de la publication ***'
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
  const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL || SUPPORT_EMAIL
  const HOST_NAME = process.env.NEXT_PUBLIC_HOST_NAME || 'Vercel Inc.'
  const HOST_ADDR = process.env.NEXT_PUBLIC_HOST_ADDRESS || '340 S Lemon Ave #4133, Walnut, CA 91789, USA'
  const UPDATED = '2025-01-01'

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
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <a href="/" style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>
            &larr; {COMPANY_NAME}
          </a>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Mise à jour : {UPDATED}</span>
        </div>

        <header style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, margin: '0 0 8px' }}>Mentions légales</h1>
          <p style={{ margin: 0, opacity: 0.85 }}>Informations obligatoires relatives à l’éditeur du site.</p>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Éditeur du site</h2>
            <p style={{ margin: '0 0 8px' }}>
              <strong>{COMPANY_LEGAL_NAME}</strong>
              <br />
              {COMPANY_ADDRESS}
              <br />
              Identifiant : {COMPANY_SIREN}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>
              Contact :{' '}
              <a href={`mailto:${LEGAL_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                {LEGAL_EMAIL}
              </a>
            </p>
          </section>

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Directeur·rice de la publication</h2>
            <p style={{ margin: 0 }}>{COMPANY_PUBLICATION}</p>
          </section>

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Hébergement</h2>
            <p style={{ margin: '0 0 6px' }}>
              {HOST_NAME}
              <br />
              {HOST_ADDR}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>
              Infrastructure majoritairement déployée en Europe (régions préférées&nbsp;: cdg1/fra1).
            </p>
          </section>

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Contact</h2>
            <p style={{ margin: '0 0 8px' }}>
              Support :{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                {SUPPORT_EMAIL}
              </a>
              <br />
              Juridique :{' '}
              <a href={`mailto:${LEGAL_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                {LEGAL_EMAIL}
              </a>
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
              Pour toute notification de contenu illicite, merci d’ajouter les URL précises et le motif.
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
