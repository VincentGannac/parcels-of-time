import type { Metadata } from 'next'
import { I18nProvider } from '../i18n/I18nProvider'
import fr from '../../locales/fr.json'
import en from '../../locales/en.json'
import '../globals.css'

export const dynamic = 'force-static'

export async function generateMetadata({
  params,
}: { params: { locale: 'fr'|'en' } }): Promise<Metadata> {
  const l = params.locale
  return {
    title: l === 'fr'
      ? 'Parcels of Time — Possédez la minute qui compte.'
      : 'Parcels of Time — Own the minute that matters.',
    description: l === 'fr'
      ? 'Réservez une minute unique en UTC, certificat signé & page souvenir.'
      : 'Claim a unique minute in UTC, signed certificate & shareable page.',
    alternates: {
      languages: {
        en: '/en',
        fr: '/fr',
      },
    },
  }
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: 'fr'|'en' }
}) {
  const dict = params.locale === 'fr' ? fr : en

  return (
    <html lang={params.locale}>
      <body>
        <I18nProvider locale={params.locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
