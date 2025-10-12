// app/sitemap.ts
import type { MetadataRoute } from 'next'

const LOCALES = ['fr', 'en'] as const
const paths = ['', '/claim', '/company', '/support', '/legal/terms', '/legal/refund', '/legal/privacy'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.parcelsoftime.com'
  const entries: MetadataRoute.Sitemap = []

  for (const loc of LOCALES) {
    for (const p of paths) {
      const url = `${base}/${loc}${p}`
      entries.push({
        url,
        changeFrequency: p ? 'yearly' : 'weekly',
        priority: p === '' ? 1.0 : p === '/claim' ? 0.9 : 0.7,
      })
    }
  }
  return entries
}
