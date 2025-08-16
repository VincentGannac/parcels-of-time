// app/page.tsx — fallback i18n propre
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

const LOCALES = ['fr','en'] as const
type Locale = (typeof LOCALES)[number]
const DEFAULT_LOCALE: Locale = 'en'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

export default async function RootRedirect() {
  const h = await headers() // ← ATTENTION: await
  const al = (h.get('accept-language') ?? '').toLowerCase()
  const guess = al.split(',')[0]?.split('-')[0]
  const locale: Locale = isLocale(guess) ? guess : DEFAULT_LOCALE
  redirect(`/${locale}`)
}
