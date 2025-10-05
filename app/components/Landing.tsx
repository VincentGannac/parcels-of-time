// app/components/Landing.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import HeroSlideshow from './HeroSlideshow'
import { useLocaleHref } from './useLocaleHref'
import { useT } from '../i18n/I18nProvider'
import { usePathname } from 'next/navigation'

/* ====================== Utilities ====================== */
const isBrowser = () => typeof window !== 'undefined'

/* -------------------- Design Tokens -------------------- */
const TOKENS_DARK = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-elev': '#0F1421',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-secondary': '#00D2A8',
  '--color-accent': '#8CD6FF',
  '--color-border': '#1E2A3C',
  '--ring': '0 0 0 4px rgba(228,183,61,.20)',
  '--shadow-elev1': '0 6px 22px rgba(0,0,0,.28)',
  '--shadow-elev2': '0 14px 36px rgba(0,0,0,.40)',
  '--shadow-glow': '0 0 0 6px rgba(228,183,61,.12)',
} as const

const TOKENS_LIGHT = {
  '--color-bg': '#FAFAF7',
  '--color-surface': '#FFFFFF',
  '--color-elev': '#F5F6FA',
  '--color-text': '#1D2433',
  '--color-muted': '#4B5565',
  '--color-primary': '#1C2B6B',
  '--color-on-primary': '#FFFFFF',
  '--color-secondary': '#4A8FFF',
  '--color-accent': '#D4AF37',
  '--color-border': '#E6E6EA',
  '--ring': '0 0 0 4px rgba(28,43,107,.18)',
  '--shadow-elev1': '0 6px 18px rgba(10,14,30,.08)',
  '--shadow-elev2': '0 14px 36px rgba(10,14,30,.12)',
  '--shadow-glow': '0 0 0 6px rgba(28,43,107,.12)',
} as const

function applyTheme(vars: Record<string, string>) {
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

/* ====================== Accessibility helpers ====================== */
function SkipLink() {
  return (
    <a
      href="#content"
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 60,
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        transform: 'translateY(-150%)',
        transition: 'transform .15s ease',
      }}
      onFocus={(e) => ((e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)')}
      onBlur={(e) => ((e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-150%)')}
    >
      Skip to content
    </a>
  )
}

/* ====================== Cookie banner (RGPD) ====================== */
function CookieBanner() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    try {
      const v = localStorage.getItem('cookieConsent')
      if (!v) setVisible(true)
    } catch {}
  }, [])
  if (!visible) return null
  const accept = (val: 'accept' | 'reject') => {
    try {
      localStorage.setItem('cookieConsent', val)
    } catch {}
    setVisible(false)
  }
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Bannière de cookies"
      style={{
        position: 'fixed',
        zIndex: 50,
        left: 16,
        right: 16,
        bottom: 16,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: 14,
        boxShadow: 'var(--shadow-elev2)',
      }}
    >
      <p style={{ fontSize: 14, margin: 0 }}>
        Nous utilisons des cookies essentiels (sécurité, paiement) et de mesure d’audience. Consultez la{' '}
        <a href="/fr/legal/cookies" style={{ color: 'var(--color-text)' }}>
          Politique des cookies
        </a>
        .
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button
          onClick={() => accept('reject')}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
          }}
        >
          Refuser (hors essentiels)
        </button>
        <button
          onClick={() => accept('accept')}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontWeight: 800,
          }}
        >
          Accepter
        </button>
        <Link
          href="/fr/legal/privacy"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            textDecoration: 'none',
          }}
        >
          Préférences
        </Link>
      </div>
    </div>
  )
}

/* ====================== UI atoms ====================== */
function focusRing<T extends HTMLElement>(el: T | null, on = true) {
  if (!el) return
  ;(el.style as any).boxShadow = on ? 'var(--ring)' : 'none'
}

function Button({
  href,
  children,
  variant = 'primary',
  ariaLabel,
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  ariaLabel?: string
}) {
  const base: React.CSSProperties = {
    textDecoration: 'none',
    fontWeight: 700,
    borderRadius: 12,
    padding: '14px 18px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    outline: 'none',
    border: '1px solid var(--color-border)',
    transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease',
  }
  const styles: Record<'primary' | 'secondary' | 'ghost', React.CSSProperties> = {
    primary: {
      ...base,
      background: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      borderColor: 'transparent',
    },
    secondary: { ...base, background: 'var(--color-surface)', color: 'var(--color-text)' },
    ghost: { ...base, background: 'transparent', color: 'var(--color-text)' },
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{ ...styles[variant] }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as any).style.boxShadow = 'var(--shadow-glow)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as any).style.boxShadow = 'none'
      }}
      onMouseDown={(e) => {
        ;(e.currentTarget as any).style.transform = 'translateY(1px)'
      }}
      onMouseUp={(e) => {
        ;(e.currentTarget as any).style.transform = 'translateY(0)'
      }}
      onFocus={(e) => focusRing(e.currentTarget)}
      onBlur={(e) => focusRing(e.currentTarget, false)}
    >
      {children}
    </Link>
  )
}

function SectionLabel(props: React.HTMLAttributes<HTMLDivElement>) {
  const { children, style, ...rest } = props
  return (
    <div
      {...rest}
      style={{
        fontSize: 14,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: 'var(--color-muted)',
        marginBottom: 8,
        ...(style || {}),
      }}
    >
      {children}
    </div>
  )
}

/* ====================== Header ====================== */
function Header({ onToggleTheme, href }: { onToggleTheme: () => void; href: (p: string) => string }) {
  const { t } = useT()
  return (
    <header
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'color-mix(in srgb, var(--color-bg) 86%, transparent)',
        backdropFilter: 'saturate(120%) blur(10px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <nav
        aria-label="Primary"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '12px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Link
          href={href('/')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--color-text)' }}
        >
          <img src="/logo.svg" alt="Parcels of Time" width={28} height={28} />
          <strong style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Parcels of Time</strong>
        </Link>

        {/* En-tête épuré */}
        <ul
          aria-label="Navigation"
          style={{ display: 'flex', gap: 18, listStyle: 'none', justifyContent: 'center', margin: 0, padding: 0, color: 'var(--color-text)' }}
        >
          <li>
            <a href="#faq" style={{ textDecoration: 'none', color: 'inherit' }}>
              {t('nav.faq')}
            </a>
          </li>
          <li>
            <Link href={href('/explore')} style={{ textDecoration: 'none', color: 'inherit' }}>
              Registre public
            </Link>
          </li>
          <li>
            <Link href={href('/account')} style={{ textDecoration: 'none', color: 'inherit' }}>
              Mon Compte
            </Link>
          </li>
        </ul>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {/* Un seul “Offrir” + “Réserver” */}
          <Button href={href('/claim?gift=1')} variant="secondary" ariaLabel={t('cta.gift')}>
            🎁 {t('cta.gift')}
          </Button>
          <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>
            {t('cta.claim')}
          </Button>
          <button
            aria-label="Changer de thème"
            onClick={onToggleTheme}
            onFocus={(e) => focusRing(e.currentTarget)}
            onBlur={(e) => focusRing(e.currentTarget, false)}
            style={{
              marginLeft: 6,
              padding: 10,
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            ☀︎/☾
          </button>
        </div>
      </nav>
    </header>
  )
}

/* =============== Certificate Preview =============== */
type PreviewStyle =
  | 'romantic'
  | 'birth'
  | 'wedding'
  | 'birthday'
  | 'christmas'
  | 'newyear'
  | 'graduation'
  | 'neutral'

const SAFE_INSETS_PCT: Record<
  PreviewStyle,
  { top: number; right: number; bottom: number; left: number }
> = {
  neutral: { top: 16.6, right: 16.1, bottom: 18.5, left: 16.1 },
  romantic: { top: 19.0, right: 19.5, bottom: 18.5, left: 19.5 },
  birthday: { top: 17.1, right: 22.2, bottom: 18.5, left: 22.2 },
  birth: { top: 17.8, right: 18.8, bottom: 18.5, left: 18.8 },
  wedding: { top: 19.0, right: 20.8, bottom: 18.5, left: 20.8 },
  christmas: { top: 17.8, right: 18.8, bottom: 18.5, left: 18.8 },
  newyear: { top: 17.8, right: 18.8, bottom: 18.5, left: 18.8 },
  graduation: { top: 17.8, right: 18.8, bottom: 18.5, left: 18.8 },
}
const EDGE_PX = 12

function CertificatePreview({
  styleId,
  owner,
  title,
  message,
  ts,
  href,
}: {
  styleId: PreviewStyle
  owner: string
  title?: string
  message?: string
  ts: string
  href: string
}) {
  // Toujours afficher la date UTC (jour)
  const tsText = useMemo(() => {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ts
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
    return utc.toISOString().slice(0, 10) + ' UTC'
  }, [ts])

  const previewTextColor = 'rgba(26, 31, 42, 0.92)'
  const previewSubtle = 'rgba(26, 31, 42, 0.70)'
  const ins = SAFE_INSETS_PCT[styleId]

  return (
    <a href={href} style={{ textDecoration: 'none', color: 'var(--color-text)' }} aria-label={`Choisir le style ${styleId}`}>
      <figure
        style={{
          margin: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-elev1)',
        }}
      >
        <div style={{ position: 'relative', width: '100%', aspectRatio: '595/842', background: '#F4F1EC' }}>
          <img
            src={`/cert_bg/${styleId}.png`}
            alt={`Certificat style ${styleId}`}
            width={595}
            height={842}
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Overlay */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, color: previewTextColor }}>
            {/* Safe-area */}
            <div
              style={{
                position: 'absolute',
                top: `${ins.top}%`,
                right: `${ins.right}%`,
                bottom: `${ins.bottom}%`,
                left: `${ins.left}%`,
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                textAlign: 'center',
              }}
            >
              {/* Header */}
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Parcels of Time</div>
                <div style={{ opacity: 0.9, fontSize: 12 }}>Certificate of Claim</div>
              </div>

              {/* Body */}
              <div style={{ display: 'grid', alignItems: 'start', justifyItems: 'center', rowGap: 8, paddingTop: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: 0.2 }}>{tsText}</div>

                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>Owned by</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{owner || 'Anonymous'}</div>

                {title && (
                  <>
                    <div style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>Title</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
                  </>
                )}

                {message && (
                  <>
                    <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>Message</div>
                    <div style={{ maxWidth: '72%', lineHeight: 1.35, fontSize: 13 }}>“{message}”</div>
                  </>
                )}
              </div>
            </div>

            {/* Footer mock */}
            <div
              style={{
                position: 'absolute',
                left: EDGE_PX,
                bottom: EDGE_PX,
                fontSize: 12,
                color: previewSubtle,
                textAlign: 'left',
                pointerEvents: 'none',
              }}
            >
              Certificate ID • Integrity hash (aperçu)
            </div>

            <div
              style={{
                position: 'absolute',
                right: EDGE_PX,
                bottom: EDGE_PX,
                width: 84,
                height: 84,
                border: '1px dashed rgba(26,31,42,.45)',
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                opacity: 0.85,
                pointerEvents: 'none',
              }}
            >
              QR
            </div>
          </div>
        </div>

        <figcaption style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-muted)' }}>
          Aperçu non contractuel — le PDF final contient un QR code scannable et l’empreinte d’intégrité.
        </figcaption>
      </figure>
    </a>
  )
}

/* =============== Usages carousel =============== */
function UsagesCarousel() {
  const items = [
    { title: 'Amour & famille', text: 'Rencontre, fiançailles, mariage, naissance, premier mot.', icon: '💛' },
    { title: 'Réussite', text: 'Diplôme, CDI, première vente, lancement de projet.', icon: '🏆' },
    { title: 'Culture & fête', text: 'Concert, finale, feu d’artifice, Nouvel An.', icon: '🎆' },
    { title: 'Voyages', text: 'Décollage, lever de soleil, boussole vers ailleurs.', icon: '🧭' },
    { title: 'Cadeaux', text: 'Une journée à offrir, personnelle et mémorable.', icon: '🎁' },
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 3000)
    return () => clearInterval(t)
  }, [])
  const it = items[i]
  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Idées d’utilisation"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        borderRadius: 16,
        padding: 16,
        boxShadow: 'var(--shadow-elev1)',
      }}
    >
      <div>
        <div style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{it.icon}</span>
          <strong>{it.title}</strong>
        </div>
        <p style={{ margin: '8px 0 0', color: 'var(--color-text)', opacity: 0.9 }}>{it.text}</p>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        {items.map((_, idx) => (
          <span
            key={idx}
            aria-label={idx === i ? 'élément actif' : 'élément'}
            style={{ width: 6, height: 6, borderRadius: 99, background: idx === i ? 'var(--color-primary)' : 'var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}

/* =============== Feature card =============== */
function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 18,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 6 }}>{title}</strong>
      <p style={{ margin: 0, color: 'var(--color-text)', opacity: 0.9 }}>{text}</p>
    </div>
  )
}

/* =============== Témoignages =============== */
function Testimonials() {
  const items = [
    { q: '“Nous avons revendiqué la journée de la naissance d’Aïcha… frissons à chaque fois !”', a: 'Camille' },
    { q: '“Mon cadeau préféré : la journée de notre rencontre.”', a: 'Thomas' },
    { q: '“La journée du diplôme de ma sœur. Simple, mémorable, classe.”', a: 'Mina' },
  ]
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
      <SectionLabel>Témoignages</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
        {items.map((t, i) => (
          <blockquote
            key={i}
            style={{
              gridColumn: 'span 4',
              margin: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: 18,
              color: 'var(--color-text)',
            }}
          >
            <p style={{ margin: '0 0 8px', fontStyle: 'italic' }}>{t.q}</p>
            <footer style={{ opacity: 0.8 }}>— {t.a}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}

/* =============== FAQ (FR/EN) =============== */
function FAQ() {
  const pathname = usePathname() || '/'
  const href = useLocaleHref()
  const isFR = /^\/fr(\/|$)/.test(pathname)

  const rowsFR = [
    {
      q: 'Qu’est-ce que j’achète exactement ?',
      a: `Vous acquérez la propriété symbolique d’une journée, vendue une seule fois.
Elle est matérialisée par un certificat numérique (PDF) et une page publique dédiée.
Aucun droit juridique sur le temps n’est conféré. C’est un objet symbolique et artistique.`,
    },
    {
      q: 'Le certificat est-il personnalisable (photo) ?',
      a: `Oui. Vous pouvez définir un titre, un message, choisir un style ou ajouter une photo personnelle.
Le rendu HD inclut un QR code vers votre page.`,
    },
    {
      q: 'Comment garantissez-vous l’authenticité de l’acquisition ?',
      a: `Chaque certificat intègre une empreinte d’intégrité (SHA-256) unique.
L’empreinte est imprimée sur le certificat et vérifiable via le QR code. Toute altération la rendrait invalide.
C’est notre preuve d’authenticité, qui rend cet objet numérique tangible.`,
    },
    {
      q: 'Puis-je revendre ma journée ?',
      a: `Oui. La revente est possible sur notre place de marché.
Activez votre compte marchand Stripe (KYC) depuis votre espace client.
Commission plateforme : 15 % (min. 1 €) prélevée lors de la vente. Virements via Stripe. Vos obligations fiscales s’appliquent.`,
    },
    {
      q: 'Qu’est-ce que le Registre public ?',
      a: `Une galerie participative où vous pouvez exposer (ou non) votre certificat (date, titre, extrait, photo).
Vous contrôlez la visibilité. Les contenus publics sont modérés. Évitez les visages de mineurs. Pas de contenus sensibles ou illicites.`,
    },
    { q: 'Impression et formats', a: `Fichiers HD prêts à imprimer. Format recommandé : A4.` },
    {
      q: 'Délais et livraison',
      a: `Génération quasi immédiate (souvent moins de 2 minutes).
Vous recevez un e-mail avec les fichiers et le lien de la page.`,
    },
    {
      q: 'Paiement et sécurité',
      a: `Les paiements sont opérés par Stripe. Aucune donnée de carte bancaire n’est stockée par Parcels of Time.
En revente, les encaissements et virements passent par Stripe Connect.`,
    },
  ]

  const rowsEN = [
    {
      q: 'What exactly am I buying?',
      a: `You acquire the symbolic ownership of a single day, sold only once.
It is materialized by a digital certificate (PDF) and a dedicated public page.
No legal rights over time are conferred. It’s a symbolic, artistic object.`,
    },
    {
      q: 'Is the certificate customizable (photo)?',
      a: `Yes. You can set a title, a message, choose a style, or add a personal photo.
The HD render includes a QR code to your page.`,
    },
    {
      q: 'How do you guarantee authenticity?',
      a: `Each certificate includes a unique integrity fingerprint (SHA-256).
The fingerprint is printed on the certificate and verifiable via the QR code. Any alteration would invalidate it.`,
    },
    {
      q: 'Can I resell my day?',
      a: `Yes. Resale is possible on our marketplace.
Activate your Stripe merchant account (KYC) from your dashboard.
Platform fee: 15% (min €1) charged upon sale. Payouts via Stripe. Taxes apply.`,
    },
    {
      q: 'What is the Public Registry?',
      a: `A participatory gallery where you may display (or keep private) your certificate (date, title, excerpt, photo).
You control visibility. Public content is moderated. Avoid faces of minors. No sensitive or illegal content.`,
    },
    { q: 'Printing & formats', a: `HD files ready to print. Recommended A4.` },
    {
      q: 'Turnaround & delivery',
      a: `Near-instant generation (often under 2 minutes).
You’ll receive an email with files and the page link.`,
    },
    {
      q: 'Payment & security',
      a: `Payments are handled by Stripe. We do not store card data.
For resales, collection and payouts go through Stripe Connect.`,
    },
  ]

  const rows = isFR ? rowsFR : rowsEN

  return (
    <section id="faq" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 72px' }}>
      <SectionLabel>FAQ</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 12 }}>
        {rows.map((r, i) => (
          <details
            key={i}
            style={{
              gridColumn: 'span 6',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 700, lineHeight: 1.2 }}>{r.q}</summary>
            <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{r.a}</p>
          </details>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
        {isFR ? (
          <>
            Besoin d’aide ? Consultez{' '}
            <a href={href('/legal/terms')} style={{ color: 'inherit' }}>
              CGU/CGV
            </a>{' '}
            •{' '}
            <a href={href('/legal/privacy')} style={{ color: 'inherit' }}>
              Confidentialité
            </a>{' '}
            •{' '}
            <a href="mailto:hello@parcelsoftime.com" style={{ color: 'inherit' }}>
              Support
            </a>
          </>
        ) : (
          <>
            Need help? See{' '}
            <a href={href('/legal/terms')} style={{ color: 'inherit' }}>
              Terms
            </a>{' '}
            •{' '}
            <a href={href('/legal/privacy')} style={{ color: 'inherit' }}>
              Privacy
            </a>{' '}
            •{' '}
            <a href="mailto:hello@parcelsoftime.com" style={{ color: 'inherit' }}>
              Support
            </a>
          </>
        )}
      </div>
    </section>
  )
}

/* =============== Hero section (photos) =============== */
function HeroPhotos({ href }: { href: (p: string) => string }) {
  const { t } = useT()
  return (
    <section
      style={{ position: 'relative', overflow: 'clip', borderBottom: '1px solid var(--color-border)' }}
      aria-labelledby="hero-title"
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(50% 30% at 60% -10%, rgba(140,214,255,.12), transparent 60%), radial-gradient(40% 24% at 20% -6%, rgba(228,183,61,.18), transparent 60%)',
        }}
      />
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '72px 24px 40px',
          display: 'grid',
          gap: 24,
          gridTemplateColumns: 'repeat(12, 1fr)',
          alignItems: 'center',
        }}
      >
        <div style={{ gridColumn: 'span 6', color: 'var(--color-text)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <img src="/logo.svg" alt="" width={40} height={40} />
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: 20 }}>Parcels of Time</span>
          </div>
          <h1 id="hero-title" style={{ fontFamily: 'Fraunces, serif', fontSize: 56, lineHeight: '64px', margin: '8px 0 12px' }}>
            {t('hero.h1')}
          </h1>
          <p style={{ fontSize: 18, lineHeight: '28px', maxWidth: 560, color: 'var(--color-text)' }}>{t('hero.subtitle')}</p>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>
              {t('cta.claim')}
            </Button>
            <Button href={href('/claim?gift=1')} variant="secondary" ariaLabel={t('cta.gift')}>
              🎁 {t('cta.gift')}
            </Button>
          </div>

          {/* Rareté */}
          <div style={{ marginTop: 14, fontSize: 14, color: 'var(--color-muted)' }}>Chaque date n’est proposée qu’une seule fois.</div>

          {/* Trust bar */}
          <div
            aria-label="Barre de confiance"
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              marginTop: 16,
              fontSize: 12,
              color: 'var(--color-muted)',
            }}
          >
            <span>🔒 Stripe • Paiement sécurisé</span>
            <span>🧾 SHA-256 • Empreinte d’intégrité</span>
            <span>🖼️ PDF/JPG HD prêts à imprimer</span>
          </div>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <HeroSlideshow
            interval={2000}
            slides={[
              { src: '/hero/love.png', alt: 'Amour — couple qui s’enlace au coucher du soleil', focal: 'center 40%' },
              { src: '/hero/birth.png', alt: 'Naissance — peau à peau, lumière douce' },
              { src: '/hero/birthday.png', alt: 'Anniversaire — bougies, confettis, joie' },
              { src: '/hero/graduation.png', alt: 'Diplôme — lancer de toques sur campus' },
            ]}
          />
        </div>
      </div>
    </section>
  )
}

/* =============== Gift spotlight =============== */
function GiftSpotlight() {
  return (
    <section aria-labelledby="gift" style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px' }}>
      <SectionLabel id="gift">Le cadeau original & personnalisable</SectionLabel>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 18 }}>
        <h3 style={{ margin: '0 0 8px', fontFamily: 'Fraunces, serif', lineHeight: '28px' }}>Offrez une journée qui ne se reproduira jamais</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: '28px' }}>
          <li>Certificat HD avec votre photo et message (contenu modéré)</li>
          <li>QR vers une page publique (ou privée) pour partager l’histoire</li>
          <li>Livraison instantanée par e-mail — idéal en cadeau de dernière minute</li>
          <li>Chaque date n’est proposée qu’une seule fois.</li>
        </ul>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
          Astuce : choisissez un palindrome, un 11:11 ou un moment symbolique pour rendre le cadeau encore plus marquant.
        </p>
      </div>
    </section>
  )
}

/* =============== Bloc Registre public =============== */
function PublicRegisterBlurb() {
  const href = useLocaleHref()
  return (
    <section id="registre" aria-labelledby="registre-titre" style={{ maxWidth: 960, margin: '0 auto', padding: '8px 24px 24px' }}>
      <SectionLabel id="registre-titre">Registre public</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: 18,
        }}
      >
        <p style={{ margin: 0, lineHeight: '26px' }}>
          Le <strong>Registre public</strong> est une <strong>galerie vivante</strong> d’œuvres datées : des propriétaires choisissent d’y exposer
          leur certificat. C’est une démarche <strong>symbolique et artistique</strong> — une forme d’art participatif où chaque date devient un
          témoignage unique. Vous gardez le contrôle de la visibilité depuis votre compte.
        </p>
        <div>
          <Button href={href('/explore')} variant="ghost" ariaLabel="Voir le registre public">
            Voir le Registre public →
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ====================== JSON-LD (SEO) ====================== */
function JsonLd() {
  // Minimal but useful schema: product + creative work model
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: 'Parcels of Time — Certificate of Claim',
        brand: { '@type': 'Brand', name: 'Parcels of Time' },
        description:
          'Symbolic ownership of a single day materialized by a high-definition digital certificate (PDF/JPG) with QR code and integrity hash.',
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          url: 'https://parcelsoftime.com/claim',
          priceCurrency: 'EUR',
          price: '—', // filled server-side if needed
        },
      },
      {
        '@type': 'CreativeWork',
        name: 'Day Certificate',
        creator: { '@type': 'Organization', name: 'Parcels of Time' },
        about: 'A participatory art piece turning dates into unique, verifiable keepsakes.',
      },
    ],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

/* ====================== Page ====================== */
export default function Landing() {
  const href = useLocaleHref()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    applyTheme(theme === 'dark' ? TOKENS_DARK : TOKENS_LIGHT)
  }, [theme])

  // Reduce motion preference
  useEffect(() => {
    if (!isBrowser()) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduce) {
      // Potential hook for disabling subtle animations globally if needed
    }
  }, [])

  const whyLead = useMemo(
    () =>
      'Nous capturons tout… mais les moments se perdent. Parcels of Time transforme une date en objet unique, vérifiable et partageable.',
    []
  )
  const whyBullets = [
    { icon: '🔒', title: 'Authentique', text: 'Certificat HD avec empreinte d’intégrité (SHA-256) et QR scannable.' },
    { icon: '✨', title: 'Unique', text: 'Chaque date n’est proposée qu’une seule fois — jamais en double.' },
    { icon: '🔁', title: 'Évolutif', text: 'Page publique, mise à jour du message/photo, et revente possible via Stripe.' },
  ]

  return (
    <main id="content" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <SkipLink />
      <CookieBanner />
      <Header onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} href={href} />

      <HeroPhotos href={href} />
      <GiftSpotlight />

      {/* Pourquoi maintenant */}
      <section id="pourquoi" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
        <SectionLabel>Pourquoi maintenant&nbsp;?</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16, alignItems: 'stretch' }}>
          <div style={{ gridColumn: 'span 7' }}>
            <p style={{ margin: 0, fontSize: 18, lineHeight: '28px' }}>{whyLead}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 12, marginTop: 12 }}>
              {whyBullets.map((b, i) => (
                <div
                  key={i}
                  style={{
                    gridColumn: 'span 4',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: 14,
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span aria-hidden style={{ fontSize: 18 }}>
                      {b.icon}
                    </span>
                    <strong>{b.title}</strong>
                  </div>
                  <div style={{ opacity: 0.9 }}>{b.text}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Carousel aligné */}
          <div style={{ gridColumn: 'span 5', display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: 1 }}>
              <UsagesCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* Registre public */}
      <PublicRegisterBlurb />

      {/* Ce que vous possédez */}
      <section aria-labelledby="possedez" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
        <SectionLabel id="possedez">Ce que vous possédez</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          <div style={{ gridColumn: 'span 3' }}>
            <FeatureCard title="Une journée unique" text="Jamais vendue deux fois. Votre instant, pour toujours." />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <FeatureCard title="Certificat de Claim" text="PDF/JPG signé, prêt à imprimer et encadrer." />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <FeatureCard title="QR code scannable" text="Accès direct à votre page souvenir et partage facile." />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <FeatureCard title="Page dédiée" text="Message + lien (modérés), horodatage UTC & heure locale." />
          </div>
        </div>
      </section>

      {/* Ce que vous recevez */}
      <section id="receive" style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px 32px' }}>
        <SectionLabel>Ce que vous recevez</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          <div style={{ gridColumn: 'span 4' }}>
            <CertificatePreview
              styleId="romantic"
              owner="Clara & Sam"
              title="Notre premier baiser"
              ts="2018-07-19"
              message="Te souviens-tu ? Ce 19 juillet 2018, on s’était abrités de l’averse. Puis, là, tu m’as embrassé."
              href={href('/claim?style=romantic')}
            />
          </div>

          <div style={{ gridColumn: 'span 4' }}>
            <CertificatePreview
              styleId="birth"
              owner="Nora & Mehdi"
              title="Bienvenue, Aïcha"
              ts="2023-03-02"
              message="À 06:12, le 2 mars 2023, tu as crié. Le silence d’après s’est rempli de lumière : tu étais née."
              href={href('/claim?style=birth')}
            />
          </div>

          <div style={{ gridColumn: 'span 4' }}>
            <CertificatePreview
              styleId="wedding"
              owner="Inès & Hugo"
              title="À 17:31, plus que nous deux"
              ts="2024-07-20"
              message="Les confettis volaient. À 17:31, nos deux « oui » ont effacé le reste."
              href={href('/claim?style=wedding')}
            />
          </div>
        </div>

        {/* Info */}
        <div style={{ maxWidth: 960, margin: '18px auto 0' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: '28px' }}>
              <li>Certificat numérique haute définition (PDF/JPG) prêt à imprimer</li>
              <li>QR code scannable menant à votre page souvenir</li>
            </ul>
            <div style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)' }}>
              Paiements & revente sécurisés par Stripe • Commission de place de marché : 15% (min 1 €) lors de la revente.
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment" style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 24px 32px' }}>
        <SectionLabel>Comment ça marche</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          <div style={{ gridColumn: 'span 4', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 28 }}>①</div>
            <strong>Choisissez date & heure</strong>
          </div>
          <div style={{ gridColumn: 'span 4', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 28 }}>②</div>
            <strong>Personnalisez</strong>
            <p style={{ margin: '6px 0 0' }}>Propriétaire, message, style du certificat, photo.</p>
          </div>
          <div style={{ gridColumn: 'span 4', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 28 }}>③</div>
            <strong>Réservez & recevez</strong>
            <p style={{ margin: '6px 0 0' }}>
              Certificat + QR immédiatement. <span aria-label="moins de 2 minutes" title="moins de 2 minutes">⏱ &lt; 2&nbsp;minutes</span>.
            </p>
          </div>
        </div>
      </section>

      <Testimonials />
      <FAQ />

      {/* CTA FINAL */}
      <section
        aria-labelledby="cta-final"
        style={{
          borderTop: '1px solid var(--color-border)',
          background: 'linear-gradient(0deg, color-mix(in srgb, var(--color-surface) 85%, transparent), transparent)',
          marginTop: 16,
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 24px 56px', textAlign: 'center' }}>
          <h3 id="cta-final" style={{ fontFamily: 'Fraunces, serif', fontSize: 40, lineHeight: '48px', margin: '0 0 8px' }}>
            Transformez un instant en héritage.
          </h3>
          <p style={{ margin: '0 0 16px' }}>Réservez le jour qui compte — aujourd’hui.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button href={href('/claim')} variant="primary">
              Réserver mon jour
            </Button>
            <Button href={href('/claim?gift=1')} variant="secondary">
              🎁 Offrir un jour
            </Button>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
            Paiement sécurisé Stripe • Certificat HD • Revente C2C possible • Une seule vente par date
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--color-border)' }}>
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '18px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>Parcels of Time</div>
            <div style={{ marginTop: 6, color: 'var(--color-muted)' }}>© {new Date().getFullYear()} Parcels of Time</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Légal</div>
              <div style={{ display: 'grid', gap: 6 }}>
                <Link href="/fr/legal/legal-notice" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  Mentions légales
                </Link>
                <Link href="/fr/legal/terms" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  CGU/CGV
                </Link>
                <Link href="/fr/legal/seller" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  Conditions Vendeur
                </Link>
                <Link href="/fr/legal/refund" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  Remboursement
                </Link>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Entreprise</div>
              <div style={{ display: 'grid', gap: 6 }}>
                <Link href="/fr/legal/privacy" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  Confidentialité
                </Link>
                <Link href="/fr/legal/cookies" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  Cookies
                </Link>
                <Link href="/fr/company" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  À propos
                </Link>
                <Link href="/fr/support" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  Support
                </Link>
                <a href="mailto:hello@parcelsoftime.com" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                  B2B
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <JsonLd />
    </main>
  )
}
