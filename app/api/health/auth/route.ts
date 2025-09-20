// app/api/health/auth/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { headers, cookies } from 'next/headers'

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
  try { return { ok: true, value: JSON.parse(s) as T } }
  catch (e: any) { return { ok: false, error: String(e?.message || e) } }
}
function trunc(s: string, n = 32) {
  if (!s) return ''
  if (s.length <= n) return s
  return `${s.slice(0, Math.ceil(n / 2))}…${s.slice(-Math.floor(n / 2))}`
}
function nowSec() { return Math.floor(Date.now() / 1000) }

// Le check "soft" du middleware (présence/exp sans HMAC)
function softCheck(raw: string | undefined) {
  if (!raw) return { present: false, expOk: null as null | boolean, parsed: null as any, reason: 'no_cookie' }
  const [p64] = raw.split('.')
  if (!p64) return { present: true, expOk: null, parsed: null, reason: 'no_payload' }
  try {
    const b64 = p64.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0
    const s = b64 + '='.repeat(pad)
    const bin = Buffer.from(s, 'base64').toString('utf8')
    const parsed = JSON.parse(bin)
    if (typeof parsed?.exp === 'number') {
      return { present: true, expOk: parsed.exp >= nowSec(), parsed, reason: null }
    }
    return { present: true, expOk: null, parsed, reason: 'no_exp' }
  } catch (e: any) {
    return { present: true, expOk: null, parsed: null, reason: 'decode_error' }
  }
}

export async function GET(req: Request) {
  const h = await headers()
  const ck = await cookies()
  const url = new URL(req.url)

  const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'
  const AUTH_SECRET_ENV = process.env.AUTH_SECRET || ''
  const SECRET_SALT_ENV = process.env.SECRET_SALT || ''
  const COOKIE_DOMAIN = (process.env.COOKIE_DOMAIN || '').trim()
  const VERCEL_ENV = process.env.VERCEL_ENV || ''
  const VERCEL_URL = process.env.VERCEL_URL || ''
  const host = h.get('host') ?? ''
  const xfh = h.get('x-forwarded-host') ?? ''

  // Cookies vus par Node
  const allCookies = ck.getAll().map(c => ({ name: c.name, len: (c.value || '').length }))
  const cHost = ck.get(`__Host-${AUTH_COOKIE_NAME}`)?.value || ''
  const cNorm = ck.get(AUTH_COOKIE_NAME)?.value || ''
  const picked = cHost.length > cNorm.length ? cHost : cNorm
  const pickedName = cHost.length > cNorm.length ? `__Host-${AUTH_COOKIE_NAME}` : AUTH_COOKIE_NAME

  // Santé du cookie côté "soft middleware"
  const soft = softCheck(picked)

  // Diagnostics signature (Node) — informatif
  let sigGiven = ''
  let p64 = ''
  let payloadStr = ''
  let payload: any = null
  let expOk = true
  let parseReason = ''

  if (picked) {
    const parts = picked.split('.')
    if (parts.length === 2) {
      p64 = parts[0]; sigGiven = parts[1]
      try {
        payloadStr = fromB64url(p64)
        const pj = safeJsonParse(payloadStr)
        if (pj.ok) {
          payload = pj.value
          if (typeof payload?.exp === 'number' && payload.exp < nowSec()) expOk = false
        } else {
          parseReason = `json_error: ${pj.error}`
        }
      } catch (e: any) {
        parseReason = `b64_error: ${String(e?.message || e)}`
      }
    } else {
      parseReason = 'token_format_invalid'
    }
  } else {
    parseReason = 'no_cookie'
  }

  // Recalc signatures avec différentes sources (diagnostic)
  let sigWithAuthSecret = '', sigWithSecretSalt = '', sigWithDev = ''
  let matchAuthSecret = false, matchSecretSalt = false, matchDev = false
  if (p64) {
    if (AUTH_SECRET_ENV) { sigWithAuthSecret = hmacNode(AUTH_SECRET_ENV, p64); matchAuthSecret = sigGiven === sigWithAuthSecret }
    if (SECRET_SALT_ENV) { sigWithSecretSalt = hmacNode(SECRET_SALT_ENV, p64); matchSecretSalt = sigGiven === sigWithSecretSalt }
    sigWithDev = hmacNode('dev_salt', p64); matchDev = sigGiven === sigWithDev
  }

  // Ce host est-il couvert par COOKIE_DOMAIN ?
  const hostCovers =
    COOKIE_DOMAIN
      ? (host === COOKIE_DOMAIN.replace(/^\./, '') || host.endsWith(COOKIE_DOMAIN))
      : true // si pas défini, on ne conclut pas

  // Reco d’accès : si tu es sur un preview *.vercel.app, tu n’auras pas le cookie Domain=.parcelsoftime.com
  const isPreviewDomain = /\.vercel\.app$/.test(host)

  // Simu "décision middleware soft"
  // - si cookie absent: redirect
  // - si expOk === false : redirect
  // - sinon: pass
  const middlewareDecision =
    !soft.present ? 'redirect_login'
    : (soft.expOk === false ? 'redirect_login' : 'pass')

  return NextResponse.json({
    info: 'Auth health (Node). Diagnostic cookie + signature. Inclut décision simulée du middleware "soft".',
    env: {
      AUTH_COOKIE_NAME,
      AUTH_SECRET_len: AUTH_SECRET_ENV ? AUTH_SECRET_ENV.length : 0,
      SECRET_SALT_len: SECRET_SALT_ENV ? SECRET_SALT_ENV.length : 0,
      COOKIE_DOMAIN,
      VERCEL_ENV,
      VERCEL_URL,
    },
    request: {
      url: url.toString(),
      host,
      x_forwarded_host: xfh,
      previewDomain: isPreviewDomain,
      cookieDomainCoversThisHost: hostCovers,
    },
    cookies: {
      names: allCookies.map(c => c.name),
      variants: {
        hostPrefixed: { present: !!cHost, len: cHost.length, preview: trunc(cHost, 64) },
        normal: { present: !!cNorm, len: cNorm.length, preview: trunc(cNorm, 64) },
      },
      picked: {
        name: pickedName,
        present: !!picked,
        len: picked.length,
        preview: trunc(picked, 64),
      },
    },
    softMiddlewareView: {
      present: soft.present,
      expOk: soft.expOk,
      reason: soft.reason,
      decision: middlewareDecision, // pass / redirect_login
    },
    tokenDecode: {
      parsed: payload || null,
      payloadPreviewStart: trunc(payloadStr, 48),
      payloadPreviewEnd: payloadStr && payloadStr.length > 48 ? trunc(payloadStr.slice(-48), 48) : '',
      expOk,
      parseReason: parseReason || null,
    },
    signatureChecks: {
      sigGivenPreview: trunc(sigGiven, 24),
      with_AUTH_SECRET: { provided: !!AUTH_SECRET_ENV, match: matchAuthSecret, sigPreview: trunc(sigWithAuthSecret, 24) },
      with_SECRET_SALT: { provided: !!SECRET_SALT_ENV, match: matchSecretSalt, sigPreview: trunc(sigWithSecretSalt, 24) },
      with_dev_salt: { match: matchDev, sigPreview: trunc(sigWithDev, 24) },
    },
    hints: [
      isPreviewDomain
        ? 'Tu es sur un domaine preview *.vercel.app → le cookie Domain=.parcelsoftime.com ne sera PAS envoyé. Teste sur https://www.parcelsoftime.com/.'
        : (hostCovers ? 'COOKIE_DOMAIN couvre ce host.' : `ATTENTION: COOKIE_DOMAIN="${COOKIE_DOMAIN}" ne couvre pas le host "${host}".`),
      'Le middleware soft ne vérifie PAS la signature HMAC. La vraie vérification cryptographique reste côté Node (pages).',
    ],
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
