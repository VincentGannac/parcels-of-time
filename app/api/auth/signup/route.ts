// app/api/auth/signup/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  createOwnerWithPassword,
  findOwnerByEmailWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'
import { pool } from '@/lib/db'

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}
function isValidUsername(u: string) {
  return /^[a-zA-Z0-9._-]{3,20}$/.test(u)
}

export async function POST(req: Request) {
  try {
    const { email, password, display_name } = await req.json()
    const username = String(display_name || '').trim()

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    if (!isValidEmail(String(email))) {
      return NextResponse.json({ error: 'bad_email' }, { status: 400 })
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'weak_password' }, { status: 400 })
    }
    if (!isValidUsername(username)) {
      return NextResponse.json({ error: 'bad_username' }, { status: 400 })
    }

    // E-mail déjà pris ?
    const existing = await findOwnerByEmailWithPassword(email)
    if (existing?.password_hash) {
      return NextResponse.json({ error: 'email_taken' }, { status: 409 })
    }

    // Pseudo déjà pris ? (case-insensitive)
    const chk = await pool.query(
         `select 1 from owners where lower(username) = lower($1) limit 1`,
         [username],
    )
    if (chk.rows.length) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }

    // Création (gère collision DB via 23505)
    let rec
    try {
      rec = await createOwnerWithPassword(String(email), String(password), username)
    } catch (e: any) {
      if (e?.code === '23505') {
        return NextResponse.json({ error: 'username_taken' }, { status: 409 })
      }
      console.error('[signup] db error:', e)
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    const hostname = new URL(req.url).hostname
    const res = NextResponse.json({ ok: 1, ownerId: rec.id })
    setSessionCookieOnResponse(res, {
    ownerId: String(rec.id),
    email: String(rec.email),
    displayName: rec.username,    // 👈 désormais le pseudo
    iat: Math.floor(Date.now() / 1000),
    }, undefined, hostname)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    console.error('[signup] error:', e?.message || e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
