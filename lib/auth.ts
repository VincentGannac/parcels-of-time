// lib/auth.ts
// Next.js 15 – headers() / cookies() sont asynchrones.

export const runtime = 'nodejs'

import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import type { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

/* ============================
 *  Config cookie + secret
 * ============================ */
export const COOKIE_NAME = 'pot_sess' as const                 // un seul cookie
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30                        // 30 jours


const SECRET = process.env.SESSION_SECRET || process.env.SECRET_SALT || 'dev_salt'

/* ============================
 *  Types
 * ============================ */
export type Session = {
  ownerId: string
  email: string
  displayName?: string | null
  iat: number
}

/* ============================
 *  Helpers base64url + HMAC
 * ============================ */
function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function toStd(b64urlStr: string) {
  let t = b64urlStr.replace(/-/g, '+').replace(/_/g, '/')
  const pad = t.length % 4
  if (pad) t += '='.repeat(4 - pad)
  return t
}
function b64anyToUtf8(s: string): string {
  const std = /[-_]/.test(s) ? toStd(s) : s
  return Buffer.from(std, 'base64').toString('utf8')
}
function sign(payload: string) {
  return b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())
}

/* ============================
 *  Encode / Decode session
 * ============================ */
export function encodeSessionForCookie(sess: Session): string {
  const payload = b64url(Buffer.from(JSON.stringify(sess)))
  const sig = sign(payload)
  return `${payload}.${sig}`
}

function parseCookieHeader(rawHeader: string | null | undefined, name: string): string | undefined {
  if (!rawHeader) return undefined
  const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  const m = re.exec(rawHeader)
  return m ? m[1] : undefined
}

/* ============================
 *  Lecture session (cookies() puis headers())
 * ============================ */
export async function readSession(): Promise<Session | null> {
  // 1) magasin de cookies
  try {
    const ck = await cookies()
    const val = ck.get(COOKIE_NAME)?.value
    if (val) {
      const dot = val.indexOf('.')
      if (dot > 0) {
        const payload = val.slice(0, dot)
        const sig = val.slice(dot + 1)
        if (sign(payload) === sig) {
          const json = b64anyToUtf8(payload)
          const data = JSON.parse(json) as any
          const now = Math.floor(Date.now()/1000)
          const hasIat = typeof data?.iat === 'number' && data.iat > now - 60*60*24*35 // 35j
          const hasExp = typeof data?.exp === 'number' && data.exp > now
          if (data && typeof data.ownerId === 'string' && (hasIat || hasExp)) {
            return data as Session
          }
        }
      }
    }
  } catch {}

  // 2) fallback: header Cookie
  try {
    const h = await headers()
    const raw = h.get('cookie') || h.get('Cookie') || ''
    const val = parseCookieHeader(raw, COOKIE_NAME)
    if (val) {
      const dot = val.indexOf('.')
      if (dot > 0) {
        const payload = val.slice(0, dot)
        const sig = val.slice(dot + 1)
        if (sign(payload) === sig) {
          const json = b64anyToUtf8(payload)
          const data = JSON.parse(json) as Session
          if (data && typeof data.ownerId === 'string') return data
        }
      }
    }
  } catch {}

  return null
}

/* ============================
 *  Helpers écriture/clear côté RSC (cookies())
 *  (Les routes API peuvent aussi utiliser les variantes *OnResponse)
 * ============================ */
export async function writeSessionCookie(sess: Session) {
  try {
    const ck = await cookies()
    ck.set(COOKIE_NAME, encodeSessionForCookie(sess), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      // pas de domain ici (host-only) — utile côté RSC
    })
  } catch {}
}

export async function clearSessionCookie() {
  try {
    const ck = await cookies()
    ck.set(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  } catch {}
}

/* ============================
 *  Helpers écriture/clear sur une NextResponse
 * ============================ */
export function setSessionCookieOnResponse(res: NextResponse, sess: Session) {
  res.cookies.set(COOKIE_NAME, encodeSessionForCookie(sess), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: COOKIE_DOMAIN,   // couvre apex + www
    maxAge: COOKIE_MAX_AGE,
  })
}

export function clearSessionCookieOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: 0,
  })
}

/* ============================
 *  Redirection pratique vers /login
 * ============================ */
export async function redirectToLogin(nextPath?: string) {
  const h = await headers()
  const pathname = nextPath || (h.get('x-pathname') || '/')
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr' | 'en') || 'en'
  return `/${locale}/login?next=${encodeURIComponent(pathname)}`
}

/* ============================
 *  Auth DB (email + mot de passe)
 * ============================ */
export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12)
}
export async function verifyPassword(plain: string, hash: string) {
  try { return await bcrypt.compare(plain, hash) } catch { return false }
}

export async function createOwnerWithPassword(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase()
  const pwHash = await hashPassword(password)

  const { rows: existing } = await pool.query(
    `select id, email, display_name, password_hash
       from owners
      where lower(email)=lower($1)
      limit 1`,
    [email]
  )

  if (existing.length) {
    const row = existing[0]
    if (row.password_hash) {
      return { id: row.id, email: row.email, display_name: row.display_name }
    }
    const { rows } = await pool.query(
      `update owners
          set password_hash = $2
        where id = $1
      returning id, email, display_name`,
      [row.id, pwHash]
    )
    return rows[0]
  }

  const { rows } = await pool.query(
    `insert into owners (email, password_hash)
     values ($1, $2)
     returning id, email, display_name`,
    [email, pwHash]
  )
  return rows[0]
}

export async function authenticateWithPassword(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase()
  const { rows } = await pool.query(
    `select id, email, display_name, password_hash
       from owners
      where lower(email)=lower($1)
      limit 1`,
    [email]
  )
  if (!rows.length) return null
  const row = rows[0]
  if (!row.password_hash) return null
  const ok = await verifyPassword(password, row.password_hash)
  return ok ? { id: row.id, email: row.email, display_name: row.display_name } : null
}

/* ============================
 *  Optionnel — lookup propriétaire d'une journée
 * ============================ */
export async function ownerIdForDay(ts: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `select owner_id from claims where ts = $1 limit 1`,
      [ts]
    )
    return rows[0]?.owner_id ?? null
  } catch {
    return null
  }
}

/* ============================
 *  Debug — affiché dans /login?debug=1 ou /api/_diag
 * ============================ */
export async function debugSessionSnapshot() {
  const h = await headers()
  const ck = await cookies()

  const rawFromStore = ck.get(COOKIE_NAME)?.value
  const rawFromHeader = parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME)
  const raw = rawFromStore ?? rawFromHeader ?? ''

  let payload = ''
  let sig = ''
  let sigOk = false
  let parseOk = false
  let reason = ''

  if (raw) {
    const dot = raw.indexOf('.')
    if (dot > 0) {
      payload = raw.slice(0, dot)
      sig = raw.slice(dot + 1)
      try {
        sigOk = sign(payload) === sig
        const j = b64anyToUtf8(payload)
        JSON.parse(j)
        parseOk = true
      } catch (e: any) {
        reason = String(e?.message || e)
      }
    } else {
      reason = 'malformed_cookie'
    }
  } else {
    reason = 'cookie_absent'
  }

  return {
    host: h.get('host') || '',
    xfh: h.get('x-forwarded-host') || '',
    proto: h.get('x-forwarded-proto') || '',
    cookiePresent: !!raw,
    rawLen: raw.length,
    payloadStart: payload.slice(0, 10),
    payloadEnd: payload.slice(-6),
    sigStart: sig.slice(0, 6),
    sigEnd: sig.slice(-6),
    sigOk,
    parseOk,
    reason,
  }
}
