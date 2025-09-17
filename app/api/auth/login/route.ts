// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  verifyLoginToken,
  upsertOwnerByEmail,
  getOwnerByEmail,
  verifyPasswordHash,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function pickLocale(h: Headers) {
  const acc = (h.get('accept-language') || '').toLowerCase()
  return acc.startsWith('fr') ? 'fr' : 'en'
}

function redirectTo(base: string, locale: 'fr' | 'en', next?: string | null) {
  const to = next && /^\/(fr|en)\//.test(next) ? next : `/${locale}/account`
  return NextResponse.redirect(new URL(to, base), { status: 303 })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const next = url.searchParams.get('next')
  const base = url.origin
  const locale = pickLocale(req.headers)

  if (!token) {
    // Pas de token → redirect login
    return NextResponse.redirect(new URL(`/${locale}/login`, base), { status: 302 })
  }

  const payload = verifyLoginToken(token)
  if (!payload?.email) {
    return NextResponse.redirect(new URL(`/${locale}/login?err=bad_token`, base), { status: 302 })
  }

  // Crée/maj l'owner si besoin
  const ownerId = await upsertOwnerByEmail(payload.email, payload.displayName ?? undefined)
  const res = redirectTo(base, locale, next)
  setSessionCookieOnResponse(res, {
    ownerId,
    email: payload.email,
    displayName: payload.displayName ?? null,
    iat: Math.floor(Date.now() / 1000),
  })
  return res
}

export async function POST(req: Request) {
  const base = new URL(req.url).origin
  const locale = pickLocale(req.headers)
  try {
    const body = await req.json().catch(() => ({} as any))
    const next: string | null = body?.next || null

    // 1) Magic token dans le body ?
    if (body?.token) {
      const payload = verifyLoginToken(String(body.token))
      if (!payload?.email) {
        return NextResponse.json({ ok: false, error: 'bad_token' }, { status: 400 })
      }
      const ownerId = await upsertOwnerByEmail(payload.email, payload.displayName ?? undefined)
      const res = redirectTo(base, locale, next)
      setSessionCookieOnResponse(res, {
        ownerId,
        email: payload.email,
        displayName: payload.displayName ?? null,
        iat: Math.floor(Date.now() / 1000),
      })
      return res
    }

    // 2) Email + password (si colonne password_hash présente)
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'missing_credentials' }, { status: 400 })
    }

    const owner = await getOwnerByEmail(email)
    if (!owner || !owner.password_hash) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 401 })
    }
    const ok = verifyPasswordHash(password, owner.password_hash)
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'bad_credentials' }, { status: 401 })
    }

    const res = redirectTo(base, locale, next)
    setSessionCookieOnResponse(res, {
      ownerId: owner.id,
      email: owner.email,
      displayName: owner.display_name ?? null,
      iat: Math.floor(Date.now() / 1000),
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: String(e?.message || e) }, { status: 500 })
  }
}
