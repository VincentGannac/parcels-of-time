//lib/auth.ts
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

/** Détermine le Domain à utiliser pour ce host (sinon host-only) */
export function computeCookieDomainForHost(host?: string): string | undefined {
  const conf = (process.env.COOKIE_DOMAIN || '').trim()
  if (!conf) return undefined
  const clean = conf.replace(/^\./, '')
  if (!host) return undefined
  const h = host.toLowerCase()
  if (h === clean || h.endsWith('.' + clean)) return '.' + clean
  return undefined // host-only
}

/** Pose 1 seule variante (source de vérité) : domain si couvert, sinon host-only */
export function setSessionCookieOnResponse(
  res: NextResponse,
  payload: SessionPayload,
  ttlSec?: number,
  hostForDomainDecision?: string,
) {
  const value = makeSignedCookieValue(payload, ttlSec)
  const maxAge = ttlSec ?? 60 * 60 * 24 * 90
  const domain = computeCookieDomainForHost(hostForDomainDecision)
  res.cookies.set(AUTH_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
    ...(domain ? { domain } : {}),
  })
}

/** Efface toutes les variantes possibles pour ce host */
export function clearSessionCookies(
  res: NextResponse,
  hostForDomainDecision?: string,
) {
  const domain = computeCookieDomainForHost(hostForDomainDecision)
  const baseGone = {
    httpOnly: true as const,
    secure: true,
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  }

  // Variante effective (domain si couvert, sinon host-only)
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...baseGone, sameSite: 'lax', ...(domain ? { domain } : {}) })

  // Compat : tout raser (anciennes variantes)
  // host-only
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...baseGone, sameSite: 'lax' })
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...baseGone, sameSite: 'none' })

  // domain explicites .example.com et example.com (certaines stacks sont tatillonnes)
  const conf = (process.env.COOKIE_DOMAIN || '').trim().replace(/^\./, '')
  if (conf) {
    res.cookies.set(AUTH_COOKIE_NAME, '', { ...baseGone, sameSite: 'lax', domain: '.' + conf })
    res.cookies.set(AUTH_COOKIE_NAME, '', { ...baseGone, sameSite: 'none', domain: '.' + conf })
    res.cookies.set(AUTH_COOKIE_NAME, '', { ...baseGone, sameSite: 'lax', domain: conf })
    res.cookies.set(AUTH_COOKIE_NAME, '', { ...baseGone, sameSite: 'none', domain: conf })
  }

  // anciens __Host-*
  res.cookies.set(`__Host-${AUTH_COOKIE_NAME}`, '', { ...baseGone, sameSite: 'lax' })
  res.cookies.set(`__Host-${AUTH_COOKIE_NAME}`, '', { ...baseGone, sameSite: 'none' })
}

/** Lecture robuste : tente __Host-* puis normal, garde la 1re VALIDE */
export async function readSession(): Promise<SessionPayload | null> {
  const cAny = cookies as any
  const bag = typeof cAny === 'function' ? cAny() : cAny
  const jar = bag?.then ? await bag : bag

  const rawHost = jar?.get?.(`__Host-${AUTH_COOKIE_NAME}`)?.value
  const rawNorm = jar?.get?.(AUTH_COOKIE_NAME)?.value

  if (rawHost) {
    const p = parseSignedCookieValue(rawHost)
    if (p) return p
  }
  if (rawNorm) {
    const p = parseSignedCookieValue(rawNorm)
    if (p) return p
  }
  return null
}

// ===== DB & password =====
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

/** Met à jour le mot de passe d’un owner (et l’algo). */
export async function setOwnerPassword(ownerId: string, newPassword: string): Promise<void> {
    const passHash = await hashPassword(newPassword)
    await pool.query(
      `update owners
          set password_hash = $2,
              password_algo = 'scrypt'
        where id = $1`,
      [ownerId, passHash]
    )
  }



export async function findOwnerByEmailWithPassword(email: string) {
  const { rows } = await pool.query<PWRecord>(
    `select id, email, display_name, password_hash, password_algo from owners where email = $1`,
    [email.trim().toLowerCase()]
  )
  return rows[0] || null
}

// ===== Debug enrichi =====
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

    const rawHost = jar?.get?.(`__Host-${AUTH_COOKIE_NAME}`)?.value || ''
    const rawNorm = jar?.get?.(AUTH_COOKIE_NAME)?.value || ''

    const inspect = (raw: string) => {
      if (!raw) return { rawLen: 0, payload: null, payloadStart: '', payloadEnd: '', sigStart: '', sigEnd: '', sigOk: false, parseOk: false }
      const [p64, sig] = raw.split('.')
      if (!p64 || !sig) return { rawLen: raw.length, payload: null, payloadStart: '', payloadEnd: '', sigStart: (sig||'').slice(0,8), sigEnd: (sig||'').slice(-8), sigOk: false, parseOk: false }
      const payloadStr = fromB64url(p64)
      let payload: any = null
      let parseOk = false
      try { payload = JSON.parse(payloadStr); parseOk = true } catch {}
      const good = hmac(p64)
      const sigOk = !!(sig && good && sig === good)
      return {
        rawLen: raw.length,
        payload,
        payloadStart: payloadStr.slice(0, 24),
        payloadEnd: payloadStr.slice(-12),
        sigStart: sig.slice(0, 8),
        sigEnd: sig.slice(-8),
        sigOk,
        parseOk,
      }
    }

    const hostView = inspect(rawHost)
    const normView = inspect(rawNorm)
    const isValid = (v: any) => {
      if (!v.parseOk || !v.sigOk || !v.payload) return false
      if (typeof v.payload.exp === 'number' && v.payload.exp < Math.floor(Date.now()/1000)) return false
      return true
    }
    const chosen =
      isValid(hostView) ? '__Host-' + AUTH_COOKIE_NAME
      : isValid(normView) ? AUTH_COOKIE_NAME
      : '(none)'

    const headersMod = (await import('next/headers')).headers
    const hs = headersMod as any
    const hbag = hs?.then ? await hs() : hs()
    const xfh = hbag.get('x-forwarded-host') || ''
    const proto = hbag.get('x-forwarded-proto') || ''

    const picked = chosen === '__Host-' + AUTH_COOKIE_NAME ? hostView : normView

    return {
      cookiePresent: !!(rawHost || rawNorm),
      rawLen: picked.rawLen,
      host: hbag.get('host') || '',
      xfh,
      proto,
      payload: picked.payload,
      payloadStart: picked.payloadStart,
      payloadEnd: picked.payloadEnd,
      sigStart: picked.sigStart,
      sigEnd: picked.sigEnd,
      sigOk: picked.sigOk,
      parseOk: picked.parseOk,
      reason: `chosen=${chosen}; hostValid=${isValid(hostView)}; normValid=${isValid(normView)}`,
    }
  } catch (e: any) {
    return {
      cookiePresent: false, rawLen: 0, host: '', xfh: '', proto: '',
      payload: null, payloadStart: '', payloadEnd: '', sigStart: '', sigEnd: '',
      sigOk: false, parseOk: false, reason: String(e?.message || e),
    }
  }
}
