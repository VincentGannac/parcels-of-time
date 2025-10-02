// app/[locale]/legal/terms/page.tsx
/**
 * CGU/CGV (FR/EN) — version unifiée et bilingue
 * Conforme : exécution immédiate contenu numérique (UE 2011/83/UE), marketplace (commission 15% min 1 €),
 * Stripe Connect (mandat d’encaissement), informations précontractuelles essentielles.
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

  const COMPANY_NAME = 'Parcels of Time'
  const SUPPORT_EMAIL = 'support@parcelsoftime.com'
  const UPDATED = '2025-11-01'

  // Médiateur (avec fallback ENV si tu veux varier plus tard)
  const MEDIATOR = {
    name: process.env.NEXT_PUBLIC_MEDIATOR_NAME || 'CM2C',
    address: process.env.NEXT_PUBLIC_MEDIATOR_ADDR || '49 rue de Ponthieu, 75008 Paris, France',
    phone: process.env.NEXT_PUBLIC_MEDIATOR_PHONE || '+33 1 89 47 00 14',
    site: process.env.NEXT_PUBLIC_MEDIATOR_DECL_URL || 'https://www.cm2c.net/declarer-un-litige.php',
    email: process.env.NEXT_PUBLIC_MEDIATOR_EMAIL || 'litiges@cm2c.net',
  } as const
  const ODR_URL = 'https://ec.europa.eu/consumers/odr'

  const href = (p: string) => `/${locale}${p}`

  const toc: Array<[string, string]> = fr
    ? [
        ['1. Définitions', '#def'],
        ['2. Compte', '#acc'],
        ['3. Achat & prix', '#buy'],
        ['4. Livraison numérique', '#delivery'],
        ['5. Rétractation', '#withdraw'],
        ['6. Contenus & modération', '#ugc'],
        ['7. Marketplace', '#market'],
        ['8. Paiements', '#pay'],
        ['9. Responsabilité', '#liability'],
        ['10. Suspension', '#susp'],
        ['11. Résiliation', '#term'],
        ['12. Droit applicable', '#law'],
        ['13. Médiation de la consommation', '#med'],
        ['14. Plateforme RLL (UE)', '#odr'],
        ['15. Contact', '#contact'],
      ]
    : [
        ['1. Definitions', '#def'],
        ['2. Account', '#acc'],
        ['3. Purchase & Pricing', '#buy'],
        ['4. Digital Delivery', '#delivery'],
        ['5. Withdrawal Right', '#withdraw'],
        ['6. Content & Moderation', '#ugc'],
        ['7. Marketplace', '#market'],
        ['8. Payments', '#pay'],
        ['9. Liability', '#liability'],
        ['10. Suspension', '#susp'],
        ['11. Termination', '#term'],
        ['12. Governing Law', '#law'],
        ['13. Consumer Mediation', '#med'],
        ['14. EU ODR Platform', '#odr'],
        ['15. Contact', '#contact'],
      ]

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
          <a href={`/${locale}`} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>
            &larr; {COMPANY_NAME}
          </a>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {fr ? 'Mise à jour' : 'Last updated'} : {UPDATED}
          </span>
        </div>

        <header style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, margin: '0 0 8px' }}>
            {fr ? 'Conditions générales (CGU/CGV)' : 'Terms & Conditions'}
          </h1>
          <p style={{ margin: 0, opacity: 0.85 }}>
            {fr
              ? "Utilisation du service et vente de certificats numériques. Version bilingue à valeur informative."
              : 'Use of the service and sale of digital certificates. Bilingual informative version.'}
          </p>
          <nav aria-label={fr ? 'Liens légaux' : 'Legal links'} style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
            <a href={href('/legal/legal-notice')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Mentions légales' : 'Legal Notice'}
            </a>
            <a href={href('/legal/privacy')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Confidentialité' : 'Privacy'}
            </a>
            <a href={href('/legal/cookies')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Cookies' : 'Cookies'}
            </a>
            <a href={href('/legal/seller')} style={{ color: 'var(--color-text)' }}>
              {fr ? 'Conditions Vendeur' : 'Seller Terms'}
            </a>
          </nav>
        </header>

        {/* Sommaire */}
        <nav aria-label={fr ? 'Sommaire' : 'Table of contents'} style={{ margin: '0 0 14px' }}>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
            {toc.map(([label, id]) => (
              <li key={id}>
                <a
                  href={id}
                  style={{
                    textDecoration: 'none',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    padding: '6px 10px',
                    borderRadius: 999,
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* 1. Definitions */}
          <section id="def" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '1. Définitions' : '1. Definitions'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? '« Certificat » : ' : '"Certificate": '}
              {fr
                ? 'document numérique (PDF/QR) matérialisant la revendication symbolique d’une journée. '
                : 'a digital document (PDF/QR) representing the symbolic claim of a day. '}
              {fr ? '« Utilisateur·rice » : ' : '"User": '}
              {fr
                ? 'toute personne disposant d’un compte ou effectuant un achat. '
                : 'any person holding an account or making a purchase. '}
              {fr ? '« Marketplace » : ' : '"Marketplace": '}
              {fr
                ? `module de revente entre utilisateurs opéré par ${COMPANY_NAME}.`
                : `resale module between users operated by ${COMPANY_NAME}.`}
            </p>
          </section>

          {/* 2. Account */}
          <section id="acc" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '2. Compte' : '2. Account'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Fournissez des informations exactes et maintenez-les à jour. La sécurité de vos identifiants relève de votre responsabilité. Toute activité depuis votre compte est réputée effectuée par vous.'
                : 'Provide accurate information and keep it up to date. You are responsible for safeguarding your credentials. Any activity from your account is deemed yours.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? "L'accès peut nécessiter une confirmation par e-mail. Nous pouvons procéder à des vérifications anti-fraude."
                : 'Access may require email confirmation. We may carry out anti-fraud checks.'}
            </p>
          </section>

          {/* 3. Purchase & price */}
          <section id="buy" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '3. Achat & prix' : '3. Purchase & Pricing'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Les prix sont indiqués en EUR, toutes taxes comprises le cas échéant. Le prix total, frais et taxes, est affiché avant paiement sur Stripe.'
                : 'Prices are shown in EUR, VAT-inclusive where applicable. The total price, including any fees and taxes, is displayed before payment on Stripe.'}
            </p>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Langue du contrat : français ou anglais selon votre interface. Les commandes sont archivées dans votre compte ; un accusé est envoyé par e-mail.'
                : 'Contract language: French or English depending on your interface. Orders are archived in your account; an acknowledgement is sent by email.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Preuve : les journaux de transaction et confirmations Stripe font foi. Facturation sur demande quand applicable.'
                : 'Evidence: Stripe transaction logs and confirmations serve as proof. Invoicing available on request where applicable.'}
            </p>
          </section>

          {/* 4. Digital delivery */}
          <section id="delivery" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '4. Livraison numérique' : '4. Digital Delivery'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? 'La livraison est immédiate : génération du PDF, lien de téléchargement et e-mail. Un identifiant et une empreinte (SHA-256) sont associés au certificat.'
                : 'Delivery is immediate: PDF generation, download link, and email. An identifier and integrity hash (SHA-256) may be associated with the certificate.'}
            </p>
          </section>

          {/* 5. Withdrawal right */}
          <section id="withdraw" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '5. Droit de rétractation' : '5. Withdrawal Right'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? "Les certificats constituent un contenu numérique fourni immédiatement. En validant le paiement, vous demandez l'exécution immédiate et renoncez expressément à votre droit de rétractation (Directive 2011/83/UE, art. 16 m). En cas d'erreur de facturation, contactez le support."
                : 'Certificates are digital content supplied immediately. By confirming payment, you request immediate performance and expressly waive your right of withdrawal (EU Directive 2011/83, Art. 16 m). For billing errors, contact support.'}
            </p>
          </section>

          {/* 6. Content & moderation */}
          <section id="ugc" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '6. Contenus & modération' : '6. Content & Moderation'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Vous êtes responsable des textes et images ajoutés à vos pages. Sont interdits : contenus illégaux, diffamatoires, haineux, ou portant atteinte aux droits de tiers, ainsi que les données personnelles sensibles.'
                : 'You are responsible for any text and pictures you add to your pages. Prohibited: unlawful, defamatory, hateful, or rights-infringing content, as well as sensitive personal data.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Nous pouvons retirer un contenu ou suspendre un compte en cas de violation ou de signalement fondé.'
                : 'We may remove content or suspend an account in case of violations or substantiated reports.'}
            </p>
          </section>

          {/* 7. Marketplace */}
          <section id="market" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '7. Marketplace' : '7. Marketplace'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? `La revente entre utilisateurs est facilitée via un encaissement opéré par ${COMPANY_NAME} en tant qu’opérateur de plateforme et mandataire d’encaissement via Stripe Connect.`
                : `User-to-user resale is facilitated with collection operated by ${COMPANY_NAME} as platform operator and collection agent via Stripe Connect.`}
            </p>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Une commission de 15% (minimum 1 €) est prélevée côté vendeur sur chaque vente réussie. Le vendeur demeure responsable de l’offre, des informations fournies, des droits sur le contenu et de ses obligations fiscales.'
                : 'A 15% fee (minimum €1) is charged to the seller on each successful sale. The seller remains responsible for the offer, provided information, rights in the content, and tax obligations.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'En cas d’achat sur la marketplace, le contrat de vente est conclu entre acheteur et vendeur ; la plateforme fournit l’infrastructure et l’encaissement.'
                : 'For marketplace purchases, the sale contract is between buyer and seller; the platform provides infrastructure and payment collection.'}
            </p>
          </section>

          {/* 8. Payments */}
          <section id="pay" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '8. Paiements' : '8. Payments'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Les paiements sont traités par Stripe (prestataire agréé). Nous ne stockons pas vos données de carte. Des contrôles anti-fraude et obligations KYC/KYB peuvent s’appliquer aux vendeurs.'
                : 'Payments are processed by Stripe (licensed provider). We do not store your card data. Anti-fraud checks and KYC/KYB obligations may apply to sellers.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Le détail du prix (taxes, frais éventuels) est récapitulé avant validation sur l’interface Stripe.'
                : 'Price details (taxes, any fees) are summarized before confirmation in the Stripe interface.'}
            </p>
          </section>

          {/* 9. Liability */}
          <section id="liability" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '9. Responsabilité' : '9. Liability'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Le service est fourni “en l’état”. Nous mettons en œuvre des moyens raisonnables pour l’accessibilité et l’intégrité des certificats, sans garantie d’absence d’interruption.'
                : 'The service is provided “as is”. We use reasonable efforts to ensure accessibility and certificate integrity, without guaranteeing uninterrupted service.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Aucune garantie quant à l’impression par des services tiers.'
                : 'No warranty regarding printing by third-party services.'}
            </p>
          </section>

          {/* 10. Suspension */}
          <section id="susp" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '10. Suspension' : '10. Suspension'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Nous pouvons suspendre ou restreindre l’accès en cas d’abus, de non-respect des présentes ou de risque manifeste (fraude, sécurité).'
                : 'We may suspend or restrict access in cases of abuse, breach of these terms, or clear risk (fraud, security).'}
            </p>
          </section>

          {/* 11. Termination */}
          <section id="term" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '11. Résiliation' : '11. Termination'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Vous pouvez demander la suppression de votre compte. Certaines données peuvent être conservées pour des obligations légales (comptabilité, prévention de la fraude) pendant la durée requise.'
                : 'You may request deletion of your account. Certain data may be retained to comply with legal obligations (accounting, anti-fraud) for the required period.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Pour exercer vos droits RGPD : voir la Politique de confidentialité.'
                : 'To exercise GDPR rights: see the Privacy Policy.'}
            </p>
          </section>

          {/* 12. Governing law */}
          <section id="law" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '12. Droit applicable' : '12. Governing Law'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? `Les présentes sont régies par le droit français. En cas de litige et faute d’accord amiable, compétence des tribunaux du ressort du siège de ${COMPANY_NAME}, sous réserve des règles impératives applicables.`
                : `These terms are governed by French law. Failing amicable settlement, courts at the registered office of ${COMPANY_NAME} have jurisdiction, subject to applicable mandatory rules.`}
            </p>
          </section>

          {/* 13. Médiation / Consumer Mediation */}
          <section id="med" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '13. Médiation de la consommation' : '13. Consumer Mediation'}</h2>
            {fr ? (
              <>
                <p style={{ margin: '0 0 8px' }}>
                  Après réclamation écrite auprès de notre support à{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  restée sans solution sous 30&nbsp;jours, vous pouvez saisir gratuitement le médiateur de la consommation
                  désigné ci-dessous.
                </p>
                <ul style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
                  <li>
                    <strong>Médiateur</strong> : {MEDIATOR.name}
                  </li>
                  <li>
                    <strong>Adresse</strong> : {MEDIATOR.address}
                  </li>
                  <li>
                    <strong>Tél.</strong> : {MEDIATOR.phone}
                  </li>
                  <li>
                    <strong>Site</strong> :{' '}
                    <a href={MEDIATOR.site} style={{ color: 'var(--color-text)' }}>
                      {MEDIATOR.site}
                    </a>
                  </li>
                  <li>
                    <strong>E-mail</strong> :{' '}
                    <a href={`mailto:${MEDIATOR.email}`} style={{ color: 'var(--color-text)' }}>
                      {MEDIATOR.email}
                    </a>
                  </li>
                </ul>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
                  Conditions : litige B2C, saisine dans l’année suivant la réclamation, dossier recevable et non abusif. Le
                  recours à un avocat n’est pas obligatoire. Vous restez libre d’accepter la solution proposée.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px' }}>
                  After a written complaint to{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  with no solution within 30 days, consumers may refer the dispute free of charge to the appointed mediator
                  below.
                </p>
                <ul style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
                  <li>
                    <strong>Mediator</strong>: {MEDIATOR.name}
                  </li>
                  <li>
                    <strong>Address</strong>: {MEDIATOR.address}
                  </li>
                  <li>
                    <strong>Phone</strong>: {MEDIATOR.phone}
                  </li>
                  <li>
                    <strong>Website</strong>:{' '}
                    <a href={MEDIATOR.site} style={{ color: 'var(--color-text)' }}>
                      {MEDIATOR.site}
                    </a>
                  </li>
                  <li>
                    <strong>Email</strong>:{' '}
                    <a href={`mailto:${MEDIATOR.email}`} style={{ color: 'var(--color-text)' }}>
                      {MEDIATOR.email}
                    </a>
                  </li>
                </ul>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
                  Eligibility: B2C disputes, filed within 1 year after your complaint, non-abusive and admissible case. You
                  remain free to accept or refuse the proposed solution.
                </p>
              </>
            )}
          </section>

          {/* 14. ODR / EU RLL */}
          <section id="odr" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '14. Plateforme européenne de RLL/ODR' : '14. EU ODR Platform'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? 'Pour les achats en ligne dans l’UE :' : 'For online purchases within the EU: '}{' '}
              <a href={ODR_URL} style={{ color: 'var(--color-text)' }}>
                {ODR_URL}
              </a>
              .
            </p>
          </section>

          {/* 15. Contact */}
          <section id="contact" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '15. Contact' : '15. Contact'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? 'Support : ' : 'Support: '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
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
