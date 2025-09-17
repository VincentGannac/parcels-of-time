// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  setSessionCookieOnResponse,
  verifyLoginToken,
  upsertOwnerByEmail,
  makeSignedCookieValue,
} from '@/lib/auth'

function pickLocale(s?: string | null) {
  return String(s || '').toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

async function parseBody(req: Request) {
  const ctype = req.headers.get('content-type') || ''
  if (ctype.includes('application/json')) {
    try {
      return await req.json()
    } catch {
      return {}
    }
  }
  if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
    try {
      const fd = await req.formData()
      const obj: Record<string, any> = {}
      fd.forEach((v, k) => (obj[k] = v))
      return obj
    } catch {
      return {}
    }
  }
  return {}
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const base = process.env.NEXT_PUBLIC_BASE_URL || url.origin

  const body = await parseBody(req)
  const nextUrl = String(body.next || url.searchParams.get('next') || `/${pickLocale(body.locale)}/account`)
  const locale = pickLocale(body.locale || url.searchParams.get('locale'))

  // 1) Login via token magique (recommandé en prod)
  const token = String(body.token || url.searchParams.get('token') || '')
  if (token) {
    const data = verifyLoginToken(token)
    if (!data) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
    }
    const email = data.email.trim().toLowerCase()
    const ownerId = data.ownerId || (await upsertOwnerByEmail(email, data.displayName))
    const res = NextResponse.redirect(new URL(nextUrl, base).toString(), { status: 303 })
    setSessionCookieOnResponse(res, {
      ownerId,
      email,
      displayName: data.displayName || null,
      iat: Math.floor(Date.now() / 1000),
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  // 2) Mode DEV: login par e-mail seul (désactivé par défaut)
  const devAllowed =
    process.env.ALLOW_PASSWORDLESS_DEV === '1' || process.env.NODE_ENV !== 'production'
  if (devAllowed) {
    const email = String(body.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'missing_email' }, { status: 400 })
    const displayName = String(body.display_name || '') || null
    const ownerId = await upsertOwnerByEmail(email, displayName)
    const res = NextResponse.redirect(new URL(nextUrl, base).toString(), { status: 303 })
    setSessionCookieOnResponse(res, { ownerId, email, displayName })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  // 3) Sinon, on exige un token
  return NextResponse.json({ error: 'missing_token' }, { status: 400 })
}

// Optionnel: GET avec token dans l'URL (utile depuis un lien e-mail)
export async function GET(req: Request) {
  return POST(req)
}
