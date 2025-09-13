//app/components/LocaleSwitcher.tsx
'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const LOCALES = ['fr','en'] as const
type Locale = typeof LOCALES[number]

function getCurrentLocale(pathname: string): Locale {
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  return (m?.[1] as Locale) || 'en'
}

export default function LocaleSwitcher({
  className,
  style,
  labels = { fr: 'FR', en: 'EN' },
}: {
  className?: string
  style?: React.CSSProperties
  labels?: { fr: string; en: string }
}) {
  const pathname = usePathname() || '/'
  const search = useSearchParams()

  const current = getCurrentLocale(pathname)
  const other: Locale = current === 'fr' ? 'en' : 'fr'

  // Chemin sans le préfixe locale
  const rest = pathname.replace(/^\/(fr|en)/, '') || '/'

  // Reconstruit l'URL de destination en conservant la query string
  const query = search?.toString()
  const href = `/${other}${rest}${query ? `?${query}` : ''}`

  return (
    <Link
      href={href}
      aria-label={current === 'fr' ? 'Switch to English' : 'Passer en français'}
      className={className}
      style={{
        padding: '8px 10px',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        textDecoration: 'none',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        ...style,
      }}
    >
      {/* petit rendu “FR / EN” avec la langue courante en gras */}
      <span style={{ fontWeight: current === 'fr' ? 700 : 400 }}>{labels.fr}</span>
      <span style={{ opacity: 0.6 }}> / </span>
      <span style={{ fontWeight: current === 'en' ? 700 : 400 }}>{labels.en}</span>
    </Link>
  )
}
