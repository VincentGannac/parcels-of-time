// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'
const COOKIE_NAME_MAIN = '__Host-pot_sess'
const COOKIE_NAME_COMP = 'pot_sess'

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
  const host = req.headers.get('host') || ''

  // 0) Canonique : apex (sans www) — si tu veux forcer www, inverse la logique
  if (host === 'www.parcelsoftime.com') {
    const target = new URL(req.url)
    target.host = 'parcelsoftime.com'
    target.protocol = 'https:'
    return NextResponse.redirect(target, 308)
  }

  // 1) Admin (inchangé)
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Basic ')) {
      try {
        const decoded =
          typeof atob !== 'undefined'
            ? atob(auth.split(' ')[1])
            : Buffer.from(auth.split(' ')[1], 'base64').toString()
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

  // 2) Routes déjà localisées
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)
  const alreadyLocalized = path === '/fr' || path === '/en' || path.startsWith('/fr/') || path.startsWith('/en/')

  if (isFile || alreadyLocalized) {
    const isGuarded =
      /^\/(fr|en)\/(?:claim|account)(?:\/|$)/.test(path) ||
      /^\/(fr|en)\/m\/.+/.test(path)
    const isAuthPage = /^\/(fr|en)\/(?:login|signup)(?:\/|$)/.test(path)

    if (isGuarded && !isAuthPage) {
      const hasSess = !!(req.cookies.get(COOKIE_NAME_MAIN) || req.cookies.get(COOKIE_NAME_COMP))
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

  // 3) Pref. locale
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any)
    ? (guess as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  const target = new URL(req.url)
  target.pathname = `/${locale}${path}`
  return NextResponse.redirect(target, 302)
}
