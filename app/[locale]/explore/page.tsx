export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { pool } from '@/lib/db'
import { headers } from 'next/headers'
import RegistryClient from './RegistryClient'

type Params = { locale: string }

type RegistryRow = {
  ts: string
  owner: string
  title: string | null
  message: string | null
  style: string
}

/** Lecture directe DB (zéro cache) */
async function getFromDB(): Promise<RegistryRow[]> {
  try {
    const { rows } = await pool.query(
      `select
         c.ts,
         coalesce(o.display_name, 'Anonymous') as owner,
         c.title,
         c.message,
         c.cert_style as style
       from minute_public mp
       join claims c on c.ts = mp.ts
       join owners o on o.id = c.owner_id
       order by c.ts desc
       limit 500`
    )
    return rows.map((r: any) => ({
      ts: new Date(r.ts).toISOString(),
      owner: String(r.owner || 'Anonymous'),
      title: r.title ?? null,
      message: r.message ?? null,
      style: String(r.style || 'neutral'),
    }))
  } catch {
    return []
  }
}

/** Fallback SSR via l'API (au cas où la DB SSR soit lente/cold) */
async function getFromAPI(): Promise<RegistryRow[]> {
  try {
    const h = await headers()
    const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https'
    const host  = (h.get('host') || '').split(',')[0].trim()
    const base  = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${proto}://${host}` : '')
    const res = await fetch(`${base}/api/registry?v=${Date.now()}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { locale = 'en' } = await params

  // 1) DB directe
  let items = await getFromDB()

  // 2) Si vide, second filet via l'API (toujours en SSR)
  if (items.length === 0) {
    const apiItems = await getFromAPI()
    if (apiItems.length) items = apiItems
  }

  return <RegistryClient locale={locale} initialItems={items} />
}
