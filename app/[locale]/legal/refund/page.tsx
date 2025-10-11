// app/[locale]/legal/refund/page.tsx
import type { CSSProperties } from 'react'

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

type Locale = 'fr' | 'en'

export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const fr = locale === 'fr'

  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <a href={`/${locale}`} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>
            &larr; {COMPANY_NAME}
          </a>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {fr ? 'Mise à jour' : 'Updated'} : {UPDATED}
          </span>
        </div>

        <header style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, margin: '0 0 8px' }}>
            {fr ? 'Remboursements & droit de rétractation' : 'Refund & Withdrawal Policy'}
          </h1>
          <p style={{ margin: 0, opacity: 0.85 }}>
            {fr ? 'Règles applicables aux certificats numériques.' : 'Rules applicable to digital certificates.'}
          </p>
          <nav aria-label={fr ? 'Liens légaux' : 'Legal links'} style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
            <a href={`/${locale}/legal/terms`} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Conditions générales' : 'Terms & Conditions'}
            </a>
            <a href={`/${locale}/legal/privacy`} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Confidentialité' : 'Privacy'}
            </a>
            <a href={`/${locale}/legal/cookies`} style={{ color: 'var(--color-text)' }}>
              {fr ? 'Cookies' : 'Cookies'}
            </a>
          </nav>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Digital content */}
          <section style={cardStyle()}>
            <h2 style={h2Style()}>
              {fr ? 'Contenu numérique et exécution immédiate' : 'Digital Content & Immediate Execution'}
            </h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr ? (
                <>
                  Les certificats vendus sont des <strong>contenus numériques fournis immédiatement</strong> (génération
                  du PDF et lien de téléchargement dès le paiement). En procédant au paiement, vous consentez à
                  l’exécution immédiate et <strong>renoncez expressément à votre droit de rétractation</strong> (directive UE).
                </>
              ) : (
                <>
                  Certificates are <strong>digital content delivered immediately</strong> (PDF generation and download
                  link upon payment). By completing payment, you consent to immediate execution and{' '}
                  <strong>explicitly waive your right of withdrawal</strong> (EU directive).
                </>
              )}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
              {fr ? 'Cette information est rappelée au moment du paiement.' : 'This notice is shown again at checkout.'}
            </p>
          </section>

          {/* Billing errors */}
          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? 'Erreurs de facturation & doublons' : 'Billing Errors & Duplicates'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  En cas de <strong>paiement en double</strong>, d’erreur manifeste ou de problème technique empêchant la
                  livraison du certificat, contactez-nous à{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                    {SUPPORT_EMAIL}
                  </a>
                  . Nous investiguerons et procéderons, le cas échéant, à un remboursement.
                </>
              ) : (
                <>
                  In case of a <strong>duplicate payment</strong>, obvious error, or technical issue preventing
                  certificate delivery, contact us at{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                    {SUPPORT_EMAIL}
                  </a>
                  . We will investigate and refund where applicable.
                </>
              )}
            </p>
          </section>

          {/* Marketplace */}
          <section style={cardStyle()}>
            <h2 style={h2Style()}>Marketplace</h2>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  Les reventes entre utilisateurs sont traitées via un paiement sécurisé. Une <strong>commission</strong>{' '}
                  est prélevée lors de la transaction réussie. Les certificats ne sont ni retournables ni échangeables.
                </>
              ) : (
                <>
                  User-to-user resales are processed via secure payment. A <strong>commission</strong> is applied upon a
                  successful transaction. Certificates are neither returnable nor exchangeable.
                </>
              )}
            </p>
          </section>

          <footer style={{ marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}>
            {fr ? 'Besoin d’aide ? ' : 'Need help? '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
              {SUPPORT_EMAIL}
            </a>
          </footer>
        </div>
      </section>
    </main>
  )
}

function cardStyle(): CSSProperties {
  return {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    padding: 16,
  }
}

function h2Style(): CSSProperties {
  return { margin: '0 0 6px', fontSize: 20 }
}
