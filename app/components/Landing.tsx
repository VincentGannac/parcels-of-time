// app/components/Landing.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
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
   CERTIFICATE PREVIEW — v2 (aligné sur ClientClaim/cert.ts)
   ========================================================= */


  const SAFE_INSETS_PCT: Record<PreviewStyle, { top: number; right: number; bottom: number; left: number }> = {
    neutral: { top: 120, right: 100, bottom: 130, left: 100 },
    romantic: { top: 120, right: 100, bottom: 130, left: 100  },
    birthday: { top: 120, right: 100, bottom: 130, left: 100  },
    birth: { top: 120, right: 100, bottom: 130, left: 100  },
    wedding: { top: 120, right: 100, bottom: 130, left: 100  },
    christmas: { top: 120, right: 100, bottom: 130, left: 100 },
    newyear: { top: 120, right: 100, bottom: 130, left: 100  },
    graduation: { top: 120, right: 100, bottom: 130, left: 100  },
  }


 // --- REPLACE the whole CertificatePreview implementation with this one ---

type PreviewStyle = 'romantic' | 'birth' | 'wedding' | 'birthday' | 'christmas' | 'newyear' | 'graduation' | 'neutral'

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
  ts: string               // "YYYY-MM-DD" ou ISO
  href: string
  compact?: boolean
}) {
  // --- Locale minimale (FR si navigateur fr-*)
  const isFR = (() => {
    try { return (navigator.language || '').toLowerCase().startsWith('fr') } catch { return false }
  })()
  const L = {
    brand: 'Parcels of Time',
    title: isFR ? 'Certificat d’acquisition' : 'Certificate of Claim',
    ownedBy: isFR ? 'Au nom de' : 'Owned by',
    giftedBy: isFR ? 'Offert par' : 'Gifted by',
    titleLabel: isFR ? 'Titre' : 'Title',
    message: isFR ? 'Message' : 'Message',
    attestationLabel: isFR ? 'Texte d’attestation' : 'Attestation text',
    anon: isFR ? 'Anonyme' : 'Anonymous',
    certId: isFR ? 'ID du certificat' : 'Certificate ID',
    integrity: isFR ? 'Intégrité (SHA-256)' : 'Integrity (SHA-256)',
  }

  // ---------- Constantes A4 & layout (miroir ClientClaim/PDF) ----------
  const A4_W_PT = 595.28, A4_H_PT = 841.89
  const EDGE_PT = 16, QR_SIZE_PT = 120, META_H_PT = 76
  const PT_PER_CM = 28.3465 
  const SHIFT_UP_PT = Math.round(2 * PT_PER_CM)         // ↑ 2 cm
  const MIN_GAP_HEADER_PT = 28                          // écart mini sous-titre → date
  const TEXT_MAIN_HEX = '#1A1F2A'
  const CERT_BG_HEX = '#F4F1EC'

  type Insets = { top: number; right: number; bottom: number; left: number }
  function getSafeArea(_style: PreviewStyle): Insets {
    // mêmes insets que le PDF pour tous les styles
    return { top: 120, right: 100, bottom: 130, left: 100 }
  }

  // ---------- Utils ----------
  function ymdUTC(d: Date) {
    const c = new Date(d.getTime()); c.setUTCHours(0, 0, 0, 0)
    return c.toISOString().slice(0, 10) // ⚠️ pas de "UTC" affiché
  }
  function parseToDateOrNull(input: string): Date | null {
    const s = (input || '').trim(); if (!s) return null
    const d = new Date(s); if (isNaN(d.getTime())) return null
    d.setUTCHours(0,0,0,0); return d
  }
  function hexToRgb(hex:string){
    const m = /^#?([0-9a-f]{6})$/i.exec(hex); if(!m) return {r:26,g:31,b:42}
    const n = parseInt(m[1],16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 }
  }
  function mix(a:number,b:number,t:number){ return Math.round(a*(1-t)+b*t) }
  function lightenTowardWhite(hex:string, t=0.45){
    const {r,g,b} = hexToRgb(hex); return `rgba(${mix(r,255,t)}, ${mix(g,255,t)}, ${mix(b,255,t)}, 0.9)`
  }
  function isAttestationParagraph(p: string){
    const s = (p||'').trim().toLowerCase()
    return s.startsWith('ce certificat atteste que') || s.startsWith('this certificate attests that')
  }

  // Measurer (points → pixels via scale)
  function makeMeasurer(scale:number){
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const setFont = (sizePt:number, bold=false) => {
      const px = sizePt * scale
      ctx.font = `${bold ? '700 ' : ''}${px}px Helvetica, Arial, sans-serif`
    }
    const widthPx = (text:string) => ctx.measureText(text).width
    const wrap = (text:string, sizePt:number, maxWidthPt:number, bold=false) => {
      const words = (String(text) || '').trim().split(/\s+/).filter(Boolean)
      const lines:string[] = []
      let line = ''
      setFont(sizePt, bold)
      const maxPx = maxWidthPt * scale
      for (const w of words) {
        const test = line ? (line + ' ' + w) : w
        if (widthPx(test) <= maxPx) line = test
        else { if (line) lines.push(line); line = w }
      }
      if (line) lines.push(line)
      return lines
    }
    return { wrap }
  }

  // ---------- Data d’entrée ----------
  const parsed = parseToDateOrNull(ts)
  const mainDate = parsed ? ymdUTC(parsed) : ts
  const displayName = (owner || '').trim() || L.anon
  const mainColor = TEXT_MAIN_HEX
  const subtleColor = lightenTowardWhite(mainColor, 0.45)
  const SA = getSafeArea(styleId)

  // ---------- Mesure & échelle ----------
  const wrapRef = useRef<HTMLDivElement|null>(null)
  const [scale, setScale] = useState(1) // px per pt
  useLayoutEffect(()=>{
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(()=>{
      const w = el.clientWidth
      const s = w / A4_W_PT
      setScale(s || 1)
    })
    ro.observe(el)
    return ()=>ro.disconnect()
  }, [])

  // ---------- Métriques (identiques PDF) ----------
  const brandSize = 18, subSize = 12
  const tsSize = 26, labelSize = 11, nameSize = 15, msgSize = 12.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16

  // Header (positions de base en points)
  const TOP_Y = A4_H_PT - SA.top
  let yHeader = TOP_Y - 40
  const yBrand = yHeader; yHeader -= 18
  const yCert  = yHeader

  // Contenu (réservations bas)
  const footerH = Math.max(QR_SIZE_PT, META_H_PT)
  const contentTopMaxNatural = yHeader - 38 + SHIFT_UP_PT
  const contentBottomMin     = SA.bottom + footerH + 8
  const availH               = contentTopMaxNatural - contentBottomMin

  const meas = useMemo(()=>makeMeasurer(scale), [scale])

  // ---------- Parsing message (exact comme PDF) ----------
  let giftedName = ''
  let forceHideOwned = false
  let userMessage = ''
  let attestationText = ''

  {
    let raw = (message || '').trim()
    if (raw) {
      const paras = raw.split(/\r?\n/).map(l => l.trim())
      const kept: string[] = []
      for (const p of paras) {
        if (!p) continue
        if (/^\[\[\s*HIDE_OWNED_BY\s*\]\]$/i.test(p)) { forceHideOwned = true; continue }
        const mg = /^(offert\s*par|gifted\s*by)\s*:\s*(.+)$/i.exec(p)
        if (mg) { giftedName = mg[2].trim(); continue }
        kept.push(p)
      }
      const finalParas: string[] = []
      for (const p of kept) {
        if (!attestationText && isAttestationParagraph(p)) attestationText = p
        else finalParas.push(p)
      }
      userMessage = finalParas.join('\n').trim()
    }
  }

  // Wrap titre & textes
  const titleText = (title || '').trim()
  const titleLines = titleText ? meas.wrap(titleText, nameSize, (A4_W_PT - SA.left - SA.right), true).slice(0, 2) : []

  // Message → lignes (en respectant les paragraphes vides)
  const msgLinesAll: string[] = []
  if (userMessage) {
    const paras = userMessage.split(/\n+/)
    paras.forEach((p, i) => {
      const lines = meas.wrap(p, msgSize, (A4_W_PT - SA.left - SA.right), false)
      msgLinesAll.push(...lines)
      if (i < paras.length - 1) msgLinesAll.push('')
    })
  }
  const attestLinesAll = attestationText ? meas.wrap(attestationText, msgSize, (A4_W_PT - SA.left - SA.right), false) : []

  // Visibilité "Au nom de"
  const hasName = !forceHideOwned && !!displayName

  // Hauteurs de blocs (identiques PDF)
  const ownedBlockH  = hasName    ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0
  const giftedBlockH = giftedName ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0

  const fixedTop = (tsSize + 6) + ownedBlockH
  const spaceAfterOwned = availH - fixedTop

  const titleBlockNoGap = titleText ? ((labelSize + 2) + 6 + titleLines.length * (nameSize + 6)) : 0
  const gapBeforeTitle = giftedName ? 8 : gapSection

  const beforeMsgConsumed = giftedBlockH + (titleBlockNoGap ? (gapBeforeTitle + titleBlockNoGap) : 0)
  const afterTitleSpace = spaceAfterOwned - beforeMsgConsumed
  const TOTAL_TEXT_LINES = Math.max(0, Math.floor(afterTitleSpace / lineHMsg))

  const msgLines = msgLinesAll.slice(0, TOTAL_TEXT_LINES)
  const remainingForAttest = Math.max(0, TOTAL_TEXT_LINES - msgLines.length)
  const attestLines = attestLinesAll.slice(0, remainingForAttest)

  // Helpers: baseline→CSS top (px)
  const toTopPx = (baselineY:number, fontSizePt:number) => (A4_H_PT - baselineY) * scale - (fontSizePt * scale)
  const centerCss: React.CSSProperties = {
    position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', whiteSpace:'pre', color: mainColor
  }

  // ------ Anti-chevauchement sous-titre / date (identique PDF) ------
  const height = A4_H_PT
  const topOf = (baseline:number, fontPt:number) => (height - baseline) - fontPt
  const yDateNatural = contentTopMaxNatural - (tsSize + 6)
  const topCertPx   = toTopPx(yCert, subSize)
  const topDateNat  = toTopPx(yDateNatural, tsSize)
  const minDateTopPx = topCertPx + (MIN_GAP_HEADER_PT * scale)
  const contentOffsetPx = Math.max(0, minDateTopPx - topDateNat)

  // Calcul séquentiel des tops (miroir PDF)
  let y = contentTopMaxNatural
  // Date
  y -= (tsSize + 6)
  const topMainTime = toTopPx(y, tsSize) + contentOffsetPx

  // Owned by
  let ownedLabelTop: number | null = null
  let ownedNameTop: number | null = null
  if (hasName) {
    y -= gapSection
    ownedLabelTop = toTopPx(y - (labelSize + 2), labelSize) + contentOffsetPx
    y -= (labelSize + 2 + gapSmall)
    ownedNameTop  = toTopPx(y - (nameSize + 4) + 4, nameSize) + contentOffsetPx
    y -= (nameSize + 4)
  }

  // Gifted by
  let giftedLabelTop: number | null = null
  let giftedNameTop: number | null = null
  if (giftedName) {
    y -= gapSection
    giftedLabelTop = toTopPx(y - (labelSize + 2), labelSize) + contentOffsetPx
    y -= (labelSize + 2 + gapSmall)
    giftedNameTop  = toTopPx(y - (nameSize + 4) + 4, nameSize) + contentOffsetPx
    y -= (nameSize + 4)
  }

  // Title — pas de gapSection supplémentaire (exact PDF)
  let titleLabelTop: number | null = null
  const titleLineTops: number[] = []
  if (titleText) {
    y -= (nameSize + 4)
    y -= gapBeforeTitle
    titleLabelTop = toTopPx(y - (labelSize + 2), labelSize) + contentOffsetPx
    y -= (labelSize + 6)
    for (const _ of titleLines) {
      titleLineTops.push(toTopPx(y - (nameSize + 2), nameSize) + contentOffsetPx)
      y -= (nameSize + 6)
    }
  }

  // Message
  let msgLabelTop: number | null = null
  const msgLineTops: number[] = []
  if (msgLines.length) {
    y -= gapSection
    msgLabelTop = toTopPx(y - (labelSize + 2), labelSize) + contentOffsetPx
    y -= (labelSize + 6)
    for (const line of msgLines) {
      msgLineTops.push(toTopPx(y - lineHMsg, msgSize) + contentOffsetPx)
      y -= lineHMsg
    }
  }

  // Attestation
  let attestLabelTop: number | null = null
  const attestLineTops: number[] = []
  if (attestLines.length) {
    y -= gapSection
    attestLabelTop = toTopPx(y - (labelSize + 2), labelSize) + contentOffsetPx
    y -= (labelSize + 6)
    for (const line of attestLines) {
      attestLineTops.push(toTopPx(y - lineHMsg, msgSize) + contentOffsetPx)
      y -= lineHMsg
    }
  }

  // Header tops (pas d’offset)
  const topBrand = toTopPx(yBrand, brandSize)
  const topCert  = toTopPx(yCert,  subSize)

  // ---------- Rendu ----------
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
        <div ref={wrapRef} style={{ position: 'relative', width: '100%', aspectRatio: compact ? '3 / 4' : `${A4_W_PT}/${A4_H_PT}`, background: '#0E1017' }}>
          <img
            src={`/cert_bg/${styleId}.png`}
            alt={`Certificate style ${styleId}`}
            width={595}
            height={842}
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', background: CERT_BG_HEX }}
          />

          {/* Header */}
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: topBrand, fontWeight:800, fontSize: 18*scale, color: TEXT_MAIN_HEX }}>{L.brand}</div>
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: topCert,  fontWeight:400, fontSize: 12*scale, color: lightenTowardWhite(TEXT_MAIN_HEX) }}>{L.title}</div>

          {/* Date (AAAA-MM-JJ — pas de “UTC”) */}
          <div style={{ ...centerCss, top: topMainTime, fontWeight:800, fontSize: tsSize*scale }}>
            {mainDate}
          </div>

          {/* Owned by */}
          {hasName && (
            <>
              <div style={{ ...centerCss, top: ownedLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                {L.ownedBy}
              </div>
              <div style={{ ...centerCss, top: ownedNameTop!, fontWeight:800, fontSize: 15*scale }}>
                {displayName}
              </div>
            </>
          )}

          {/* Gifted by — ✅ au bon endroit, comme le PDF */}
          {giftedName && (
            <>
              <div style={{ ...centerCss, top: giftedLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                {L.giftedBy}
              </div>
              <div style={{ ...centerCss, top: giftedNameTop!, fontWeight:800, fontSize: 15*scale }}>
                {giftedName}
              </div>
            </>
          )}

          {/* Title */}
          {titleText && (
            <>
              <div style={{ ...centerCss, top: titleLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                {L.titleLabel}
              </div>
              {titleLineTops.map((top, i)=>(
                <div key={i} style={{ ...centerCss, top, fontWeight:800, fontSize: 15*scale }}>
                  {titleLines[i]}
                </div>
              ))}
            </>
          )}

          {/* Message */}
          {msgLines.length>0 && (
            <>
              <div style={{ ...centerCss, top: msgLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                {L.message}
              </div>
              {msgLineTops.map((top, i)=>(
                <div key={i} style={{ ...centerCss, top, fontSize: 12.5*scale }}>
                  {msgLines[i] === '' ? ' ' : msgLines[i]}
                </div>
              ))}
            </>
          )}

          {/* Attestation */}
          {attestLines.length>0 && (
            <>
              <div style={{ ...centerCss, top: attestLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                {L.attestationLabel}
              </div>
              {attestLineTops.map((top, i)=>(
                <div key={i} style={{ ...centerCss, top, fontSize: 12.5*scale }}>
                  {attestLines[i] === '' ? ' ' : attestLines[i]}
                </div>
              ))}
            </>
          )}

          {/* Footer: méta (gauche) + QR (droite) — placeholders */}
          <div style={{position:'absolute', left: EDGE_PT*scale, bottom: EDGE_PT*scale, width: (A4_W_PT/2)*scale, height: META_H_PT*scale, color: subtleColor, fontSize: 11*scale, lineHeight: 1.2}}>
            <div style={{opacity:.9}}>{L.certId}</div>
            <div style={{marginTop:6, fontWeight:800, color: TEXT_MAIN_HEX, fontSize: 10.5*scale}}>••••••••••••••••••••••••••••••••••••••</div>
            <div style={{marginTop:8, opacity:.9}}>{L.integrity}</div>
            <div style={{marginTop:6, color: TEXT_MAIN_HEX, fontSize: 9.5*scale}}>••••••••••••••••••••••••••••••••••••••</div>
            <div style={{marginTop:4, color: TEXT_MAIN_HEX, fontSize: 9.5*scale}}>••••••••••••••••••••••••••••••••••••••</div>
          </div>

          <div
            style={{
              position:'absolute',
              right: EDGE_PT*scale,
              bottom: EDGE_PT*scale,
              width: QR_SIZE_PT*scale,
              height: QR_SIZE_PT*scale,
              border:'1px dashed rgba(26,31,42,.45)',
              borderRadius:8,
              display:'grid',
              placeItems:'center',
              fontSize: 12*scale,
              color: 'rgba(26,31,42,.85)',
              background:'rgba(255,255,255,.08)'
            }}
            aria-label="QR placeholder"
          >
            QR
          </div>
        </div>

        {!compact && (
          <figcaption style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-muted)' }}>
            {isFR
              ? 'Aperçu non contractuel — ces certificats sont des exemples. Le PDF final inclut un QR scannable et l’empreinte d’intégrité.'
              : 'Non-contractual preview — these certificates are examples. The final PDF includes a scannable QR and the integrity fingerprint.'}
          </figcaption>
        )}
      </figure>
    </a>
  )
}

  

/* =========================================================
   HERO — responsive sans impacter le desktop
   ========================================================= */
   function Hero({ href }: { href: (p: string) => string }) {
    const { t } = useT()
    const [isSmall, setIsSmall] = useState(false)
  
    useEffect(() => {
      const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
      onResize()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [])
  
    return (
      <section style={{ borderBottom: '1px solid var(--color-border)', background: 'radial-gradient(60% 40% at 70% -10%, rgba(140,214,255,.10), transparent 60%)' }}>
        <Container style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: isSmall ? 16 : 24, alignItems: 'center' }}>
          <div style={{ gridColumn: isSmall ? 'span 12' : 'span 6', color: 'var(--color-text)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <img src="/logo.svg" alt="" width={40} height={40} />
              <span style={{ fontFamily: 'Fraunces, serif', fontSize: 20 }}>Parcels of Time</span>
            </div>
            <h1
              style={{
                fontFamily: 'Fraunces, serif',
                fontSize: isSmall ? 34 : 52,              // mobile ↓ sans toucher le desktop
                lineHeight: isSmall ? '42px' : '60px',
                margin: '6px 0 10px',
              }}
            >
              {t('hero.h1')}
            </h1>
            <p style={{ fontSize: isSmall ? 16 : 18, lineHeight: isSmall ? '26px' : '28px', maxWidth: 560 }}>
              {t('hero.subtitle')}
            </p>
  
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
  
          <div style={{ gridColumn: isSmall ? 'span 12' : 'span 6' }}>
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
      textFR: 'Ce jour où une page s’est tournée, possédez la date qui a tout basculé.',
      textEN: 'The day the page turned, claim the date that changed everything.',
      badgeFR: 'Historique', badgeEN: 'Historic', tone: 'warning',
    },
    {
      icon: '🎨',
      titleFR: 'Icônes culturelles',
      titleEN: 'Cultural icons',
      textFR: 'Concerts, sorties majeures, gardez la trace du jour où une icône est née.',
      textEN: 'Concerts, major releases, keep the date when an icon was born',
      badgeFR: 'Collector', badgeEN: 'Collectible', tone: 'success',
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
   FEATURE BAND — mobile: 2 carrousels puis 4 bullets en 2x2
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
  
    /* ====== MOBILE LAYOUT (nouveau) ====== */
    if (isNarrow) {
      const bulletsAll = [...bulletsTop, ...bulletsBottom] // → 4 bullets
      return (
        <section>
          <Container style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <SectionEyebrow>{isFR ? 'Dates convoitées' : 'Sought-after dates'}</SectionEyebrow>
            </div>
  
            {/* 2 carrousels empilés */}
            <div style={{ gridColumn: 'span 12' }}>
              <EmotionalThemesCarousel />
            </div>
            <div style={{ gridColumn: 'span 12' }}>
              <CollectorThemesCarousel />
            </div>
  
            {/* 4 bullets en 2 colonnes (2x2) */}
            {bulletsAll.map((b, i) => (
              <div key={i} style={{ gridColumn: 'span 6' }}>
                <BulletCard {...b} />
              </div>
            ))}
          </Container>
        </section>
      )
    }
  
    /* ====== DESKTOP / TABLET LAYOUT (inchangé) ====== */
    const leftSpan = 'span 7'
    const rightSpan = 'span 5'
  
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
   REGISTRE PUBLIC — v2 (aléatoire + vrai visuel + CTA jaune)
   ========================================================= */

// Mini type local (aligné sur /api/registry)
type PublicRegistryRow = {
  ts: string
  owner: string
  title: string | null
  message: string | null
  style: string
}

function shuffle<T>(arr: T[]) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Vignette avec le *vrai* PDF embarqué */
function PublicCertThumb({
  ts,
  owner,
  title,
  href,
}: {
  ts: string
  owner: string
  title?: string | null
  href: string
}) {

  // Locale pour le libellé du badge
  const pathname = usePathname() || '/'
  const isFR = /^\/fr(\/|$)/.test(pathname)
  const badgeLabel = isFR ? 'Authentifié' : 'Authenticated'
  // Normalise AAAA-MM-JJ
  const day =
    /^\d{4}-\d{2}-\d{2}$/.test(ts)
      ? ts
      : (() => {
          try {
            return new Date(ts).toISOString().slice(0, 10)
          } catch {
            return String(ts).slice(0, 10)
          }
        })()

  const pdfSrc = `/api/cert/${encodeURIComponent(day)}?public=1&hide_meta=1#view=FitH&toolbar=0&navpanes=0&scrollbar=0`

  return (
    <a href={href} aria-label={`Voir le certificat du ${day}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <figure
        style={{
          margin: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-1)',
          transition: 'transform .25s ease, box-shadow .25s ease',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '595/842',
            background: '#0E1017',
            overflow: 'hidden',
          }}
        >
          <iframe
            src={pdfSrc}
            title="Certificate"
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: 'none', userSelect: 'none' }}
          />
          {/* voile + légende */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(100% 70% at 50% -10%, rgba(255,255,255,0) 40%, rgba(0,0,0,.22) 100%)',
              pointerEvents: 'none',
            }}
            />
          {/* Badge Authentifié — identique au registre public */}
          <div
            aria-label={badgeLabel}
            style={{
              position: 'absolute', left: 8, bottom: 8,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 8px', borderRadius: 999,
             background: 'rgba(14,170,80,.18)',
              border: '1px solid rgba(14,170,80,.45)',
              color: '#D9FBE3', fontSize: 12, fontWeight: 700,
              pointerEvents: 'none'
           }}
          >
            <span>{badgeLabel}</span><span aria-hidden>✓</span>
          </div>
        </div>
      </figure>
      <style>{`
        a:hover > figure { transform: translateY(-2px); box-shadow: 0 18px 40px rgba(0,0,0,.34) }
      `}</style>
    </a>
  )
}

/** Grosse variation jaune du CTA (beaucoup plus visible) */
function GoldCTA({ href, children, ariaLabel }: { href: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        textDecoration: 'none',
        fontWeight: 900,
        borderRadius: '18px',
        padding: '16px 22px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 15,
        lineHeight: '22px',
        minHeight: 52,
        color: '#0B0E14',
        background: 'linear-gradient(180deg, #FFD84D, #E5B53B)',
        boxShadow: '0 10px 28px rgba(229,181,59,.35), inset 0 0 0 1px rgba(0,0,0,.18)',
        border: '1px solid rgba(0,0,0,.25)',
        transition: 'transform .12s ease, box-shadow .12s ease',
      }}
      onMouseEnter={(e) => ((e.currentTarget as any).style.boxShadow = '0 12px 34px rgba(229,181,59,.45), inset 0 0 0 1px rgba(0,0,0,.2)')}
      onMouseLeave={(e) => ((e.currentTarget as any).style.boxShadow = '0 10px 28px rgba(229,181,59,.35), inset 0 0 0 1px rgba(0,0,0,.18)')}
      onMouseDown={(e) => ((e.currentTarget as any).style.transform = 'translateY(1px)')}
      onMouseUp={(e) => ((e.currentTarget as any).style.transform = 'translateY(0)')}
    >
      {children}
    </Link>
  )
}

/* =========================================================
   REGISTRE PUBLIC — responsive (grille 3 → 1 en mobile)
   ========================================================= */
   function RegistryShowcase() {
    const href = useLocaleHref()
    const { t } = useT()
    const [entries, setEntries] = useState<PublicRegistryRow[]>([])
    const [loading, setLoading] = useState(true)
    const [isSmall, setIsSmall] = useState(false)
  
    useEffect(() => {
      const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
      onResize()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [])
  
    useEffect(() => {
      let cancelled = false
      ;(async () => {
        try {
          const res = await fetch(`/api/registry?v=${Date.now()}`, { cache: 'no-store' })
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const data: PublicRegistryRow[] = (await res.json()) || []
          if (!cancelled) {
            const random3 = shuffle(data).slice(0, 3)
            setEntries(random3)
            setLoading(false)
          }
        } catch {
          if (!cancelled) setLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [])
  
    const fallback: PublicRegistryRow[] = [
      { ts: '2018-07-19', owner: 'Clara & Sam', title: 'Premier baiser', message: null, style: 'romantic' },
      { ts: '2023-03-02', owner: 'Nora & Mehdi', title: 'Bienvenue, Aïcha', message: null, style: 'birth' },
      { ts: '2024-07-20', owner: 'Inès & Hugo', title: 'Nos deux “oui”', message: null, style: 'wedding' },
    ]
  
    const list = entries.length ? entries : fallback
  
    return (
      <section id="registry" aria-labelledby="registry-title" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Container>
          <SectionEyebrow>{t('registry.eyebrow')}</SectionEyebrow>
          <H2 id="registry-title">{t('registry.title')}</H2>
          <p style={{ margin: '6px 0 16px', color: 'var(--color-text)', opacity: 0.92, maxWidth: 760 }}>
            {t('registry.paragraph')}
          </p>
  
          {/* 3 vignettes A4 réelles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
            {(loading ? Array.from({ length: 3 }) : list).map((it: any, i: number) => (
              <div key={i} style={{ gridColumn: isSmall ? 'span 12' : 'span 4' }}>
                {loading ? (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '595/842',
                      borderRadius: 'var(--radius-lg)',
                      background:
                        'linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.08), rgba(255,255,255,.04))',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.4s infinite',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                ) : (
                  <PublicCertThumb ts={it.ts} owner={it.owner} title={it.title} href={href('/explore')} />
                )}
              </div>
            ))}
          </div>
  
          {/* CTA + informations */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <GoldCTA href={href('/explore')} ariaLabel={t('registry.cta')}>
              {t('registry.cta')}
            </GoldCTA>
            <Pill tone="success">{t('registry.moderation')}</Pill>
            <Pill>{t('registry.visibility')}</Pill>
          </div>
        </Container>
  
        <style>{`
          @keyframes shimmer {
            0% { background-position: 0% 0%; }
            100% { background-position: -200% 0%; }
          }
        `}</style>
      </section>
    )
  }
  
/* =========================================================
   WHAT YOU RECEIVE — Démos (version émotion) — responsive
   ========================================================= */
   function ReceiveShowcase() {
    const href = useLocaleHref()
    const pathname = usePathname() || '/'
    const isFR = /^\/fr(\/|$)/.test(pathname)
    const [isSmall, setIsSmall] = useState(false)
  
    useEffect(() => {
      const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
      onResize()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [])
  
    // 🔁 wording synchronisé avec le PDF et le preview
    const giftLabel = isFR ? 'Offert par' : 'Gifted by'
  
    const copy = isFR
      ? {
          eyebrow: 'Ce que vous recevez',
          title: 'Gardez une journée qui compte',
          lead:
            'Un certificat HD (PDF/JPG) prêt à imprimer, unique ' +
            'Chaque date est vendue une seule fois.',
          note:
            'Chaque certificat inclut un QR scannable vers votre page souvenir et une empreinte d’intégrité (SHA-256).WXCV',
          cards: [
            {
              style: 'romantic' as PreviewStyle,
              owner: 'Sam',
              title: 'Notre pique-nique sous l’averse',
              ts: '2018-07-19',
              msg:
                `On s’est pris la pluie en plein pique-nique, et toi qui chantes faux juste pour me faire rire, comme pour qu’il pleuve encore plus. On était trempés, mais heureux.
    Ce moment n’a rien d’exceptionnel, et c’est sûrement pour ça qu’il ne me lâche pas.
    Le 19/07/2018 est devenu notre point de départ. Je te l’offre pour que, les jours de doute, on se rappelle qu’on sait déjà traverser les averses.
    
    ${giftLabel} : Eva`,
              cta: '/claim?style=romantic',
            },
            {
              style: 'birth' as PreviewStyle,
              owner: 'Zoé',
              title: 'Bienvenue, Zoé',
              ts: '2023-03-02',
              msg:
                `Un cri minuscule. Ce 2 mars 2023, tu es arrivée, et nous sommes devenus trois.
    J’acquiers symboliquement ce jour pour qu’il nous appartienne toujours.
    
    ${giftLabel} : Maman & Papa`,
              cta: '/claim?style=birth',
            },
            {
              style: 'birthday' as PreviewStyle,
              owner: 'Mathieu',
              title: '18 ans',
              ts: '2025-09-15',
              msg:
                `Bon anniversaire mon fils, déjà 18 ans. Tu parles d’études, de musique, d’ailleurs…
    Rien n’est décidé mais tout est possible.
    Je réserve symboliquement cette date pour qu’elle te rappelle que la première marche, tu l’as déjà montée,
    et que je crois en la suite.
    
    ${giftLabel} : Maman`,
              cta: '/claim?style=birthday',
            },
          ] as Array<{ style: PreviewStyle; owner: string; title: string; ts: string; msg: string; cta: string }>,
        }
      : {
          eyebrow: 'What you receive',
          title: 'Keep a day that matters',
          lead:
            'A print-ready, HD certificate (PDF/JPG) — unique, verifiable, and in your name. ' +
            'Each date is sold only once.',
          note:
            'Every certificate includes a scannable QR to your memory page and an integrity fingerprint (SHA-256).',
          cards: [
            {
              style: 'romantic' as PreviewStyle,
              owner: 'Sam',
              title: 'Our picnic in the rain',
              ts: '2018-07-19',
              msg:
                `We got caught in the rain mid-picnic, and you sang off-key just to make me laugh — as if it could make the clouds pour harder. We were soaked, and happy.
    It wasn’t extraordinary, and maybe that’s why it sticks.
    07/19/2018 became our beginning. I’m giving you this so that, on doubtful days, we remember we already know how to walk through storms.
    
    ${giftLabel}: Eva`,
              cta: '/claim?style=romantic',
            },
            {
              style: 'birth' as PreviewStyle,
              owner: 'Zoé',
              title: 'Welcome, Zoé',
              ts: '2023-03-02',
              msg:
                `A tiny cry. On 2023-03-02, you arrived, and we became three.
    I’m claiming this day for us, so it will always be ours.
    
    ${giftLabel}: Mom & Dad`,
              cta: '/claim?style=birth',
            },
            {
              style: 'birthday' as PreviewStyle,
              owner: 'Mathieu',
              title: '18',
              ts: '2025-09-15',
              msg:
                `Happy birthday my son, eighteen already. You talk about studies, music, somewhere else…
    Nothing’s decided, but everything’s possible.
    I’m reserving this date to remind you the first step is already behind you —
    and that I believe in what comes next.
    
    ${giftLabel}: Mom`,
              cta: '/claim?style=birthday',
            },
          ] as Array<{ style: PreviewStyle; owner: string; title: string; ts: string; msg: string; cta: string }>,
        }
  
    return (
      <section>
        <Container>
          <SectionEyebrow>{copy.eyebrow}</SectionEyebrow>
          <H2>{copy.title}</H2>
          <p style={{ margin: '6px 0 16px', color: 'var(--color-text)', opacity: 0.92, maxWidth: 820 }}>
            {copy.lead}
          </p>
  
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 }}>
            {copy.cards.map((c, idx) => (
              <div key={idx} style={{ gridColumn: isSmall ? 'span 12' : 'span 4' }}>
                <CertificatePreview
                  styleId={c.style}
                  owner={c.owner}
                  title={c.title}
                  message={c.msg}
                  ts={c.ts}
                  href={href(c.cta)}
                />
              </div>
            ))}
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
              <li>{isFR ? 'Fichiers HD prêts à imprimer (PDF/JPG), certificat unique et vérifiable.' : 'HD, print-ready files (PDF/JPG), unique and verifiable certificate.'}</li>
              <li>{isFR ? 'QR scannable vers votre page — partage immédiat.' : 'Scannable QR to your page — instant sharing.'}</li>
              <li>{isFR ? 'Chaque date n’est vendue qu’une fois — la vôtre, pour toujours.' : 'Each date is sold only once — yours, forever.'}</li>
            </ul>
            <div style={{ marginTop: 10, fontSize: 14, color: 'var(--color-muted)' }}>
              {copy.note}
            </div>
          </div>
        </Container>
      </section>
    )
  }
  
  
/* =========================================================
   HOW IT WORKS — steps responsive 3 → 1 en mobile
   ========================================================= */
   function HowItWorks() {
    const pathname = usePathname() || '/'
    const isFR = /^\/fr(\/|$)/.test(pathname)
    const [isSmall, setIsSmall] = useState(false)
  
    useEffect(() => {
      const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
      onResize()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [])
  
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
              <div
                key={i}
                style={{
                  gridColumn: isSmall ? 'span 12' : 'span 4',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                }}
              >
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
  

/* =========================================================
   TESTIMONIALS — responsive 3 → 1 en mobile
   ========================================================= */
   function Testimonials() {
    const pathname = usePathname() || '/'
    const isFR = /^\/fr(\/|$)/.test(pathname)
    const [isSmall, setIsSmall] = useState(false)
  
    useEffect(() => {
      const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
      onResize()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [])
  
    const eyebrow = isFR ? 'Témoignages' : 'Testimonials'
    const items = isFR
      ? [
          { q: '“Nous avons revendiqué la journée de la naissance d’Aïcha… frissons à chaque fois !”', a: 'Mathilde' },
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
              <blockquote
                key={i}
                style={{
                  gridColumn: isSmall ? 'span 12' : 'span 4',
                  margin: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                }}
              >
                <p style={{ margin: '0 0 8px', fontStyle: 'italic' }}>{t.q}</p>
                <footer style={{ opacity: 0.8 }}>— {t.a}</footer>
              </blockquote>
            ))}
          </div>
        </Container>
      </section>
    )
  }
  

/* =============== FAQ (FR/EN) — responsive 2 → 1 en mobile =============== */
function FAQ() {
  const pathname = usePathname() || '/'
  const href = useLocaleHref()
  const isFR = /^\/fr(\/|$)/.test(pathname)
  const [isSmall, setIsSmall] = useState(false)

  useEffect(() => {
    const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
            <details
              key={i}
              style={{
                gridColumn: isSmall ? 'span 12' : 'span 6',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
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
