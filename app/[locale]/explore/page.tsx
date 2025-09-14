// app/explore/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { pool } from '@/lib/db'
import { headers } from 'next/headers'
import RegistryClient from './RegistryClient'

type Params = { locale: string }

type RegistryRow = {
  ts: string   // ISO minuit du jour
  owner: string
  title: string | null
  message: string | null
  style: string
}

/** Lecture DB par jour (zéro cache) */
async function getFromDB(): Promise<RegistryRow[]> {
  try {
    const { rows } = await pool.query(
      `
      select distinct on (day_utc)
        day_utc, owner, title, message, style
      from (
        select
          date_trunc('day', c.ts) as day_utc,
          coalesce(o.display_name, 'Anonymous') as owner,
          c.title, c.message, c.cert_style as style,
          c.ts as claim_ts
        from minute_public mp
        join claims c on date_trunc('day', c.ts) = date_trunc('day', mp.ts)
        join owners o on o.id = c.owner_id
      ) t
      order by day_utc desc, claim_ts desc
      limit 500
      `
    )
    return rows.map((r: any) => ({
      ts: new Date(r.day_utc).toISOString().slice(0,10), // => 'YYYY-MM-DD'
      owner: String(r.owner || 'Anonymous'),
      title: r.title ?? null,
      message: r.message ?? null,
      style: String(r.style || 'neutral'),
    }))
  } catch {
    return []
  }
}

/** Fallback SSR via l'API */
async function getFromAPI(): Promise<RegistryRow[]> {
  try {
    const h = await headers()
    const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https'
    const host  = (h.get('host') || '').split(',')[0].trim()
    const base  = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${proto}://${host}` : '')
    const res = await fetch(`${base}/api/registry?v=${Date.now()}`, { cache: 'no-store', next: { revalidate: 0 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { locale = 'en' } = await params

  let items = await getFromDB()
  if (items.length === 0) {
    const apiItems = await getFromAPI()
    if (apiItems.length) items = apiItems
  }

  return <RegistryClient locale={locale} initialItems={items} />
}
