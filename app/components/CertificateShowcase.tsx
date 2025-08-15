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

const EXAMPLES: Example[] = [
  {
    style: 'romantic',
    tsISO: '2017-06-24T21:13:07Z',
    title: 'Ode to love',
    owner: 'A. & L.',
    quote:
      'The exact second of our first kiss — June warmth, city lights flickering, time holding its breath.',
    cta: 'Claim a romantic second →',
  },
  {
    style: 'birth',
    tsISO: '2023-11-03T05:42:10Z',
    title: 'Welcome to the world',
    owner: 'Elena & Marc',
    quote:
      '05:42:10 — Léa’s first cry. Tiny fingers wrapped around ours; everything else disappeared.',
    cta: 'Claim a birth second →',
  },
  {
    style: 'wedding',
    tsISO: '2021-09-12T18:11:11Z',
    title: 'She said yes',
    owner: 'Nora + Theo',
    quote:
      '18:11:11 — trembling hands, a ring that almost slipped, and her yes that changed everything.',
    cta: 'Claim a wedding second →',
  },
  {
    style: 'christmas',
    tsISO: '2022-12-25T07:12:03Z',
    title: 'Christmas morning',
    owner: 'The Martins',
    quote:
      'Paper rustling, cinnamon in the air — the second they shouted “open it!” and the room burst with joy.',
    cta: 'Claim a Christmas second →',
  },
  {
    style: 'newyear',
    tsISO: '2030-01-01T00:00:00Z',
    title: 'Midnight fireworks',
    owner: 'Friends of 2029',
    quote:
      '00:00:00 UTC — city skyline lit up, a new decade unfolding in sparks and cheers.',
    cta: 'Claim a New Year second →',
  },
  {
    style: 'graduation',
    tsISO: '2019-07-15T14:32:44Z',
    title: 'Diploma in hand',
    owner: 'Class of 2019',
    quote:
      'Applause rising — one deep breath, that second on stage felt like a door opening.',
    cta: 'Claim a graduation second →',
  },
]

function formatISO(iso: string) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toISOString().replace('T', ' ').replace('Z', ' UTC')
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
    timeout.current = window.setTimeout(() => go(1), 4500)
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
          border: '1px solid #D9D7D3',
          borderRadius: 16,
          background: '#fff',
          overflow: 'hidden',
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
          />

          {/* Safe area overlay */}
          <div
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              top: 28,
              bottom: 24,
              background: 'rgba(255,255,255,0.88)',
              borderRadius: 12,
              boxShadow: '0 1px 0 rgba(0,0,0,.02) inset',
            }}
          />

          {/* Certificate content */}
          <div
            style={{
              position: 'relative',
              display: 'grid',
              alignContent: 'space-between',
              padding: 20,
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '5px solid #0B0B0C',
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
                    background: '#0B0B0C',
                  }}
                />
              </div>
              <div style={{ fontWeight: 800 }}>Parcels of Time — Certificate of Claim</div>
            </div>

            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {formatISO(current.tsISO)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Owned by</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{current.owner}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Message</div>
              <blockquote style={{ margin: 0, fontSize: 14, fontStyle: 'italic' }}>
                “{current.quote}”
              </blockquote>
            </div>

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
                  background: '#0B0B0C',
                  color: '#FAF9F7',
                  padding: '10px 14px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {current.cta}
              </Link>
              <span
                style={{
                  fontSize: 12,
                  opacity: 0.65,
                  padding: '6px 8px',
                  border: '1px solid #E9E7E3',
                  borderRadius: 6,
                  background: '#fff',
                }}
              >
                Style: <strong>{current.style}</strong>
              </span>
            </div>
          </div>

          {/* Controls */}
          <button
            aria-label="Previous example"
            onClick={() => go(-1)}
            style={navBtnStyle('left')}
          >
            ←
          </button>
          <button
            aria-label="Next example"
            onClick={() => go(1)}
            style={navBtnStyle('right')}
          >
            →
          </button>
        </div>
      </div>

      {/* Dots */}
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
              background: i === idx ? '#0B0B0C' : '#D9D7D3',
              cursor: 'pointer',
            }}
          />
        ))}
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Resume autoplay' : 'Pause autoplay'}
          style={{
            marginLeft: 8,
            border: '1px solid #E4E2DE',
            background: '#fff',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>
    </div>
  )
}

function navBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [side]: 8,
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid #E4E2DE',
    background: 'rgba(255,255,255,.9)',
    cursor: 'pointer',
    fontWeight: 700,
  } as React.CSSProperties
}
