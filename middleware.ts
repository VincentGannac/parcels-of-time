// middleware.ts (RACINE du projet)
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// --- Réglages (adapter si besoin) ---
const PROD_HOST = 'www.parcelsoftime.com'
const APEX_HOST = 'parcelsoftime.com'
const COOKIE_NAME = 'pot_sess'              // ton cookie d'auth (variante __Host- possible)
const LOCALES = ['fr', 'en'] as const
type Locale = (typeof LOCALES)[number]

// --- Utils ---
function isAsset(pathname: string) {
  return pathname.startsWith('/_next')
    || pathname.startsWith('/static')
    || /\.[a-z0-9]+$/i.test(pathname)
}

function getLocaleFromPath(pathname: string): Locale | undefined {
  const m = pathname.match(/^\/(fr|en)(?:\/|$)/)
  return m?.[1] as Locale | undefined
}

function isVercelPreviewHost(host: string) {
  return /\.vercel\.app$/.test(host)
}

function safeNext(url: URL, fallback: string) {
  // Évite les open-redirects : n'autorise que /fr/... ou /en/...
  const raw = url.searchParams.get('next')
  if (!raw) return fallback
  try {
    const decoded = decodeURIComponent(raw)
    if (/^\/(fr|en)\//.test(decoded)) return decoded
    return fallback
  } catch {
    return fallback
  }
}

// --- Middleware ---
export function middleware(req: NextRequest) {
  const { nextUrl, headers, method, cookies } = req
  const host = headers.get('host') || nextUrl.host
  const pathname = nextUrl.pathname
  const isProd = process.env.VERCEL_ENV === 'production'
  const isPreview = isVercelPreviewHost(host)

  // 1) Canonical host (prod seulement, pas sur les previews vercel.app)
  if (isProd && !isPreview && host === APEX_HOST) {
    const url = new URL(req.url)
    url.host = PROD_HOST
    return NextResponse.redirect(url, 308)
  }

  // 2) Ignore assets et API
  if (isAsset(pathname) || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // 3) Si on tente d’afficher la page de login alors qu'il y a déjà une session → rediriger tout de suite
  //    (évite le besoin de “revenir au menu”)
  if (method === 'GET' && /^\/(fr|en)\/login\/?$/.test(pathname)) {
    const hasSess =
      Boolean(cookies.get(COOKIE_NAME)?.value) ||
      Boolean(cookies.get(`__Host-${COOKIE_NAME}`)?.value)

    const err = nextUrl.searchParams.get('err')
    if (hasSess && !err) {
      const locale = (getLocaleFromPath(pathname) ?? 'fr') as Locale
      const to = safeNext(nextUrl, `/${locale}/account`)
      const res = NextResponse.redirect(new URL(to, nextUrl.origin), 307)
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
  }

  // 4) Tout le reste passe
  return NextResponse.next()
}

// Matcher global (exclut assets/fichiers)
export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
