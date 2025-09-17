// app/api/auth/logout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/auth'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const locale = url.searchParams.get('locale')?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const base = process.env.NEXT_PUBLIC_BASE_URL || url.origin

  const res = NextResponse.redirect(`${base}/${locale}`, { status: 303 })
  clearSessionCookies(res)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

// Optionnel : accepter GET (ex. <a href="/api/auth/logout">)
export async function GET(req: Request) {
  return POST(req)
}
