// lib/auth.ts
// Runtime: nodejs
// Outils d'auth côté serveur: signature HMAC, cookie SameSite=None; Secure, helpers DB.

import { cookies } from 'next/headers'
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
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null
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
    const c = await cookies(); // ⬅️ ajouter await
    const raw = c.get(AUTH_COOKIE_NAME)?.value
    return parseSignedCookieValue(raw)
  } catch {
    return null
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
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null
  try {
    const obj = JSON.parse(fromB64url(p64)) as MagicTokenPayload
    if (obj?.exp && obj.exp < Math.floor(Date.now() / 1000)) return null
    if (!obj?.email) return null
    return obj
  } catch {
    return null
  }
}
