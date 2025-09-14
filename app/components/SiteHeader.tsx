// app/components/SiteHeader.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocaleHref } from './useLocaleHref'
import LocaleSwitcher from './LocaleSwitcher'

export default function SiteHeader() {
  const href = useLocaleHref()
  const pathname = usePathname() || '/'

  // Cache le header sur la landing locale: "/", "/fr", "/en"
  const isLandingRoot = /^\/(?:|fr|en)$/.test(pathname)
  if (isLandingRoot) return null

  // Détermine la locale courante à partir de l'URL
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr' | 'en') || 'en'

  const labels = locale === 'fr'
    ? { about: 'À propos', support: 'Support', search: 'Recherche', claim: 'Réserver' }
    : { about: 'About',    support: 'Support', search: 'Search',    claim: 'Claim' }

  return (
    <header
      role="banner"
      style={{
        borderBottom: '1px solid #E9E7E3',
        background: '#FAF9F7',
      }}
    >
      <nav
        aria-label="Global"
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          justifyContent: 'space-between',
        }}
      >
        {/* Brand */}
        <Link
          href={href('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: '#0B0B0C',
          }}
        >
          <img src="/logo.svg" alt="Parcels of Time" width={28} height={28} />
          <strong>Parcels of Time</strong>
        </Link>

        {/* Nav */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Link href={href('/company')} style={linkStyle}>
            {labels.about}
          </Link>
          <Link href={href('/support')} style={linkStyle}>
            {labels.support}
          </Link>
          <Link href={href('/search')} style={linkStyle}>
            {labels.search}
          </Link>
          <Link href={href('/account')} style={linkStyle}>
            {locale === 'fr' ? 'Mon compte' : 'My Account'}
          </Link>

          {/* Switch FR/EN */}
          <LocaleSwitcher />

          {/* CTA */}
          <Link
            href={href('/claim')}
            style={{
              background: '#0B0B0C',
              color: '#FAF9F7',
              padding: '8px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              marginLeft: 4,
            }}
          >
            {labels.claim}
          </Link>
        </div>
      </nav>
    </header>
  )
}

const linkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#0B0B0C',
  padding: '6px 2px',
}
