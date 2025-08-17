// app/[locale]/layout.tsx
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { I18nProvider } from '../i18n/I18nProvider'
import fr from '../../locales/fr.json'
import en from '../../locales/en.json'
import '../globals.css'

/** IMPORTANT :
 * - Pas de <html>/<body> ici (gardés dans app/layout.tsx)
 * - Next 15 : `params` est un Promise
 */
export const dynamic = 'force-static'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.parcelsoftime.com'

export async function generateMetadata(
  { params }: { params: Promise<{ locale: 'fr' | 'en' }> }
): Promise<Metadata> {
  const { locale } = await params
  const isFR = locale === 'fr'
  const basePath = isFR ? '/fr' : '/en'

  return {
    metadataBase: new URL(BASE),
    title: isFR
      ? 'Parcels of Time — Possédez la minute qui compte.'
      : 'Parcels of Time — Own the minute that matters.',
    description: isFR
      ? 'Réservez une minute unique en UTC, certificat signé & page souvenir.'
      : 'Claim a unique minute in UTC, signed certificate & shareable page.',
    alternates: {
      canonical: basePath, // chemin relatif; résolu via metadataBase
      languages: {
        en: '/en',
        fr: '/fr',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Parcels of Time',
      locale,
      url: `${BASE}${basePath}`,
      title: isFR
        ? 'Possédez la minute qui compte.'
        : 'Own the minute that matters.',
      description: isFR
        ? 'Réservez une minute unique en UTC, certificat signé & page souvenir.'
        : 'Claim a unique minute in UTC, signed certificate & shareable page.',
    },
  }
}

export default async function LocaleLayout(
  { children, params }: { children: ReactNode; params: Promise<{ locale: 'fr' | 'en' }> }
) {
  const { locale } = await params
  const dict = locale === 'fr' ? fr : en

  return (
    <I18nProvider locale={locale} dict={dict}>
      {children}
    </I18nProvider>
  )
}
