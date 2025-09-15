// app/api/auth/logout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { clearSessionCookieOnResponse } from '@/lib/auth'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const referer = req.headers.get('referer') || ''
  const m = referer.match(/\/(fr|en)(?:\/|$)/)
  const loc = (m?.[1] as 'fr'|'en') || 'en'

  const res = NextResponse.redirect(new URL(`/${loc}/login`, req.url), { status: 303 })
  clearSessionCookieOnResponse(res)
  return res
}
