// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

// un seul cookie métier
const COOKIE_NAME = 'pot_sess'

export const config = {
  matcher: [
    // ⚠️ exclut /api et les assets
    '/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
    // admin API protégé (basique)
    '/api/admin/:path*',
  ],
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // 0) Admin basique
  if (pathname.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Basic ')) {
      try {
        const [u, p] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':')
        if (u === (process.env.ADMIN_USER || 'admin') && p === (process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123')) {
          return NextResponse.next()
        }
      } catch {}
    }
    return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } })
  }

  // 1) Si fichier → passe
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return NextResponse.next()

  // 2) Routes déjà localisées
  const isLocalized = pathname === '/fr' || pathname === '/en' || pathname.startsWith('/fr/') || pathname.startsWith('/en/')
  if (isLocalized) {
    const guard =
      /^\/(fr|en)\/(?:claim|account)(?:\/|$)/.test(pathname) ||
      /^\/(fr|en)\/m\/.+/.test(pathname)

    const isAuthPage = /^\/(fr|en)\/(?:login|signup)(?:\/|$)/.test(pathname)

    if (guard && !isAuthPage) {
      // ✅ lecture robuste: on scanne l'entête Cookie brut (évite les doublons et les parsers capricieux)
      const raw = req.headers.get('cookie') || ''
      const hasSess = raw.includes(`${COOKIE_NAME}=`)
      if (!hasSess) {
        const loc = pathname.startsWith('/fr') ? 'fr' : 'en'
        const target = req.nextUrl.clone()
        target.pathname = `/${loc}/login`
        target.search = ''
        target.searchParams.set('next', pathname + (search || ''))
        return NextResponse.redirect(target, 302)
      }
    }
    return NextResponse.next()
  }

  // 3) Préfixe locale si absente (jamais pour /api car exclu par matcher)
  const al = (req.headers.get('accept-language') || '').split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(al as any) ? (al as (typeof LOCALES)[number]) : DEFAULT_LOCALE

  const target = req.nextUrl.clone()
  target.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(target, 302)
}
