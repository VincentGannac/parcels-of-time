//app/sitemap.ts
import type { MetadataRoute } from 'next'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://parcelsoftime.com'
  // Tu peux plus tard lister les secondes revendiquées depuis la DB
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/claim`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/company`, changeFrequency: 'yearly' },
    { url: `${base}/support`, changeFrequency: 'yearly' },
    { url: `${base}/legal/terms`, changeFrequency: 'yearly' },
    { url: `${base}/legal/refund`, changeFrequency: 'yearly' },
    { url: `${base}/legal/privacy`, changeFrequency: 'yearly' },
  ]
}
