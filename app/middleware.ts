// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'
const COOKIE_NAME = '__Host-pot_sess' // host-only, Secure, Path=/, sans Domain

export const config = {
  matcher: [
    '/api/:path*',
    '/fr/:path*',
    '/en/:path*',
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const hostHeader = (req.headers.get('host') || '').toLowerCase()

  // 0) Canonical host : redirige TOUS les "www.*" vers l'apex, toute route confondue
  if (hostHeader.startsWith('www.')) {
    const target = new URL(req.url)
    target.host = hostHeader.slice(4) // retire "www."
    target.protocol = 'https:'
    return NextResponse.redirect(target, 308) // 308 pour préserver la méthode (POST)
  }

  // 1) Admin basique (inchangé)
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Basic ')) {
      try {
        const token = auth.split(' ')[1]
        const decoded =
          typeof atob !== 'undefined'
            ? atob(token)
            : Buffer.from(token, 'base64').toString()
        const [u, p] = decoded.split(':')
        const USER = process.env.ADMIN_USER || 'admin'
        const PASS = process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123'
        if (u === USER && p === PASS) return NextResponse.next()
      } catch {}
    }
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  // 2) Fichiers statiques (par sécurité) et détection locale
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)
  const alreadyLocalized = path === '/fr' || path === '/en' || path.startsWith('/fr/') || path.startsWith('/en/')

  // 2bis) Ne JAMAIS préfixer /api/* avec une locale
  if (path.startsWith('/api/')) {
    // Protection des endpoints API admin gérée plus haut,
    // ici on laisse passer sans préfixe de locale.
    return NextResponse.next()
  }

  if (isFile || alreadyLocalized) {
    // Pages/segments localisés : protège certaines routes
    const isGuarded =
      /^\/(fr|en)\/(?:claim|account)(?:\/|$)/.test(path) ||
      /^\/(fr|en)\/m\/.+/.test(path)
    const isAuthPage = /^\/(fr|en)\/(?:login|signup)(?:\/|$)/.test(path)

    if (isGuarded && !isAuthPage) {
      const hasSess = !!req.cookies.get(COOKIE_NAME)
      if (!hasSess) {
        const loc = path.startsWith('/fr') ? 'fr' : 'en'
        const target = new URL(req.url)
        const next = path + (url.search || '')
        target.pathname = `/${loc}/login`
        target.search = ''
        target.searchParams.set('next', next)
        return NextResponse.redirect(target, 302)
      }
    }

    return NextResponse.next()
  }

  // 3) Préfixe de locale si absente (pour les pages non localisées et non-fichiers)
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any)
    ? (guess as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  const target = new URL(req.url)
  target.pathname = `/${locale}${path}`
  return NextResponse.redirect(target, 302)
}
