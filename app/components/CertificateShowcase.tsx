'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

type CertStyle =
  | 'neutral'
  | 'romantic'
  | 'birthday'
  | 'wedding'
  | 'birth'
  | 'christmas'
  | 'newyear'
  | 'graduation'

type Example = {
  style: CertStyle
  tsISO: string
  title: string
  owner: string
  quote: string
  cta: string
}

/** Exemples réalistes — minutes (pas de secondes) */
const EXAMPLES: Example[] = [
  {
    style: 'romantic',
    tsISO: '2017-06-24T21:13:00Z',
    title: 'Ode to love',
    owner: 'A. & L.',
    quote:
      'The minute of our first kiss — June warmth, city lights flickering, time holding its breath.',
    cta: 'Claim a romantic minute →',
  },
  {
    style: 'birth',
    tsISO: '2023-11-03T05:42:00Z',
    title: 'Welcome to the world',
    owner: 'Elena & Marc',
    quote:
      '05:42 — Léa’s first cry. Tiny fingers wrapped around ours; everything else disappeared.',
    cta: 'Claim a birth minute →',
  },
  {
    style: 'wedding',
    tsISO: '2021-09-12T18:11:00Z',
    title: 'She said yes',
    owner: 'Nora + Theo',
    quote:
      '18:11 — trembling hands, a ring that almost slipped, and her yes that changed everything.',
    cta: 'Claim a wedding minute →',
  },
  {
    style: 'christmas',
    tsISO: '2022-12-25T07:12:00Z',
    title: 'Christmas morning',
    owner: 'The Martins',
    quote:
      'Paper rustling, cinnamon in the air — the minute they shouted “open it!” and the room burst with joy.',
    cta: 'Claim a Christmas minute →',
  },
  {
    style: 'newyear',
    tsISO: '2030-01-01T00:00:00Z',
    title: 'Midnight fireworks',
    owner: 'Friends of 2029',
    quote:
      '00:00 UTC — skyline lit up, a new decade unfolding in sparks and cheers.',
    cta: 'Claim a New Year minute →',
  },
  {
    style: 'graduation',
    tsISO: '2019-07-15T14:32:00Z',
    title: 'Diploma in hand',
    owner: 'Class of 2019',
    quote:
      'Applause rising — one deep breath, that minute on stage felt like a door opening.',
    cta: 'Claim a graduation minute →',
  },
]

function formatISOMinute(iso: string) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    // Affichage à la minute
    return d.toISOString().replace('T', ' ').replace(':00.000Z', ' UTC').replace('Z',' UTC')
  } catch {
    return iso
  }
}

export default function CertificateShowcase() {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const timeout = useRef<number | null>(null)

  const go = (dir: 1 | -1) =>
    setIdx((i) => (i + dir + EXAMPLES.length) % EXAMPLES.length)

  // Auto-advance
  useEffect(() => {
    if (paused) return
    timeout.current = window.setTimeout(() => go(1), 4200)
    return () => {
      if (timeout.current) window.clearTimeout(timeout.current)
    }
  }, [idx, paused])

  // keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const current = EXAMPLES[idx]
  const dots = useMemo(() => Array.from({ length: EXAMPLES.length }, (_, i) => i), [])

  // Texte foncé (lisible sur fonds A4 clairs, même en UI dark)
  const previewText = 'rgba(26,31,42,.92)'
  const previewSubtle = 'rgba(26,31,42,.70)'

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ display: 'grid', gap: 12 }}
      aria-label="Certificate showcase"
    >
      {/* Card with real A4 background preview */}
      <div
        style={{
          border: '1px solid var(--color-border, #D9D7D3)',
          borderRadius: 16,
          background: 'var(--color-surface, #fff)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-elev1, 0 6px 20px rgba(0,0,0,.12))',
        }}
      >
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label={`${current.title} — ${idx + 1} of ${EXAMPLES.length}`}
          style={{
            position: 'relative',
            height: 360,
            display: 'grid',
          }}
        >
          {/* Background (thumb then full as fallback) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(/cert_bg/${current.style}_thumb.jpg), url(/cert_bg/${current.style}.png)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'saturate(1) contrast(1)',
            }}
            aria-hidden
          />

          {/* Certificate content — overlay (pas de voile blanc) */}
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              padding: 20,
              gap: 8,
              color: previewText,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '5px solid ' + previewText,
                  position: 'relative',
                }}
                aria-hidden
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: 12,
                    width: 5,
                    height: 18,
                    background: previewText,
                  }}
                />
              </div>
              <div style={{ fontWeight: 800 }}>
                Parcels of Time — <span style={{ opacity: .9 }}>Certificate of Claim</span>
              </div>
            </div>

            {/* Middle */}
            <div style={{ display: 'grid', alignContent: 'center', gap: 6 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {formatISOMinute(current.tsISO)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>Owned by</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{current.owner}</div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Message</div>
                <blockquote style={{ margin: 0, fontSize: 14, fontStyle: 'italic', color: previewSubtle }}>
                  “{current.quote}”
                </blockquote>
              </div>
            </div>

            {/* CTA + style tag */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Link
                href={`/claim?ts=${encodeURIComponent(current.tsISO)}&style=${current.style}`}
                style={{
                  background: 'var(--color-primary, #0B0B0C)',
                  color: 'var(--color-on-primary, #FAF9F7)',
                  padding: '10px 14px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {current.cta}
              </Link>
              <span
                style={{
                  fontSize: 12,
                  opacity: 0.80,
                  padding: '6px 8px',
                  border: '1px solid var(--color-border, #E9E7E3)',
                  borderRadius: 8,
                  background: 'var(--color-surface, #fff)',
                }}
              >
                Style: <strong>{current.style}</strong>
              </span>
            </div>

            {/* Nav buttons */}
            <button aria-label="Previous example" onClick={() => go(-1)} style={navBtnStyle('left')}>
              ←
            </button>
            <button aria-label="Next example" onClick={() => go(1)} style={navBtnStyle('right')}>
              →
            </button>
          </div>
        </div>
      </div>

      {/* Dots + Pause */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        {dots.map((i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Show example ${i + 1}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              border: 'none',
              background: i === idx ? 'var(--color-primary, #0B0B0C)' : 'var(--color-border, #D9D7D3)',
              cursor: 'pointer',
            }}
          />
        ))}
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Resume autoplay' : 'Pause autoplay'}
          style={{
            marginLeft: 8,
            border: '1px solid var(--color-border, #E4E2DE)',
            background: 'var(--color-surface, #fff)',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 12,
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>
    </div>
  )
}

function navBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--color-border, #E4E2DE)',
    background: 'rgba(255,255,255,.92)',
    cursor: 'pointer',
    fontWeight: 700,
  }
  ;(base as any)[side] = 8
  return base
}
