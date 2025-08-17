import type { Metadata } from 'next'
export const dynamic = 'force-static'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.parcelsoftime.com'

export async function generateMetadata({ params }: { params: Promise<{ locale:'fr'|'en' }> }): Promise<Metadata> {
  const { locale } = await params
  const t = locale === 'fr'

  const basePath = locale === 'fr' ? '/fr' : '/en'
  return {
    metadataBase: new URL(BASE),
    title: t ? 'Parcels of Time — Possédez la minute qui compte.' : 'Parcels of Time — Own the minute that matters.',
    description: t
      ? 'Réservez une minute unique en UTC, certificat signé & page souvenir.'
      : 'Claim a unique minute in UTC, signed certificate & shareable page.',
    alternates: {
      canonical: `${BASE}${basePath}`, // page racine locale
      languages: {
        en: '/en',
        fr: '/fr',
      },
    },
    openGraph: {
      locale,
      siteName: 'Parcels of Time',
      type: 'website',
      url: `${BASE}${basePath}`,
      title: t ? 'Possédez la minute qui compte.' : 'Own the minute that matters.',
      description: t
        ? 'Réservez une minute unique en UTC, certificat signé & page souvenir.'
        : 'Claim a unique minute in UTC, signed certificate & shareable page.',
    },
  }
}
