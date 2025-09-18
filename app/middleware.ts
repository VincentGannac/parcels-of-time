import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'

// -------- lecture "loose" du payload (PAS de HMAC ici) --------
type SessionPayload = { ownerId: string; email: string; displayName?: string | null; iat?: number; exp?: number }
function base64UrlToString(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0
  const s = b64 + '='.repeat(pad)
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
function getLocale(pathname: string): 'fr' | 'en' {
  if (pathname.startsWith('/fr')) return 'fr'
  if (pathname.startsWith('/en')) return 'en'
  return 'en'
}
function isFile(pathname: string) { return /\.[a-zA-Z0-9]+$/.test(pathname) }
function safeNext(nxt: string | null, locale: 'fr' | 'en') {
  if (!nxt) return `/${locale}/account`
  if (!/^\/(fr|en)\//.test(nxt)) return `/${locale}/account`
  if (/^\/(fr|en)\/login/.test(nxt)) return `/${locale}/account`
  return nxt
}
function readSessionLoose(req: NextRequest): SessionPayload | null {
  const raw =
    req.cookies.get(`__Host-${AUTH_COOKIE_NAME}`)?.value ||
    req.cookies.get(AUTH_COOKIE_NAME)?.value ||
    ''
  if (!raw) return null
  const [p64] = raw.split('.')
  if (!p64) return null
  try {
    const json = base64UrlToString(p64)
    const obj = JSON.parse(json) as SessionPayload
    // on ne fait qu’un filtrage grossier d’expiration
    if (obj?.exp && typeof obj.exp === 'number' && obj.exp < Math.floor(Date.now() / 1000)) return null
    return obj
  } catch { return null }
}

// -------- règles --------
// ✅ on protège /account et /claim (PAS /m/[ts] → lecture publique)
const REQUIRE_AUTH = [/^\/(fr|en)\/account$/, /^\/(fr|en)\/claim$/]
const AUTH_FORMS   = [/^\/(fr|en)\/login$/, /^\/(fr|en)\/signup$/]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()
  if (isFile(pathname)) return NextResponse.next()

  const locale = getLocale(pathname)
  const session = readSessionLoose(req)

  // Déjà connecté sur /login ou /signup → on RESPECTE ?next=
  if (session && AUTH_FORMS.some(rx => rx.test(pathname))) {
    const wanted = safeNext(req.nextUrl.searchParams.get('next'), locale)
    return NextResponse.redirect(new URL(wanted, req.url))
  }

  // Anonyme sur page protégée → /login?next=
  if (!session && REQUIRE_AUTH.some(rx => rx.test(pathname))) {
    const url = new URL(`/${locale}/login`, req.url)
    url.searchParams.set('next', pathname + (req.nextUrl.search || ''))
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
