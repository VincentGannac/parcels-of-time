// app/[locale]/legal/legal-notice/page.tsx
import type { CSSProperties } from 'react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const preferredRegion = ['cdg1', 'fra1']

type Locale = 'fr' | 'en'

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
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const fr = locale === 'fr'
  const href = (p: string) => `/${locale}${p}`

  // ——— Identité / contact
  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
  const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL || SUPPORT_EMAIL
  const PRESS_EMAIL = process.env.NEXT_PUBLIC_PRESS_EMAIL || SUPPORT_EMAIL
  const UPDATED = process.env.NEXT_PUBLIC_LEGAL_UPDATED || '2025-11-01'

  // ——— Éditeur (personne physique — micro-entrepreneur)
  const PUBLISHER_NAME = process.env.NEXT_PUBLIC_PUBLISHER_NAME || 'Auto-entrepreneur Vincent GANNAC'
  const PUBLISHER_SIRET = process.env.NEXT_PUBLIC_PUBLISHER_SIRET || '93368883000019'
  const PUBLISHER_ADDR = process.env.NEXT_PUBLIC_PUBLISHER_ADDR || '2 Lotissement Beaupré, St Canadet, 13610 Le Puy-Sainte-Réparade'
  const PUBLISHER_COUNTRY = process.env.NEXT_PUBLIC_PUBLISHER_COUNTRY || 'France'
  const VAT_NOTE =
    process.env.NEXT_PUBLIC_VAT_NOTE ||
    (fr ? 'TVA non applicable, art. 293 B du CGI' : 'VAT not applicable under French Art. 293 B CGI')

  // ——— DPO / confidentialité
  const DPO_EMAIL = process.env.NEXT_PUBLIC_DPO_EMAIL || LEGAL_EMAIL

  // ——— Hébergeur & prestataires
  const HOST_NAME = process.env.NEXT_PUBLIC_HOST_NAME || 'Vercel'
  const HOST_SITE = process.env.NEXT_PUBLIC_HOST_SITE || 'https://vercel.com'
  const DB_NAME = process.env.NEXT_PUBLIC_DB_NAME || 'Supabase'
  const DB_SITE = process.env.NEXT_PUBLIC_DB_SITE || 'https://supabase.com'
  const PAY_NAME = process.env.NEXT_PUBLIC_PAY_NAME || 'Stripe'
  const PAY_SITE = process.env.NEXT_PUBLIC_PAY_SITE || 'https://stripe.com'

  // ——— Médiation de la consommation (CM2C)
  const MEDIATION_NAME =
    process.env.NEXT_PUBLIC_MEDIATION_NAME ||
    'CM2C – Centre de la Médiation de la Consommation de Conciliateurs de Justice'
  const MEDIATION_ADDR = process.env.NEXT_PUBLIC_MEDIATION_ADDR || '49 rue de Ponthieu, 75008 Paris'
  const MEDIATION_TEL = process.env.NEXT_PUBLIC_MEDIATION_TEL || '01 89 47 00 14'
  const MEDIATION_SITE =
    process.env.NEXT_PUBLIC_MEDIATION_SITE || 'https://www.cm2c.net/declarer-un-litige.php'
  const MEDIATION_MAIL = process.env.NEXT_PUBLIC_MEDIATION_MAIL || 'litiges@cm2c.net'

  // ——— Représentant UE (Art. 27 RGPD) si l’éditeur n’est pas établi dans l’UE
  const EU_ESTABLISHED = (process.env.NEXT_PUBLIC_EU_ESTABLISHED || 'true').toLowerCase() === 'true'
  const EU_REP_NAME = process.env.NEXT_PUBLIC_EU_REP_NAME || ''
  const EU_REP_CONTACT = process.env.NEXT_PUBLIC_EU_REP_CONTACT || ''

  // ——— Plateforme européenne de RLL (ODR)
  const ODR_URL = 'https://ec.europa.eu/consumers/odr/'

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
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <a href={`/${locale}`} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>
            &larr; {COMPANY_NAME}
          </a>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {fr ? 'Mise à jour' : 'Last updated'}&nbsp;: {UPDATED}
          </span>
        </div>

        {/* Header */}
        <header style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, margin: '0 0 8px' }}>
            {fr ? 'Mentions légales' : 'Legal Notice'}
          </h1>
          <p style={{ margin: 0, opacity: 0.85 }}>
            {fr
              ? 'Informations exigées par le droit français pour l’éditeur du site, l’hébergement, la médiation et les contacts.'
              : 'Information required by French law for the site publisher, hosting, mediation and contacts.'}
          </p>
          <nav aria-label={fr ? 'Liens légaux' : 'Legal links'} style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
            <a href={href('/legal/terms')} style={link()}>{fr ? 'CGU/CGV' : 'Terms'}</a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/privacy')} style={link()}>{fr ? 'Confidentialité' : 'Privacy'}</a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/cookies')} style={link()}>{fr ? 'Cookies' : 'Cookies'}</a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/refund')} style={link()}>{fr ? 'Remboursements' : 'Refunds'}</a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/seller')} style={link()}>{fr ? 'Conditions Vendeur' : 'Seller Terms'}</a>
          </nav>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Publisher */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Éditeur du site' : 'Site Publisher'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr ? (
                <>
                  <strong>{PUBLISHER_NAME}</strong>
                  <br />
                  SIRET&nbsp;: {formatSiret(PUBLISHER_SIRET)}
                  <br />
                  Adresse professionnelle&nbsp;: {PUBLISHER_ADDR}
                  <br />
                  Pays&nbsp;: {PUBLISHER_COUNTRY}
                  <br />
                  {VAT_NOTE}
                </>
              ) : (
                <>
                  <strong>{PUBLISHER_NAME}</strong>
                  <br />
                  SIRET (France)&nbsp;: {PUBLISHER_SIRET}
                  <br />
                  Business address&nbsp;: {PUBLISHER_ADDR}
                  <br />
                  Country&nbsp;: {PUBLISHER_COUNTRY}
                  <br />
                  {VAT_NOTE}
                </>
              )}
            </p>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  Contact : <a href={`mailto:${LEGAL_EMAIL}`} style={link()}>{LEGAL_EMAIL}</a> • Presse :{' '}
                  <a href={`mailto:${PRESS_EMAIL}`} style={link()}>{PRESS_EMAIL}</a> • Support :{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} style={link()}>{SUPPORT_EMAIL}</a>
                </>
              ) : (
                <>
                  Contact: <a href={`mailto:${LEGAL_EMAIL}`} style={link()}>{LEGAL_EMAIL}</a> • Press:{' '}
                  <a href={`mailto:${PRESS_EMAIL}`} style={link()}>{PRESS_EMAIL}</a> • Support:{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} style={link()}>{SUPPORT_EMAIL}</a>
                </>
              )}
            </p>
          </section>

          {/* Publication director */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Directeur·rice de la publication' : 'Publication Director'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  {PUBLISHER_NAME} — contact&nbsp;: <a href={`mailto:${LEGAL_EMAIL}`} style={link()}>{LEGAL_EMAIL}</a>
                </>
              ) : (
                <>
                  {PUBLISHER_NAME} — contact: <a href={`mailto:${LEGAL_EMAIL}`} style={link()}>{LEGAL_EMAIL}</a>
                </>
              )}
            </p>
          </section>

          {/* Hosting & processors */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Hébergement & prestataires' : 'Hosting & processors'}</h2>
            <ul style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
              <li>
                {fr ? 'Hébergeur applicatif : ' : 'Application hosting: '}
                <a href={HOST_SITE} style={link()}>{HOST_NAME}</a>
              </li>
              <li>
                {fr ? 'Base de données (UE) : ' : 'Managed database (EU): '}
                <a href={DB_SITE} style={link()}>{DB_NAME}</a>
              </li>
              <li>
                {fr ? 'Paiements : ' : 'Payments: '}
                <a href={PAY_SITE} style={link()}>{PAY_NAME}</a>
              </li>
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
              {fr
                ? 'Les coordonnées détaillées de ces prestataires sont disponibles sur leurs sites respectifs.'
                : 'Detailed contact information for these providers is available on their websites.'}
            </p>
          </section>

          {/* GDPR DPO */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Données personnelles (RGPD)' : 'Personal data (GDPR)'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Pour toute demande relative à vos données, écrivez à : '
                : 'For any data request, email: '}
              <a href={`mailto:${DPO_EMAIL}`} style={link()}>{DPO_EMAIL}</a>
              {fr ? '. ' : '. '}
              {fr ? (
                <>
                  Consultez également notre <a href={href('/legal/privacy')} style={link()}>Politique de confidentialité</a>.
                </>
              ) : (
                <>
                  See also our <a href={href('/legal/privacy')} style={link()}>Privacy Policy</a>.
                </>
              )}
            </p>
            {!EU_ESTABLISHED && (EU_REP_NAME || EU_REP_CONTACT) ? (
              <p style={{ margin: 0 }}>
                {fr ? (
                  <>
                    Représentant dans l’UE (art. 27) : <strong>{EU_REP_NAME}</strong> — {EU_REP_CONTACT || '—'}
                  </>
                ) : (
                  <>
                    EU Representative (Art. 27): <strong>{EU_REP_NAME}</strong> — {EU_REP_CONTACT || '—'}
                  </>
                )}
              </p>
            ) : null}
          </section>

          {/* Consumer mediation */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Médiation de la consommation' : 'Consumer mediation'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'En cas de litige non résolu avec notre service client, vous pouvez recourir gratuitement au médiateur suivant :'
                : 'If a dispute remains unresolved with our support, you may refer the matter free of charge to:'}
            </p>
            <p style={{ margin: 0 }}>
              <strong>{MEDIATION_NAME}</strong>
              <br />
              {MEDIATION_ADDR} — {fr ? 'Tél.' : 'Tel.'} {MEDIATION_TEL}
              <br />
              {fr ? 'Site : ' : 'Website: '}
              <a href={MEDIATION_SITE} style={link()}>{MEDIATION_SITE}</a>
              <br />
              E-mail : <a href={`mailto:${MEDIATION_MAIL}`} style={link()}>{MEDIATION_MAIL}</a>
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
              {fr ? (
                <>
                  Plateforme européenne de RLL : <a href={ODR_URL} style={link()}>{ODR_URL}</a>
                </>
              ) : (
                <>
                  EU ODR platform: <a href={ODR_URL} style={link()}>{ODR_URL}</a>
                </>
              )}
            </p>
          </section>

          {/* Intellectual property */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Propriété intellectuelle' : 'Intellectual property'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Sauf mention contraire, les textes, éléments graphiques et interfaces du site sont protégés. Toute reproduction non autorisée est interdite.'
                : 'Unless stated otherwise, texts, graphics and UI are protected. Any unauthorized reproduction is prohibited.'}
            </p>
          </section>

          {/* Responsibility & notice/takedown */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Responsabilité & signalements' : 'Liability & notices'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Les liens externes sont fournis à titre pratique ; nous n’en garantissons pas le contenu. Pour signaler un contenu illicite ou porter atteinte à vos droits :'
                : 'External links are provided for convenience; we do not warrant their content. To report unlawful content or rights infringement:'}
            </p>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  écrivez à <a href={`mailto:${LEGAL_EMAIL}`} style={link()}>{LEGAL_EMAIL}</a> en joignant les
                  informations utiles (URL, description, justificatifs).
                </>
              ) : (
                <>
                  email <a href={`mailto:${LEGAL_EMAIL}`} style={link()}>{LEGAL_EMAIL}</a> with helpful details (URL, description, proof).
                </>
              )}
            </p>
          </section>

          {/* Footer note */}
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
            {fr
              ? 'Ce document est fourni à titre informatif et ne remplace pas un conseil juridique.'
              : 'This document is provided for information only and does not replace legal advice.'}
          </p>
        </div>
      </section>
    </main>
  )
}

function card(): CSSProperties {
  return {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    padding: 16,
  }
}

function h2(): CSSProperties {
  return { margin: '0 0 6px', fontSize: 20 }
}

function link(): CSSProperties {
  return { color: 'var(--color-text)', textDecoration: 'underline', textUnderlineOffset: 3 }
}

function formatSiret(s: string) {
  // Ajoute des espaces pour lecture : 14 chiffres -> 3 3 3 5
  const digits = s.replace(/\D/g, '')
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4') || s
}
