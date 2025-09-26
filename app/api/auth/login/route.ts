//app/api/auth/login/route.ts
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
  if (/^\/(fr|en)\/.+/.test(s)) return s
  return fallback
}
function pickLocaleFromHeader(h: Headers): 'fr' | 'en' {
  const a = (h.get('accept-language') || '').toLowerCase()
  return a.startsWith('fr') ? 'fr' : 'en'
}
function isSafariUA(h: Headers) {
  const ua = (h.get('user-agent') || '')
  // Safari (iOS/macOS), exclure Chrome/Chromium/Edge/Firefox
  return /\bSafari\/\d+/.test(ua)
    && !/(Chrome|Chromium)\/\d+/.test(ua)
    && !/\bEdg(A|iOS|e)?\/\d+/.test(ua)
    && !/\bFirefox\/\d+/.test(ua)
}

/** Petite page 200 qui redirige (laisse le temps au cookie d’être écrit) */
function htmlAfterLogin(toHref: string) {
  const esc = toHref.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return (
    '<!doctype html><html><head>' +
    '<meta charset="utf-8">' +
    `<meta http-equiv="refresh" content="0; url=${esc}">` +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Redirecting…</title>' +
    '</head><body style="font:16px system-ui;padding:24px">' +
    '<p>Redirecting…</p>' +
    `<p><a href="${esc}">Continue</a></p>` +
    `<script>setTimeout(function(){location.replace(${JSON.stringify(toHref)})},0)</script>` +
    '</body></html>'
  )
}

function loginSuccessHTML(nextAbsUrl: string, hostHint: string | undefined, payload: {
  ownerId: string
  email: string
  displayName: string | null
}) {
  const res = new NextResponse(htmlAfterLogin(nextAbsUrl), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
  // hostHint = undefined => cookie host-only (utilisé pour Safari)
  setSessionCookieOnResponse(res, {
    ownerId: String(payload.ownerId),
    email: String(payload.email),
    displayName: payload.displayName,
    iat: Math.floor(Date.now() / 1000),
  }, undefined, hostHint)
  return res
}

export async function POST(req: Request) {
  try {
    const ctype = req.headers.get('content-type') || ''
    const origin = getOrigin(req)
    const hostname = new URL(req.url).hostname
    const locale = pickLocaleFromHeader(req.headers)
    const safari = isSafariUA(req.headers)
    const hostHint: string | undefined = safari ? undefined : hostname

    // ---- 1) Form POST
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      const email = String(form.get('email') ?? '')
      const password = String(form.get('password') ?? '')
      const requestedNext = form.get('next')
      const next = sanitizeNext(requestedNext, `/${locale}/account`)

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

      const toAbs = new URL(next, origin).toString()
      return loginSuccessHTML(toAbs, hostHint, {
        ownerId: String(rec.id),
        email: String(rec.email),
        displayName: rec.display_name,
      })
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
    }, undefined, hostHint)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e) {
    console.error('[login] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
