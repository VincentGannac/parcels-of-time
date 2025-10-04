// app/[locale]/company/page.tsx
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
  const href = (p: string) => `/${locale}${p}`

  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
  const PRESS_EMAIL = process.env.NEXT_PUBLIC_PRESS_EMAIL || 'presse@parcelsoftime.com'
  const UPDATED = '2025-01-01'

  // Médiateur de la consommation (CM2C) — personnalisable via env
  const MEDIATION_NAME =
    process.env.NEXT_PUBLIC_MEDIATION_NAME ||
    'CM2C – Centre de la Médiation de la Consommation de Conciliateurs de Justice'
  const MEDIATION_ADDR = process.env.NEXT_PUBLIC_MEDIATION_ADDR || '49 rue de Ponthieu, 75008 Paris'
  const MEDIATION_TEL = process.env.NEXT_PUBLIC_MEDIATION_TEL || '01 89 47 00 14'
  const MEDIATION_SITE =
    process.env.NEXT_PUBLIC_MEDIATION_SITE || 'https://www.cm2c.net/declarer-un-litige.php'
  const MEDIATION_MAIL = process.env.NEXT_PUBLIC_MEDIATION_MAIL || 'litiges@cm2c.net'

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
        <header style={{ marginBottom: 14 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 44, lineHeight: '52px', margin: '0 0 8px' }}>
            {fr ? 'À propos — le concept' : 'About — the concept'}
          </h1>
          <p style={{ opacity: 0.9, margin: 0, maxWidth: 760 }}>
            {fr ? (
              <>
                {COMPANY_NAME} propose une façon simple et élégante de <strong>revendiquer une journée</strong> qui
                compte et d’en conserver la trace sous forme d’un <strong>certificat signé</strong> (PDF + QR vérifiable).
              </>
            ) : (
              <>
                {COMPANY_NAME} offers a simple, elegant way to <strong>claim a meaningful day</strong> and preserve it
                as a <strong>signed certificate</strong> (verifiable PDF + QR).
              </>
            )}
          </p>
          <nav aria-label={fr ? 'Liens utiles' : 'Helpful links'} style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
            <a href={href('/legal/terms')} style={link()}>
              {fr ? 'CGU/CGV' : 'Terms'}
            </a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/privacy')} style={link()}>
              {fr ? 'Confidentialité' : 'Privacy'}
            </a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/refund')} style={link()}>
              {fr ? 'Remboursements' : 'Refunds'}
            </a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/seller')} style={link()}>
              {fr ? 'Conditions Vendeur' : 'Seller Terms'}
            </a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/cookies')} style={link()}>
              {fr ? 'Cookies' : 'Cookies'}
            </a>
          </nav>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {/* Concept */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Concept' : 'Concept'}</h2>
            <p style={{ margin: '0 0 8px', opacity: 0.92 }}>
              {fr ? (
                <>
                  Une date peut marquer une histoire. Nous la transformons en un <em>objet numérique pérenne</em>&nbsp;:
                  un certificat avec métadonnées (date, titre, message), un <strong>identifiant unique</strong>, une
                  <strong> empreinte d’intégrité (SHA-256)</strong> et un <strong>QR de vérification</strong>.
                </>
              ) : (
                <>
                  A date can carry a story. We turn it into an <em>enduring digital object</em>: a certificate with
                  metadata (date, title, message), a <strong>unique ID</strong>, a
                  <strong> SHA-256 integrity hash</strong>, and a <strong>verification QR</strong>.
                </>
              )}
            </p>
            <p style={{ margin: 0, opacity: 0.92 }}>
              {fr ? (
                <>
                  Gardez-le privé, partagez-le, exposez-le dans un <strong>registre public</strong> optionnel, ou
                  <strong> revendez</strong>-le via notre marketplace.
                </>
              ) : (
                <>
                  Keep it private, share it, showcase it in an optional <strong>public registry</strong>, or
                  <strong> resell</strong> it via our marketplace.
                </>
              )}
            </p>
          </section>

          {/* How it works */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Comment ça marche ?' : 'How it works'}</h2>
            <ol style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
              <li>
                {fr ? (
                  <>
                    <strong>Choisir</strong> votre journée et lui donner un titre/message.
                  </>
                ) : (
                  <>
                    <strong>Choose</strong> your day and add a title/message.
                  </>
                )}
              </li>
              <li>{fr ? <><strong>Payer</strong> via Stripe.</> : <><strong>Pay</strong> with Stripe.</>}</li>
              <li>
                {fr ? (
                  <>
                    <strong>Recevoir</strong> immédiatement le PDF signé + lien/QR par e-mail.
                  </>
                ) : (
                  <>
                    <strong>Receive</strong> the signed PDF + link/QR instantly by email.
                  </>
                )}
              </li>
              <li>
                {fr ? (
                  <>
                    <strong>Gérer</strong> la visibilité (privée/publique) depuis la page dédiée.
                  </>
                ) : (
                  <>
                    <strong>Manage</strong> visibility (private/public) from the dedicated page.
                  </>
                )}
              </li>
              <li>
                {fr ? (
                  <>
                    <strong>Revendre</strong> le certificat via la marketplace (Stripe Connect).
                  </>
                ) : (
                  <>
                    <strong>Resell</strong> the certificate on the marketplace (Stripe Connect).
                  </>
                )}
              </li>
            </ol>
          </section>

          {/* What is a certificate */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Qu’est-ce qu’un certificat ?' : 'What is a certificate?'}</h2>
            <ul style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
              <li>{fr ? 'Un document PDF contenant les informations de votre journée.' : 'A PDF file with your day’s information.'}</li>
              <li>{fr ? 'Un QR de vérification pointant vers sa page publique.' : 'A verification QR linking to its public page.'}</li>
              <li>{fr ? 'Un identifiant unique et une empreinte SHA-256.' : 'A unique ID and a SHA-256 hash.'}</li>
              <li>{fr ? 'Un statut (privé/public, en collection, en vente…).' : 'A status (private/public, in collection, for sale…).'}</li>
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
              {fr
                ? "Ce certificat n’est pas un titre financier ni un acte authentique ; c’est un objet numérique commémoratif avec garanties d’intégrité et de traçabilité."
                : 'This certificate is not a financial instrument nor a notarial act; it is a commemorative digital object with integrity and traceability safeguards.'}
            </p>
          </section>

          {/* Use cases */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Exemples d’usages' : 'Use cases'}</h2>
            <ul style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
              <li>{fr ? 'Moments personnels : naissance, rencontre, mariage, réussite, hommage.' : 'Personal milestones: birth, meeting, wedding, achievement, tribute.'}</li>
              <li>{fr ? 'Culture & communautés : dates mémorables, éditions limitées, collections.' : 'Culture & communities: memorable dates, limited editions, collections.'}</li>
              <li>{fr ? 'Marques & créateurs : campagnes “journées uniques”, drops événementiels.' : 'Brands & creators: “unique day” campaigns, event drops.'}</li>
              <li>{fr ? 'Projets : jalons, premiers clients, lancements produits.' : 'Projects: milestones, first customers, product launches.'}</li>
            </ul>
          </section>

          {/* Trust & Integrity */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Confiance & intégrité' : 'Trust & integrity'}</h2>
            <ul style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
              <li>{fr ? 'Vérification via QR et page dédiée.' : 'Verification via QR and dedicated page.'}</li>
              <li>{fr ? 'Empreinte cryptographique (SHA-256).' : 'Cryptographic fingerprint (SHA-256).'}</li>
              <li>{fr ? 'Journalisation des opérations clés.' : 'Logging of key operations.'}</li>
              <li>{fr ? 'Modération des contenus illicites.' : 'Moderation of unlawful content.'}</li>
            </ul>
          </section>

          {/* Marketplace */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Marketplace (revente)' : 'Marketplace (resale)'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr ? (
                <>
                  Reventes opérées via <strong>Stripe Connect</strong>. KYC/KYB vendeur requis. Commission&nbsp;
                  <strong>15&nbsp;% (min 1&nbsp;€)</strong> côté vendeur pour chaque vente réussie.
                </>
              ) : (
                <>
                  Resales via <strong>Stripe Connect</strong>. Seller KYC/KYB required. <strong>15% fee (min €1)</strong> charged to the seller on each successful sale.
                </>
              )}
            </p>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  Le vendeur reste responsable de la licéité de l’offre, des informations fournies et de ses obligations
                  fiscales. Voir <a href={href('/legal/seller')} style={link()}>Conditions Vendeur</a>.
                </>
              ) : (
                <>
                  The seller remains responsible for offer legality, provided information and tax obligations. See{' '}
                  <a href={href('/legal/seller')} style={link()}>Seller Terms</a>.
                </>
              )}
            </p>
          </section>

          {/* Legal & Mediation */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Transparence légale' : 'Legal transparency'}</h2>
            <ul style={{ margin: '0 0 10px 18px', lineHeight: 1.7 }}>
              <li>
                <a href={href('/legal/terms')} style={link()}>
                  {fr ? 'CGU/CGV' : 'Terms & Conditions'}
                </a>{' '}
                — {fr ? 'livraison numérique immédiate, informations précontractuelles.' : 'immediate digital delivery, key pre-contractual information.'}
              </li>
              <li>
                <a href={href('/legal/refund')} style={link()}>
                  {fr ? 'Remboursements & rétractation' : 'Refunds & withdrawal'}
                </a>{' '}
                — {fr ? 'règles en cas de doublon/erreur manifeste.' : 'rules for duplicate/obvious errors.'}
              </li>
              <li>
                <a href={href('/legal/privacy')} style={link()}>
                  {fr ? 'Confidentialité (RGPD)' : 'Privacy (GDPR)'}
                </a>{' '}
                — {fr ? 'données, bases légales, durées, droits.' : 'data, legal bases, retention, rights.'}
              </li>
              <li>
                <a href={href('/legal/cookies')} style={link()}>
                  {fr ? 'Cookies' : 'Cookies'}
                </a>{' '}
                — {fr ? 'essentiels ; mesure d’audience si consentie.' : 'essentials; analytics if consented.'}
              </li>
              <li>
                <a href={href('/legal/legal-notice')} style={link()}>
                  {fr ? 'Mentions légales' : 'Legal notice'}
                </a>
              </li>
            </ul>
            <div
              style={{
                border: '1px dashed var(--color-border)',
                borderRadius: 12,
                padding: 12,
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>
                {fr ? 'Médiation de la consommation' : 'Consumer mediation'}
              </h3>
              <p style={{ margin: 0, opacity: 0.92 }}>
                {fr ? (
                  <>
                    Conformément au droit de la consommation, vous pouvez saisir gratuitement&nbsp;:
                    <br />
                    <strong>{MEDIATION_NAME}</strong>
                    <br />
                    {MEDIATION_ADDR} — Tél. {MEDIATION_TEL}
                    <br />
                    Site :{' '}
                    <a href={MEDIATION_SITE} style={link()}>
                      {MEDIATION_SITE}
                    </a>
                    <br />
                    E-mail :{' '}
                    <a href={`mailto:${MEDIATION_MAIL}`} style={link()}>
                      {MEDIATION_MAIL}
                    </a>
                  </>
                ) : (
                  <>
                    In accordance with consumer law, you may refer disputes free of charge to:
                    <br />
                    <strong>{MEDIATION_NAME}</strong>
                    <br />
                    {MEDIATION_ADDR} — Tel. {MEDIATION_TEL}
                    <br />
                    Website:{' '}
                    <a href={MEDIATION_SITE} style={link()}>
                      {MEDIATION_SITE}
                    </a>
                    <br />
                    E-mail:{' '}
                    <a href={`mailto:${MEDIATION_MAIL}`} style={link()}>
                      {MEDIATION_MAIL}
                    </a>
                  </>
                )}
              </p>
            </div>
          </section>

          {/* Privacy & Security */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Vie privée & sécurité' : 'Privacy & security'}</h2>
            <ul style={{ margin: '0 0 0 18px', lineHeight: 1.7 }}>
              <li>
                {fr
                  ? 'Traitements limités au fonctionnement (création, paiement, délivrance, support, sécurité).'
                  : 'Processing limited to operation (creation, payment, delivery, support, security).'}
              </li>
              <li>
                {fr
                  ? 'Paiements gérés par Stripe — aucune donnée de carte stockée chez nous.'
                  : 'Payments handled by Stripe — no card data stored by us.'}
              </li>
              <li>
                {fr ? 'Hébergement UE privilégié ; voir la politique de confidentialité.' : 'EU hosting preferred; see the privacy policy.'}
              </li>
            </ul>
            <p style={{ margin: '8px 0 0' }}>
              {fr ? (
                <>
                  Détails complets : <a href={href('/legal/privacy')} style={link()}>Politique de confidentialité</a> •{' '}
                  <a href={href('/legal/cookies')} style={link()}>Politique cookies</a>
                </>
              ) : (
                <>
                  Full details: <a href={href('/legal/privacy')} style={link()}>Privacy Policy</a> •{' '}
                  <a href={href('/legal/cookies')} style={link()}>Cookie Policy</a>
                </>
              )}
            </p>
          </section>

          {/* Contact blocks */}
          <section style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <div style={card()}>
              <h2 style={h2()}>{fr ? 'Presse & partenariats' : 'Press & partnerships'}</h2>
              <p style={{ margin: '0 0 10px', opacity: 0.92 }}>
                {fr
                  ? 'Dossier de presse, visuels HD, démonstrations produit et interviews disponibles.'
                  : 'Press kit, hi-res visuals, product demos and interviews available.'}
              </p>
              <a
                href={`mailto:${PRESS_EMAIL}`}
                style={{
                  textDecoration: 'none',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontWeight: 800,
                }}
              >
                {fr ? 'Nous contacter' : 'Contact us'}
              </a>
            </div>
            <div style={card()}>
              <h2 style={h2()}>Support</h2>
              <p style={{ margin: '0 0 10px', opacity: 0.92 }}>
                {fr
                  ? 'Une question, une correction ou un souci de paiement ? Nous répondons rapidement.'
                  : 'Questions, edits or payment issues? We reply quickly.'}
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                style={{
                  textDecoration: 'none',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  padding: '10px 12px',
                  borderRadius: 10,
                }}
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </section>
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
  return { margin: '0 0 8px', fontSize: 22 }
}

function link(): CSSProperties {
  return { color: 'var(--color-text)', textDecoration: 'underline', textUnderlineOffset: 3 }
}

function details(): CSSProperties {
  return {
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    background: 'rgba(255,255,255,0.02)',
  }
}

function summary(): CSSProperties {
  return { cursor: 'pointer', fontWeight: 600, listStyle: 'none' }
}
