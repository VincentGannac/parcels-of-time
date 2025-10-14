// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
type Locale = (typeof LOCALES)[number]
const FALLBACK: Locale = 'en'

function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x as any)
}

function pickLocaleFromAcceptLanguage(al: string): Locale {
  // Défense légère : limite le parsing des langues pour éviter des en-têtes géants
  const items = (al || '')
    .split(',')
    .slice(0, 10)
    .map(s => {
      const [tag, ...rest] = s.trim().split(';')
      const q = parseFloat(rest.find(p => p.trim().startsWith('q='))?.split('=')[1] || '1')
      const base = tag.toLowerCase().split('-')[0]
      return { base, q }
    })
    .sort((a, b) => b.q - a.q)

  const found = items.find(i => isLocale(i.base))?.base
  return (found as Locale) || FALLBACK
}

function withSecurityHeaders(res: NextResponse, req: NextRequest) {
  const host = req.headers.get('host') || ''
  const isLocal =
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.endsWith('.test') ||
    host.endsWith('.local')
  const isProdLike = !isLocal

  // En-têtes "safe-by-default" (faible risque de régression)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  // Politique permissions par défaut (désactive accès capteurs/API sensibles)
  res.headers.set(
    'Permissions-Policy',
    // Ajuste si tu utilises l'une de ces API côté client
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()'
  )

  // CSP en mode "Report-Only" pour ne rien casser (tu pourras durcir plus tard)
  // - autorise inline/https pour éviter blocages, mais signale les écarts
  // - verrouille les iframes aux origines sûres
  // - autorise Stripe Checkout en form-action
  const cspReportOnly = [
    "default-src 'self' https: data: blob:",
    "script-src 'self' 'unsafe-inline' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'self'",
    "frame-src https:",
    "form-action 'self' https://checkout.stripe.com",
    'base-uri self',
    'upgrade-insecure-requests',
  ].join('; ')
  res.headers.set('Content-Security-Policy-Report-Only', cspReportOnly)

  // HSTS seulement hors local pour ne pas polluer le dev (navigateur)
  if (isProdLike) {
    // 2 ans, sous-domaines, et compatible "preload" (si tu veux l’inscrire)
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }

  return res
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Laisser passer assets/fichiers statiques → mais on ajoute quand même les en-têtes
  if (
    pathname.startsWith('/_next') ||
    /\.[a-zA-Z0-9]+$/.test(pathname) ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    const res = NextResponse.next()
    return withSecurityHeaders(res, req)
  }

  // Pour l'API, on passe mais on garde les en-têtes de sécurité "safe"
  if (pathname.startsWith('/api')) {
    const res = NextResponse.next()
    return withSecurityHeaders(res, req)
  }

  // Si déjà /fr ou /en → rien à faire (mais ajoute les en-têtes)
  const first = pathname.split('/').find(Boolean) ?? ''
  if (isLocale(first)) {
    const res = NextResponse.next()
    return withSecurityHeaders(res, req)
  }

  // Racine → redirige vers la locale (cookie puis Accept-Language)
  if (pathname === '/' || pathname === '') {
    const cookieLoc = req.cookies.get('pt_locale')?.value
    const loc: Locale = isLocale(cookieLoc)
      ? cookieLoc
      : pickLocaleFromAcceptLanguage(req.headers.get('accept-language') || '')

    const res = NextResponse.redirect(new URL(`/${loc}`, req.url), 307)
    // Cookie de langue plus strict (HttpOnly, Secure, SameSite=Lax)
    res.cookies.set('pt_locale', loc, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
      // ⚠️ Garde le domaine si tu dois partager entre apex et www.
      // Pour surface d'attaque minimale, tu peux l'enlever si non nécessaire :
      domain: '.parcelsoftime.com',
    })

    // Pas de cache pour la redirection locale
    res.headers.set('Cache-Control', 'no-store')

    // En dev, on laisse l’info de debug ; en prod, on n’expose pas ce header
    if (process.env.NODE_ENV !== 'production') {
      res.headers.set('x-pt-reason', 'root-redirect')
    }

    return withSecurityHeaders(res, req)
  }

  // Pour tout chemin non localisé → laisse passer (404 si mauvais chemin) + en-têtes
  const res = NextResponse.next()
  return withSecurityHeaders(res, req)
}

// S'applique à tout sauf fichiers statiques explicites (cohérent avec nos checks)
export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
