// lib/auth.ts
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.SECRET_SALT || 'dev_salt'

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function fromB64url(input: string) {
  input = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = input.length % 4 ? 4 - (input.length % 4) : 0
  return Buffer.from(input + '='.repeat(pad), 'base64').toString('utf8')
}

export type SessionPayload = { ownerId: string; email: string; displayName?: string | null; iat?: number; exp?: number }
function hmac(input: string) { return crypto.createHmac('sha256', AUTH_SECRET).update(input).digest('base64url') }
export function makeSignedCookieValue(payload: SessionPayload, ttlSec = 60 * 60 * 24 * 90) {
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: payload.iat ?? now, exp: payload.exp ?? now + ttlSec }
  const p64 = b64url(JSON.stringify(body))
  const sig = hmac(p64)
  return `${p64}.${sig}`
}
export function parseSignedCookieValue(value: string | undefined): SessionPayload | null {
  if (!value) return null
  const [p64, sig] = value.split('.')
  if (!p64 || !sig) return null
  const good = hmac(p64)
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null
  try {
    const obj = JSON.parse(fromB64url(p64))
    if (obj?.exp && typeof obj.exp === 'number' && obj.exp < Math.floor(Date.now() / 1000)) return null
    return obj
  } catch { return null }
}

// --- pose 1 cookie « source de vérité » ---
export function setSessionCookieOnResponse(res: NextResponse, payload: SessionPayload, ttlSec?: number) {
  const value = makeSignedCookieValue(payload, ttlSec)
  const maxAge = ttlSec ?? 60 * 60 * 24 * 90
  const dom = process.env.COOKIE_DOMAIN || undefined

  res.cookies.set(AUTH_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',   // navigation top-level
    path: '/',
    maxAge,
    domain: dom,       // ex: .parcelsoftime.com
  })
}

// --- nettoyage agressif (nouvelles & anciennes variantes) ---
export function clearSessionCookies(res: NextResponse) {
  const gone = {
    httpOnly: true as const,
    secure: true,
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  }
  const dom = process.env.COOKIE_DOMAIN || undefined

  // cookie « vérité »
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...gone, sameSite: 'lax', domain: dom })

  // variantes historiques possibles
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...gone, sameSite: 'lax' })        // host-only legacy
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...gone, sameSite: 'none', domain: dom })
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...gone, sameSite: 'none' })
  res.cookies.set(`__Host-${AUTH_COOKIE_NAME}`, '', { ...gone, sameSite: 'lax' })
  res.cookies.set(`__Host-${AUTH_COOKIE_NAME}`, '', { ...gone, sameSite: 'none' })
}

/** Next 15 : cookies() possiblement async */
export async function readSession(): Promise<SessionPayload | null> {
  const cAny = cookies as any
  const bag = typeof cAny === 'function' ? cAny() : cAny
  const jar = bag?.then ? await bag : bag
  const raw =
    jar?.get?.(`__Host-${AUTH_COOKIE_NAME}`)?.value ||
    jar?.get?.(AUTH_COOKIE_NAME)?.value
  return parseSignedCookieValue(raw)
}

// ===== DB & password
type PWRecord = { id: string; email: string; display_name: string | null; password_hash: string | null; password_algo: string | null }

export async function ownerIdForDay(tsISO: string): Promise<string | null> {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(tsISO)) tsISO = `${tsISO}T00:00:00.000Z`
    const { rows } = await pool.query(`select owner_id from claims where date_trunc('day', ts) = $1::timestamptz`, [tsISO])
    if (!rows?.length) return null
    return String(rows[0].owner_id)
  } catch { return null }
}

export async function upsertOwnerByEmail(email: string, displayName?: string | null): Promise<string> {
  const { rows } = await pool.query(
    `insert into owners(email, display_name)
     values($1,$2)
     on conflict(email) do update set display_name = coalesce(excluded.display_name, owners.display_name)
     returning id`,
    [email.trim().toLowerCase(), displayName ?? null]
  )
  return String(rows[0].id)
}

const SCRYPT_N = 16384, SCRYPT_r = 8, SCRYPT_p = 1, KEYLEN = 64
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const dk = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p }, (err, derived) =>
      err ? reject(err) : resolve(derived as Buffer)
    )
  })
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`
}
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const dk = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p }, (err, derived) =>
      err ? reject(err) : resolve(derived as Buffer)
    )
  })
  return crypto.timingSafeEqual(dk, expected)
}
export async function createOwnerWithPassword(email: string, password: string, displayName?: string | null) {
  const emailNorm = email.trim().toLowerCase()
  const passHash = await hashPassword(password)
  const { rows } = await pool.query<PWRecord>(
    `insert into owners(email, display_name, password_hash, password_algo)
     values ($1,$2,$3,'scrypt')
     on conflict (email) do update
       set display_name = coalesce(excluded.display_name, owners.display_name)
     returning id, email, display_name, password_hash, password_algo`,
    [emailNorm, displayName ?? null, passHash]
  )
  return rows[0]
}
export async function findOwnerByEmailWithPassword(email: string) {
  const { rows } = await pool.query<PWRecord>(
    `select id, email, display_name, password_hash, password_algo from owners where email = $1`,
    [email.trim().toLowerCase()]
  )
  return rows[0] || null
}

// Debug (login?debug=1)
export type DebugSnapshot = {
  cookiePresent: boolean
  rawLen: number
  host: string
  xfh: string
  proto: string
  payload: SessionPayload | null
  payloadStart: string
  payloadEnd: string
  sigStart: string
  sigEnd: string
  sigOk: boolean
  parseOk: boolean
  reason?: string
}
export async function debugSessionSnapshot(): Promise<DebugSnapshot> {
  try {
    const cAny = cookies as any
    const bag = typeof cAny === 'function' ? cAny() : cAny
    const jar = bag?.then ? await bag : bag
    const raw = jar?.get?.(`__Host-${AUTH_COOKIE_NAME}`)?.value || jar?.get?.(AUTH_COOKIE_NAME)?.value || ''
    const [p64, sig] = raw.split('.')
    const headers = (await import('next/headers')).headers
    const hs = headers as any
    const hbag = hs?.then ? await hs() : hs()
    const xfh = hbag.get('x-forwarded-host') || ''
    const proto = hbag.get('x-forwarded-proto') || ''
    const payloadStr = p64 ? fromB64url(p64) : ''
    const payload = payloadStr ? JSON.parse(payloadStr) : null
    const good = p64 ? hmac(p64) : ''
    return {
      cookiePresent: !!raw,
      rawLen: raw.length,
      host: hbag.get('host') || '',
      xfh,
      proto,
      payload,
      payloadStart: payloadStr.slice(0, 24),
      payloadEnd: payloadStr.slice(-12),
      sigStart: (sig || '').slice(0, 8),
      sigEnd: (sig || '').slice(-8),
      sigOk: !!(sig && good && sig === good),
      parseOk: !!payload,
    }
  } catch (e: any) {
    return { cookiePresent: false, rawLen: 0, host: '', xfh: '', proto: '', payload: null, payloadStart: '', payloadEnd: '', sigStart: '', sigEnd: '', sigOk: false, parseOk: false, reason: String(e?.message || e) }
  }
}
