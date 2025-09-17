// lib/auth.ts
// Runtime: nodejs
// Outils d'auth côté serveur: signature HMAC, cookie SameSite=None; Secure, helpers DB.
// + Support password optionnel (scrypt), avec détection dynamique des colonnes.

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
  // timingSafeEqual demande des buffers de même longueur => harmoniser
  const a = Buffer.from(sig)
  const b = Buffer.from(good)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
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
  try {
    const c = await cookies() // <= Next 15 peut retourner une Promise
    const raw = c.get(AUTH_COOKIE_NAME)?.value
    return parseSignedCookieValue(raw)
  } catch {
    return null
  }
}

/**
 * Petit utilitaire debug pour ta page /login?debug=1
 */
export type DebugSnapshot = {
  present: boolean
  raw: string
  payload: SessionPayload | null
  host: string
  xfh: string
  proto: string
  cookiePresent: boolean
  rawLen: number
}

export async function debugSessionSnapshot(): Promise<DebugSnapshot> {
  try {
    const c = await cookies()
    const h = await headers()

    const raw = c.get(AUTH_COOKIE_NAME)?.value || ''
    const payload = parseSignedCookieValue(raw)

    const host = h.get('host') || ''
    const xfh = h.get('x-forwarded-host') || ''
    const proto = h.get('x-forwarded-proto') || ''

    const cookiePresent = !!raw
    const rawLen = raw.length

    return { present: cookiePresent, raw, payload, host, xfh, proto, cookiePresent, rawLen }
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
    }
  }
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

// === Password optionnel (scrypt) ============================================

/** Récupère le set des colonnes pour la table owners (cache minimal par process). */
let OWNERS_COLS: Set<string> | null = null
async function ownersColumns(): Promise<Set<string>> {
  if (OWNERS_COLS) return OWNERS_COLS
  try {
    const { rows } = await pool.query(
      `select column_name
         from information_schema.columns
        where table_schema='public' and table_name='owners'`
    )
    OWNERS_COLS = new Set<string>(rows.map((r: any) => String(r.column_name)))
    return OWNERS_COLS
  } catch {
    OWNERS_COLS = new Set<string>(['email', 'display_name', 'id']) // fallback minimal
    return OWNERS_COLS
  }
}

function hashPassword(password: string, salt?: string) {
  const s = salt || crypto.randomBytes(16).toString('hex')
  const buf = crypto.scryptSync(password, s, 64)
  return { salt: s, hash: buf.toString('hex') }
}
function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { hash } = hashPassword(password, salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(expectedHash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Crée un owner avec mot de passe si les colonnes existent.
 * - Si l'email existe déjà avec mot de passe: throw 'email_in_use'
 * - Si l'email existe sans colonnes password: renvoie l'id tel quel (pas d’erreur).
 * - Si les colonnes password n’existent pas: insert/update sans mot de passe (fallback).
 */
export async function createOwnerWithPassword(
  email: string,
  password: string,
  displayName?: string | null
): Promise<string> {
  const mail = email.trim().toLowerCase()
  const cols = await ownersColumns()

  // Check existant
  const { rows } = await pool.query(
    `select id${cols.has('password_hash') ? ', password_hash, password_salt' : ''} from owners where email = $1`,
    [mail]
  )
  const exists = rows[0]
  if (exists && cols.has('password_hash')) {
    if (exists.password_hash) {
      // un compte password existe déjà
      const err = new Error('email_in_use')
      ;(err as any).code = 'email_in_use'
      throw err
    }
    // Pas de password encore => on peut le définir
    const { salt, hash } = hashPassword(password)
    await pool.query(
      `update owners set display_name = coalesce($2, owners.display_name),
                          password_hash = $3, password_salt = $4
        where id = $1`,
      [exists.id, displayName ?? null, hash, salt]
    )
    return String(exists.id)
  }

  // Insert
  if (cols.has('password_hash') && cols.has('password_salt')) {
    const { salt, hash } = hashPassword(password)
    const { rows: ins } = await pool.query(
      `insert into owners(email, display_name, password_hash, password_salt)
       values ($1,$2,$3,$4)
       on conflict(email) do update
         set display_name = coalesce(excluded.display_name, owners.display_name)
       returning id`,
      [mail, displayName ?? null, hash, salt]
    )
    return String(ins[0].id)
  } else {
    // Fallback: pas de colonnes password; on se contente d’un upsert standard
    return upsertOwnerByEmail(mail, displayName ?? null)
  }
}

/** Vérifie un login/password ; retourne l'ownerId si OK, sinon null. */
export async function loginOwnerWithPassword(
  email: string,
  password: string
): Promise<{ ownerId: string; email: string; displayName: string | null } | null> {
  const mail = email.trim().toLowerCase()
  const cols = await ownersColumns()
  const fields = ['id', 'email', 'display_name']
  if (cols.has('password_hash')) fields.push('password_hash')
  if (cols.has('password_salt')) fields.push('password_salt')

  const { rows } = await pool.query(
    `select ${fields.join(', ')} from owners where email = $1`,
    [mail]
  )
  if (!rows.length) return null

  const r = rows[0]
  if (cols.has('password_hash') && r.password_hash && r.password_salt) {
    const ok = verifyPassword(password, String(r.password_salt), String(r.password_hash))
    if (!ok) return null
  } else {
    // pas de colonnes password -> pas de vérification possible (considérer KO)
    return null
  }

  return { ownerId: String(r.id), email: mail, displayName: r.display_name ?? null }
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
  const a = Buffer.from(sig)
  const b = Buffer.from(good)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const obj = JSON.parse(fromB64url(p64)) as MagicTokenPayload
    if (obj?.exp && obj.exp < Math.floor(Date.now() / 1000)) return null
    if (!obj?.email) return null
    return obj
  } catch {
    return null
  }
}
