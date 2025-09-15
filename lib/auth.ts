// lib/auth.ts
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

/** Cookie principal + cookie de compat (temporaire). */
export const COOKIE_NAME_MAIN = '__Host-pot_sess'   // host-only (PAS de Domain)
export const COOKIE_NAME_COMP = 'pot_sess'          // compat: Domain=.parcelsoftime.com

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

export type Session = {
  ownerId: string
  email: string
  displayName?: string | null
  iat: number
}

/* ================= Base64 & HMAC ================= */

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'')
}
function toB64(s: string) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = t.length % 4
  if (pad) t += '='.repeat(4 - pad)
  return t
}
function b64anyToUtf8(s: string): string {
  const std = /[-_]/.test(s) ? toB64(s) : s
  return Buffer.from(std, 'base64').toString('utf8')
}
function sign(input: string) {
  return b64url(crypto.createHmac('sha256', SECRET).update(input).digest())
}

/* ================= Encodage session ================= */

export function encodeSessionForCookie(sess: Session): string {
  const payload = b64url(Buffer.from(JSON.stringify(sess)))
  const sig = sign(payload)
  return `${payload}.${sig}`
}

/* ================= Cookies (réponse) ================= */

export function setSessionCookieOnResponse(res: NextResponse, sess: Session) {
  const value = encodeSessionForCookie(sess)
  // Cookie principal host-only
  res.cookies.set(COOKIE_NAME_MAIN, value, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  })
  // Cookie compat (sur quelques jours), pour apex + www
  res.cookies.set(COOKIE_NAME_COMP, value, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
    domain: '.parcelsoftime.com',
  })
}

export function clearSessionCookieOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE_NAME_MAIN, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
  })
  res.cookies.set(COOKIE_NAME_COMP, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
    domain: '.parcelsoftime.com',
  })
}

/* ================= Cookies (store implicite) ================= */

export async function writeSessionCookie(sess: Session) {
  const ck = await cookies()
  const value = encodeSessionForCookie(sess)
  ck.set(COOKIE_NAME_MAIN, value, { httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge: 60 * 60 * 24 * 30 })
  ck.set(COOKIE_NAME_COMP, value, { httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge: 60 * 60 * 24 * 7, domain: '.parcelsoftime.com' })
}
export async function clearSessionCookie() {
  const ck = await cookies()
  ck.set(COOKIE_NAME_MAIN, '', { httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge: 0 })
  ck.set(COOKIE_NAME_COMP, '', { httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge: 0, domain: '.parcelsoftime.com' })
}

/* ================= Lecture cookie ================= */

function parseCookieHeader(rawHeader: string | null | undefined, name: string): string | undefined {
  if (!rawHeader) return undefined
  const parts = rawHeader.split(/;\s*/)
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx === -1) continue
    const k = p.slice(0, idx).trim()
    if (k !== name) continue
    return p.slice(idx + 1)
  }
  return undefined
}

export async function readSession(): Promise<Session | null> {
  const ck = await cookies()
  // Essaie l’officiel puis la compat
  let raw = ck.get(COOKIE_NAME_MAIN)?.value || ck.get(COOKIE_NAME_COMP)?.value

  if (!raw) {
    const h = await headers()
    raw =
      parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME_MAIN) ||
      parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME_COMP)
  }
  if (!raw) return null

  const dot = raw.indexOf('.'); if (dot <= 0) return null
  let payload = raw.slice(0, dot)
  let sig = raw.slice(dot + 1)

  let sigOk = (sign(payload) === sig)
  if (!sigOk) {
    try {
      const maybe = decodeURIComponent(raw)
      const d2 = maybe.indexOf('.')
      if (d2 > 0) {
        const p2 = maybe.slice(0, d2)
        const s2 = maybe.slice(d2 + 1)
        if (sign(p2) === s2) { payload = p2; sig = s2; sigOk = true }
      }
    } catch {}
  }
  if (!sigOk) return null

  try {
    const json = b64anyToUtf8(payload)
    const data = JSON.parse(json) as Session
    return data && typeof data.ownerId === 'string' ? data : null
  } catch { return null }
}

/* ================= Helpers “business” ================= */

export async function redirectToLogin(nextPath?: string) {
  const h = await headers()
  const pathname = nextPath || (h.get('x-pathname') || '/')
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr'|'en') || 'en'
  return `/${locale}/login?next=${encodeURIComponent(pathname)}`
}

export async function ownerIdForDay(tsISOorDay: string): Promise<string | null> {
  let ts = tsISOorDay
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) ts = `${ts}T00:00:00.000Z`
  const { rows } = await pool.query<{ owner_id: string }>(
    `select c.owner_id
       from claims c
      where date_trunc('day', c.ts) = $1::timestamptz
      limit 1`,
    [ts]
  )
  return rows[0]?.owner_id ?? null
}

/* ================= Password auth (bcrypt + Postgres) ================= */

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
      where lower(email) = lower($1)
      limit 1`,
    [email]
  )
  if (existing.length) {
    const row = existing[0]
    // si déjà un password, on considère que le compte existe
    if (row.password_hash) return { id: row.id, email: row.email, display_name: row.display_name }
    const { rows } = await pool.query(
      `update owners set password_hash = $2 where id = $1
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
      where lower(email) = lower($1)
      limit 1`,
    [email]
  )
  if (!rows.length) return null
  const row = rows[0]
  if (!row.password_hash) return null
  const ok = await verifyPassword(password, row.password_hash)
  return ok ? { id: row.id, email: row.email, display_name: row.display_name } : null
}

/* ================= DEBUG ================= */

export async function debugSessionSnapshot() {
  const h = await headers()
  const ck = await cookies()
  const host = h.get('host') || ''
  const xfh  = h.get('x-forwarded-host') || ''
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')

  const rawFromStoreMain = ck.get(COOKIE_NAME_MAIN)?.value
  const rawFromStoreComp = ck.get(COOKIE_NAME_COMP)?.value
  const rawFromHeaderMain = parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME_MAIN)
  const rawFromHeaderComp = parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME_COMP)

  const raw = rawFromStoreMain ?? rawFromHeaderMain ?? rawFromStoreComp ?? rawFromHeaderComp ?? ''
  let payload = '', sig = '', sigOk = false, parseOk = false, reason = ''
  if (raw) {
    const dot = raw.indexOf('.')
    if (dot > 0) { payload = raw.slice(0, dot); sig = raw.slice(dot + 1) }
    try {
      sigOk = (sign(payload) === sig)
      const j = b64anyToUtf8(payload)
      JSON.parse(j)
      parseOk = true
    } catch (e: any) { reason = String(e?.message || e) }
  } else {
    reason = 'cookie_absent'
  }
  return {
    host, xfh, proto,
    haveMainStore: !!rawFromStoreMain,
    haveMainHeader: !!rawFromHeaderMain,
    haveCompStore: !!rawFromStoreComp,
    haveCompHeader: !!rawFromHeaderComp,
    cookiePresent: !!raw,
    rawLen: raw.length,
    payloadStart: payload.slice(0, 10),
    payloadEnd: payload.slice(-6),
    sigStart: sig.slice(0, 6),
    sigEnd: sig.slice(-6),
    sigOk, parseOk, reason,
  }
}
