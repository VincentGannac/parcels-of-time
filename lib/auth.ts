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
  // attendus par la page
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
      } catch (e: any) {
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