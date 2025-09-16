// lib/auth.ts
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

/**
 * Cookie unique côté app
 * - un seul nom: pot_sess
 * - Secure + HttpOnly + SameSite=Lax
 * - Domain: .parcelsoftime.com uniquement quand l'hôte courant correspond, sinon host-only (utile en dev)
 */
export const COOKIE_NAME = 'pot_sess'
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

export type Session = {
  ownerId: string
  email: string
  displayName?: string | null
  iat: number // issued-at (unix seconds)
}

/* ---------------- Base64 + signature ---------------- */
function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'')
}
function toStdB64(s: string) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = t.length % 4
  if (pad) t += '='.repeat(4 - pad)
  return t
}
function b64anyToUtf8(s: string): string {
  const std = /[-_]/.test(s) ? toStdB64(s) : s
  return Buffer.from(std, 'base64').toString('utf8')
}
function sign(payload: string) {
  return b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())
}

export function encodeSessionForCookie(sess: Session): string {
  const payload = b64url(Buffer.from(JSON.stringify(sess)))
  const sig = sign(payload)
  return `${payload}.${sig}`
}

/* ---------------- Cookie helpers (lecture robuste) ---------------- */

/** Retourne la dernière occurrence d'un cookie dans un header Cookie potentiellement dupliqué */
function getCookieFromHeaderLast(raw: string | null | undefined, name: string): string | undefined {
  if (!raw) return undefined
  const parts = raw.split(/;\s*/).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    const idx = parts[i].indexOf('=')
    if (idx < 0) continue
    const k = parts[i].slice(0, idx).trim()
    if (k === name) return parts[i].slice(idx + 1)
  }
  return undefined
}

/** Essaie store cookies(), puis header Cookie (dernière occurrence) */
async function readRawCookie(): Promise<string | null> {
  // 1) store
  try {
    const ck: any = cookies()
    const entry: any = ck?.get?.(COOKIE_NAME)
    if (entry) {
      if (typeof entry === 'string') return entry
      if (typeof entry?.value === 'string') return entry.value
    }
  } catch {}
  // 2) header (robuste)
  try {
    const h = await headers()
    const raw = h.get('cookie') || h.get('Cookie') || ''
    const val = getCookieFromHeaderLast(raw, COOKIE_NAME)
    if (val) return val
  } catch {}
  return null
}

/** Détermine le domain à utiliser pour le cookie (prod .parcelsoftime.com, sinon host-only) */
async function computeCookieDomain(): Promise<string | undefined> {
  try {
    const h = await headers()
    const host = (h.get('host') || '').toLowerCase()
    if (host.endsWith('.parcelsoftime.com') || host === 'parcelsoftime.com') return '.parcelsoftime.com'
  } catch {}
  return undefined // host-only (dev/staging hors domaine)
}

/* ---------------- API publique: lecture/écriture de session ---------------- */

export async function readSession(): Promise<Session | null> {
  const raw = await readRawCookie()
  if (!raw) return null

  const dot = raw.indexOf('.')
  if (dot <= 0) return null

  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)

  if (sign(payload) !== sig) return null

  try {
    const j = b64anyToUtf8(payload)
    const data = JSON.parse(j) as Session
    return data && typeof data.ownerId === 'string' ? data : null
  } catch {
    return null
  }
}

/** Pose le cookie de session sur une réponse NextResponse */
export async function setSessionCookieOnResponse(res: NextResponse, sess: Session) {
  const val = encodeSessionForCookie(sess)
  const domain = await computeCookieDomain()
  res.cookies.set(COOKIE_NAME, val, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain,                     // undefined en dev → host-only
    maxAge: 60 * 60 * 24 * 30,  // 30 jours
  })
}

/** Efface le cookie de session sur une réponse NextResponse */
export async function clearSessionCookieOnResponse(res: NextResponse) {
  const domain = await computeCookieDomain()
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: 0,
  })
}

/** Variante écriture via cookies() (utile depuis une RSC/route sans NextResponse) */
export async function writeSessionCookie(sess: Session) {
  try {
    const val = encodeSessionForCookie(sess)
    const domain = await computeCookieDomain()
    const ck: any = cookies()
    ck.set?.(COOKIE_NAME, val, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      domain,
      maxAge: 60 * 60 * 24 * 30,
    })
  } catch {}
}

export async function clearSessionCookie() {
  try {
    const domain = await computeCookieDomain()
    const ck: any = cookies()
    ck.set?.(COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      domain,
      maxAge: 0,
    })
  } catch {}
}

/* ---------------- Redirection pratique ---------------- */

export async function redirectToLogin(nextPath?: string) {
  const h = await headers()
  const pathname = nextPath || (h.get('x-pathname') || '/')
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr' | 'en') || 'en'
  return `/${locale}/login?next=${encodeURIComponent(pathname)}`
}

/* ---------------- Auth DB (email + mot de passe) ---------------- */

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12)
}

export async function verifyPassword(plain: string, hash: string) {
  try { return await bcrypt.compare(plain, hash) } catch { return false }
}

export async function createOwnerWithPassword(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase()
  const pwHash = await hashPassword(password)

  // Existe déjà ?
  const { rows: existing } = await pool.query(
    `select id, email, display_name, password_hash
       from owners
      where lower(email) = lower($1)
      limit 1`,
    [email],
  )

  if (existing.length) {
    const row = existing[0]
    // Si déjà un hash, on retourne simplement l'utilisateur
    if (row.password_hash) return { id: row.id, email: row.email, display_name: row.display_name }
    // Sinon on initialise le hash
    const { rows } = await pool.query(
      `update owners
          set password_hash = $2
        where id = $1
      returning id, email, display_name`,
      [row.id, pwHash],
    )
    return rows[0]
  }

  // Création
  const { rows } = await pool.query(
    `insert into owners (email, password_hash)
     values ($1, $2)
     returning id, email, display_name`,
    [email, pwHash],
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
    [email],
  )
  if (!rows.length) return null
  const row = rows[0]
  if (!row.password_hash) return null
  const ok = await verifyPassword(password, row.password_hash)
  return ok ? { id: row.id, email: row.email, display_name: row.display_name } : null
}

/* ---------------- Debug (affiché dans /login?debug=1) ---------------- */

export async function debugSessionSnapshot() {
  const h = await headers()
  const ckStore: any = cookies()
  const storeVal: any = ckStore?.get?.(COOKIE_NAME)
  const rawFromStore =
    (typeof storeVal === 'string' ? storeVal : storeVal?.value) || ''

  const rawFromHeader =
    getCookieFromHeaderLast(h.get('cookie') || h.get('Cookie'), COOKIE_NAME) || ''

  const raw = rawFromStore || rawFromHeader
  let payload = '', sig = '', sigOk = false, parseOk = false, reason = ''
  if (raw) {
    const dot = raw.indexOf('.')
    if (dot > 0) { payload = raw.slice(0, dot); sig = raw.slice(dot + 1) }
    try {
      sigOk = (sign(payload) === sig)
      const j = b64anyToUtf8(payload)
      JSON.parse(j)
      parseOk = true
    } catch (e: any) {
      reason = String(e?.message || e)
    }
  } else {
    reason = 'cookie_absent'
  }

  return {
    host: h.get('host') || '',
    xfh:  h.get('x-forwarded-host') || '',
    proto: h.get('x-forwarded-proto') || '',
    cookiePresent: !!raw,
    rawLen: raw.length,
    payloadStart: payload.slice(0, 10),
    payloadEnd: payload.slice(-6),
    sigStart: sig.slice(0, 6),
    sigEnd: sig.slice(-6),
    sigOk, parseOk, reason,
  }
}

/* ---------------- Optionnel: util pour pages /m/[ts] ---------------- */
/** Renvoie l'ownerId si le jour est déjà revendiqué (silencieusement null si la table n'existe pas) */
export async function ownerIdForDay(ts: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `select owner_id from claims where ts = $1 limit 1`,
      [ts],
    )
    return rows[0]?.owner_id ?? null
  } catch {
    return null
  }
}
