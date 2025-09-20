// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  verifyPassword,
  findOwnerByEmailWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function pickLocale(h: Headers) {
  const a = (h.get('accept-language') || '').toLowerCase()
  return a.startsWith('fr') ? 'fr' : 'en'
}

export async function POST(req: Request) {
  try {
    const ctype = req.headers.get('content-type') || ''
    const base = new URL(req.url).origin
    const locale = pickLocale(req.headers)

    // === 1) Form POST
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      const email = String(form.get('email') || '')
      const password = String(form.get('password') || '')
      const next = String(form.get('next') || `/${locale}/account`)

      const urlBack = new URL(`/${locale}/login`, base)
      urlBack.searchParams.set('next', next)

      if (!email || !password) {
        urlBack.searchParams.set('err', 'missing_credentials')
        return NextResponse.redirect(urlBack, { status: 303 })
      }

      const rec = await findOwnerByEmailWithPassword(email)
      if (!rec?.password_hash) {
        urlBack.searchParams.set('err', 'not_found')
        return NextResponse.redirect(urlBack, { status: 303 })
      }
      const ok = await verifyPassword(password, rec.password_hash)
      if (!ok) {
        urlBack.searchParams.set('err', 'bad_credentials')
        return NextResponse.redirect(urlBack, { status: 303 })
      }

      const to = new URL(next, base)
      const res = NextResponse.redirect(to, { status: 303 })
      setSessionCookieOnResponse(res, {
        ownerId: String(rec.id),
        email: String(rec.email),
        displayName: rec.display_name,
        iat: Math.floor(Date.now() / 1000),
      })
      return res
    }

    // === 2) Fallback JSON (XHR)
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'missing_credentials' }, { status: 400 })
    }
    const rec = await findOwnerByEmailWithPassword(String(email))
    if (!rec?.password_hash) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const ok = await verifyPassword(String(password), rec.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'bad_credentials' }, { status: 401 })
    }
    const res = NextResponse.json({ ok: 1, ownerId: rec.id })
    setSessionCookieOnResponse(res, {
      ownerId: String(rec.id),
      email: String(rec.email),
      displayName: rec.display_name,
      iat: Math.floor(Date.now() / 1000),
    })
    return res
  } catch (e: any) {
    console.error('[login] error:', e?.message || e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
