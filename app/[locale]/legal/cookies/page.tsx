// app/[locale]/legal/cookies/page.tsx
/**
 * Politique Cookies — FR/EN
 * Catégories, consentement, durées, gestion, exemples de cookies (Stripe, session, préférence de langue).
 */

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

export default async function Page({
  params,
}: {
  params: Promise<{ locale: 'fr' | 'en' }>
}) {
  const { locale } = await params
  const fr = locale === 'fr'

  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const SUPPORT_EMAIL =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
  const UPDATED = '2025-01-01'
  const href = (p: string) => `/${locale}${p}`

  // Provider (affichage informatif)
  const ANALYTICS =
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER || 'none' // e.g. 'none' | 'plausible' | 'posthog'

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
          <a href={`/${locale}`} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: .85 }}>
            &larr; {COMPANY_NAME}
          </a>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {fr ? 'Mise à jour' : 'Last updated'} : {UPDATED}
          </span>
        </div>

        <header style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, margin: '0 0 8px' }}>
            {fr ? 'Politique des cookies' : 'Cookie Policy'}
          </h1>
          <p style={{ margin: 0, opacity: .85 }}>
            {fr
              ? "Explication des traceurs utilisés, des choix de consentement et de leur durée."
              : "Explanation of trackers used, consent choices, and their duration."}
          </p>

          <nav aria-label={fr ? 'Liens légaux' : 'Legal links'} style={{ marginTop: 10, fontSize: 12, opacity: .9 }}>
            <a href={href('/legal/privacy')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Confidentialité' : 'Privacy'}
            </a>
            <a href={href('/legal/terms')} style={{ color: 'var(--color-text)' }}>
              {fr ? 'CGU/CGV' : 'Terms'}
            </a>
          </nav>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '1) Catégories de cookies' : '1) Cookie Categories'}</h2>
            <ul style={ulStyle()}>
              <li>
                <strong>{fr ? 'Essentiels' : 'Essential'}</strong> — {fr
                  ? 'sécurité, anti-fraude, session, authentification (ex. cookies de session, anti-CSRF), paiement Stripe.'
                  : 'security, anti-fraud, session, authentication (e.g., session/anti-CSRF), Stripe payment.'}
              </li>
              <li>
                <strong>{fr ? 'Préférences' : 'Preferences'}</strong> — {fr
                  ? 'langue/locale et affichage (ex. sauvegarde du choix fr/en).'
                  : 'language/locale and display (e.g., saving fr/en choice).'}
              </li>
              <li>
                <strong>{fr ? 'Mesure d’audience' : 'Analytics'}</strong> — {fr
                  ? 'métriques agrégées et respectueuses de la vie privée (activées uniquement si vous y consentez).'
                  : 'aggregate, privacy-friendly metrics (enabled only if you consent).'}{' '}
                <span style={{ opacity: .85 }}>
                  {fr ? 'Fournisseur' : 'Provider'}: {ANALYTICS}
                </span>
              </li>
            </ul>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '2) Exemples de cookies' : '2) Examples of Cookies'}</h2>
            <ul style={ulStyle()}>
              <li>
                <strong>Stripe</strong> — {fr
                  ? 'paiement sécurisé (ex. __stripe_mid, __stripe_sid, m).'
                  : 'secure payment (e.g., __stripe_mid, __stripe_sid, m).'}
              </li>
              <li>
                <strong>{fr ? 'Session / Auth' : 'Session / Auth'}</strong> — {fr
                  ? 'maintien de votre session connectée (ex. cookie de session d’application).'
                  : 'keeping you signed-in (e.g., app session cookie).'}
              </li>
              <li>
                <strong>{fr ? 'Préférence de langue' : 'Language preference'}</strong> — {fr
                  ? "mémorise fr/en pour l'interface."
                  : 'stores fr/en for the interface.'}
              </li>
              <li>
                <strong>{fr ? 'Analytics (si activés)' : 'Analytics (if enabled)'}</strong> — {fr
                  ? 'statistiques agrégées sans suivi cross-site.'
                  : 'aggregate stats without cross-site tracking.'}
              </li>
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
              {fr
                ? 'Les noms exacts et durées peuvent varier selon les versions techniques utilisées.'
                : 'Exact names and lifetimes may vary depending on technical versions used.'}
            </p>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '3) Consentement & gestion' : '3) Consent & Management'}</h2>
            <ul style={ulStyle()}>
              <li>
                {fr
                  ? 'Les cookies essentiels sont déposés sans consentement car nécessaires au service.'
                  : 'Essential cookies are set without consent as they are necessary for the service.'}
              </li>
              <li>
                {fr
                  ? 'Pour les cookies non essentiels (analytics/marketing), votre consentement préalable est requis et peut être retiré à tout moment.'
                  : 'For non-essential cookies (analytics/marketing), your prior consent is required and can be withdrawn at any time.'}
              </li>
              <li>
                {fr
                  ? 'Vous pouvez modifier vos préférences via le bandeau cookies (lien “Gérer mes cookies”) ou depuis les réglages de votre navigateur.'
                  : 'You can update your choices via the cookie banner (“Manage cookies”) or through your browser settings.'}
              </li>
            </ul>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '4) Durées de conservation' : '4) Retention Periods'}</h2>
            <ul style={ulStyle()}>
              <li>{fr ? 'Session : pendant la session.' : 'Session: for the session.'}</li>
              <li>
                {fr
                  ? 'Préférences (langue/consentement) : jusqu’à 12 mois.'
                  : 'Preferences (language/consent): up to 12 months.'}
              </li>
              <li>
                {fr
                  ? 'Analytics (si consentis) : jusqu’à 13 mois, en agrégé.'
                  : 'Analytics (if consented): up to 13 months, aggregate.'}
              </li>
            </ul>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '5) En savoir plus' : '5) Learn more'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Pour les traitements, vos droits et les destinataires (Stripe, hébergeur, etc.), consultez notre Politique de confidentialité.'
                : 'For processing details, your rights and recipients (Stripe, hosting, etc.), see our Privacy Policy.'}
            </p>
            <p style={{ margin: 0 }}>
              <a href={href('/legal/privacy')} style={{ color: 'var(--color-text)' }}>
                {fr ? 'Voir la Politique de confidentialité' : 'See the Privacy Policy'}
              </a>
              {' '}· {fr ? 'Support :' : 'Support: ' }
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>

          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
            {fr
              ? 'Document informatif. Les réglages et cookies exacts dépendent de votre configuration et des services activés.'
              : 'Informational document. Exact settings and cookies depend on your configuration and enabled services.'}
          </p>
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
function ulStyle(): CSSProperties {
  return { margin: '0 0 0 18px', lineHeight: 1.7 }
}
