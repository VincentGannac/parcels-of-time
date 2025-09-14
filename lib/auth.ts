// lib/auth.ts
import { cookies } from 'next/headers'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

const COOKIE_NAME = 'pot_sess'
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

export type Session = {
  ownerId: string // uuid
  email: string
  displayName?: string | null
  iat: number
}

function b64u(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function sign(input: string) {
  return b64u(crypto.createHmac('sha256', SECRET).update(input).digest())
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies()
  const c = jar.get(COOKIE_NAME)?.value
  if (!c) return null
  const [p, s] = c.split('.')
  if (!p || !s) return null
  const ok = sign(p) === s
  if (!ok) return null
  try {
    const json = Buffer.from(p, 'base64').toString('utf8')
    const data = JSON.parse(json) as Session
    return data && typeof data.ownerId === 'string' ? data : null
  } catch {
    return null
  }
}

export async function writeSessionCookie(sess: Session): Promise<void> {
  const payload = Buffer.from(JSON.stringify(sess)).toString('base64')
  const sig = sign(payload)
  const jar = await cookies()
  jar.set(COOKIE_NAME, `${payload}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30j
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
}

/** URL de redirection login suivant la locale déduite du chemin fourni */
export function redirectToLogin(nextPath?: string) {
  const pathname = nextPath || '/'
  const m = /^\/(fr|en)(\/|$)/.exec(pathname)
  const locale = (m?.[1] as 'fr' | 'en') || 'en'
  return `/${locale}/login?next=${encodeURIComponent(pathname)}`
}

/** Owner d’un jour (par jour, à minuit UTC) */
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

/** Upsert owner par email (lowercased) */
export async function upsertOwnerByEmail(
  emailRaw: string
): Promise<{ id: string; email: string; display_name: string | null }> {
  const email = emailRaw.trim().toLowerCase()
  const { rows } = await pool.query(
    `
      insert into owners (email)
      values ($1)
      on conflict (email) do update set email = excluded.email
      returning id, email, display_name
    `,
    [email]
  )
  return rows[0]
}
