export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

async function getPublicItems(): Promise<RegistryRow[]> {
  try {
    const h = await headers()
    const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https'
    const host  = (h.get('host') || '').split(',')[0].trim()
    const base  = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${proto}://${host}` : '')

    // Cache-buster pour éviter tout cache intermédiaire
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

export default async function Page({ params }: { params: Params }) {
  const { locale = 'en' } = params
  const items = await getPublicItems()
  return <RegistryClient locale={locale} initialItems={items} />
}
