// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const COOKIE_NAME = 'pot_sess'

export const config = {
  matcher: [
    '/api/:path*',
    '/fr/:path*',
    '/en/:path*',
    // tout le reste sauf assets
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const host = req.headers.get('host') || ''
  const isAPI = pathname.startsWith('/api/')
  const method = req.method

  // 0) Canonical host = www.parcelsoftime.com
  //    - jamais pour /api/* (on ne rebondit pas un POST d’auth)
  //    - uniquement pour GET (pas de 308/307 sur form POST)
  if (!isAPI && method === 'GET' && host === 'parcelsoftime.com') {
    const u = new URL(req.url)
    u.host = 'www.parcelsoftime.com'
    u.protocol = 'https:'
    return NextResponse.redirect(u, 308)
  }

  // 1) Gardes pages protégées (hors API)
  if (!isAPI) {
    const guarded =
      /^\/(fr|en)\/(?:account|claim)(?:\/|$)/.test(pathname) ||
      /^\/(fr|en)\/m\/.+/.test(pathname)

    if (guarded) {
      const hasSess = !!req.cookies.get(COOKIE_NAME)
      if (!hasSess) {
        const loc = pathname.startsWith('/fr') ? 'fr' : 'en'
        const u = new URL(req.url)
        u.pathname = `/${loc}/login`
        u.search = ''
        u.searchParams.set('next', pathname + (search || ''))
        return NextResponse.redirect(u, 302)
      }
    }
  }

  return NextResponse.next()
}
