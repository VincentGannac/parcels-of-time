// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  verifyPassword,
  findOwnerByEmailWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function getOrigin(req: Request): string {
  return new URL(req.url).origin
}
function sanitizeNext(next: unknown, fallback: string) {
  const s = typeof next === 'string' ? next : ''
  return /^\/(fr|en)\/.+/.test(s) ? s : fallback
}
function pickLocaleFromHeader(h: Headers): 'fr' | 'en' {
  const a = (h.get('accept-language') || '').toLowerCase()
  return a.startsWith('fr') ? 'fr' : 'en'
}

export async function POST(req: Request) {
  try {
    const ctype = req.headers.get('content-type') || ''
    const origin = getOrigin(req)
    const hostname = new URL(req.url).hostname
    const locale = pickLocaleFromHeader(req.headers)

    // ---- 1) Form POST
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      const email = String(form.get('email') ?? '')
      const password = String(form.get('password') ?? '')
      const next = sanitizeNext(form.get('next'), `/${locale}/account`)

      if (!email || !password) {
        const back = new URL(`/${locale}/login`, origin)
        back.searchParams.set('err', 'missing_credentials')
        back.searchParams.set('next', next)
        return NextResponse.redirect(back, { status: 303 })
      }

      const rec = await findOwnerByEmailWithPassword(email)
      if (!rec?.password_hash) {
        const back = new URL(`/${locale}/login`, origin)
        back.searchParams.set('err', 'not_found')
        back.searchParams.set('next', next)
        return NextResponse.redirect(back, { status: 303 })
      }

      const ok = await verifyPassword(password, rec.password_hash)
      if (!ok) {
        const back = new URL(`/${locale}/login`, origin)
        back.searchParams.set('err', 'bad_credentials')
        back.searchParams.set('next', next)
        return NextResponse.redirect(back, { status: 303 })
      }

      // ✅ Pose cookie
      const to = new URL(next, origin)
      // cache-buster contre d'anciens 302/303 mis en cache par un CDN
      to.searchParams.set('_r', Date.now().toString(36))

      const res = NextResponse.redirect(to, { status: 303 })
      setSessionCookieOnResponse(res, {
        ownerId: String(rec.id),
        email: String(rec.email),
        displayName: rec.display_name,
        iat: Math.floor(Date.now() / 1000),
      }, undefined, hostname)

      res.headers.set('Cache-Control', 'no-store, private')
      res.headers.set('Vary', 'Cookie')
      return res
    }

    // ---- 2) JSON fallback
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '')
    const password = String(body.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: 'missing_credentials' }, { status: 400 })
    }

    const rec = await findOwnerByEmailWithPassword(email)
    if (!rec?.password_hash) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const ok = await verifyPassword(password, rec.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'bad_credentials' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true, ownerId: rec.id })
    setSessionCookieOnResponse(res, {
      ownerId: String(rec.id),
      email: String(rec.email),
      displayName: rec.display_name,
      iat: Math.floor(Date.now() / 1000),
    }, undefined, hostname)
    res.headers.set('Cache-Control', 'no-store, private')
    res.headers.set('Vary', 'Cookie')
    return res
  } catch (e) {
    console.error('[login] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
