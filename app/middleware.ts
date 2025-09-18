// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// ====== Config clés & nom de cookie (doit matcher lib/auth.ts) ======
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.SECRET_SALT || 'dev_salt'

// ====== Utils base64url (Edge) ======
function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  // btoa -> base64, puis conversion url-safe
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function base64UrlDecodeToString(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0
  const s = b64 + '='.repeat(pad)
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

// HMAC SHA-256 (Edge WebCrypto)
async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64UrlEncode(new Uint8Array(sig))
}

// timing-safe compare
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

// ====== Lecture & vérification de la session depuis le cookie ======
type SessionPayload = {
  ownerId: string
  email: string
  displayName?: string | null
  iat?: number
  exp?: number
}
async function readSessionFromCookie(req: NextRequest): Promise<SessionPayload | null> {
  try {
    const raw = req.cookies.get(AUTH_COOKIE_NAME)?.value
    if (!raw) return null
    const [p64, sig] = raw.split('.')
    if (!p64 || !sig) return null
    const good = await hmacSha256Base64Url(AUTH_SECRET, p64)
    if (!timingSafeEqual(sig, good)) return null
    const json = base64UrlDecodeToString(p64)
    const obj = JSON.parse(json) as SessionPayload
    if (obj?.exp && typeof obj.exp === 'number') {
      const now = Math.floor(Date.now() / 1000)
      if (obj.exp < now) return null
    }
    return obj
  } catch {
    return null
  }
}

// ====== Routage ======
const REQUIRE_AUTH = [
  /^\/(fr|en)\/account$/,
  /^\/(fr|en)\/m\/.+$/,
]
const AUTH_FORMS = [/^\/(fr|en)\/login$/, /^\/(fr|en)\/signup$/]

// détecte fichiers statiques
function isFile(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}
function getLocale(pathname: string): 'fr' | 'en' {
  if (pathname.startsWith('/fr')) return 'fr'
  if (pathname.startsWith('/en')) return 'en'
  return 'en'
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // 1) Ignore assets & fichiers & API (auth gérée dans les route handlers)
  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (isFile(pathname)) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()

  const locale = getLocale(pathname)
  const session = await readSessionFromCookie(req)

  // 2) Déjà connecté → empêcher d’ouvrir /login et /signup
  if (session && AUTH_FORMS.some(rx => rx.test(pathname))) {
    const url = new URL(`/${locale}/account`, req.url)
    return NextResponse.redirect(url)
  }

  // 3) Enforce auth pour /account et /m/*
  if (!session && REQUIRE_AUTH.some(rx => rx.test(pathname))) {
    const url = new URL(`/${locale}/login`, req.url)
    const next = pathname + (search || '')
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  // 4) Laisser passer pour le reste
  return NextResponse.next()
}

// Matcher global, exclut _next et fichiers courants
export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
