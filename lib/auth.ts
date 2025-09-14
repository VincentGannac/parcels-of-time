// lib/auth.ts
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'pot_sess'
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

export type Session = {
  ownerId: string
  email: string
  displayName?: string | null
  iat: number
}

function b64u(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
function sign(input: string) {
  return b64u(crypto.createHmac('sha256', SECRET).update(input).digest())
}
export function encodeSessionForCookie(sess: Session): string {
  const payload = Buffer.from(JSON.stringify(sess)).toString('base64')
  const sig = sign(payload)
  return `${payload}.${sig}`
}

/** Détermine le domain à utiliser pour un host donné. Ne met rien en local/préprod. */
function cookieDomainForHost(host?: string | null): string | undefined {
  if (!host) return undefined
  const h = host.split(':')[0].toLowerCase()
  // Jamais de domain= en local / IP / preview vercel
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.endsWith('.vercel.app')) return undefined
  // Prod : apex + www -> on force sur l'apex pour couvrir www et apex
  if (h === 'parcelsoftime.com' || h === 'www.parcelsoftime.com') return 'parcelsoftime.com'
  return undefined
}

export function setSessionCookieOnResponse(res: NextResponse, sess: Session, hostFromReq?: string) {
  const domain = cookieDomainForHost(hostFromReq)
  res.cookies.set(COOKIE_NAME, encodeSessionForCookie(sess), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
    ...(domain ? { domain } : {}),
  })
}

/** Efface le cookie de session sur une réponse NextResponse */
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

function b64anyToUtf8(s: string): string {
  // Accepte base64url ( - _ ) et base64 classique ( + / ), rajoute le padding
  let t = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = t.length % 4
  if (pad) t += '='.repeat(4 - pad)
  return Buffer.from(t, 'base64').toString('utf8')
}

export async function readSession(): Promise<Session | null> {
  let raw = (await nextCookies()).get(COOKIE_NAME)?.value
  if (!raw) return null

  // Certains environnements percent-encodent les '=' du base64 → on tente de décoder
  try { raw = decodeURIComponent(raw) } catch { /* no-op */ }

  const [p, s] = raw.split('.')
  if (!p || !s) return null

  // La signature est calculée sur la *chaîne* payload telle qu’elle est stockée dans le cookie
  if (sign(p) !== s) return null

  try {
    const json = b64anyToUtf8(p)
    const data = JSON.parse(json) as Session
    return data && typeof data.ownerId === 'string' ? data : null
  } catch {
    return null
  }
}


/** Variante "server-only" (pas utilisée dans les routes API) */
export async function writeSessionCookie(sess: Session) {
  const domain = cookieDomainForHost((await nextHeaders()).get('host'))
  const payload = Buffer.from(JSON.stringify(sess)).toString('base64')
  const sig = sign(payload)
  ;(await nextCookies()).set(COOKIE_NAME, `${payload}.${sig}`, {
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

/** Redirige vers /:locale/login si pas connecté (utilisé côté pages) */
export async function redirectToLogin(nextPath?: string) {
  const h = await nextHeaders()
  const pathname = nextPath || (h.get('x-pathname') || '/')
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr'|'en') || 'en'
  return `/${locale}/login?next=${encodeURIComponent(pathname)}`
}

/** Ownership par jour (jour UTC) */
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

/* ==== Password helpers + auth (inchangé) ==== */
export async function hashPassword(plain: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(plain, saltRounds)
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
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
