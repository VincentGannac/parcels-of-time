// app/api/auth/signup/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  createOwnerWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function pickLocale(h: Headers) {
  const acc = (h.get('accept-language') || '').toLowerCase()
  return acc.startsWith('fr') ? 'fr' : 'en'
}

export async function POST(req: Request) {
  const base = new URL(req.url).origin
  const locale = pickLocale(req.headers)
  try {
    const body = await req.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const displayName = body?.display_name ? String(body.display_name) : null
    const next = typeof body?.next === 'string' ? body.next : null

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
    }

    const ownerId = await createOwnerWithPassword(email, password, displayName)
    const res = NextResponse.redirect(new URL(next && /^\/(fr|en)\//.test(next) ? next : `/${locale}/account`, base), { status: 303 })
    setSessionCookieOnResponse(res, {
      ownerId,
      email,
      displayName,
      iat: Math.floor(Date.now() / 1000),
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: String(e?.message || e) }, { status: 500 })
  }
}
