// lib/auth.ts
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

const COOKIE_NAME = 'pot_sess'
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

export type Session = {
  ownerId: string
  email: string
  displayName?: string | null
  iat: number
}

/* ============ base64 helpers ============ */
function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'')
}
function toB64(s: string) {
  // base64url -> base64, avec padding
  let t = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = t.length % 4
  if (pad) t += '='.repeat(4 - pad)
  return t
}
function b64anyToUtf8(s: string): string {
  // accepte base64url OU base64
  const std = /[-_]/.test(s) ? toB64(s) : s
  return Buffer.from(std, 'base64').toString('utf8')
}

/* ============ HMAC ============ */
function sign(input: string) {
  return b64url(crypto.createHmac('sha256', SECRET).update(input).digest())
}

/* ============ Cookie domain ============ */
function cookieDomainForHost(host?: string | null): string | undefined {
  if (!host) return undefined
  const h = host.split(':')[0].toLowerCase()
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.endsWith('.vercel.app')) return undefined
  if (h === 'parcelsoftime.com' || h === 'www.parcelsoftime.com') return 'parcelsoftime.com'
  return undefined
}

/* ============ Encoder / Set / Clear ============ */
export function encodeSessionForCookie(sess: Session): string {
  // Utilise un payload en base64url (pour éviter les '=', '+', '/')
  const payload = b64url(Buffer.from(JSON.stringify(sess)))
  const sig = sign(payload)
  return `${payload}.${sig}`
}

export function setSessionCookieOnResponse(res: NextResponse, sess: Session, hostFromReq?: string) {
  const domain = cookieDomainForHost(hostFromReq)
  res.cookies.set(COOKIE_NAME, encodeSessionForCookie(sess), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    ...(domain ? { domain } : {}),
  })
}

export function clearSessionCookieOnResponse(res: NextResponse, hostFromReq?: string) {
  const domain = cookieDomainForHost(hostFromReq)
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(domain ? { domain } : {}),
  })
}

/* ============ Lecture robuste ============ */
function parseCookieHeader(rawHeader: string | null | undefined, name: string): string | undefined {
  if (!rawHeader) return undefined
  // parse à la main (pas de lib)
  const parts = rawHeader.split(/;\s*/)
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx === -1) continue
    const k = p.slice(0, idx).trim()
    if (k !== name) continue
    // ne PAS decodeURIComponent ici : certains clients laissent le payload en base64url pur
    return p.slice(idx + 1)
  }
  return undefined
}

export async function readSession(): Promise<Session | null> {
    // 1) source principale
    let raw = (await nextCookies()).get(COOKIE_NAME)?.value

    // 1.bis) si middleware a injecté l’en-tête interne, on le privilégie (fiable en App Router)
    if (!raw) {
      const xSess = (await nextHeaders()).get('x-pot-sess')
      if (xSess) raw = xSess
    }
  
    // 2) fallback depuis l’en-tête Cookie brut
    if (!raw) {
      const headerCookie = (await nextHeaders()).get('cookie') || (await nextHeaders()).get('Cookie')
      raw = parseCookieHeader(headerCookie, COOKIE_NAME)
    }
  if (!raw) return null
  // Tolère des encodages : parfois '=' sont %3D, parfois rien. On essaye sans, puis avec.
  let payload = ''
  let sig = ''
  {
    const dot = raw.indexOf('.')
    if (dot <= 0) return null
    payload = raw.slice(0, dot)
    sig = raw.slice(dot + 1)
  }

  // Si la signature ne matche pas au premier coup, essaye de décoder un éventuel %xx
  let sigOk = (sign(payload) === sig)
  if (!sigOk) {
    try {
      const maybeDecoded = decodeURIComponent(raw)
      const dot2 = maybeDecoded.indexOf('.')
      if (dot2 > 0) {
        const p2 = maybeDecoded.slice(0, dot2)
        const s2 = maybeDecoded.slice(dot2 + 1)
        if (sign(p2) === s2) {
          payload = p2
          sig = s2
          sigOk = true
        }
      }
    } catch {}
  }
  if (!sigOk) return null

  try {
    const json = b64anyToUtf8(payload)
    const data = JSON.parse(json) as Session
    return data && typeof data.ownerId === 'string' ? data : null
  } catch {
    return null
  }
}

/* ============ Helpers “server-only” ============ */
export async function writeSessionCookie(sess: Session) {
  const domain = cookieDomainForHost((await nextHeaders()).get('host'))
  const value = encodeSessionForCookie(sess)
  ;(await nextCookies()).set(COOKIE_NAME, value, {
    httpOnly: true, secure: true, sameSite: 'lax',
    path: '/', maxAge: 60 * 60 * 24 * 30,
    ...(domain ? { domain } : {}),
  })
}
export async function clearSessionCookie() {
  const domain = cookieDomainForHost((await nextHeaders()).get('host'))
  ;(await nextCookies()).set(COOKIE_NAME, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
    ...(domain ? { domain } : {}),
  })
}

/* ============ Redirect helper ============ */
export async function redirectToLogin(nextPath?: string) {
  const h = await nextHeaders()
  const pathname = nextPath || (h.get('x-pathname') || '/')
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr'|'en') || 'en'
  return `/${locale}/login?next=${encodeURIComponent(pathname)}`
}

/* ============ DB ============ */
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

/* ============ Password & auth ============ */
export async function hashPassword(plain: string) { return bcrypt.hash(plain, 12) }
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

/* ============ DEBUG (sans rien exposer de sensible) ============ */
export async function debugSessionSnapshot() {
  const h = await nextHeaders()
  const ck = await nextCookies()
  const host = h.get('host') || ''
  const xfh  = h.get('x-forwarded-host') || ''
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  const path  = h.get('x-pathname') || 'N/A'
  // brut
  const rawFromStore = ck.get(COOKIE_NAME)?.value
  const rawFromHeader = parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME)
  const raw = rawFromStore ?? rawFromHeader ?? ''
  let payload = '', sig = '', sigOk = false, parseOk = false, reason = ''
  if (raw) {
    const dot = raw.indexOf('.')
    if (dot > 0) { payload = raw.slice(0, dot); sig = raw.slice(dot + 1) }
    try {
      sigOk = (sign(payload) === sig) || (()=>{
        try {
          const dec = decodeURIComponent(raw)
          const d2 = dec.indexOf('.'); if (d2 <= 0) return false
          return sign(dec.slice(0, d2)) === dec.slice(d2 + 1)
        } catch { return false }
      })()
      const j = b64anyToUtf8(payload)
      JSON.parse(j)
      parseOk = true
    } catch (e: any) { reason = String(e?.message || e) }
  } else {
    reason = 'cookie_absent'
  }
  return {
    host, xfh, proto, path,
    cookiePresent: !!raw,
    rawLen: raw.length,
    payloadStart: payload.slice(0, 10),
    payloadEnd: payload.slice(-6),
    sigStart: sig.slice(0, 6),
    sigEnd: sig.slice(-6),
    sigOk, parseOk, reason,
  }
}
