// app/[locale]/layout.tsx
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { I18nProvider } from '../i18n/I18nProvider'
import fr from '../../locales/fr.json'
import en from '../../locales/en.json'
import '../globals.css'

export const dynamic = 'force-static'

export async function generateMetadata(
  { params }: { params: Promise<{ locale: 'fr' | 'en' }> }
): Promise<Metadata> {
  const { locale } = await params
  return {
    title:
      locale === 'fr'
        ? 'Parcels of Time — Possédez la minute qui compte.'
        : 'Parcels of Time — Own the minute that matters.',
    description:
      locale === 'fr'
        ? 'Réservez une minute unique en UTC, certificat signé & page souvenir.'
        : 'Claim a unique minute in UTC, signed certificate & shareable page.',
    alternates: { languages: { en: '/en', fr: '/fr' } },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: 'fr' | 'en' }>
}) {
  const { locale } = await params
  const dict = locale === 'fr' ? fr : en
  return <I18nProvider locale={locale} dict={dict}>{children}</I18nProvider>
}
