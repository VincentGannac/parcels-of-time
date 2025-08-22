//app/routes/sitemap.ts
import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.parcelsoftime.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '',                // /
    '/claim',          // /claim
    '/company',        // /company
    '/legal/terms',
    '/legal/privacy',
    '/legal/refund',
    '/legal/mentions-legales',
    // ajoute ici d’autres pages statiques
  ]
  // locale actuelle est déduite du répertoire [locale]
  // Next te passera /fr/... ou /en/... automatiquement.
  return paths.map((p) => ({
    url: `${BASE}${p.startsWith('/') ? '' : '/'}${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.7,
  }))
}
