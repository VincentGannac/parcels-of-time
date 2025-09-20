// app/api/auth/logout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/auth'

function pickLocale(h: Headers) {
  const acc = (h.get('accept-language') || '').toLowerCase()
  return acc.startsWith('fr') ? 'fr' : 'en'
}

export async function POST(req: Request) {
  const base = new URL(req.url).origin
  const locale = pickLocale(req.headers)
  const url = new URL(`/${locale}/?logged_out=1`, base)

  const res = NextResponse.redirect(url, { status: 303 })
  clearSessionCookies(res)
  return res
}

export async function GET(req: Request) {
  return POST(req)
}
