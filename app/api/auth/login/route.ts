// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { authenticateWithPassword, setSessionCookieOnResponse } from '@/lib/auth'

function safeNext(input: string, locale: 'fr'|'en') {
  const s = (input || '').trim()
  return /^\/(fr|en)\//.test(s) ? s : `/${locale}/account`
}

async function parseBody(req: Request) {
  const ct = req.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({} as any))
    return {
      email: String(j.email || ''),
      password: String(j.password || ''),
      locale: (String(j.locale || 'en') === 'fr' ? 'fr' : 'en') as 'fr'|'en',
      next: String(j.next || ''),
    }
  }
  const txt = await req.text()
  const sp = new URLSearchParams(txt)
  return {
    email: String(sp.get('email') || ''),
    password: String(sp.get('password') || ''),
    locale: (String(sp.get('locale') || 'en') === 'fr' ? 'fr' : 'en') as 'fr'|'en',
    next: String(sp.get('next') || ''),
  }
}

export async function POST(req: Request) {
  const { email, password, locale, next } = await parseBody(req)
  if (!email || !password) {
    const loc = `/${locale}/login?err=missing${next ? `&next=${encodeURIComponent(next)}` : ''}`
    return NextResponse.redirect(new URL(loc, req.url))
  }

  const user = await authenticateWithPassword(email, password)
  if (!user) {
    const loc = `/${locale}/login?err=badcreds${next ? `&next=${encodeURIComponent(next)}` : ''}`
    return NextResponse.redirect(new URL(loc, req.url))
  }

  const target = safeNext(next, locale)
  const res = NextResponse.redirect(new URL(target, req.url), { status: 303 })
  setSessionCookieOnResponse(res, {
    ownerId: user.id,
    email: user.email,
    displayName: user.display_name,
    iat: Math.floor(Date.now() / 1000),
  })
  return res
}
