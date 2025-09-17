// lib/auth.ts
// Runtime: nodejs
// Outils d'auth côté serveur: signature HMAC, cookie SameSite=None; Secure, helpers DB.

import { cookies, headers } from 'next/headers'
import type { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.SECRET_SALT || 'dev_salt'

// ===== Utils base64url =====
function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
function fromB64url(input: string) {
  input = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = input.length % 4 ? 4 - (input.length % 4) : 0
  return Buffer.from(input + '='.repeat(pad), 'base64').toString('utf8')
}

// ===== Signature HMAC (type JWT light) =====
export type SessionPayload = {
  ownerId: string
  email: string
  displayName?: string | null
  iat?: number
  exp?: number
}

function hmac(input: string) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(input).digest('base64url')
}

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
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null
  } catch {
    return null
  }
  try {
    const obj = JSON.parse(fromB64url(p64))
    if (obj?.exp && typeof obj.exp === 'number' && obj.exp < Math.floor(Date.now() / 1000)) return null
    return obj
  } catch {
    return null
  }
}

// ===== Cookies helpers =====

/**
 * Pose la session sur la réponse avec SameSite=None; Secure.
 * Utiliser CETTE fonction partout (login, retour Stripe, etc.).
 */
export function setSessionCookieOnResponse(res: NextResponse, payload: SessionPayload, ttlSec?: number) {
  const value = makeSignedCookieValue(payload, ttlSec)
  const base = {
    httpOnly: true as const,
    secure: true,
    sameSite: 'none' as const,
    path: '/',
    maxAge: ttlSec ?? 60 * 60 * 24 * 90,
  }
  const dom = process.env.COOKIE_DOMAIN || ''
  // Variante "domain" (prod)
  if (dom) res.cookies.set(AUTH_COOKIE_NAME, value, { ...base, domain: dom })
  // Variante host-only (preview / localhost)
  res.cookies.set(AUTH_COOKIE_NAME, value, base)
}

/**
 * Efface toutes les variantes possibles du cookie de session.
 */
export function clearSessionCookies(res: NextResponse) {
  const gone = {
    httpOnly: true as const,
    secure: true,
    sameSite: 'none' as const,
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  }
  const dom = process.env.COOKIE_DOMAIN || ''
  // 1) SameSite=None + domain
  if (dom) res.cookies.set(AUTH_COOKIE_NAME, '', { ...gone, domain: dom })
  // 2) SameSite=None + host-only
  res.cookies.set(AUTH_COOKIE_NAME, '', gone)
  // 3) Lax + domain (anciens cookies)
  if (dom) res.cookies.set(AUTH_COOKIE_NAME, '', { ...gone, sameSite: 'lax', domain: dom })
  // 4) Lax + host-only
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...gone, sameSite: 'lax' })
}

/**
 * Lecture de la session côté serveur (App Router).
 * Retourne null si absent/invalide/expiré.
 */
export async function readSession(): Promise<SessionPayload | null> {
  const c = await cookies()
  const raw = c.get(AUTH_COOKIE_NAME)?.value
  return parseSignedCookieValue(raw)
}

// ====== DB helpers ======

/** Renvoie l'owner_id (string) pour un jour donné (YYYY-MM-DD ou ISO), ou null. */
export async function ownerIdForDay(tsISO: string): Promise<string | null> {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(tsISO)) tsISO = `${tsISO}T00:00:00.000Z`
    const { rows } = await pool.query(
      `select owner_id from claims where date_trunc('day', ts) = $1::timestamptz`,
      [tsISO]
    )
    if (!rows?.length) return null
    return String(rows[0].owner_id)
  } catch {
    return null
  }
}

/** Crée (si besoin) un owner par email et retourne son id. */
export async function upsertOwnerByEmail(email: string, displayName?: string | null): Promise<string> {
  const { rows } = await pool.query(
    `insert into owners(email, display_name)
     values($1,$2)
     on conflict(email) do update
       set display_name = coalesce(excluded.display_name, owners.display_name)
     returning id`,
    [email.trim().toLowerCase(), displayName ?? null]
  )
  return String(rows[0].id)
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `select 1 from information_schema.columns
       where table_schema='public' and table_name=$1 and column_name=$2 limit 1`,
      [table, column]
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export type OwnerRow = {
  id: string
  email: string
  display_name: string | null
  password_hash?: string | null
}

export async function getOwnerByEmail(email: string): Promise<OwnerRow | null> {
  try {
    const hasPwd = await tableHasColumn('owners', 'password_hash')
    const { rows } = await pool.query(
      `select id, email, display_name${hasPwd ? ', password_hash' : ''}
       from owners where lower(email)=lower($1) limit 1`,
      [email.trim().toLowerCase()]
    )
    if (!rows?.length) return null
    const r = rows[0]
    return {
      id: String(r.id),
      email: String(r.email),
      display_name: r.display_name ?? null,
      password_hash: hasPwd ? (r.password_hash ?? null) : null,
    }
  } catch {
    return null
  }
}

// ====== Password helpers (scrypt, no native deps) ======

function encodeB64(buf: Buffer) { return buf.toString('base64') }
function decodeB64(s: string) { return Buffer.from(s, 'base64') }

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16)
  const N = 16384, r = 8, p = 1
  const dk = crypto.scryptSync(password, salt, 64, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${encodeB64(salt)}$${encodeB64(dk)}`
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const N = parseInt(parts[1], 10)
    const r = parseInt(parts[2], 10)
    const p = parseInt(parts[3], 10)
    const salt = decodeB64(parts[4])
    const hash = parts[5]
    const dk = crypto.scryptSync(password, salt, 64, { N, r, p })
    const ok = crypto.timingSafeEqual(Buffer.from(hash, 'base64'), dk)
    return ok
  } catch {
    return false
  }
}

/** Création d'owner avec mot de passe si la colonne existe, sinon fallback à upsert sans mot de passe. */
export async function createOwnerWithPassword(email: string, password: string, displayName?: string | null): Promise<string> {
  const hasPwd = await tableHasColumn('owners', 'password_hash')
  if (!hasPwd) {
    // table sans colonne password_hash → on crée/maj l'owner simple
    return upsertOwnerByEmail(email, displayName)
  }
  const pwdHash = hashPasswordScrypt(password)
  const { rows } = await pool.query(
    `insert into owners(email, display_name, password_hash)
     values($1,$2,$3)
     on conflict(email) do update
       set display_name = coalesce(excluded.display_name, owners.display_name),
           password_hash = coalesce(excluded.password_hash, owners.password_hash)
     returning id`,
    [email.trim().toLowerCase(), displayName ?? null, pwdHash]
  )
  return String(rows[0].id)
}

// ====== Jeton de login (optionnel, pour "magic link") ======

export type MagicTokenPayload = {
  email: string
  ownerId?: string
  displayName?: string | null
  exp?: number
  iat?: number
}

/** Génère un token signé (à envoyer par mail). */
export function makeLoginToken(p: MagicTokenPayload, ttlSec = 60 * 30): string {
  const now = Math.floor(Date.now() / 1000)
  const body = { ...p, iat: p.iat ?? now, exp: p.exp ?? now + ttlSec }
  const p64 = b64url(JSON.stringify(body))
  const sig = hmac(`login.${p64}`)
  return `${p64}.${sig}`
}

/** Vérifie un token signé et retourne la charge utile ou null. */
export function verifyLoginToken(token: string): MagicTokenPayload | null {
  const [p64, sig] = String(token || '').split('.')
  if (!p64 || !sig) return null
  const good = hmac(`login.${p64}`)
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null
  } catch {
    return null
  }
  try {
    const obj = JSON.parse(fromB64url(p64)) as MagicTokenPayload
    if (obj?.exp && obj.exp < Math.floor(Date.now() / 1000)) return null
    if (!obj?.email) return null
    return obj
  } catch {
    return null
  }
}

// ---- Debug helpers (pour la page /login?debug=1)
export type DebugSnapshot = {
  present: boolean
  raw: string
  payload: SessionPayload | null
  host: string
  xfh: string
  proto: string
  cookiePresent: boolean
  rawLen: number
  payloadStart: string
  payloadEnd: string
  sigStart: string
  sigEnd: string
  sigOk: boolean
  parseOk: boolean
  reason: string
}

export async function debugSessionSnapshot(): Promise<DebugSnapshot> {
  try {
    const c = await cookies()
    const h = await headers()

    const raw = c.get(AUTH_COOKIE_NAME)?.value || ''
    const [p64 = '', sig = ''] = raw.split('.')

    // Vérif signature
    let sigOk = false
    if (p64 && sig) {
      try {
        const good = hmac(p64)
        sigOk = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))
      } catch {
        sigOk = false
      }
    }

    // Parse payload b64url → JSON
    let payload: SessionPayload | null = null
    let parseOk = false
    let reason = ''
    if (p64) {
      try {
        const json = fromB64url(p64)
        const obj = JSON.parse(json)
        const now = Math.floor(Date.now() / 1000)
        if (obj?.exp && typeof obj.exp === 'number' && obj.exp < now) {
          reason = 'expired'
        } else {
          payload = obj
          parseOk = true
        }
      } catch {
        reason = 'invalid_payload'
      }
    } else if (raw) {
      reason = 'missing_parts'
    } else {
      reason = 'no_cookie'
    }

    const host = h.get('host') || ''
    const xfh = h.get('x-forwarded-host') || ''
    const proto = h.get('x-forwarded-proto') || ''

    const cookiePresent = !!raw
    const rawLen = raw.length

    const payloadStart = p64.slice(0, 12)
    const payloadEnd = p64.slice(-12)
    const sigStart = sig.slice(0, 12)
    const sigEnd = sig.slice(-12)

    return {
      present: cookiePresent,
      raw,
      payload,
      host,
      xfh,
      proto,
      cookiePresent,
      rawLen,
      payloadStart,
      payloadEnd,
      sigStart,
      sigEnd,
      sigOk,
      parseOk,
      reason,
    }
  } catch {
    return {
      present: false,
      raw: '',
      payload: null,
      host: '',
      xfh: '',
      proto: '',
      cookiePresent: false,
      rawLen: 0,
      payloadStart: '',
      payloadEnd: '',
      sigStart: '',
      sigEnd: '',
      sigOk: false,
      parseOk: false,
      reason: 'exception',
    }
  }
}
