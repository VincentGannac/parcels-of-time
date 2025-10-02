// app/[locale]/legal/seller/page.tsx
/**
 * Conditions Vendeur (Marketplace) — FR/EN
 * Stripe Connect (KYC/KYB), commission, obligations fiscales/comptables, contenus interdits,
 * litiges & médiation (CM2C), ODR, données personnelles (rôles).
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

type Locale = 'fr' | 'en'

export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const fr = locale === 'fr'

  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const SUPPORT_EMAIL =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
  const UPDATED = '2025-01-01'

  // Paramétrables : commission marketplace
  const FEE_PCT =
    Number(process.env.NEXT_PUBLIC_MARKET_FEE_PERCENT || 15) // %
  const FEE_MIN =
    Number(process.env.NEXT_PUBLIC_MARKET_FEE_MIN_EUR || 1) // € min

  // Médiation (CM2C)
  const MEDIATOR = {
    name: process.env.NEXT_PUBLIC_MEDIATOR_NAME || 'CM2C',
    address:
      process.env.NEXT_PUBLIC_MEDIATOR_ADDR ||
      '49 rue de Ponthieu, 75008 Paris, France',
    phone: process.env.NEXT_PUBLIC_MEDIATOR_PHONE || '01 89 47 00 14',
    site:
      process.env.NEXT_PUBLIC_MEDIATOR_DECL_URL ||
      'https://www.cm2c.net/declarer-un-litige.php',
    email:
      process.env.NEXT_PUBLIC_MEDIATOR_EMAIL || 'litiges@cm2c.net',
  } as const
  const ODR_URL = 'https://ec.europa.eu/consumers/odr'

  const href = (p: string) => `/${locale}${p}`

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
            {fr ? 'Conditions Vendeur (Marketplace)' : 'Seller Terms (Marketplace)'}
          </h1>
          <p style={{ margin: 0, opacity: .85 }}>
            {fr
              ? "Règles applicables aux vendeurs sur la marketplace opérée par la plateforme."
              : "Rules for sellers on the marketplace operated by the platform."}
          </p>

          <nav aria-label={fr ? 'Liens légaux' : 'Legal links'} style={{ marginTop: 10, fontSize: 12, opacity: .9 }}>
            <a href={href('/legal/terms')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'CGU/CGV' : 'Terms'}
            </a>
            <a href={href('/legal/privacy')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Confidentialité' : 'Privacy'}
            </a>
            <a href={href('/legal/cookies')} style={{ color: 'var(--color-text)' }}>
              {fr ? 'Cookies' : 'Cookies'}
            </a>
          </nav>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '1. Champ d’application' : '1. Scope'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? `Ces conditions complètent les CGU/CGV pour toute mise en vente d’un certificat numérique sur la marketplace ${COMPANY_NAME}.`
                : `These terms supplement the general Terms for any listing of a digital certificate on ${COMPANY_NAME}'s marketplace.`}
            </p>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '2. Accès & éligibilité' : '2. Access & Eligibility'}</h2>
            <ul style={ulStyle()}>
              <li>
                {fr
                  ? 'Âge minimum 18 ans, compte valide et e-mail confirmé.'
                  : 'Minimum age 18, valid account and confirmed email.'}
              </li>
              <li>
                {fr
                  ? 'Ouverture d’un compte Stripe Connect et vérification KYC/KYB obligatoires.'
                  : 'Opening a Stripe Connect account and passing KYC/KYB checks is mandatory.'}
              </li>
              <li>
                {fr
                  ? 'Un compte bancaire éligible est requis pour les virements.'
                  : 'An eligible bank account is required for payouts.'}
              </li>
            </ul>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '3. Stripe Connect & paiements' : '3. Stripe Connect & Payments'}</h2>
            <ul style={ulStyle()}>
              <li>
                {fr
                  ? 'La plateforme agit comme mandataire d’encaissement ; Stripe traite les paiements et virements.'
                  : 'The platform acts as collection agent; Stripe processes payments and payouts.'}
              </li>
              <li>
                {fr
                  ? 'Les contestations (chargebacks) et frais associés peuvent être imputés au vendeur si le litige lui est opposable.'
                  : 'Disputes (chargebacks) and related fees may be charged to the seller where attributable.'}
              </li>
              <li>
                {fr
                  ? 'Un solde négatif peut être compensé sur des paiements ultérieurs.'
                  : 'Negative balances may be offset against future payments.'}
              </li>
            </ul>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '4. Frais & facturation' : '4. Fees & Invoicing'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? `Commission plateforme : ${FEE_PCT}% (minimum ${FEE_MIN.toFixed(0)} €) prélevée sur le montant de la vente. Les frais moyens de paiement peuvent s’ajouter selon Stripe.`
                : `Platform fee: ${FEE_PCT}% (minimum €${FEE_MIN.toFixed(0)}) charged on the sale amount. Standard payment fees may apply per Stripe.`}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Vous demeurez seul responsable de vos obligations fiscales et comptables (déclaration de revenus, TVA le cas échéant).'
                : 'You remain solely responsible for your tax and accounting obligations (income reporting, VAT if applicable).'}
            </p>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '5. Annonces, droits & garanties' : '5. Listings, IP & Warranties'}</h2>
            <ul style={ulStyle()}>
              <li>
                {fr
                  ? 'Vous garantissez détenir les droits nécessaires sur le titre, la description et tout média utilisé.'
                  : 'You warrant you hold necessary rights to titles, descriptions, and any media used.'}
              </li>
              <li>
                {fr
                  ? 'Les informations publiées doivent être exactes, non trompeuses, conformes à la loi.'
                  : 'Published information must be accurate, not misleading, and lawful.'}
              </li>
              <li>
                {fr
                  ? 'Contenus interdits : illégaux, haineux, diffamatoires, contrefaisants, données personnelles sensibles.'
                  : 'Prohibited content: unlawful, hateful, defamatory, infringing, sensitive personal data.'}
              </li>
            </ul>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '6. Relation acheteur-vendeur' : '6. Buyer–Seller Relationship'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Le contrat de vente est conclu entre l’acheteur et vous ; la plateforme fournit l’infrastructure et l’encaissement.'
                : 'The sale contract is between buyer and you; the platform provides infrastructure and collection.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Les certificats numériques ne sont ni retournables ni échangeables, sauf erreur technique ou facturation.'
                : 'Digital certificates are non-returnable and non-exchangeable, except in case of technical or billing errors.'}
            </p>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '7. Données & conformité' : '7. Data & Compliance'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? 'La plateforme est responsable de traitement pour l’animation de la marketplace ; Stripe agit en qualité de prestataire de paiement indépendant. Voir Politique de confidentialité pour les détails RGPD.'
                : 'The platform is data controller for marketplace operations; Stripe is an independent payment service provider. See the Privacy Policy for GDPR details.'}
            </p>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '8. Modération, suspension' : '8. Moderation & Suspension'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Nous pouvons déréférencer une annonce, retenir un paiement, ou suspendre un compte en cas de risque de fraude, de violation des règles ou d’obligation légale.'
                : 'We may delist a listing, hold a payout, or suspend an account in case of fraud risk, rule breach, or legal requirement.'}
            </p>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '9. Litiges & médiation' : '9. Disputes & Mediation'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'En cas de litige B2C, contactez d’abord notre support. À défaut de réponse sous 30 jours, le consommateur peut saisir gratuitement le médiateur :'
                : 'For B2C disputes, contact our support first. If unresolved within 30 days, the consumer may refer the matter free of charge to the mediator:'}
            </p>
            <ul style={ulStyle()}>
              <li><strong>{MEDIATOR.name}</strong> — {MEDIATOR.address}, {MEDIATOR.phone}</li>
              <li>
                <a href={MEDIATOR.site} style={{ color: 'var(--color-text)' }}>
                  {MEDIATOR.site}
                </a>{' '}
                — <a href={`mailto:${MEDIATOR.email}`} style={{ color: 'var(--color-text)' }}>{MEDIATOR.email}</a>
              </li>
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
              {fr
                ? 'Plateforme européenne de RLL/ODR : '
                : 'EU ODR platform: '}
              <a href={ODR_URL} style={{ color: 'var(--color-text)' }}>{ODR_URL}</a>
            </p>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '10. Contact' : '10. Contact'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? 'Support : ' : 'Support: '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>

          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
            {fr
              ? 'Document informatif. Prévalent les CGU/CGV et les conditions Stripe applicables.'
              : 'Informational document. The platform Terms and applicable Stripe terms prevail.'}
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
