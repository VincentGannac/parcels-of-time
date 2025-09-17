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
  const url = new URL(req.url)
  const next = url.searchParams.get('next')

  const to = next && /^\/(fr|en)\//.test(next) ? next : `/${locale}/login`
  const res = NextResponse.redirect(new URL(to, base), { status: 303 })
  clearSessionCookies(res)
  return res
}

export async function GET(req: Request) {
  // Support GET pour facilité (lien direct)
  return POST(req)
}
