// app/components/HeroSlideshow.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Slide = {
  src: string
  alt: string
  focal?: string // ex: 'center 40%' → objectPosition CSS (optionnel)
}

export default function HeroSlideshow({
  slides,
  interval = 2000,
}: {
  slides: Slide[]
  interval?: number
}) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  )
  const timer = useRef<number | null>(null)

  // Auto-advance
  useEffect(() => {
    if (paused || reduce || slides.length <= 1) return
    timer.current = window.setInterval(() => setI((v) => (v + 1) % slides.length), interval)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [paused, reduce, slides.length, interval])

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => (v + 1) % slides.length)
      if (e.key === 'ArrowLeft') setI((v) => (v - 1 + slides.length) % slides.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])

  // Précharge la suivante
  useEffect(() => {
    const next = new Image()
    next.src = slides[(i + 1) % slides.length]?.src
  }, [i, slides])

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero photos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-elev2)',
        background: 'var(--color-surface)',
      }}
    >
      {/* Viewport fixe pour éviter tout CLS */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}>
        {slides.map((s, idx) => (
          <img
            key={s.src + idx}
            src={s.src}
            alt={s.alt}
            loading={idx === 0 ? 'eager' : 'lazy'}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: s.focal || 'center',
              opacity: idx === i ? 1 : 0,
              transition: 'opacity 600ms ease',
            }}
          />
        ))}

        {/* Voile radial subtil pour lisibilité éventuelle du texte par-dessus (si tu ajoutes un badge) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(80% 70% at 50% 30%, rgba(0,0,0,.20), rgba(0,0,0,.05) 60%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Controls (accessibles) */}
        <button
          aria-label="Photo précédente"
          onClick={() => setI((v) => (v - 1 + slides.length) % slides.length)}
          style={navBtn('left')}
        >
          ‹
        </button>
        <button
          aria-label="Photo suivante"
          onClick={() => setI((v) => (v + 1) % slides.length)}
          style={navBtn('right')}
        >
          ›
        </button>
      </div>

      {/* Dots + Pause/Play */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 10,
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {slides.map((_, idx) => (
          <button
            key={idx}
            aria-label={idx === i ? 'Photo active' : `Aller à la photo ${idx + 1}`}
            onClick={() => setI(idx)}
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              background: idx === i ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-text) 30%, transparent)',
            }}
          />
        ))}
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Relancer le défilement' : 'Mettre en pause'}
          style={{
            marginLeft: 6,
            padding: '4px 8px',
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'color-mix(in srgb, var(--color-bg) 60%, var(--color-surface))',
            color: 'var(--color-text)',
          }}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>
    </div>
  )
}

function navBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [side]: 8,
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--color-border)',
    background: 'color-mix(in srgb, var(--color-bg) 60%, var(--color-surface))',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: '34px',
    fontWeight: 700,
  } as React.CSSProperties
}
