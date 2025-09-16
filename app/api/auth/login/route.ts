// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

// --- à adapter à ta DB ---
async function verifyUser(email: string, password: string) {
  // TODO: remplace par ta vraie vérification (hash en DB, etc.)
  // Retourne l'ownerId si OK, sinon null.
  if (!email || !password) return null
  // EXEMPLE SEULEMENT
  return { ownerId: crypto.createHash('sha1').update(email).digest('hex').slice(0, 16) }
}

// --- session HMAC simple (pas de JWT nécessaire) ---
const COOKIE_NAME = 'pot_sess'
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 jours
const SECRET = process.env.SECRET_SALT || 'dev_salt'

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}
function packSession(s: { ownerId: string; exp: number }) {
  const payload = Buffer.from(JSON.stringify(s)).toString('base64url')
  const sig = sign(payload)
  return `${payload}.${sig}`
}

// Utilise un domaine explicite pour couvrir apex + www
function cookieDomainFromHost(host: string | null): string | undefined {
  // Préfère env si fourni (recommandé en prod)
  const envDom = process.env.COOKIE_DOMAIN?.trim()
  if (envDom) return envDom // ex: ".parcelsoftime.com"
  if (!host) return undefined
  // enlève le port, et colle le cookie au domaine racine
  const h = host.split(':')[0].toLowerCase()
  if (h.endsWith('.parcelsoftime.com') || h === 'parcelsoftime.com') return '.parcelsoftime.com'
  // fallback: host-only
  return undefined
}

function safeNextPath(next: string | null | undefined, localeFallback = 'en') {
  if (!next) return `/${localeFallback}/account`
  // n’autorise que des chemins internes
  try {
    const u = new URL(next, 'https://x')
    if (u.origin !== 'https://x') return `/${localeFallback}/account`
    if (!u.pathname.startsWith('/')) return `/${localeFallback}/account`
    return u.pathname + (u.search || '')
  } catch {
    // next était probablement un chemin simple (ex: "/fr/account")
    if (next.startsWith('/')) return next
    return `/${localeFallback}/account`
  }
}

async function parseBody(req: Request) {
  const ct = req.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({}))
    return { email: j.email || '', password: j.password || '', locale: j.locale || 'en', next: j.next || '' }
  }
  // x-www-form-urlencoded
  const txt = await req.text()
  const sp = new URLSearchParams(txt)
  return {
    email: sp.get('email') || '',
    password: sp.get('password') || '',
    locale: (sp.get('locale') || 'en').toLowerCase(),
    next: sp.get('next') || '',
  }
}

export async function POST(req: Request) {
  const { email, password, locale, next } = await parseBody(req)
  if (!email || !password) {
    // on reste compatible avec ta page: ?err=missing
    const loc = `/${locale || 'en'}/login?err=missing${next ? `&next=${encodeURIComponent(next)}` : ''}`
    return NextResponse.redirect(new URL(loc, req.url))
  }

  const user = await verifyUser(String(email).trim().toLowerCase(), String(password))
  if (!user) {
    const loc = `/${locale || 'en'}/login?err=badcreds${next ? `&next=${encodeURIComponent(next)}` : ''}`
    return NextResponse.redirect(new URL(loc, req.url))
  }

  // construit la session
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS
  const value = packSession({ ownerId: user.ownerId, exp })

  // prépare la redirection finale
  const nextPath = safeNextPath(next, (locale || 'en').toLowerCase())
  const res = NextResponse.redirect(new URL(nextPath, req.url), { status: 303 }) // 303 pour convertir POST -> GET

  // pose le cookie
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const domain = cookieDomainFromHost(host)
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_TTL_SECONDS,
    ...(domain ? { domain } : {}),
  })

  return res
}
