// app/api/health/auth/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { headers, cookies } from 'next/headers'

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.SECRET_SALT || 'dev_salt'

function fromB64url(input: string) {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0
  return Buffer.from(s + '='.repeat(pad), 'base64').toString('utf8')
}
function hmacNode(secret: string, data: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url')
}
function nowSec() { return Math.floor(Date.now() / 1000) }
function trunc(s: string, n = 40) {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, n/2|0) + '…' + s.slice(-n/2|0)
}
function parseAndVerify(raw: string | undefined) {
  if (!raw) return { present:false, valid:false, expOk:null as null|boolean, payload:null as any, sigGiven:'', sigGood:'', reason:'no_cookie' }
  const [p64, sig] = raw.split('.')
  if (!p64 || !sig) return { present:true, valid:false, expOk:null, payload:null, sigGiven: sig||'', sigGood:'', reason:'bad_format' }
  let payload: any = null
  let expOk: null|boolean = null
  try {
    payload = JSON.parse(fromB64url(p64))
    if (typeof payload?.exp === 'number') expOk = payload.exp >= nowSec()
  } catch (e:any) {
    return { present:true, valid:false, expOk:null, payload:null, sigGiven:sig, sigGood:'', reason:'json_error' }
  }
  const good = hmacNode(AUTH_SECRET, p64)
  const sigOk = (sig === good)
  const valid = !!payload && sigOk && (expOk !== false)
  return { present:true, valid, expOk, payload, sigGiven:sig, sigGood:good, reason: sigOk ? (expOk===false?'expired':'ok') : 'sig_mismatch' }
}
function softDecision(raw: string | undefined) {
  if (!raw) return { present:false, decision:'redirect_login' }
  const [p64] = raw.split('.')
  if (!p64) return { present:true, decision:'pass' }
  try {
    const pj = JSON.parse(fromB64url(p64))
    if (typeof pj?.exp === 'number' && pj.exp < nowSec()) return { present:true, decision:'redirect_login' }
    return { present:true, decision:'pass' }
  } catch { return { present:true, decision:'pass' } }
}

export async function GET(req: Request) {
  const h = await headers()
  const ck = await cookies()
  const url = new URL(req.url)

  const host = h.get('host') || ''
  const COOKIE_DOMAIN = (process.env.COOKIE_DOMAIN || '').trim()

  const rawHost = ck.get(`__Host-${AUTH_COOKIE_NAME}`)?.value
  const rawNorm = ck.get(AUTH_COOKIE_NAME)?.value

  const hostChk = parseAndVerify(rawHost)
  const normChk = parseAndVerify(rawNorm)

  // Ce que ferait la NOUVELLE readSession()
  let chosen: 'host'|'norm'|'none' = 'none'
  if (hostChk.valid) chosen = 'host'
  else if (normChk.valid) chosen = 'norm'
  else chosen = 'none'

  const soft = softDecision(rawHost || rawNorm)

  return NextResponse.json({
    info: 'Auth health (Node). Compare variantes __Host- et normale, et montre la variante que readSession() retiendrait.',
    env: {
      AUTH_COOKIE_NAME,
      AUTH_SECRET_len: (process.env.AUTH_SECRET || '').length,
      SECRET_SALT_len: (process.env.SECRET_SALT || '').length,
      COOKIE_DOMAIN,
      hostCoveredByDomain: COOKIE_DOMAIN ? (host === COOKIE_DOMAIN.replace(/^\./,'') || host.endsWith(COOKIE_DOMAIN)) : true,
    },
    request: {
      url: url.toString(),
      host,
      xfh: h.get('x-forwarded-host') || '',
      previewDomain: /\.vercel\.app$/.test(host),
    },
    cookies: {
      allNames: ck.getAll().map(c => c.name),
      hostVariant: {
        present: hostChk.present,
        valid: hostChk.valid,
        expOk: hostChk.expOk,
        sigGivenPreview: trunc(hostChk.sigGiven, 24),
        sigGoodPreview: trunc(hostChk.sigGood, 24),
        reason: hostChk.reason,
        payloadPreview: hostChk.payload ? trunc(JSON.stringify(hostChk.payload), 80) : '',
      },
      normalVariant: {
        present: normChk.present,
        valid: normChk.valid,
        expOk: normChk.expOk,
        sigGivenPreview: trunc(normChk.sigGiven, 24),
        sigGoodPreview: trunc(normChk.sigGood, 24),
        reason: normChk.reason,
        payloadPreview: normChk.payload ? trunc(JSON.stringify(normChk.payload), 80) : '',
      },
      chosenByReadSession: chosen, // 'host' | 'norm' | 'none'
    },
    softMiddlewareSimulation: {
      present: soft.present,
      decision: soft.decision, // pass / redirect_login
    },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
}
