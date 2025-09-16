// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  authenticateWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function safeNext(input: string, locale: 'fr'|'en') {
  const s = (input || '').trim()
  return /^\/(fr|en)\//.test(s) ? s : `/${locale}/account`
}

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') || '')
  const password = String(form.get('password') || '')
  const nextRaw = String(form.get('next') || '')
  const locale = (String(form.get('locale') || 'en') === 'fr' ? 'fr' : 'en') as 'fr'|'en'

  if (!email || !password) {
    return NextResponse.redirect(new URL(`/${locale}/login?err=missing&next=${encodeURIComponent(nextRaw)}`, req.url), { status: 303 })
  }

  const user = await authenticateWithPassword(email, password)
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login?err=badcreds&next=${encodeURIComponent(nextRaw)}`, req.url), { status: 303 })
  }

  const target = safeNext(nextRaw, locale)
  const res = NextResponse.redirect(new URL(target, req.url), { status: 303 })

  // ⚠️ Purge absolue des doublons:
  //    - host-only (aucun domain)
  res.cookies.set('pot_sess', '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax' })
  //    - domain-wide (.parcelsoftime.com)
  res.cookies.set('pot_sess', '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax', domain: '.parcelsoftime.com' })

  // Pose l’unique cookie canonical (domain-wide)
  setSessionCookieOnResponse(res, {
    ownerId: user.id,
    email: user.email,
    displayName: user.display_name,
    iat: Math.floor(Date.now() / 1000),
  })

  return res
}
