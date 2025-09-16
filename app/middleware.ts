// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

/** ====== CONFIG ====== */
const LOCALES = ['fr', 'en'] as const
type Locale = typeof LOCALES[number]

const DEFAULT_LOCALE: Locale =
  (process.env.NEXT_PUBLIC_DEFAULT_LOCALE === 'fr' ? 'fr' : 'en')

const CANONICAL_HOST =
  (process.env.NEXT_PUBLIC_CANONICAL_HOST || 'www.parcelsoftime.com').toLowerCase()

const ENFORCE_CANONICAL = (process.env.ENFORCE_CANONICAL ?? '1') === '1'
const ENFORCE_HTTPS = (process.env.ENFORCE_HTTPS ?? '1') === '1'

/** Nom du cookie de session (doit matcher ton lib/auth) */
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'pot_sess'

/** Cookie court pour post-login redirection */
const NEXT_COOKIE_NAME = 'pot_next'
const NEXT_COOKIE_TTL = 60 * 5 // 5 min

/** Préfixes non localisés à laisser tels quels (pages de partage, images OG, etc.) */
const NON_LOCALIZED_PREFIXES = ['/s/']

/** API auth (laisse passer, on fait juste une vérif CSRF légère) */
const AUTH_API_PREFIX = '/api/auth'

/** API webhooks/payment à ne jamais toucher */
const SAFE_API_PREFIXES = ['/api/stripe', '/api/cert', '/api/seconds', '/api/minutes', '/api/registry', '/api/unavailable', '/api/verify']

/** Pages nécessitant une session */
const AUTH_GUARDS = [
  /^\/(?:fr|en)\/claim(?:$|\/)/i,
  /^\/(?:fr|en)\/m\/.+/i,
  /^\/(?:fr|en)\/account(?:$|\/)/i,
]

/** ====== HELPERS ====== */
function hasLocalePrefix(pathname: string): { ok: boolean; locale?: Locale } {
  const m = /^\/(fr|en)(?:\/|$)/i.exec(pathname)
  if (!m) return { ok: false }
  return { ok: true, locale: (m[1] as Locale) }
}

function preferredLocale(req: NextRequest): Locale {
  const al = (req.headers.get('accept-language') || '').toLowerCase()
  return al.startsWith('fr') ? 'fr' : DEFAULT_LOCALE
}

function isAsset(path: string) {
  return (
    path.startsWith('/_next/') ||
    path.startsWith('/static/') ||
    path === '/favicon.ico' ||
    path.endsWith('.map') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml)$/i.test(path)
  )
}

function isApi(path: string) {
  return path.startsWith('/api/')
}

function isAuthApi(path: string) {
  return path.startsWith(AUTH_API_PREFIX)
}

function isSafeApi(path: string) {
  return SAFE_API_PREFIXES.some((p) => path.startsWith(p))
}

function needsAuth(path: string) {
  return AUTH_GUARDS.some((re) => re.test(path))
}

function sanitizeNext(nextRaw: string | null, locale: Locale): string {
  if (!nextRaw) return `/${locale}/account`
  let v = nextRaw
  // multi-decode tolérant
  try { for (let i = 0; i < 3; i++) { const d = decodeURIComponent(v); if (d === v) break; v = d } } catch {}
  // Interne uniquement
  if (!v.startsWith('/')) return `/${locale}/account`
  // Empêche d’injecter une URL cross-origin masquée
  if (/^\/\/|^\/\\/.test(v)) return `/${locale}/account`
  // Force une locale
  if (!/^\/(?:fr|en)(?:\/|$)/i.test(v)) v = `/${locale}${v}`
  return v
}

function redirectWith(req: NextRequest, url: URL, extra?: { setNextCookie?: string }) {
  const res = NextResponse.redirect(url)
  if (extra?.setNextCookie) {
    res.cookies.set({
      name: NEXT_COOKIE_NAME,
      value: extra.setNextCookie,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: NEXT_COOKIE_TTL,
    })
  }
  return res
}

/** ====== MIDDLEWARE ====== */
export function middleware(req: NextRequest) {
  const { nextUrl } = req
  const url = new URL(nextUrl) // clone
  const pathname = url.pathname
  const host = (req.headers.get('host') || url.host || '').toLowerCase()
  const proto = (req.headers.get('x-forwarded-proto') || url.protocol.replace(':','') || '').toLowerCase()

  // 0) Laisser passer assets
  if (isAsset(pathname)) return NextResponse.next()

  // 1) Injecter x-forwarded-* s’ils manquent (utile pour ton debug)
  const requestHeaders = new Headers(req.headers)
  if (!requestHeaders.get('x-forwarded-host')) requestHeaders.set('x-forwarded-host', host || url.host)
  if (!requestHeaders.get('x-forwarded-proto')) requestHeaders.set('x-forwarded-proto', proto || (url.protocol.replace(':','') || 'https'))

  // 2) HTTPS / domaine canonique (SANS toucher aux webhooks Stripe & Cie)
  if (!isApi(pathname) || isAuthApi(pathname)) {
    if (ENFORCE_HTTPS && proto === 'http') {
      url.protocol = 'https:'
      return NextResponse.redirect(url, { headers: requestHeaders })
    }
    if (ENFORCE_CANONICAL && host && host !== CANONICAL_HOST) {
      url.host = CANONICAL_HOST
      return NextResponse.redirect(url, { headers: requestHeaders })
    }
  }

  // 3) i18n — poser une locale si absente (sauf /api/*, /s/* et assets)
  if (!isApi(pathname) && !NON_LOCALIZED_PREFIXES.some(p => pathname.startsWith(p))) {
    const { ok } = hasLocalePrefix(pathname)
    if (!ok) {
      const loc = preferredLocale(req)
      url.pathname = `/${loc}${pathname}`
      return NextResponse.redirect(url, { headers: requestHeaders })
    }
  }

  // 4) Pages protégées → redirection vers /[locale]/login?next=...
  const locale = hasLocalePrefix(pathname).locale || preferredLocale(req)
  if (needsAuth(pathname)) {
    const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value
    if (!sessionCookie) {
      const nextTarget = sanitizeNext(`${pathname}${url.search}`, locale)
      url.pathname = `/${locale}/login`
      url.searchParams.set('next', nextTarget)
      return redirectWith(req, url, { setNextCookie: nextTarget })
    }
  }

  // 5) GET /[locale]/login — sanitizer `next` + poser cookie court pour post-login
  if (/^\/(?:fr|en)\/login(?:$|\/)/i.test(pathname) && req.method === 'GET') {
    const rawNext = url.searchParams.get('next')
    const safeNext = sanitizeNext(rawNext, locale)
    if (rawNext !== safeNext) {
      url.searchParams.set('next', safeNext)
      return redirectWith(req, url, { setNextCookie: safeNext })
    }
    // Rafraîchir le cookie next (qualité de vie si on reload)
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.cookies.set({
      name: NEXT_COOKIE_NAME,
      value: safeNext,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: NEXT_COOKIE_TTL,
    })
    return res
  }

  // 6) POST /api/auth/* — petite vérif CSRF (Origin/Referer même host)
  if (isAuthApi(pathname) && req.method === 'POST') {
    const origin = (req.headers.get('origin') || '').toLowerCase()
    const referer = (req.headers.get('referer') || '').toLowerCase()
    const expectedHost = CANONICAL_HOST

    const okOrigin =
      !!origin && (origin.endsWith(`://${expectedHost}`) || origin.includes(expectedHost))
    const okReferer =
      !!referer && (referer.includes(`://${expectedHost}/`) || referer.includes(`://${host}/`))

    if (!okOrigin && !okReferer) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: 'bad_origin' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // 7) Laisse tout passer (y compris /api/*, /s/*, etc.)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

/** ====== MATCHER ======
 * - on passe sur quasi tout, mais on épargne le gros des assets
 * - on inclut explicitement /api/auth/*
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
    '/api/auth/:path*',
  ],
}
