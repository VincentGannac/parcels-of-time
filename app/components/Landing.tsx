// app/components/Landing.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import HeroSlideshow from './HeroSlideshow'
import { useLocaleHref } from './useLocaleHref'
import { useT } from '../i18n/I18nProvider'
import { usePathname } from 'next/navigation'

/* ======================= THEME TOKENS ======================= */
const TOKENS_DARK = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#101521',
  '--color-elev': '#0E1525',
  '--color-text': '#E8ECF5',
  '--color-muted': '#9FA9BC',
  '--color-primary': '#E5B53B',
  '--color-on-primary': '#0B0E14',
  '--color-accent': '#8CD6FF',
  '--color-border': '#1B2435',
  '--color-success': '#19C37D',
  '--color-warning': '#F0B429',
  '--color-danger': '#FF5D5D',
  '--ring': '0 0 0 4px rgba(229,181,59,.22)',
  '--shadow-1': '0 10px 24px rgba(0,0,0,.18)',
  '--shadow-2': '0 18px 40px rgba(0,0,0,.34)',
  '--radius': '12px',
  '--radius-lg': '16px',
} as const

const TOKENS_LIGHT = {
  '--color-bg': '#FAFAF7',
  '--color-surface': '#FFFFFF',
  '--color-elev': '#F4F6FB',
  '--color-text': '#141A26',
  '--color-muted': '#536179',
  '--color-primary': '#1B2B6B',
  '--color-on-primary': '#FFFFFF',
  '--color-accent': '#D4AF37',
  '--color-border': '#E6E8EF',
  '--color-success': '#0E9E6E',
  '--color-warning': '#B7791F',
  '--color-danger': '#E03131',
  '--ring': '0 0 0 4px rgba(27,43,107,.18)',
  '--shadow-1': '0 10px 24px rgba(10,14,30,.10)',
  '--shadow-2': '0 18px 40px rgba(10,14,30,.16)',
  '--radius': '12px',
  '--radius-lg': '16px',
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
    borderRadius: 'var(--radius)',
    padding: '14px 18px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid var(--color-border)',
    transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease, opacity .12s ease',
    fontSize: 14,
    lineHeight: '20px',
    minHeight: 46,
    willChange: 'transform',
  }

  const styles: Record<'primary' | 'secondary' | 'ghost', React.CSSProperties> = {
    primary: { ...base, background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderColor: 'transparent' },
    secondary: { ...base, background: 'var(--color-surface)', color: 'var(--color-text)' },
    ghost: { ...base, background: 'transparent', color: 'var(--color-text)', opacity: .9 },
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
    borderRadius: 'var(--radius)',
    padding: '14px 18px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    fontWeight: 700,
    fontSize: 14,
    lineHeight: '20px',
    minHeight: 46,
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
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)
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
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <p style={{ margin: 0, fontSize: 14 }}>
        {isFR ? (
          <>Nous utilisons des cookies essentiels (sécurité, paiement) et de mesure d’audience. Voir{' '}
            <a href="/fr/legal/cookies" style={{ color: 'var(--color-text)' }}>Politique des cookies</a>.</>
        ) : (
          <>We use essential (security, payment) and analytics cookies. See{' '}
            <a href="/fr/legal/cookies" style={{ color: 'var(--color-text)' }}>Cookie Policy</a>.</>
        )}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => accept('reject')}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)' }}
        >
          {isFR ? 'Refuser (hors essentiels)' : 'Reject (except essentials)'}
        </button>
        <button
          onClick={() => accept('accept')}
          style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontWeight: 800 }}
        >
          {isFR ? 'Accepter' : 'Accept'}
        </button>
        <Link href="/fr/legal/privacy" style={{ textDecoration: 'none', color: 'var(--color-text)', padding: '10px 12px' }}>
          {isFR ? 'Préférences' : 'Preferences'}
        </Link>
      </div>
    </div>
  )
}

type PillTone = 'default' | 'success' | 'warning' | 'danger'
function Pill({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: PillTone
}) {
  const tones: Record<PillTone, React.CSSProperties> = {
    default: { borderColor: 'var(--color-border)' },
    success: { borderColor: 'color-mix(in srgb, var(--color-success) 50%, var(--color-border))', color: 'var(--color-success)' },
    warning: { borderColor: 'color-mix(in srgb, var(--color-warning) 55%, var(--color-border))', color: 'var(--color-warning)' },
    danger:  { borderColor: 'color-mix(in srgb, var(--color-danger) 55%, var(--color-border))',  color: 'var(--color-danger)' },
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        fontSize: 12,
        borderRadius: 999,
        border: '1px solid',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        ...tones[tone],
      }}
    >
      {children}
    </span>
  )
}

/* ======================= HEADER ======================= */
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
          <Link href={href('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--color-text)' }}>
            <img src="/logo.svg" alt="Parcels of Time" width={28} height={28} />
            <strong style={{ fontFamily: 'Fraunces, serif' }}>Parcels of Time</strong>
          </Link>

          {!isSmall && (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
              <NavPill href={href('/explore')} emphasis="accent" ariaLabel={t('nav.public_registry')}>
                🖼️ <span>{t('nav.public_registry')}</span>
              </NavPill>
              <NavPill href={href('/account')} emphasis="outline" ariaLabel={t('nav.account')}>
                👤 <span>{t('nav.account')}</span>
              </NavPill>
              <Button href={href('/gift/recover')} variant="secondary" ariaLabel={t('nav.recover')}>
                🎫 {t('nav.recover')}
              </Button>
              <Button href={href('/claim?gift=1')} variant="secondary" ariaLabel={t('cta.gift')}>
                🎁 {t('cta.gift')}
              </Button>
              <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>
                {t('cta.claim')}
              </Button>

              <button
                aria-label={t('nav.theme')}
                onClick={onToggleTheme}
                style={{
                  height: 46,
                  padding: '0 14px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                ☀︎/☾
              </button>
            </div>
          )}

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
            <NavPill href={href('/explore')} emphasis="accent" ariaLabel={t('nav.public_registry')}>
              🖼️ {t('nav.public_registry')}
            </NavPill>
            <NavPill href={href('/account')} emphasis="outline" ariaLabel={t('nav.account')}>
              👤 {t('nav.account')}
            </NavPill>
            <Button href={href('/gift/recover')} variant="secondary">
              🎫 {t('nav.recover')}
            </Button>
            <Button href={href('/claim?gift=1')} variant="secondary">
              🎁 {t('cta.gift')}
            </Button>
            <button
              onClick={onToggleTheme}
              style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textAlign: 'left' }}
            >
              ☀︎/☾ {t('nav.theme')}
            </button>
          </Container>
        </div>
      )}
    </header>
  )
}

/* =========================================================
   CERTIFICATE PREVIEW
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
    <a href={href} aria-label={`Choose style ${styleId}`} style={{ textDecoration: 'none', color: 'var(--color-text)', display: 'block' }}>
      <figure
        style={{
          margin: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        <div style={{ position: 'relative', width: '100%', aspectRatio: compact ? '3 / 4' : '595 / 842', background: '#F4F1EC' }}>
          <img
            src={`/cert_bg/${styleId}.png`}
            alt={`Certificate style ${styleId}`}
            width={595}
            height={842}
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
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
              Certificate ID • Integrity hash (preview)
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
            Non-contractual preview — final PDF includes a scannable QR and the integrity fingerprint.
          </figcaption>
        )}
      </figure>
    </a>
  )
}

/* =========================================================
   HERO
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

          <div style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)' }}>{t('hero.unique')}</div>

          {/* TRUST BAR */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 16, fontSize: 12, color: 'var(--color-muted)' }}>
            <span>🔒 {t('trust.stripe')}</span>
            <span>🧾 {t('trust.sha')}</span>
          </div>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <HeroSlideshow
            interval={2000}
            slides={[
              { src: '/hero/love.png', alt: 'Love — couple at sunset', focal: 'center 40%' },
              { src: '/hero/birth.png', alt: 'Birth — soft light' },
              { src: '/hero/birthday.png', alt: 'Birthday — candles & confetti' },
              { src: '/hero/graduation.png', alt: 'Graduation — tossing caps' },
            ]}
          />
        </div>
      </Container>
    </section>
  )
}

/* -------------------- Carrousel 1 — Émotions & souvenirs -------------------- */
function EmotionalThemesCarousel() {
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)

  type Item = {
    icon: string
    titleFR: string
    titleEN: string
    textFR: string
    textEN: string
    badgeFR: string
    badgeEN: string
    tone: 'success'|'warning'|'danger'
  }

  const items: Item[] = [
   
    {
      icon: '🎂',
      titleFR: 'Anniversaires',
      titleEN: 'Birthdays',
      textFR: 'Célébrez leur histoire avec leur date de naissance, personnalisée par vos soins.',
      textEN: 'Celebrate their story with their birth date, personalized by you.',
      badgeFR: 'Chaleur', badgeEN: 'Warmth', tone: 'warning',
    },
    {
      icon: '🏆',
      titleFR: 'Réussites & tournants',
      titleEN: 'Milestones & turning points',
      textFR: 'Diplôme, premier contrat, première vente, ces journées qui change une vie.',
      textEN: 'Graduation, first job, first sale, that day that shifts a life.',
      badgeFR: 'Inoubliable', badgeEN: 'Unforgettable', tone: 'success',
    },
    {
      icon: '🧭',
      titleFR: 'Voyages & retrouvailles',
      titleEN: 'Journeys & reunions',
      textFR: 'Gravez pour toujours l’émotion de cet instant.',
      textEN: 'Capture the emotion of this moment forever.',
      badgeFR: 'Souvenir', badgeEN: 'Memory', tone: 'warning',
    },
    {
      icon: '🎁',
      titleFR: 'À offrir',
      titleEN: 'To gift',
      textFR: 'Plus qu’un cadeau : une émotion.',
      textEN: 'More than a gift: an emotion.',
      badgeFR: 'Coup de cœur', badgeEN: 'Heartfelt', tone: 'success',
    },

    {
      icon: '💛',
      titleFR: 'Amour & famille',
      titleEN: 'Love & family',
      textFR: 'Rencontre, fiançailles, mariage, naissance, premier mot… ces instants qui nous fondent.',
      textEN: 'First date, engagement, wedding, birth, first word… the moments that make us.',
      badgeFR: 'Émotion', badgeEN: 'Emotion', tone: 'success',
    },
  ]

  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(v => (v+1)%items.length), 3400); return () => clearInterval(t) }, [])
  const it = items[i]
  const toneToColor: Record<'success'|'warning'|'danger', string> = ({
    success: 'var(--color-success)', warning: 'var(--color-warning)', danger: 'var(--color-danger)'
  })

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={isFR ? 'Émotions & souvenirs' : 'Emotions & memories'}
      style={{
        border:'1px solid var(--color-border)',
        background:'var(--color-surface)',
        borderRadius:'var(--radius-lg)',
        padding:16,
        boxShadow:'var(--shadow-1)',
        height:'100%',
      }}
    >
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
          <span aria-hidden style={{fontSize:22}}>{it.icon}</span>
          <strong style={{fontSize:18, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden'}}>
            {isFR ? it.titleFR : it.titleEN}
          </strong>
        </div>
        <Pill tone={it.tone}>{isFR ? it.badgeFR : it.badgeEN}</Pill>
      </div>

      <p style={{margin:'8px 0 10px', color:'var(--color-text)', opacity:.9}}>
        {isFR ? it.textFR : it.textEN}
      </p>

      {/* Indicateurs centrés pour alléger la ligne et rester parfaitement aligné avec la variante du dessous */}
      <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:4, marginBottom:4 }}>
        {items.map((_, idx)=>(
          <span key={idx}
                aria-label={idx===i ? (isFR?'élément actif':'active item') : (isFR?'élément':'item')}
                style={{width:6, height:6, borderRadius:99, background: idx===i ? toneToColor[it.tone] : 'var(--color-border)'}} />
        ))}
      </div>

      <div style={{marginTop:8, fontSize:11, color:'var(--color-muted)', textAlign:'center'}}>
        {isFR ? 'Inspirez-vous. Chaque date n’est vendue qu’une fois.' : 'Get inspired. Each date is sold only once.'}
      </div>
    </div>
  )
}

/* -------------------- Carrousel 2 — Collection & Histoire -------------------- */
function CollectorThemesCarousel() {
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)

  type Item = {
    icon: string
    titleFR: string
    titleEN: string
    textFR: string
    textEN: string
    badgeFR: string
    badgeEN: string
    tone: 'success'|'warning'|'danger'
  }

  const items: Item[] = [
    {
      icon: '🚀',
      titleFR: 'Exploration spatiale',
      titleEN: 'Space exploration',
      textFR: 'Découvertes, alunissages, rovers, ces instants qui élargissent notre horizon.',
      textEN: 'Discoveries, moon landings, rovers—moments that broaden our horizons',
      badgeFR: 'Iconique', badgeEN: 'Iconic', tone: 'success',
    },
    {
      icon: '🏆',
      titleFR: 'Grandes finales',
      titleEN: 'Great finals',
      textFR: 'Coupe du monde, JO, ces moments gravés dans la mémoire collective.',
      textEN: 'World cups, Olympics — moments etched in collective memory.',
      badgeFR: 'Très convoité', badgeEN: 'Highly coveted', tone: 'warning',
    },
    {
      icon: '🏛️',
      titleFR: 'Basculements d’époque',
      titleEN: 'Epochal shifts',
      textFR: 'Pages qui se tournent : frontières, innovations, sociétés qui changent.',
      textEN: 'Pages turning: borders, breakthroughs, societies shifting.',
      badgeFR: 'Historique', badgeEN: 'Historic', tone: 'warning',
    },
    {
      icon: '🎨',
      titleFR: 'Icônes culturelles',
      titleEN: 'Cultural icons',
      textFR: 'Concerts, sorties majeures, annonces qui ont bousculé l’art et la tech.',
      textEN: 'Concerts, major releases, announcements that moved art & tech.',
      badgeFR: 'Collector', badgeEN: 'Collectible', tone: 'success',
    },
    {
      icon: '🧗',
      titleFR: 'Explorations & sommets',
      titleEN: 'Exploration & summits',
      textFR: 'Ascensions, traversées, premières — l’esprit d’aventure.',
      textEN: 'Ascents, crossings, firsts — the spirit of adventure.',
      badgeFR: 'Rare', badgeEN: 'Rare', tone: 'danger',
    },
  ]

  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(v => (v+1)%items.length), 3600); return () => clearInterval(t) }, [])
  const it = items[i]
  const toneToColor: Record<'success'|'warning'|'danger', string> = ({
    success: 'var(--color-success)', warning: 'var(--color-warning)', danger: 'var(--color-danger)'
  })

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={isFR ? 'Thèmes pour collectionneurs' : 'Collector themes'}
      style={{
        border:'1px solid var(--color-border)',
        background:'var(--color-surface)',
        borderRadius:'var(--radius-lg)',
        padding:16,
        boxShadow:'var(--shadow-1)',
        height:'100%',
      }}
    >
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
          <span aria-hidden style={{fontSize:22}}>{it.icon}</span>
          <strong style={{fontSize:18, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden'}}>
            {isFR ? it.titleFR : it.titleEN}
          </strong>
        </div>
        <Pill tone={it.tone}>{isFR ? it.badgeFR : it.badgeEN}</Pill>
      </div>

      <p style={{margin:'8px 0 10px', color:'var(--color-text)', opacity:.9}}>
        {isFR ? it.textFR : it.textEN}
      </p>

      {/* Indicateurs centrés pour cohérence visuelle avec le carrousel du dessus */}
      <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:4, marginBottom:4 }}>
        {items.map((_, idx)=>(
          <span key={idx}
                aria-label={idx===i ? (isFR?'élément actif':'active item') : (isFR?'élément':'item')}
                style={{width:6, height:6, borderRadius:99, background: idx===i ? toneToColor[it.tone] : 'var(--color-border)'}} />
        ))}
      </div>

      <div style={{marginTop:8, fontSize:11, color:'var(--color-muted)', textAlign:'center'}}>
        {isFR ? 'Idées pour passionnés et collectionneurs. Une seule vente par date.' : 'Inspiration for enthusiasts & collectors. One sale per date.'}
      </div>
    </div>
  )
}

/* =========================================================
   FEATURE BAND — 2 carrousels alignés + 4 bullets (sans boutons)
   ========================================================= */
function FeatureBand() {
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const onResize = () => setIsNarrow(typeof window !== 'undefined' && window.innerWidth < 980)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const bulletsTop = (isFR
    ? [
        { icon: '🔒', title: 'Authentique', text: 'Empreinte d’intégrité (SHA-256) + QR code scannable menant à votre page souvenir.' },
        { icon: '🎁', title: 'Cadeau idéal', text: 'Original, personnalisable, instantané.' },
      ]
    : [
        { icon: '🔒', title: 'Authentic', text: 'Integrity fingerprint (SHA-256) + scannable QR to your memory page.' },
        { icon: '🎁', title: 'Perfect gift', text: 'Original, customizable, near-instant delivery.' },
      ]) as Array<{ icon: string; title: string; text: string }>

  const bulletsBottom = (isFR
    ? [
        { icon: '✨', title: 'Unique', text: 'Chaque date est vendue une seule fois.' },
        { icon: '💎', title: 'Collector', text: 'Objet rare, revendable sur notre marketplace (Stripe Connect).' },
      ]
    : [
        { icon: '✨', title: 'One-of-a-kind', text: 'Each date is sold only once.' },
        { icon: '💎', title: 'Collectible', text: 'A rare object you can resell on our marketplace (Stripe Connect).' },
      ]) as Array<{ icon: string; title: string; text: string }>

  const BulletCard = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        minHeight: 112,
        boxShadow: 'var(--shadow-1)',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span aria-hidden style={{ fontSize: 18 }}>{icon}</span>
        <strong style={{ lineHeight: 1.2 }}>{title}</strong>
      </div>
      <div style={{ opacity: 0.92 }}>{text}</div>
    </div>
  )

  const leftSpan = isNarrow ? 'span 12' : 'span 7'
  const rightSpan = isNarrow ? 'span 12' : 'span 5'

  return (
    <section>
      <Container style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16, alignItems: 'stretch' }}>
        {/* Eyebrow sur toute la largeur */}
        <div style={{ gridColumn: '1 / -1' }}>
          <SectionEyebrow>{isFR ? 'Dates convoitées' : 'Sought-after dates'}</SectionEyebrow>
        </div>

        {/* Row 1 : Carrousel émotions + bullets Authentique / Cadeau */}
        <div style={{ gridColumn: leftSpan, gridRow: '2' }}>
          <EmotionalThemesCarousel />
        </div>
        <div style={{ gridColumn: rightSpan, gridRow: '2', display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 12 }}>
          <div style={{ gridColumn: 'span 6' }}>
            <BulletCard {...bulletsTop[0]} />
          </div>
          <div style={{ gridColumn: 'span 6' }}>
            <BulletCard {...bulletsTop[1]} />
          </div>
        </div>

        {/* Row 2 : Carrousel collectionneurs + bullets Unique / Collector */}
        <div style={{ gridColumn: leftSpan, gridRow: '3' }}>
          <CollectorThemesCarousel />
        </div>
        <div style={{ gridColumn: rightSpan, gridRow: '3', display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 12 }}>
          <div style={{ gridColumn: 'span 6' }}>
            <BulletCard {...bulletsBottom[0]} />
          </div>
          <div style={{ gridColumn: 'span 6' }}>
            <BulletCard {...bulletsBottom[1]} />
          </div>
        </div>
      </Container>
    </section>
  )
}



/* =========================================================
   REGISTRE PUBLIC
   ========================================================= */
function RegistryShowcase() {
  const href = useLocaleHref()
  const { t } = useT()
  const items: Array<{ styleId: PreviewStyle; ts: string; owner: string; title?: string }> = [
    { styleId: 'romantic', ts: '2018-07-19', owner: 'Clara & Sam', title: 'Premier baiser' },
    { styleId: 'birth', ts: '2023-03-02', owner: 'Nora & Mehdi', title: 'Bienvenue, Aïcha' },
    { styleId: 'wedding', ts: '2024-07-20', owner: 'Inès & Hugo', title: 'Nos deux “oui”' },
    { styleId: 'neutral', ts: '2011-11-11', owner: 'Anonyme', title: '11:11' },
  ]

  return (
    <section id="registry" aria-labelledby="registry-title" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <Container>
        <SectionEyebrow>{t('registry.eyebrow')}</SectionEyebrow>
        <H2 id="registry-title">{t('registry.title')}</H2>
        <p style={{ margin: '6px 0 16px', color: 'var(--color-text)', opacity: 0.92, maxWidth: 760 }}>
          {t('registry.paragraph')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          {items.map((it, i) => (
            <div key={i} style={{ gridColumn: 'span 3' }}>
              <CertificatePreview styleId={it.styleId} owner={it.owner} ts={it.ts} title={it.title} href={href('/explore')} compact />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems:'center', flexWrap:'wrap' }}>
          <Button href={href('/explore')} variant="secondary" ariaLabel={t('registry.cta')}>
            {t('registry.cta')} →
          </Button>
          <Pill tone="success">{t('registry.moderation')}</Pill>
          <Pill>{t('registry.visibility')}</Pill>
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
  const { t } = useT()
  return (
    <section>
      <Container>
        <SectionEyebrow>{t('receive.eyebrow')}</SectionEyebrow>
        <H2>{t('receive.title')}</H2>

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
            borderRadius: 'var(--radius-lg)',
            padding: 16,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: '28px' }}>
            <li>{t('receive.list1')}</li>
            <li>{t('receive.list2')}</li>
            <li>{t('receive.list3')}</li>
          </ul>
          <div style={{ marginTop: 10, fontSize: 14, color: 'var(--color-muted)' }}>
            {t('receive.note')}
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
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)
  const eyebrow = isFR ? 'Comment ça marche' : 'How it works'
  const steps = isFR
    ? [
        ['①', 'Choisissez date & heure', ''],
        ['②', 'Personnalisez', 'Propriétaire, message, style, photo.'],
        ['③', 'Réservez & recevez', 'Certificat + QR immédiatement. ⏱ < 2 min.'],
      ]
    : [
        ['①', 'Choose date & time', ''],
        ['②', 'Personalize', 'Owner, message, style, photo.'],
        ['③', 'Reserve & receive', 'Certificate + QR instantly. ⏱ < 2 min.'],
      ]
  return (
    <section>
      <Container>
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          {steps.map(([n, t, d], i) => (
            <div key={i} style={{ gridColumn: 'span 4', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
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
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)
  const eyebrow = isFR ? 'Témoignages' : 'Testimonials'
  const items = isFR
    ? [
        { q: '“Nous avons revendiqué la journée de la naissance d’Aïcha… frissons à chaque fois !”', a: 'Camille' },
        { q: '“Mon cadeau préféré : la journée de notre rencontre.”', a: 'Thomas' },
        { q: '“La journée du diplôme de ma sœur. Simple, mémorable, classe.”', a: 'Mina' },
      ]
    : [
        { q: '“We claimed the day our daughter Aïcha was born… chills every time!”', a: 'Camille' },
        { q: '“My favorite gift: the day of our first date.”', a: 'Thomas' },
        { q: '“My sister’s graduation day. Simple, memorable, classy.”', a: 'Mina' },
      ]
  return (
    <section>
      <Container>
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
          {items.map((t, i) => (
            <blockquote key={i} style={{ gridColumn: 'span 4', margin: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
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
        <SectionEyebrow>{isFR ? 'FAQ' : 'FAQ'}</SectionEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 12 }}>
          {rows.map((r, i) => (
            <details key={i} style={{ gridColumn: 'span 6', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14 }}>
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
  const { t } = useT()
  const href = useLocaleHref()
  return (
    <section
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'linear-gradient(0deg, color-mix(in srgb, var(--color-elev) 85%, transparent), transparent)',
      }}
    >
      <Container style={{ textAlign: 'center' }}>
        <H2>{t('final.title')}</H2>
        <p style={{ margin: '0 0 16px' }}>{t('final.subtitle')}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button href={href('/claim')} variant="primary">
            {t('cta.claim')}
          </Button>
          <Button href={href('/claim?gift=1')} variant="secondary">
            🎁 {t('cta.gift')}
          </Button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
          {t('final.badge')}
        </div>
      </Container>
    </section>
  )
}

/* =========================================================
   BARRE FLOTTANTE (CTA persistant) — avec offset automatique
   ========================================================= */
function FloatingCTA() {
  const href = useLocaleHref()
  const { t } = useT()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Affiche après scroll ; met à jour l’offset dynamique pour libérer le bas de page
  useEffect(() => {
    const onScroll = () => setVisible(!dismissed && window.scrollY > 420)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [dismissed])

  useEffect(() => {
    const setOffset = () => {
      const h = ref.current?.offsetHeight ?? 0
      document.documentElement.style.setProperty('--floating-cta-offset', visible ? `${h + 12}px` : '0px')
    }
    setOffset()
    window.addEventListener('resize', setOffset)
    return () => window.removeEventListener('resize', setOffset)
  }, [visible])

  if (!visible) return null
  return (
    <div
      ref={ref}
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 40,
        background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 10,
        boxShadow: 'var(--shadow-2)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span>⏳</span>
        <strong>{t('floating.title')}</strong>
        <span style={{ color:'var(--color-muted)' }}>{t('floating.caption')}</span>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <Button href={href('/explore')} variant="ghost">{t('floating.explore')}</Button>
        <Button href={href('/claim')} variant="primary">{t('floating.reserve')}</Button>
        <button
          aria-label="Close"
          onClick={() => { setDismissed(true); document.documentElement.style.setProperty('--floating-cta-offset','0px') }}
          style={{ marginLeft: 6, border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color:'var(--color-text)', padding:'6px 8px', cursor:'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/* =========================================================
   FOOTER
   ========================================================= */
function Footer() {
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)
  return (
    <footer style={{ borderTop: '1px solid var(--color-border)' }}>
      <Container style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="" width={20} height={20} />
            <span style={{ fontWeight: 700 }}>Parcels of Time</span>
            <span style={{ color: 'var(--color-muted)' }}>© {new Date().getFullYear()}</span>
          </div>

          <nav aria-label="Footer" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-muted)' }}>{isFR ? 'Légal:' : 'Legal:'}</span>
            <Link href="/fr/legal/legal-notice" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'Mentions légales' : 'Legal notice'}
            </Link>
            <Link href="/fr/legal/terms" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'CGU/CGV' : 'Terms & Conditions'}
            </Link>
            <Link href="/fr/legal/seller" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'Conditions Vendeur' : 'Seller Terms'}
            </Link>
            <Link href="/fr/legal/refund" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'Remboursement' : 'Refunds'}
            </Link>
            <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>•</span>
            <Link href="/fr/legal/privacy" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'Confidentialité' : 'Privacy'}
            </Link>
            <Link href="/fr/legal/cookies" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'Cookies' : 'Cookies'}
            </Link>
            <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>•</span>
            <Link href="/fr/company" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'À propos' : 'About'}
            </Link>
            <Link href="/fr/support" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
              {isFR ? 'Règles du registre' : 'Registry rules'}
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
          'Transform a meaningful date into a unique, verifiable keepsake. High-definition digital certificate (PDF/JPG) with QR and integrity hash — an original, fully customizable gift.',
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          url: 'https://parcelsoftime.com/claim',
          priceCurrency: 'EUR',
          price: '29.00',
        },
      },
      {
        '@type': 'CreativeWork',
        name: 'Day Certificate',
        creator: { '@type': 'Organization', name: 'Parcels of Time' },
        about: 'A participatory art piece turning dates into unique, verifiable, and shareable keepsakes — perfect as an original and customizable gift.',
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
    <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)', paddingBottom: 'calc(var(--floating-cta-offset, 0px) + env(safe-area-inset-bottom))' }}>
      <CookieBanner />
      <Header onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} href={href} />

      {/* Barre flottante persistante (avec offset pour ne pas masquer le footer) */}
      <FloatingCTA />

      {/* 1. Hero */}
      <Hero href={href} />

      {/* 2. Bande valeur / Pourquoi (avec carrousel des dates convoitées) */}
      <FeatureBand />

      {/* 3. Démos / Ce que vous recevez */}
      <ReceiveShowcase />

      {/* 4. Registre public */}
      <RegistryShowcase />

      {/* 5. Process + Témoignages + FAQ */}
      <HowItWorks />
      <Testimonials />
      <FAQ />

      {/* 6. CTA final + Footer */}
      <FinalCTA />
      <Footer />

      <JsonLd />
    </main>
  )
}
