// utils/serverBase.ts (nouveau petit helper)
import { headers } from 'next/headers'

export async function canonicalBase() {
  const h = await headers()
  const rawHost = (h.get('x-forwarded-host') || h.get('host') || 'parcelsoftime.com').toLowerCase()
  const host = rawHost.replace(/^www\./, '')
  const proto = (h.get('x-forwarded-proto') || 'https').includes('https') ? 'https' : 'http'
  return `${proto}://${host}`
}
