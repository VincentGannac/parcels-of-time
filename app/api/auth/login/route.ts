// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  verifyPassword,
  findOwnerByEmailWithPassword,
  verifyLoginToken,
  upsertOwnerByEmail,
  setSessionCookieOnResponse,
} from '@/lib/auth'

// POST JSON { email, password }
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'missing_credentials' }, { status: 400 })
    }
    const rec = await findOwnerByEmailWithPassword(String(email))
    if (!rec || !rec.password_hash) {
      // pas de compte password -> 404 (ou inviter à s'inscrire)
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

// GET /api/auth/login?token=...  (optionnel: magic link)
export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''
  const locale = (url.pathname.split('/').find(Boolean) || 'en').startsWith('fr') ? 'fr' : 'en'
  const next = url.searchParams.get('next') || `/${locale}/account`

  const p = verifyLoginToken(token)
  if (!p) {
    return NextResponse.redirect(`${base}/${locale}/login?err=bad_token`, { status: 302 })
  }
  // Crée/MAJ l'owner si besoin (magic-link sans mot de passe)
  const ownerId = await upsertOwnerByEmail(p.email, p.displayName ?? null)
  const res = NextResponse.redirect(`${base}${next}`, { status: 302 })
  setSessionCookieOnResponse(res, {
    ownerId: String(ownerId),
    email: p.email,
    displayName: p.displayName ?? null,
    iat: Math.floor(Date.now() / 1000),
  })
  return res
}
