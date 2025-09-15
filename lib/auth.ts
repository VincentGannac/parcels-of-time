import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

/** Deux cookies : host-only (__Host-...) + domain-wide (.parcelsoftime.com) */
export const COOKIE_NAME_MAIN = '__Host-pot_sess'
export const COOKIE_NAME_COMP = 'pot_sess'

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

export type Session = {
  ownerId: string
  email: string
  displayName?: string | null
  iat: number
}

/* ---------- utils signature / base64 ---------- */
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

/* ---------- encode / decode ---------- */
export function encodeSessionForCookie(sess: Session): string {
  const payload = b64url(Buffer.from(JSON.stringify(sess)))
  const sig = sign(payload)
  return `${payload}.${sig}`
}

/* ---------- cookies() helpers tolérants ---------- */
function getCookieFromStore(name: string): string | undefined {
  try {
    const ck: any = cookies()
    const entry: any = ck?.get?.(name)
    if (!entry) return undefined
    if (typeof entry === 'string') return entry
    if (typeof entry.value === 'string') return entry.value
  } catch {}
  return undefined
}
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
async function getCookieFromHeaders(name: string): Promise<string | undefined> {
  try {
    const h = await headers()
    const raw = h.get('cookie') || h.get('Cookie')
    return parseCookieHeader(raw, name)
  } catch { return undefined }
}

/* ---------- set / clear (pose les deux variantes) ---------- */
export function setSessionCookieOnResponse(res: NextResponse, sess: Session) {
  const val = encodeSessionForCookie(sess)

  // host-only, requis par le préfixe __Host-
  res.cookies.set(COOKIE_NAME_MAIN, val, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  // domain-wide, pour couvrir apex + sous-domaines
  res.cookies.set(COOKIE_NAME_COMP, val, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: '.parcelsoftime.com',
    maxAge: 60 * 60 * 24 * 7,
  })
}
export function clearSessionCookieOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE_NAME_MAIN, '', { httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge: 0 })
  res.cookies.set(COOKIE_NAME_COMP, '', { httpOnly:true, secure:true, sameSite:'lax', path:'/', domain: '.parcelsoftime.com', maxAge: 0 })
}

/* ---------- lecture / vérification ---------- */
async function readRawCookie(): Promise<string | null> {
  // 1) store
  const a = getCookieFromStore(COOKIE_NAME_MAIN) ?? getCookieFromStore(COOKIE_NAME_COMP)
  if (a) return a
  // 2) headers (fallback quand cookies() est vide)
  const b = (await getCookieFromHeaders(COOKIE_NAME_MAIN)) ?? (await getCookieFromHeaders(COOKIE_NAME_COMP))
  return b ?? null
}

export async function readSession(): Promise<Session | null> {
  const raw = await readRawCookie()
  if (!raw) return null

  const dot = raw.indexOf('.')
  if (dot <= 0) return null
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)

  if (sign(payload) !== sig) return null

  try {
    const json = b64anyToUtf8(payload)
    const data = JSON.parse(json) as Session
    return data && typeof data.ownerId === 'string' ? data : null
  } catch {
    return null
  }
}

/* ---------- helpers serveur (cookies() writer) ---------- */
export async function writeSessionCookie(sess: Session) {
  try {
    const ck: any = cookies()
    ck.set?.(COOKIE_NAME_MAIN, encodeSessionForCookie(sess), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*30,
    })
  } catch {}
}
export async function clearSessionCookie() {
  try {
    const ck: any = cookies()
    ck.set?.(COOKIE_NAME_MAIN, '', { httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge: 0 })
    ck.set?.(COOKIE_NAME_COMP, '', { httpOnly:true, secure:true, sameSite:'lax', path:'/', domain: '.parcelsoftime.com', maxAge: 0 })
  } catch {}
}

/* ---------- redirection pratique ---------- */
export async function redirectToLogin(nextPath?: string) {
  const h = await headers()
  const pathname = nextPath || (h.get('x-pathname') || '/')
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr'|'en') || 'en'
  return `/${locale}/login?next=${encodeURIComponent(pathname)}`
}

/* ---------- DB + auth ---------- */
export async function hashPassword(plain: string) { return bcrypt.hash(plain, 12) }
export async function verifyPassword(plain: string, hash: string) {
  try { return await bcrypt.compare(plain, hash) } catch { return false }
}
export async function createOwnerWithPassword(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase()
  const pwHash = await hashPassword(password)
  const { rows: existing } = await pool.query(
    `select id, email, display_name, password_hash from owners where lower(email)=lower($1) limit 1`,
    [email]
  )
  if (existing.length) {
    const row = existing[0]
    if (row.password_hash) return { id: row.id, email: row.email, display_name: row.display_name }
    const { rows } = await pool.query(
      `update owners set password_hash = $2 where id = $1 returning id, email, display_name`,
      [row.id, pwHash]
    )
    return rows[0]
  }
  const { rows } = await pool.query(
    `insert into owners (email, password_hash) values ($1, $2) returning id, email, display_name`,
    [email, pwHash]
  )
  return rows[0]
}

export async function authenticateWithPassword(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase()
  const { rows } = await pool.query(
    `select id, email, display_name, password_hash from owners where lower(email)=lower($1) limit 1`,
    [email]
  )
  if (!rows.length) return null
  const row = rows[0]
  if (!row.password_hash) return null
  const ok = await verifyPassword(password, row.password_hash)
  return ok ? { id: row.id, email: row.email, display_name: row.display_name } : null
}

/** ---- manquant pour app/[locale]/m/[ts]/page.tsx ----
 * Essaie de trouver l’owner d’un jour (ISO AAAA-MM-JJ).
 * Adapte la requête à ton schéma si besoin.
 */
export async function ownerIdForDay(isoDay: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      // ajuste la table/colonne selon ton schéma réel
      `select owner_id as "ownerId" from claims where ts_day = $1 limit 1`,
      [isoDay]
    )
    return rows?.[0]?.ownerId ?? null
  } catch {
    return null
  }
}

/* ---------- debug (affiché dans /login?debug=1) ---------- */
export async function debugSessionSnapshot() {
  const h = await headers()
  const ck: any = cookies()
  const rawFromStoreA: any = ck?.get?.(COOKIE_NAME_MAIN)
  const rawFromStoreB: any = ck?.get?.(COOKIE_NAME_COMP)

  const rawFromStore =
    (typeof rawFromStoreA === 'string' ? rawFromStoreA : rawFromStoreA?.value) ??
    (typeof rawFromStoreB === 'string' ? rawFromStoreB : rawFromStoreB?.value)

  const rawFromHeader =
    parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME_MAIN) ||
    parseCookieHeader(h.get('cookie') || h.get('Cookie'), COOKIE_NAME_COMP)

  const raw = rawFromStore ?? rawFromHeader ?? ''
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
