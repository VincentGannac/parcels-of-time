// app/page.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

const LOCALES = ['fr', 'en'] as const
type Locale = (typeof LOCALES)[number]
const FALLBACK: Locale = 'en'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v as string)
}

/**
 * Fallback serveur si le middleware ne tourne pas (dev / export).
 * En prod, le middleware redirige déjà '/' vers '/fr' ou '/en'.
 */
export default async function RootRedirect() {
  const h = await headers() // ✅ Next 15 : Promise<ReadonlyHeaders>
  const al = (h.get('accept-language') ?? '').toLowerCase()
  const guess = al.split(',')[0]?.split('-')[0]
  const locale: Locale = isLocale(guess) ? guess : FALLBACK
  redirect(`/${locale}`)
}
