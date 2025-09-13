export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { pool } from '@/lib/db'
import RegistryClient from './RegistryClient'

type Params = { locale: string }

type RegistryRow = {
  ts: string
  owner: string
  title: string | null
  message: string | null
  style: string
}

async function getPublicItems(): Promise<RegistryRow[]> {
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
    // En cas d’erreur DB côté SSR, on renvoie une liste vide — le client fera un backoff.
    return []
  }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { locale = 'en' } = await params
  const items = await getPublicItems()
  return <RegistryClient locale={locale} initialItems={items} />
}
