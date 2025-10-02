// app/[locale]/legal/privacy/page.tsx

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

  // ── Identité & coordonnées
  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME || 'Parcels of Time'
  const LEGAL_ADDRESS =
    process.env.NEXT_PUBLIC_LEGAL_ADDRESS ||
    '2 Lotissement Beaupré, Le Puy Sainte Réparade, France' // TODO: Renseigner
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
  

  const UPDATED = process.env.NEXT_PUBLIC_PRIVACY_UPDATED_AT || '2025-11-01'

  // Représentant UE (art. 27) — afficher seulement si non établi dans l’UE
  const EU_ESTABLISHED = (process.env.NEXT_PUBLIC_EU_ESTABLISHED ?? 'true').toLowerCase() === 'true'
  const EU_REP_NAME = process.env.NEXT_PUBLIC_EU_REP_NAME ?? ''
  const EU_REP_CONTACT = process.env.NEXT_PUBLIC_EU_REP_CONTACT ?? ''

  {!EU_ESTABLISHED && EU_REP_NAME && EU_REP_CONTACT && (
    <section /* ... votre style de carte ... */>
      <h2>Représentant UE (art. 27)</h2>
      <p><strong>{EU_REP_NAME}</strong> — {EU_REP_CONTACT}</p>
    </section>
  )}


  const link = (p: string) => `/${locale}${p}`

  const toc: Array<[string, string]> = fr
    ? [
        ['1. Responsable & champ', '#controller'],
        ['2. Données collectées', '#data'],
        ['3. Finalités & bases légales', '#purposes'],
        ['4. Sources', '#sources'],
        ['5. Destinataires & sous-traitants', '#recipients'],
        ['6. Transferts hors UE/EEE', '#transfers'],
        ['7. Durées de conservation', '#retention'],
        ['8. Marketplace & rôles', '#market'],
        ['9. Sécurité', '#security'],
        ['10. Cookies & mesure', '#cookies'],
        ['11. Vos droits (RGPD)', '#rights'],
        ['12. Mineurs', '#children'],
        ['13. Modifications', '#changes'],
        ['14. Contact & réclamations', '#contact'],
      ]
    : [
        ['1. Controller & scope', '#controller'],
        ['2. Data we collect', '#data'],
        ['3. Purposes & legal bases', '#purposes'],
        ['4. Sources', '#sources'],
        ['5. Recipients & processors', '#recipients'],
        ['6. International transfers', '#transfers'],
        ['7. Retention', '#retention'],
        ['8. Marketplace & roles', '#market'],
        ['9. Security', '#security'],
        ['10. Cookies & analytics', '#cookies'],
        ['11. Your GDPR rights', '#rights'],
        ['12. Children', '#children'],
        ['13. Changes', '#changes'],
        ['14. Contact & complaints', '#contact'],
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
        {/* Header */}
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
            {fr ? 'Politique de confidentialité' : 'Privacy Policy'}
          </h1>
          <p style={{ margin: 0, opacity: 0.85 }}>
            {fr
              ? "Comment nous collectons, utilisons et protégeons vos données personnelles dans le cadre du service."
              : 'How we collect, use and protect your personal data in connection with the service.'}
          </p>
          <nav aria-label={fr ? 'Liens légaux' : 'Legal links'} style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
            <a href={link('/legal/legal-notice')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Mentions légales' : 'Legal Notice'}
            </a>
            <a href={link('/legal/terms')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Conditions générales' : 'Terms & Conditions'}
            </a>
            <a href={link('/legal/cookies')} style={{ color: 'var(--color-text)', marginRight: 12 }}>
              {fr ? 'Cookies' : 'Cookies'}
            </a>
            <a href={link('/legal/seller')} style={{ color: 'var(--color-text)' }}>
              {fr ? 'Conditions Vendeur' : 'Seller Terms'}
            </a>
          </nav>
        </header>

        {/* TOC */}
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

          {/* 1. Data collected */}
          <section id="data" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '2. Données collectées' : '2. Data we collect'}</h2>
            <ul style={ulStyle()}>
              <li>
                {fr
                  ? 'Identifiants de compte : e-mail, nom affiché.'
                  : 'Account identifiers: email, display name.'}
              </li>
              <li>
                {fr
                  ? 'Contenu fourni : titre & message du certificat.'
                  : 'User content: certificate title & message.'}
              </li>
              <li>
                {fr
                  ? 'Paiement : traité par Stripe ; nous ne stockons pas vos données de carte.'
                  : 'Payments: processed by Stripe; we do not store your card details.'}
              </li>
              <li>
                {fr
                  ? 'Journalisation technique : logs serveur, adresses IP, événements, erreurs applicatives, empreinte d’intégrité (SHA-256) liée au certificat.'
                  : 'Technical logs: server logs, IP addresses, events, app errors, integrity hash (SHA-256) linked to the certificate.'}
              </li>
              <li>
                {fr
                  ? 'Données KYC/KYB (vendeurs marketplace) : collectées et vérifiées via Stripe.'
                  : 'KYC/KYB data (marketplace sellers): collected and verified by Stripe.'}
              </li>
            </ul>
          </section>

          {/* 2. Purposes & legal bases */}
          <section id="purposes" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '3. Finalités & bases légales' : '3. Purposes & legal bases'}</h2>
            <ul style={ulStyle()}>
              <li>
                {fr
                  ? 'Exécution du contrat : création et délivrance de certificats, génération de PDF/QR, envoi d’e-mails transactionnels.'
                  : 'Performance of contract: creating and delivering certificates, generating PDF/QR, sending transactional emails.'}
              </li>
              <li>
                {fr
                  ? 'Paiement & lutte anti-fraude : obligation contractuelle / intérêt légitime ; contrôles par Stripe.'
                  : 'Payments & anti-fraud: contractual necessity / legitimate interest; checks by Stripe.'}
              </li>
              <li>
                {fr
                  ? 'Support & maintenance, correction d’erreurs : intérêt légitime.'
                  : 'Support & maintenance, error remediation: legitimate interest.'}
              </li>
              <li>
                {fr
                  ? 'Registre public (si activé par vous) : exécution du service sur paramétrage explicite.'
                  : 'Public registry (if you enable it): performance of the service based on your explicit setting.'}
              </li>
            </ul>
          </section>

          {/* 3. Sources */}
          <section id="sources" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '4. Sources' : '4. Sources'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Données fournies par vous (formulaires, compte), générées par l’usage du service (journaux), ou provenant de notre prestataire de paiement (statuts de transaction, vérifications KYC/KYB pour vendeurs).'
                : 'Data provided by you (forms, account), generated by your use of the service (logs), or provided by our payment provider (transaction statuses, KYC/KYB checks for sellers).'}
            </p>
          </section>

          {/* 4. Recipients & processors */}
          <section id="recipients" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '5. Destinataires & sous-traitants' : '5. Recipients & processors'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Nous faisons appel à des prestataires pour héberger, stocker et traiter certaines données. Ils agissent comme sous-traitants ou, pour certaines opérations de paiement, comme responsables indépendants.'
                : 'We use service providers to host, store and process certain data. They act as processors or, for certain payment operations, as independent controllers.'}
            </p>
            <ul style={ulStyle()}>
              <li>
                <strong>Stripe</strong> — {fr ? 'paiements, KYC/KYB, anti-fraude (responsable pour certaines données).' : 'payments, KYC/KYB, anti-fraud (controller for some data).'}
              </li>
              <li>
                <strong>Base de données (ex. Supabase EU)</strong> — {fr ? 'hébergement et stockage.' : 'hosting and storage.'}
              </li>
              <li>
                <strong>Hébergement applicatif (ex. Vercel)</strong> — {fr ? 'déploiement, CDN, journaux techniques.' : 'deployment, CDN, technical logs.'}
              </li>
              {/* 👉 Ajoutez ici vos autres prestataires si besoin */}
            </ul>
          </section>

          {/* 5. Transfers */}
          <section id="transfers" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '6. Transferts hors UE/EEE' : '6. International transfers'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? "L'hébergement principal est prévu en UE lorsque possible. Si des transferts vers des pays tiers ont lieu (ex. support global, CDN), ils reposent sur un mécanisme conforme (clauses contractuelles types, décisions d’adéquation, mesures complémentaires)."
                : 'Primary hosting is planned in the EU where possible. If data are transferred to third countries (e.g., global support, CDN), transfers rely on a compliant mechanism (SCCs, adequacy decisions, supplementary measures).'}
            </p>
          </section>

          {/* 6. Retention */}
          <section id="retention" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '7. Durées de conservation' : '7. Retention'}</h2>
            <ul style={ulStyle()}>
              <li>
                {fr
                  ? 'Compte & certificats : tant que le compte est actif ; suppression sur demande (avec obligations légales résiduelles).'
                  : 'Account & certificates: as long as the account is active; deletion upon request (subject to legal obligations).'}
              </li>
              <li>
                {fr ? 'Logs techniques : quelques semaines à quelques mois.' : 'Technical logs: a few weeks to a few months.'}
              </li>
              <li>
                {fr
                  ? 'Données de paiement : selon les obligations légales de Stripe.'
                  : 'Payment data: according to Stripe’s legal obligations.'}
              </li>
            </ul>
          </section>

          {/* 7. Marketplace roles */}
          <section id="market" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '8. Marketplace & rôles' : '8. Marketplace & roles'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Pour la marketplace P2P, nous agissons comme opérateur de plateforme et mandataire d’encaissement. Les vendeurs sont responsables de leurs annonces et de leurs obligations (ex. fiscales).'
                : 'For the P2P marketplace, we act as a platform operator and collection agent. Sellers are responsible for their listings and obligations (e.g., tax).'}
            </p>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Stripe peut effectuer des vérifications KYC/KYB et des analyses anti-fraude susceptibles d’entraîner un blocage temporaire d’un paiement.'
                : 'Stripe may conduct KYC/KYB checks and anti-fraud analyses that can temporarily block a payment.'}
            </p>
          </section>

          {/* 8. Security */}
          <section id="security" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '9. Sécurité' : '9. Security'}</h2>
            <ul style={ulStyle()}>
              <li>{fr ? 'Chiffrement en transit (HTTPS/TLS).' : 'Encryption in transit (HTTPS/TLS).'}</li>
              <li>{fr ? 'Contrôles d’accès, séparation des environnements.' : 'Access controls, environment separation.'}</li>
              <li>{fr ? 'Journalisation & alerting technique.' : 'Technical logging & alerting.'}</li>
              <li>
                {fr
                  ? 'Sauvegardes gérées par l’infrastructure (selon fournisseur).'
                  : 'Backups handled by infrastructure (per provider).'}
              </li>
            </ul>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
              {fr
                ? 'Aucune décision produisant des effets juridiques exclusivement automatisée ; des contrôles anti-fraude automatisés peuvent s’appliquer.'
                : 'No decision producing legal effects based solely on automated processing; automated anti-fraud checks may apply.'}
            </p>
          </section>

          {/* 9. Cookies & analytics */}
          <section id="cookies" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '10. Cookies & mesure d’audience' : '10. Cookies & analytics'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Nous limitons les traceurs au strict nécessaire au fonctionnement.'
                : 'We limit trackers to those strictly necessary for operation.'}
            </p>
            <p style={{ margin: 0 }}>
              {fr ? 'Gérez vos préférences sur ' : 'Manage your preferences at '}
              <a href={link('/legal/cookies')} style={{ color: 'var(--color-text)' }}>
                {fr ? 'la page Cookies' : 'the Cookies page'}
              </a>
              .
            </p>
          </section>

          {/* 10. Rights */}
          <section id="rights" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '11. Vos droits (RGPD)' : '11. Your GDPR rights'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Vous disposez des droits d’accès, rectification, effacement, opposition, limitation, portabilité. Vous pouvez retirer votre consentement à tout moment pour les traitements fondés sur celui-ci.'
                : 'You have the rights of access, rectification, erasure, objection, restriction and portability. You may withdraw consent at any time for processing based on consent.'}
            </p>
          </section>

          {/* 11. Children */}
          <section id="children" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '12. Mineurs' : '12. Children'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? "Le service n'est pas destiné aux enfants. Si vous avez moins que l’âge légal de consentement applicable dans votre pays, l’accord d’un représentant légal peut être nécessaire."
                : 'The service is not directed to children. If you are below the applicable age of digital consent in your country, consent from a legal guardian may be required.'}
            </p>
          </section>

          {/* 12. Changes */}
          <section id="changes" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '13. Modifications' : '13. Changes'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? "Nous pouvons modifier cette politique pour refléter l'évolution de nos traitements. La date de mise à jour figure en haut de page."
                : 'We may update this policy to reflect changes in our processing. The update date is shown at the top of this page.'}
            </p>
          </section>

          {/* 13. Contact & complaints */}
          <section id="contact" style={cardStyle()}>
            <h2 style={h2Style()}>{fr ? '14. Contact & réclamations' : '14. Contact & complaints'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr ? 'Support : ' : 'Support: '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-text)' }}>
                {SUPPORT_EMAIL}
              </a>
              {' · '}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
              {fr
                ? "Vous pouvez saisir votre autorité de contrôle (ex. CNIL en France) si vous estimez que vos droits ne sont pas respectés."
                : 'You may lodge a complaint with your supervisory authority if you believe your rights are not respected.'}
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

function ulStyle(): CSSProperties {
  return { margin: '0 0 0 18px', lineHeight: 1.7 }
}
