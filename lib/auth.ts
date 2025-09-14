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

export function setSessionCookieOnResponse(res: NextResponse, sess: Session) {
  res.cookies.set(COOKIE_NAME, encodeSessionForCookie(sess), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  })
}

/** Efface le cookie de session sur une réponse NextResponse */
export function clearSessionCookieOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function readSession(): Promise<Session | null> {
  const c = (await nextCookies()).get(COOKIE_NAME)?.value
  if (!c) return null
  const [p, s] = c.split('.')
  if (!p || !s) return null
  if (sign(p) !== s) return null
  try {
    const json = Buffer.from(p, 'base64').toString('utf8')
    const data = JSON.parse(json) as Session
    return data && typeof data.ownerId === 'string' ? data : null
  } catch { return null }
}

export async function writeSessionCookie(sess: Session) {
  const payload = Buffer.from(JSON.stringify(sess)).toString('base64')
  const sig = sign(payload)
  ;(await nextCookies()).set(COOKIE_NAME, `${payload}.${sig}`, {
    httpOnly: true, secure: true, sameSite: 'lax',
    path: '/', maxAge: 60 * 60 * 24 * 30, // 30 jours
  })
}

export async function clearSessionCookie() {
  ;(await nextCookies()).set(COOKIE_NAME, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0
  })
}

/** Redirige vers /:locale/login si pas connecté */
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

/* ===================== Password helpers ===================== */

export async function hashPassword(plain: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(plain, saltRounds)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try { return await bcrypt.compare(plain, hash) }
  catch { return false }
}

/** Crée un owner avec mot de passe (ou initialise un mdp pour un owner existant “magic link”) */
export async function createOwnerWithPassword(emailRaw: string, password: string): Promise<{ id: string; email: string; display_name: string | null }> {
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
    if (row.password_hash) {
      // Déjà un compte password
      return { id: row.id, email: row.email, display_name: row.display_name }
    }
    // Compte existant sans mdp (ancien “magic link”) → on définit le mdp
    const { rows } = await pool.query(
      `update owners set password_hash = $2 where id = $1
       returning id, email, display_name`,
      [row.id, pwHash]
    )
    return rows[0]
  }

  // Nouveau compte
  const { rows } = await pool.query(
    `insert into owners (email, password_hash)
     values ($1, $2)
     returning id, email, display_name`,
    [email, pwHash]
  )
  return rows[0]
}

/** Authentifie un owner via email+password */
export async function authenticateWithPassword(emailRaw: string, password: string): Promise<{ id: string; email: string; display_name: string | null } | null> {
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
