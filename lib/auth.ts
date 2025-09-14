// lib/auth.ts
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'

const COOKIE = 'pot_sess'
const SECRET = process.env.SECRET_SESSION || process.env.SECRET_SALT || 'dev_salt'

export type Session = { email: string; iat: number; exp: number }

function b64(data: string | Buffer) { return Buffer.from(data).toString('base64url') }
function ub64(data: string) { return Buffer.from(data, 'base64url').toString() }

function sign(payload: object) {
  const body = b64(JSON.stringify(payload))
  const sig  = b64(crypto.createHmac('sha256', SECRET).update(body).digest())
  return `${body}.${sig}`
}
function verify(token: string): Session | null {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const expSig = b64(crypto.createHmac('sha256', SECRET).update(body).digest())
  if (sig !== expSig) return null
  const sess = JSON.parse(ub64(body))
  if (!sess?.exp || Date.now()/1000 > sess.exp) return null
  return sess
}

export async function getSession(): Promise<Session|null> {
  const jar = await cookies()
  const raw = jar.get(COOKIE)?.value
  if (!raw) return null
  try { return verify(raw) } catch { return null }
}

export async function setSession(email: string, days = 30) {
  const iat = Math.floor(Date.now()/1000)
  const exp = iat + days*86400
  const token = sign({ email: email.toLowerCase(), iat, exp })
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: days*86400,
  })
}

export async function clearSession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/** Lecture dans un handler API (depuis l’entête Cookie) */
export function getSessionFromRequest(req: Request): Session | null {
  const cookie = req.headers.get('cookie') || ''
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(cookie)
  if (!m) return null
  try { return verify(decodeURIComponent(m[1])) } catch { return null }
}

/** Retourne l’email propriétaire d’un jour (ou null) */
export async function ownerEmailForDay(tsISO: string): Promise<string|null> {
  const { rows } = await pool.query(
    `select lower(o.email) as email
       from claims c join owners o on o.id = c.owner_id
      where date_trunc('day', c.ts) = $1::timestamptz
      limit 1`,
    [tsISO]
  )
  return rows[0]?.email || null
}
