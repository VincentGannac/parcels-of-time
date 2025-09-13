//app/components/UTCClock.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLocaleHref } from './useLocaleHref'

function pad2(n: number) { return n.toString().padStart(2, '0') }

function formatUTC(d: Date) {
  const y = d.getUTCFullYear()
  const m = pad2(d.getUTCMonth() + 1)
  const day = pad2(d.getUTCDate())
  const h = pad2(d.getUTCHours())
  const mi = pad2(d.getUTCMinutes())
  const s = pad2(d.getUTCSeconds())
  return {
    pretty: `${y}-${m}-${day} ${h}:${mi}:${s} UTC`,
    iso: `${y}-${m}-${day}T${h}:${mi}:${s}Z`,
  }
}

export default function UTCClock() {
  const href = useLocaleHref()
  const [now, setNow] = useState(() => formatUTC(new Date()))
  useEffect(() => {
    const id = setInterval(() => setNow(formatUTC(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      aria-label="Live UTC clock"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        border: '1px solid #D9D7D3',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{now.pretty}</span>
      <span aria-hidden="true" style={{ opacity: .4 }}>•</span>
      <Link
        href={href(`/claim?ts=${encodeURIComponent(now.iso)}`)}
        style={{
          background: '#0B0B0C',
          color: '#FAF9F7',
          padding: '8px 10px',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}
      >
        Use this second
      </Link>
    </div>
  )
}
