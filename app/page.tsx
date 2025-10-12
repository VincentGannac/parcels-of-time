// app/page.tsx
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const LOCALES = ['fr', 'en'] as const
type Locale = (typeof LOCALES)[number]
const FALLBACK: Locale = 'en'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v as any)
}

function pickLocaleFromAcceptLanguage(al: string): Locale {
  const items = (al || '')
    .split(',')
    .map(s => {
      const [tag, ...rest] = s.trim().split(';')
      const q = parseFloat(rest.find(p => p.trim().startsWith('q='))?.split('=')[1] || '1')
      const base = tag.toLowerCase().split('-')[0]
      return { base, q }
    })
    .sort((a, b) => b.q - a.q)

  const found = items.find(i => isLocale(i.base))?.base
  return (found as Locale) || FALLBACK
}

export default async function RootRedirect() {
  const h = await headers()
  const c = await cookies()
  const cookieLoc = c.get('pt_locale')?.value
  const loc: Locale = isLocale(cookieLoc)
    ? cookieLoc
    : pickLocaleFromAcceptLanguage(h.get('accept-language') || '')
  redirect(`/${loc}`)
}
