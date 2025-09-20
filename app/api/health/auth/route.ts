// app/api/health/auth/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { headers, cookies } from 'next/headers'

/**
 * Helpers base64url (alignés sur le middleware et lib/auth)
 */
function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function fromB64url(input: string) {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0
  return Buffer.from(s + '='.repeat(pad), 'base64').toString('utf8')
}
function hmacNode(secret: string, data: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url')
}
function safeJsonParse<T = unknown>(s: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(s) as T }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}
function trunc(s: string, n = 32) {
  if (!s) return ''
  if (s.length <= n) return s
  return `${s.slice(0, Math.ceil(n / 2))}…${s.slice(-Math.floor(n / 2))}`
}
function nowSec() { return Math.floor(Date.now() / 1000) }

/**
 * Lecture & vérification locales (côté Node)
 */
export async function GET(req: Request) {
  const h = await headers()
  const ck = await cookies() // Next 15: peut être async
  const url = new URL(req.url)

  // ==== ENV
  const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'
  const AUTH_SECRET_ENV = process.env.AUTH_SECRET || ''
  const SECRET_SALT_ENV = process.env.SECRET_SALT || ''
  const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || ''
  const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ''
  const VERCEL_ENV = process.env.VERCEL_ENV || ''
  const VERCEL_REGION = process.env.VERCEL_REGION || ''
  const VERCEL_URL = process.env.VERCEL_URL || ''

  // Secret effectivement utilisé ici (même logique que lib/auth & middleware)
  const SECRET_NODE = (AUTH_SECRET_ENV || SECRET_SALT_ENV || 'dev_salt')

  // ==== HEADERS & COOKIES (requête)
  const host = h.get('host') ?? ''
  const xfh = h.get('x-forwarded-host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? ''
  const cookieHeader = h.get('cookie') || h.get('Cookie') || ''
  const cookieStore = ck.getAll().map(c => ({ name: c.name, len: (c.value || '').length }))
  const cookieNames = cookieStore.map(c => c.name)

  // Variantes possibles lues par cookies()
  const hostPrefixed = ck.get(`__Host-${AUTH_COOKIE_NAME}`)?.value || ''
  const normal = ck.get(AUTH_COOKIE_NAME)?.value || ''

  // Choix du token "candidat" (le plus long gagne)
  const candidateRaw = (hostPrefixed.length > normal.length) ? hostPrefixed : normal
  const candidateName = (hostPrefixed.length > normal.length) ? `__Host-${AUTH_COOKIE_NAME}` : AUTH_COOKIE_NAME

  // ==== Décodage & vérif signature
  let payloadStr = ''
  let payload: any = null
  let expOk = true
  let iat = 0
  let exp = 0
  let reason = ''

  let sigInput = ''
  let sigGiven = ''
  let sigAuthSecret = ''
  let sigSecretSalt = ''
  let sigDevSalt = ''

  let matchAuthSecret = false
  let matchSecretSalt = false
  let matchDevSalt = false

  if (candidateRaw) {
    const parts = candidateRaw.split('.')
    if (parts.length === 2) {
      const [p64, sig] = parts
      sigInput = p64
      sigGiven = sig

      // Recalcule la signature avec différentes sources pour voir laquelle "matche"
      try {
        sigAuthSecret = hmacNode(AUTH_SECRET_ENV || '', p64)
      } catch {}
      try {
        sigSecretSalt = hmacNode(SECRET_SALT_ENV || '', p64)
      } catch {}
      try {
        sigDevSalt = hmacNode('dev_salt', p64)
      } catch {}

      matchAuthSecret = !!AUTH_SECRET_ENV && sigGiven === sigAuthSecret
      matchSecretSalt = !!SECRET_SALT_ENV && sigGiven === sigSecretSalt
      matchDevSalt = sigGiven === sigDevSalt

      // Décodage payload
      try {
        payloadStr = fromB64url(p64)
        const parsed = safeJsonParse(payloadStr)
        if (parsed.ok) {
          payload = parsed.value
          iat = Number(payload?.iat || 0)
          exp = Number(payload?.exp || 0)
          if (exp && exp < nowSec()) {
            expOk = false
            reason = 'expired'
          }
        } else {
          reason = `json_error: ${parsed.error}`
        }
      } catch (e: any) {
        reason = `b64_error: ${String(e?.message || e)}`
      }
    } else {
      reason = 'token_format_invalid'
    }
  } else {
    reason = 'no_cookie'
  }

  // ==== Simulation "middleware secret" vs "node secret"
  // Dans le middleware, la même logique est utilisée: (AUTH_SECRET || SECRET_SALT || 'dev_salt')
  let sigEdgeSecret = ''
  let matchEdgeSecret = false
  try {
    const EDGE_SECRET = (AUTH_SECRET_ENV || SECRET_SALT_ENV || 'dev_salt')
    if (sigInput) {
      sigEdgeSecret = hmacNode(EDGE_SECRET, sigInput)
      matchEdgeSecret = (sigGiven && sigEdgeSecret) ? sigGiven === sigEdgeSecret : false
    }
  } catch {}

  const verdictValid =
    !!candidateRaw &&
    !!sigInput &&
    !!sigGiven &&
    (matchAuthSecret || matchSecretSalt || matchDevSalt || matchEdgeSecret) &&
    expOk

  // ==== Locale & next debug
  const nextParam = url.searchParams.get('next') || ''
  const localeGuess = (host.startsWith('fr.') || url.pathname.startsWith('/fr') || (h.get('accept-language') || '').toLowerCase().startsWith('fr')) ? 'fr' : 'en'

  // ==== Sortie JSON verbeuse
  return NextResponse.json({
    info: 'Auth health (server/Node). Vérifie cookie, secrets & signature.',
    req: {
      url: url.toString(),
      method: 'GET',
      path: url.pathname,
      searchParams: Object.fromEntries(url.searchParams.entries()),
      nextParam,
      localeGuess,
    },
    headers: {
      host,
      x_forwarded_host: xfh,
      x_forwarded_proto: proto,
      cookieHeaderPresent: cookieHeader.length > 0,
      cookieHeaderLen: cookieHeader.length,
    },
    env: {
      AUTH_COOKIE_NAME,
      AUTH_SECRET_len: AUTH_SECRET_ENV ? AUTH_SECRET_ENV.length : 0,
      SECRET_SALT_len: SECRET_SALT_ENV ? SECRET_SALT_ENV.length : 0,
      SECRET_NODE_source: AUTH_SECRET_ENV ? 'AUTH_SECRET' : (SECRET_SALT_ENV ? 'SECRET_SALT' : 'dev_salt'),
      COOKIE_DOMAIN,
      NEXT_PUBLIC_BASE_URL,
      VERCEL_ENV,
      VERCEL_REGION,
      VERCEL_URL,
      same_AUTH_SECRET_and_SECRET_SALT: (!!AUTH_SECRET_ENV && !!SECRET_SALT_ENV) ? (AUTH_SECRET_ENV === SECRET_SALT_ENV) : null,
    },
    cookies: {
      storeKeys: cookieNames,
      storeMeta: cookieStore,
      picked: {
        name: candidateName,
        present: !!candidateRaw,
        rawLen: candidateRaw.length,
        preview: trunc(candidateRaw, 64),
      },
      variants: {
        hostPrefixed: {
          present: !!hostPrefixed, len: hostPrefixed.length, preview: trunc(hostPrefixed, 64),
        },
        normal: {
          present: !!normal, len: normal.length, preview: trunc(normal, 64),
        },
      },
    },
    token: {
      hasToken: !!candidateRaw,
      formatOK: !!sigInput && !!sigGiven,
      payloadPreview: {
        start: trunc(payloadStr, 48),
        end: payloadStr && payloadStr.length > 48 ? trunc(payloadStr.slice(-48), 48) : '',
      },
      parsed: payload || null,
      iat,
      exp,
      now: nowSec(),
      expOk,
      reason: reason || null,
    },
    signatureChecks: {
      sigGivenPreview: trunc(sigGiven, 24),
      using_AUTH_SECRET: {
        provided: !!AUTH_SECRET_ENV,
        computedPreview: trunc(sigAuthSecret, 24),
        match: matchAuthSecret,
      },
      using_SECRET_SALT: {
        provided: !!SECRET_SALT_ENV,
        computedPreview: trunc(sigSecretSalt, 24),
        match: matchSecretSalt,
      },
      using_dev_salt: {
        computedPreview: trunc(sigDevSalt, 24),
        match: matchDevSalt,
      },
      middleware_like_secret: {
        // (AUTH_SECRET || SECRET_SALT || 'dev_salt')
        computedPreview: trunc(sigEdgeSecret, 24),
        match: matchEdgeSecret,
      },
    },
    verdict: {
      isValidSession: verdictValid,
      explanation:
        verdictValid
          ? 'Cookie reconnu et signature valide avec au moins une des sources de secret (et non expiré).'
          : 'Cookie absent, expiré, ou signature invalide (mismatch de secret probable côté middleware/ENV).',
    },
    nextSteps: [
      'Vérifier que AUTH_SECRET est bien défini dans Vercel pour *tous* les environnements (Production/Preview/Development).',
      'S’assurer que le middleware et les handlers Node utilisent la même logique de secret (AUTH_SECRET || SECRET_SALT || dev_salt).',
      'Si plusieurs hôtes (apex vs www), unifier sur www.parcelsoftime.com et utiliser COOKIE_DOMAIN=.parcelsoftime.com.',
      'Après logout, confirmer que *toutes* les variantes du cookie sont supprimées (voir /api/health/auth avant/après).',
    ],
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
