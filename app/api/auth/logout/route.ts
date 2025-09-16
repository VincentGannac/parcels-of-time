// app/api/auth/logout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const locale = url.pathname.startsWith('/fr') ? 'fr' : 'en'
  const back = `/${locale}/login`

  const res = NextResponse.redirect(new URL(back, req.url), { status: 303 })
  // purge host-only
  res.cookies.set('pot_sess', '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax' })
  // purge domain-wide
  res.cookies.set('pot_sess', '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax', domain: '.parcelsoftime.com' })
  return res
}
