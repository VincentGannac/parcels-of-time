// app/[locale]/legal/registry-guidelines/page.tsx
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

  // —— Identity / contacts
  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com'
  const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL || 'support@parcelsoftime.com'
  const UPDATED = process.env.NEXT_PUBLIC_LEGAL_UPDATED || '2025-11-01'

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
            {fr ? 'Guide d’exposition — Registre public' : 'Public Registry Guidelines'}
          </h1>
          <p style={{ margin: 0, opacity: 0.9 }}>
            {fr
              ? 'Ces règles expliquent ce qui peut être publié dans la galerie publique des certificats, vos droits, et notre processus de modération.'
              : 'These rules explain what may be published to the public gallery of certificates, your choices, and how moderation works.'}
          </p>

          <nav aria-label={fr ? 'Liens légaux' : 'Legal links'} style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
            <a href={href('/legal/terms')} style={link()}>{fr ? 'CGU/CGV' : 'Terms'}</a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/privacy')} style={link()}>{fr ? 'Confidentialité' : 'Privacy'}</a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/legal/legal-notice')} style={link()}>{fr ? 'Mentions légales' : 'Legal notice'}</a>
            <span style={{ margin: '0 8px' }}>•</span>
            <a href={href('/explore')} style={link()}>{fr ? 'Voir le registre' : 'Open the register'}</a>
          </nav>
        </header>

        {/* Summary cards */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* 1. Scope */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '1) Champ et définitions' : '1) Scope & definitions'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr ? (
                <>
                  Le <strong>registre public</strong> est une galerie optionnelle où les propriétaires choisissent d’exposer leur
                  certificat (image du certificat et textes associés). La publication est <strong>facultative</strong> et réversible.
                </>
              ) : (
                <>
                  The <strong>public register</strong> is an optional gallery where owners may display their certificate
                  (certificate image and related text). Publication is <strong>optional</strong> and reversible.
                </>
              )}
            </p>
            <ul style={ul()}>
              <li>
                {fr ? (
                  <>
                    <strong>Certificat publié</strong> : rendu visuel (image) et métadonnées textuelles (titre, message, nom si affiché).
                  </>
                ) : (
                  <>
                    <strong>Published certificate</strong>: the visual (image) plus text metadata (title, message, name if displayed).
                  </>
                )}
              </li>
              <li>
                {fr ? (
                  <>
                    <strong>Vous</strong> : la personne qui publie un de ses certificats dans la galerie.
                  </>
                ) : (
                  <>
                    <strong>You</strong>: the person choosing to publish one of their certificates to the gallery.
                  </>
                )}
              </li>
            </ul>
          </section>

          {/* 2. What is shown */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '2) Ce qui est affiché publiquement' : '2) What is displayed publicly'}</h2>
            <ul style={ul()}>
              <li>
                {fr ? 'L’image du certificat (PDF rendu sous forme d’aperçu).' : 'The certificate image (rendered preview of the PDF).'}
              </li>
              <li>
                {fr
                  ? 'Les textes inclus sur le certificat : titre, message, mention “Offert par”, nom si visible.'
                  : 'Texts included on the certificate: title, message, “Gifted by”, name if visible.'}
              </li>
              <li>
                {fr
                  ? 'Une référence technique (ID/horodatage) et un QR de consultation (lecture seule).'
                  : 'A technical reference (ID/timestamp) and a QR for view-only access.'}
              </li>
            </ul>
            <p style={muted()}>
              {fr
                ? 'Nous retirons les métadonnées EXIF des images que vous importez pour limiter la fuite d’informations.'
                : 'We strip EXIF metadata from uploaded images to limit information leakage.'}
            </p>
          </section>

          {/* 3. Your choices */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '3) Vos choix & contrôle' : '3) Your choices & control'}</h2>
            <ul style={ul()}>
              <li>
                {fr
                  ? 'Vous pouvez activer/désactiver la publication depuis votre compte ou via le QR du certificat.'
                  : 'You can enable/disable publication from your account or via the certificate’s QR.'}
              </li>
              <li>
                {fr
                  ? 'La désactivation retire l’élément de la galerie. Des copies résiduelles (caches, sauvegardes) peuvent persister pendant une courte période.'
                  : 'Unpublishing removes the item from the gallery. Residual copies (caches, backups) may persist for a short period.'}
              </li>
              <li>
                {fr
                  ? 'Vous pouvez modifier à tout moment le titre, le message, la couleur et l’image personnalisée.'
                  : 'You may edit title, message, color and custom image at any time.'}
              </li>
            </ul>
          </section>

          {/* 4. Content standards */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '4) Standards de contenu' : '4) Content standards'}</h2>

            <h3 style={h3()}>{fr ? '4.1 — Nous encourageons' : '4.1 — We encourage'}</h3>
            <ul style={ul()}>
              <li>{fr ? 'Messages personnels, commémorations, créations artistiques.' : 'Personal notes, commemorations, artistic creations.'}</li>
              <li>{fr ? 'Tonalité respectueuse, non-conflictuelle.' : 'Respectful, non-confrontational tone.'}</li>
              <li>{fr ? 'Liens sobres vers des pages personnelles non commerciales.' : 'Simple links to non-commercial personal pages.'}</li>
            </ul>

            <h3 style={h3()}>{fr ? '4.2 — Interdits' : '4.2 — Not allowed'}</h3>
            <ul style={ul()}>
              <li>
                {fr
                  ? 'Haine, harcèlement, menaces, intimidation, ou apologie d’idéologies extrémistes.'
                  : 'Hate, harassment, threats, intimidation, or praise for extremist ideologies.'}
              </li>
              <li>
                {fr
                  ? 'Violence explicite ou cruauté gratuite ; incitation à la violence.'
                  : 'Graphic violence or gratuitous cruelty; incitement to violence.'}
              </li>
              <li>
                {fr
                  ? 'Nudité explicite, pornographie ou contenu sexuel ; tout contenu impliquant des mineurs.'
                  : 'Explicit nudity, pornography or sexual content; any content involving minors.'}
              </li>
              <li>
                {fr
                  ? 'Données personnelles sensibles (adresses privées, documents d’identité, coordonnées de tiers) et “doxing”.'
                  : 'Sensitive personal data (private addresses, IDs, third-party contact details) and doxxing.'}
              </li>
              <li>
                {fr
                  ? 'Atteinte aux droits d’auteur, aux marques, au droit à l’image ou à la vie privée de tiers.'
                  : 'Infringement of copyright, trademarks, rights of publicity or privacy.'}
              </li>
              <li>
                {fr
                  ? 'Promotion d’activités illégales, fraude, arnaques, logiciels malveillants, liens piégés.'
                  : 'Promotion of illegal activities, fraud, scams, malware, deceptive links.'}
              </li>
              <li>
                {fr
                  ? 'Spam, publicité agressive, sollicitations commerciales, liens d’affiliation.'
                  : 'Spam, aggressive advertising, commercial solicitations, affiliate links.'}
              </li>
              <li>
                {fr
                  ? 'Désinformation médicale ou de sécurité, instructions dangereuses.'
                  : 'Harmful medical or safety misinformation; dangerous instructions.'}
              </li>
            </ul>

            <h3 style={h3()}>{fr ? '4.3 — Images & visages' : '4.3 — Images & faces'}</h3>
            <ul style={ul()}>
              <li>
                {fr
                  ? 'Évitez d’exposer des visages de mineurs ; nous pouvons flouter ou refuser l’image.'
                  : 'Avoid displaying faces of minors; we may blur or reject such images.'}
              </li>
              <li>
                {fr
                  ? 'Images générées par IA autorisées si vous détenez les droits et si elles ne portent pas atteinte à autrui (deepfakes interdits).'
                  : 'AI-generated images are allowed if you hold rights and they do not harm others (no deepfakes).'}
              </li>
              <li>
                {fr
                  ? 'Nous pouvons redimensionner, recomprimer, recadrer légèrement pour cohérence visuelle.'
                  : 'We may resize, recompress, or lightly crop for visual consistency.'}
              </li>
            </ul>
          </section>

          {/* 5. Moderation */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '5) Modération : comment ça marche' : '5) Moderation: how it works'}</h2>
            <ul style={ul()}>
              <li>
                {fr
                  ? 'La galerie est en consultation seule. Nous combinons un contrôle automatisé et des vérifications humaines.'
                  : 'The gallery is view-only. We combine automated checks with human review.'}
              </li>
              <li>
                {fr
                  ? 'Nous pouvons retirer, masquer, recadrer, flouter ou refuser un contenu à notre discrétion.'
                  : 'We may remove, hide, crop, blur or refuse content at our discretion.'}
              </li>
              <li>
                {fr
                  ? 'En cas de manquements répétés : suspension de la publication, voire bannissement du registre.'
                  : 'For repeated violations: suspension of publishing, or a ban from the register.'}
              </li>
              <li>
                {fr
                  ? 'Contenu impliquant l’intégrité des mineurs ou d’autres risques graves : signalement aux autorités compétentes.'
                  : 'Content involving child safety or other severe risks may be reported to authorities.'}
              </li>
            </ul>
          </section>

          {/* 6. Reporting & appeal */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '6) Signaler un contenu & recours' : '6) Reporting & appeal'}</h2>
            <p style={{ margin: '0 0 8px' }}>
              {fr
                ? 'Pour signaler un contenu illicite ou portant atteinte à vos droits, écrivez à :'
                : 'To report unlawful content or rights infringement, email:'}{' '}
              <a href={`mailto:${LEGAL_EMAIL}`} style={link()}>{LEGAL_EMAIL}</a>
            </p>
            <ul style={ul()}>
              <li>
                {fr
                  ? 'Incluez l’URL du certificat, une description claire et, si possible, des justificatifs.'
                  : 'Include the certificate URL, a clear description and any supporting material.'}
              </li>
              <li>
                {fr
                  ? 'Nous analysons rapidement et vous informons des suites. Vous pouvez contester une décision en répondant au même fil.'
                  : 'We’ll review promptly and let you know the outcome. You may appeal by replying to the same thread.'}
              </li>
            </ul>
          </section>

          {/* 7. License */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '7) Licence d’affichage' : '7) Display license'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  En publiant dans le registre, vous accordez à {COMPANY_NAME} une licence <strong>mondiale, non exclusive, gratuite et
                  révocable</strong> pour héberger, afficher publiquement et reproduire techniquement votre certificat (y compris l’image importée) aux seules fins de la galerie, de sa
                  promotion raisonnable et de son archivage. La licence prend fin pour l’avenir quand vous dépubliez ;
                  des copies techniques (caches, sauvegardes) peuvent subsister brièvement.
                </>
              ) : (
                <>
                  By publishing to the register, you grant {COMPANY_NAME} a <strong>worldwide, non-exclusive, royalty-free, revocable</strong> license
                  to host, publicly display and technically reproduce your certificate (including any uploaded image) solely for the gallery, its reasonable promotion and archival purposes. The license ends prospectively when you unpublish; technical copies (caches/backups) may briefly persist.
                </>
              )}
            </p>
          </section>

          {/* 8. Responsibility */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '8) Votre responsabilité' : '8) Your responsibility'}</h2>
            <ul style={ul()}>
              <li>
                {fr
                  ? 'Vous garantissez disposer des droits nécessaires sur les textes et images que vous publiez.'
                  : 'You warrant you hold all rights necessary for the texts and images you publish.'}
              </li>
              <li>
                {fr
                  ? 'Vous ne publierez pas d’informations sensibles ou de données personnelles de tiers sans consentement.'
                  : 'You will not publish sensitive information or third-party personal data without consent.'}
              </li>
              <li>
                {fr
                  ? 'Le contenu publié reste sous votre responsabilité ; {COMPANY_NAME} n’en garantit ni l’exactitude ni la légalité.'
                  : 'You are responsible for your content; {COMPANY_NAME} does not guarantee its accuracy or legality.'}
              </li>
            </ul>
          </section>

          {/* 9. Changes */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? '9) Évolutions du guide' : '9) Changes to these guidelines'}</h2>
            <p style={{ margin: 0 }}>
              {fr
                ? 'Nous pouvons mettre à jour ces règles pour des raisons juridiques, de sécurité ou d’usage. Les changements s’appliquent dès leur publication.'
                : 'We may update these rules for legal, safety or product reasons. Changes apply upon publication.'}
            </p>
          </section>

          {/* Contact */}
          <section style={card()}>
            <h2 style={h2()}>{fr ? 'Contact' : 'Contact'}</h2>
            <p style={{ margin: 0 }}>
              {fr ? (
                <>
                  Besoin d’aide ? Écrivez-nous : <a href={`mailto:${SUPPORT_EMAIL}`} style={link()}>{SUPPORT_EMAIL}</a>
                </>
              ) : (
                <>
                  Need help? Email us: <a href={`mailto:${SUPPORT_EMAIL}`} style={link()}>{SUPPORT_EMAIL}</a>
                </>
              )}
            </p>
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
  return { margin: '0 0 6px', fontSize: 20 }
}

function h3(): CSSProperties {
  return { margin: '6px 0 6px', fontSize: 16, opacity: 0.95 }
}

function ul(): CSSProperties {
  return { margin: '0 0 0 18px', lineHeight: 1.7 }
}

function muted(): CSSProperties {
  return { margin: '8px 0 0', fontSize: 13, color: 'var(--color-muted)' }
}

function link(): CSSProperties {
  return { color: 'var(--color-text)', textDecoration: 'underline', textUnderlineOffset: 3 }
}
