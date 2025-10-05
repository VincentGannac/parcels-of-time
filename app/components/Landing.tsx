// app/components/Landing.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import HeroSlideshow from './HeroSlideshow'
import { useLocaleHref } from './useLocaleHref'
import { useT } from '../i18n/I18nProvider'
import { usePathname } from 'next/navigation'

/* ======================= THEME TOKENS ======================= */
const TOKENS_DARK = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-elev': '#0E1525',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-accent': '#8CD6FF',
  '--color-border': '#1E2A3C',
  '--ring': '0 0 0 4px rgba(228,183,61,.22)',
  '--shadow-1': '0 8px 18px rgba(0,0,0,.22)',
  '--shadow-2': '0 16px 36px rgba(0,0,0,.36)',
} as const

const TOKENS_LIGHT = {
  '--color-bg': '#FAFAF7',
  '--color-surface': '#FFFFFF',
  '--color-elev': '#F4F6FB',
  '--color-text': '#1D2433',
  '--color-muted': '#4B5565',
  '--color-primary': '#1C2B6B',
  '--color-on-primary': '#FFFFFF',
  '--color-accent': '#D4AF37',
  '--color-border': '#E6E6EA',
  '--ring': '0 0 0 4px rgba(28,43,107,.18)',
  '--shadow-1': '0 8px 18px rgba(10,14,30,.10)',
  '--shadow-2': '0 16px 36px rgba(10,14,30,.16)',
} as const

function applyTheme(vars: Record<string, string>) {
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

const MAXW = 1200
function Container(props: React.HTMLAttributes<HTMLDivElement>) {
  const { style, ...rest } = props
  return <div {...rest} style={{ maxWidth: MAXW, margin: '0 auto', padding: '24px', ...(style || {}) }} />
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8 }}>
      {children}
    </div>
  )
}
function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} style={{ fontFamily: 'Fraunces, serif', fontSize: 36, lineHeight: '44px', margin: '0 0 12px', color: 'var(--color-text)' }}>
      {children}
    </h2>
  )
}

/* ======================= ATOMS ======================= */
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
    border: '1px solid var(--color-border)',
    transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease',
  }
  const styles: Record<'primary' | 'secondary' | 'ghost', React.CSSProperties> = {
    primary: { ...base, background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderColor: 'transparent' },
    secondary: { ...base, background: 'var(--color-surface)', color: 'var(--color-text)' },
    ghost: { ...base, background: 'transparent', color: 'var(--color-text)' },
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={styles[variant]}
      onMouseEnter={(e) => ((e.currentTarget as any).style.boxShadow = 'var(--ring)')}
      onMouseLeave={(e) => ((e.currentTarget as any).style.boxShadow = 'none')}
      onMouseDown={(e) => ((e.currentTarget as any).style.transform = 'translateY(1px)')}
      onMouseUp={(e) => ((e.currentTarget as any).style.transform = 'translateY(0)')}
    >
      {children}
    </Link>
  )
}

/* ======= NavPill : pour Registre public & Mon Compte (visibilité accrue) ======= */
function NavPill({
  href,
  children,
  emphasis = 'accent', // accent | outline
  ariaLabel,
}: {
  href: string
  children: React.ReactNode
  emphasis?: 'accent' | 'outline'
  ariaLabel?: string
}) {
  const base: React.CSSProperties = {
    textDecoration: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 700,
    border: '1px solid var(--color-border)',
    transition: 'box-shadow .12s ease, transform .12s ease, background .12s ease',
  }
  const style =
    emphasis === 'accent'
      ? { ...base, background: 'var(--color-surface)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-primary) 60%, transparent) inset', color: 'var(--color-text)' }
      : { ...base, background: 'transparent', color: 'var(--color-text)' }

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={style}
      onMouseEnter={(e) => ((e.currentTarget as any).style.boxShadow = 'var(--ring)')}
      onMouseLeave={(e) => ((e.currentTarget as any).style.boxShadow = 'none')}
      onMouseDown={(e) => ((e.currentTarget as any).style.transform = 'translateY(1px)')}
      onMouseUp={(e) => ((e.currentTarget as any).style.transform = 'translateY(0)')}
    >
      {children}
    </Link>
  )
}

/* ======================= COOKIE ======================= */
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
      style={{
        position: 'fixed',
        zIndex: 60,
        left: 16,
        right: 16,
        bottom: 16,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: 14,
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <p style={{ margin: 0, fontSize: 14 }}>
        Nous utilisons des cookies essentiels (sécurité, paiement) et de mesure d’audience. Voir{' '}
        <a href="/fr/legal/cookies" style={{ color: 'var(--color-text)' }}>
          Politique des cookies
        </a>
        .
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => accept('reject')}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)' }}
        >
          Refuser (hors essentiels)
        </button>
        <button
          onClick={() => accept('accept')}
          style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontWeight: 800 }}
        >
          Accepter
        </button>
        <Link href="/fr/legal/privacy" style={{ textDecoration: 'none', color: 'var(--color-text)', padding: '10px 12px' }}>
          Préférences
        </Link>
      </div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        fontSize: 12,
        borderRadius: 999,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
      }}
    >
      {children}
    </span>
  )
}


/* ======================= HEADER (refonte) ======================= */
function Header({ onToggleTheme, href }: { onToggleTheme: () => void; href: (p: string) => string }) {
  const { t } = useT()
  const [isSmall, setIsSmall] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // accessible close on route change or esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)',
        backdropFilter: 'saturate(120%) blur(10px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <Container style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Logo */}
          <Link href={href('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--color-text)' }}>
            <img src="/logo.svg" alt="Parcels of Time" width={28} height={28} />
            <strong style={{ fontFamily: 'Fraunces, serif' }}>Parcels of Time</strong>
          </Link>

          {/* Desktop */}
          {!isSmall && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Mise en avant visible */}
              <NavPill href={href('/explore')} emphasis="accent" ariaLabel="Registre public">
                🖼️ <span>Registre public</span>
              </NavPill>
              <NavPill href={href('/account')} emphasis="outline" ariaLabel="Mon Compte">
                👤 <span>Mon Compte</span>
              </NavPill>

              <span aria-hidden style={{ width: 10 }} />

              {/* Actions */}
              <Button href={href('/claim?gift=1')} variant="secondary" ariaLabel={t('cta.gift')}>
                🎁 {t('cta.gift')}
              </Button>
              <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>
                {t('cta.claim')}
              </Button>

              <button
                aria-label="Changer de thème"
                onClick={onToggleTheme}
                style={{ padding: 10, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                ☀︎/☾
              </button>
            </div>
          )}

          {/* Mobile */}
          {isSmall && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>
                {t('cta.claim')}
              </Button>
              <button
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                ☰
              </button>
            </div>
          )}
        </div>
      </Container>

      {/* Mobile sheet */}
      {isSmall && menuOpen && (
        <div
          id="mobile-menu"
          role="menu"
          style={{
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-elev)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <Container style={{ display: 'grid', gap: 10, paddingTop: 14, paddingBottom: 14 }}>
            <NavPill href={href('/explore')} emphasis="accent" ariaLabel="Registre public">
              🖼️ Registre public
            </NavPill>
            <NavPill href={href('/account')} emphasis="outline" ariaLabel="Mon Compte">
              👤 Mon Compte
            </NavPill>
            <Button href={href('/claim?gift=1')} variant="secondary">
              🎁 {t('cta.gift')}
            </Button>
            <button
              onClick={onToggleTheme}
              style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textAlign: 'left' }}
            >
              ☀︎/☾ Changer de thème
            </button>
          </Container>
        </div>
      )}
    </header>
  )
}

/* =========================================================
   CERTIFICATE PREVIEW (réutilisé pour démos & teaser)
   ========================================================= */
type PreviewStyle = 'romantic' | 'birth' | 'wedding' | 'birthday' | 'christmas' | 'newyear' | 'graduation' | 'neutral'

const SAFE_INSETS_PCT: Record<PreviewStyle, { top: number; right: number; bottom: number; left: number }> = {
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
  compact = false,
}: {
  styleId: PreviewStyle
  owner: string
  title?: string
  message?: string
  ts: string
  href: string
  compact?: boolean
}) {
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
    <a href={href} aria-label={`Choisir le style ${styleId}`} style={{ textDecoration: 'none', color: 'var(--color-text)', display: 'block' }}>
      <figure
        style={{
          margin: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        <div style={{ position: 'relative', width: '100%', aspectRatio: compact ? '3 / 4' : '595 / 842', background: '#F4F1EC' }}>
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
              <div>
                <div style={{ fontWeight: 900, fontSize: compact ? 14 : 16 }}>Parcels of Time</div>
                <div style={{ opacity: 0.9, fontSize: compact ? 10 : 12 }}>Certificate of Claim</div>
              </div>

              <div style={{ display: 'grid', alignItems: 'start', justifyItems: 'center', rowGap: 8, paddingTop: 8 }}>
                <div style={{ fontWeight: 800, fontSize: compact ? 18 : 24, letterSpacing: 0.2 }}>{tsText}</div>

                {!compact && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            <div style={{ position: 'absolute', left: EDGE_PX, bottom: EDGE_PX, fontSize: 12, color: previewSubtle, pointerEvents: 'none' }}>
              Certificate ID • Integrity hash (aperçu)
            </div>
            <div
              style={{
                position: 'absolute',
                right: EDGE_PX,
                bottom: EDGE_PX,
                width: compact ? 56 : 84,
                height: compact ? 56 : 84,
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
        {!compact && (
          <figcaption style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-muted)' }}>
            Aperçu non contractuel — le PDF final contient un QR code scannable et l’empreinte d’intégrité.
          </figcaption>
        )}
      </figure>
    </a>
  )
}

/* =========================================================
   HERO — ALIGNEMENT + TRUST BAR
   ========================================================= */
function Hero({ href }: { href: (p: string) => string }) {
  const { t } = useT()
  return (
    <section style={{ borderBottom: '1px solid var(--color-border)', background: 'radial-gradient(60% 40% at 70% -10%, rgba(140,214,255,.10), transparent 60%)' }}>
      <Container style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 24, alignItems: 'center' }}>
        <div style={{ gridColumn: 'span 6', color: 'var(--color-text)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <img src="/logo.svg" alt="" width={40} height={40} />
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: 20 }}>Parcels of Time</span>
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 52, lineHeight: '60px', margin: '6px 0 10px' }}>{t('hero.h1')}</h1>
          <p style={{ fontSize: 18, lineHeight: '28px', maxWidth: 560 }}>{t('hero.subtitle')}</p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>
              {t('cta.claim')}
            </Button>
            <Button href={href('/claim?gift=1')} variant="secondary" ariaLabel={t('cta.gift')}>
              🎁 {t('cta.gift')}
            </Button>
          </div>

          <div style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)' }}>Chaque date n’est proposée qu’une seule fois.</div>

          {/* TRUST BAR alignée */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 16, fontSize: 12, color: 'var(--color-muted)' }}>
            <span>🔒 Stripe • Paiement sécurisé</span>
            <span>🧾 SHA-256 • Empreinte d’intégrité</span>
            <span>🖼️ PDF/JPG HD prêts à imprimer</span>
          </div>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <HeroSlideshow
            interval={2000}
            slides={[
              { src: '/hero/love.png', alt: 'Amour — couple au coucher du soleil', focal: 'center 40%' },
              { src: '/hero/birth.png', alt: 'Naissance — peau à peau, lumière douce' },
              { src: '/hero/birthday.png', alt: 'Anniversaire — bougies et confettis' },
              { src: '/hero/graduation.png', alt: 'Diplôme — lancer de toques' },
            ]}
          />
        </div>
      </Container>
    </section>
  )
}

/* =========================================================
   REGISTRE PUBLIC — SECTION AVANT “POURQUOI”
   ========================================================= */
function RegistryShowcase() {
  const href = useLocaleHref()
  const items: Array<{ styleId: PreviewStyle; ts: string; owner: string; title?: string }> = [
    { styleId: 'romantic', ts: '2018-07-19', owner: 'Clara & Sam', title: 'Premier baiser' },
    { styleId: 'birth', ts: '2023-03-02', owner: 'Nora & Mehdi', title: 'Bienvenue, Aïcha' },
    { styleId: 'wedding', ts: '2024-07-20', owner: 'Inès & Hugo', title: 'Nos deux “oui”' },
    { styleId: 'neutral', ts: '2011-11-11', owner: 'Anonyme', title: '11:11' },
  ]

  return (
    <section id="registry" aria-labelledby="registry-title" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <Container>
        <SectionEyebrow>Registre public</SectionEyebrow>
        <H2 id="registry-title">Une galerie participative d’archives personnelles</H2>
        <p style={{ margin: '6px 0 16px', color: 'var(--color-text)', opacity: 0.92, maxWidth: 760 }}>
          Des propriétaires choisissent d’exposer leur certificat (date, titre, extrait, photo). Vous contrôlez la visibilité depuis votre compte.
          C’est une démarche <strong>symbolique et artistique</strong>.
        </p>

        {/* Teaser visuel harmonisé */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          {items.map((it, i) => (
            <div key={i} style={{ gridColumn: 'span 3' }}>
              <CertificatePreview styleId={it.styleId} owner={it.owner} ts={it.ts} title={it.title} href={href('/explore')} compact />
            </div>
          ))}
        </div>

        {/* CTA aligné à gauche */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button href={href('/explore')} variant="secondary" ariaLabel="Voir le Registre public">
            Voir le Registre public →
          </Button>
          <Pill>Modération des contenus publics</Pill>
        </div>

      </Container>
    </section>
  )
}

/* =========================================================
   FEATURE BAND — POURQUOI / VALEUR
   ========================================================= */
function FeatureBand() {
  const bullets = [
    { icon: '🔒', title: 'Authentique', text: 'Empreinte d’intégrité (SHA-256) + QR scannable.' },
    { icon: '✨', title: 'Unique', text: 'Chaque date est vendue une seule fois.' },
    { icon: '🔁', title: 'Évolutif', text: 'Page publique/privée, mise à jour, revente via Stripe.' },
    { icon: '🎁', title: 'Cadeau idéal', text: 'Instantané, personnalisable, prêt à imprimer.' },
  ]
  return (
    <section>
      <Container style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
        <div style={{ gridColumn: 'span 4' }}>
          <SectionEyebrow>Pourquoi maintenant ?</SectionEyebrow>
          <H2>Possédez le jour qui compte</H2>
          <p style={{ margin: 0, color: 'var(--color-text)', opacity: 0.92 }}>
            Nous capturons tout… mais les moments se perdent. Parcels of Time transforme une date en objet unique, vérifiable et partageable.
          </p>
        </div>
        <div style={{ gridColumn: 'span 8', display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 12 }}>
          {bullets.map((b, i) => (
            <div
              key={i}
              style={{
                gridColumn: 'span 6',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 14,
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
              <div style={{ opacity: 0.92 }}>{b.text}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* =========================================================
   WHAT YOU RECEIVE – DÉMOS
   ========================================================= */
function ReceiveShowcase() {
  const href = useLocaleHref()
  return (
    <section>
      <Container>
        <SectionEyebrow>Ce que vous recevez</SectionEyebrow>
        <H2>Certificat HD + page dédiée</H2>

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
        <div
          style={{
            marginTop: 18,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: '28px' }}>
            <li>Fichiers PDF/JPG HD prêts à imprimer (A4 recommandé)</li>
            <li>QR code scannable menant à votre page souvenir</li>
            <li>Visibilité publique/privée au choix</li>
          </ul>
          <div style={{ marginTop: 10, fontSize: 14, color: 'var(--color-muted)' }}>
            Paiements & revente sécurisés par Stripe • Commission marketplace : 15% (min 1 €) lors de la revente.
          </div>
        </div>
      </Container>
    </section>
  )
}

/* =========================================================
   HOW IT WORKS / TESTIMONIALS / FAQ
   ========================================================= */
function HowItWorks() {
  return (
    <section>
      <Container>
        <SectionEyebrow>Comment ça marche</SectionEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          {[
            ['①', 'Choisissez date & heure', ''],
            ['②', 'Personnalisez', 'Propriétaire, message, style, photo.'],
            ['③', 'Réservez & recevez', 'Certificat + QR immédiatement. ⏱ < 2 min.'],
          ].map(([n, t, d], i) => (
            <div key={i} style={{ gridColumn: 'span 4', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 28 }}>{n}</div>
              <strong>{t}</strong>
              {d && <p style={{ margin: '6px 0 0' }}>{d}</p>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function Testimonials() {
  const items = [
    { q: '“Nous avons revendiqué la journée de la naissance d’Aïcha… frissons à chaque fois !”', a: 'Camille' },
    { q: '“Mon cadeau préféré : la journée de notre rencontre.”', a: 'Thomas' },
    { q: '“La journée du diplôme de ma sœur. Simple, mémorable, classe.”', a: 'Mina' },
  ]
  return (
    <section>
      <Container>
        <SectionEyebrow>Témoignages</SectionEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          {items.map((t, i) => (
            <blockquote key={i} style={{ gridColumn: 'span 4', margin: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 16 }}>
              <p style={{ margin: '0 0 8px', fontStyle: 'italic' }}>{t.q}</p>
              <footer style={{ opacity: 0.8 }}>— {t.a}</footer>
            </blockquote>
          ))}
        </div>
      </Container>
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
    <section id="faq">
      <Container>
        <SectionEyebrow>FAQ</SectionEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 12 }}>
          {rows.map((r, i) => (
            <details key={i} style={{ gridColumn: 'span 6', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, lineHeight: 1.2 }}>{r.q}</summary>
              <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{r.a}</p>
            </details>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
          {isFR ? (
            <>
              Besoin d’aide ? <a href={href('/legal/terms')} style={{ color: 'inherit' }}>CGU/CGV</a> •{' '}
              <a href={href('/legal/privacy')} style={{ color: 'inherit' }}>Confidentialité</a> •{' '}
              <a href="mailto:hello@parcelsoftime.com" style={{ color: 'inherit' }}>Support</a>
            </>
          ) : (
            <>
              Need help? <a href={href('/legal/terms')} style={{ color: 'inherit' }}>Terms</a> •{' '}
              <a href={href('/legal/privacy')} style={{ color: 'inherit' }}>Privacy</a> •{' '}
              <a href="mailto:hello@parcelsoftime.com" style={{ color: 'inherit' }}>Support</a>
            </>
          )}
        </div>
      </Container>
    </section>
  )
}


  

/* =========================================================
   FINAL CTA
   ========================================================= */
function FinalCTA() {
  const href = useLocaleHref()
  return (
    <section
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'linear-gradient(0deg, color-mix(in srgb, var(--color-elev) 85%, transparent), transparent)',
      }}
    >
      <Container style={{ textAlign: 'center' }}>
        <H2>Transformez un instant en héritage.</H2>
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
      </Container>
    </section>
  )
}

/* =========================================================
   FOOTER — COMPACT, EN LIGNE
   ========================================================= */
function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--color-border)' }}>
      <Container style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="" width={20} height={20} />
            <span style={{ fontWeight: 700 }}>Parcels of Time</span>
            <span style={{ color: 'var(--color-muted)' }}>© {new Date().getFullYear()}</span>
          </div>

          {/* Menus en LIGNE (non empilés) */}
          <nav aria-label="Footer" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-muted)' }}>Légal:</span>
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
            <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>•</span>
            <Link href="/fr/legal/privacy" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              Confidentialité
            </Link>
            <Link href="/fr/legal/cookies" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              Cookies
            </Link>
            <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>•</span>
            <Link href="/fr/company" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              À propos
            </Link>
            <Link href="/fr/support" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              Support
            </Link>
            <a href="mailto:hello@parcelsoftime.com" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              B2B
            </a>
          </nav>
        </div>
      </Container>
    </footer>
  )
}

/* =========================================================
   JSON-LD (Product + CreativeWork)
   ========================================================= */
function JsonLd() {
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
          price: '—',
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


/* =========================================================
   PAGE
   ========================================================= */
export default function Landing() {
  const href = useLocaleHref()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    applyTheme(theme === 'dark' ? TOKENS_DARK : TOKENS_LIGHT)
  }, [theme])

  return (
    <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <CookieBanner />
      <Header onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} href={href} />

      {/* 1. Hero */}
      <Hero href={href} />

      {/* 2. Registre public (en avant) */}
      <RegistryShowcase />

      {/* 3. Bande valeur / Pourquoi */}
      <FeatureBand />

      {/* 4. Démos / Ce que vous recevez */}
      <ReceiveShowcase />

      {/* 5. Process + Témoignages + FAQ */}
      <HowItWorks />
      <Testimonials />
      <FAQ />

      {/* 6. CTA final + Footer compact */}
      <FinalCTA />
      <Footer />

      <JsonLd />
    </main>
  )
}
