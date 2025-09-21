import type { MetadataRoute } from 'next'

// Canonique = WWW (cohérent avec le reste)
const BASE = 'https://www.parcelsoftime.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/claim', '/company', '/legal/terms', '/legal/privacy', '/legal/refund', '/legal/mentions-legales']
  return paths.map((p) => ({
    url: `${BASE}${p.startsWith('/') ? '' : '/'}${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.7,
  }))
}
