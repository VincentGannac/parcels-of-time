// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// ====== Config minimale (pas de secret ici !) ======
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'

// fichiers statiques
function isFile(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}
function getLocale(pathname: string): 'fr' | 'en' {
  if (pathname.startsWith('/fr')) return 'fr'
  if (pathname.startsWith('/en')) return 'en'
  return 'en'
}

const REQUIRE_AUTH = [
  /^\/(fr|en)\/account\/?$/,
  /^\/(fr|en)\/claim\/?$/,
]
const AUTH_FORMS = [/^\/(fr|en)\/login\/?$/, /^\/(fr|en)\/signup\/?$/]

// — lecture "douce" du cookie (SANS vérif HMAC !)
//   on essaye juste de décoder le payload pour contrôler exp, si présent.
function readCookieSoft(req: NextRequest) {
  try {
    const raw =
      req.cookies.get(`__Host-${AUTH_COOKIE_NAME}`)?.value ||
      req.cookies.get(AUTH_COOKIE_NAME)?.value ||
      ''
    if (!raw) return { present: false as const }

    const [p64, sig] = raw.split('.')
    if (!p64) return { present: true as const } // présence suffit

    // base64url -> string
    const b64 = p64.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0
    const s = b64 + '='.repeat(pad)
    let payload: any = null
    try {
      const bin = atob(s)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const json = new TextDecoder().decode(bytes)
      payload = JSON.parse(json)
    } catch {
      // si on n’arrive pas à parser, on ne bloque pas côté Edge
      return { present: true as const }
    }

    // contrôle d’expiration "soft"
    if (payload && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        return { present: false as const } // manifestement expiré
      }
    }
    return { present: true as const }
  } catch {
    return { present: false as const }
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // 0) Canonical host -> www (prod)
  const host = req.headers.get('host') || ''
  const isProd = process.env.VERCEL_ENV === 'production'
  const isVercelPreview = /\.vercel\.app$/.test(host)
  if (isProd && !isVercelPreview && host === 'parcelsoftime.com') {
    const url = new URL(req.url)
    url.host = 'www.parcelsoftime.com'
    return NextResponse.redirect(url, 308)
  }

  // 1) Ignore assets, fichiers, API
  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (isFile(pathname)) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()

  const locale = getLocale(pathname)
  const sessionSoft = readCookieSoft(req)

  // 2) Si déjà "connecté" (présence cookie) → empêcher /login & /signup
  if (sessionSoft.present && AUTH_FORMS.some(rx => rx.test(pathname))) {
    return NextResponse.redirect(new URL(`/${locale}/account`, req.url))
  }

  // 3) Protéger /account et /claim par présence de cookie (soft)
  if (!sessionSoft.present && REQUIRE_AUTH.some(rx => rx.test(pathname))) {
    const url = new URL(`/${locale}/login`, req.url)
    const next = pathname + (search || '')
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  // 4) Le reste passe
  return NextResponse.next()
}

// Matcher global, exclut _next et fichiers courants
export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
