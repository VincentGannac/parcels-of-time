// app/api/auth/signup/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  createOwnerWithPassword,
  findOwnerByEmailWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export async function POST(req: Request) {
  try {
    const { email, password, display_name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    if (!isValidEmail(String(email))) {
      return NextResponse.json({ error: 'bad_email' }, { status: 400 })
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'weak_password' }, { status: 400 })
    }

    const existing = await findOwnerByEmailWithPassword(email)
    if (existing?.password_hash) {
      return NextResponse.json({ error: 'email_taken' }, { status: 409 })
    }

    const rec = await createOwnerWithPassword(String(email), String(password), display_name || null)

    const res = NextResponse.json({ ok: 1, ownerId: rec.id })
    setSessionCookieOnResponse(
      res,
      {
        ownerId: String(rec.id),
        email: String(rec.email),
        displayName: rec.display_name,
        iat: Math.floor(Date.now() / 1000),
      },
      /* ttl */ undefined,
      /* host */ new URL(req.url).hostname,   // ✅ important
    )
    res.headers.set('Cache-Control', 'no-store') // optionnel mais conseillé
    return res
    
  } catch (e: any) {
    console.error('[signup] error:', e?.message || e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
