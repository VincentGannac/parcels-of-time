// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

const COOKIE = 'pot_sess'
const LOCALES = ['fr', 'en'] as const
const isLocalized = (p: string) => /^\/(fr|en)(\/|$)/.test(p)

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const isFile = /\.[a-z0-9]+$/i.test(pathname)
  if (isFile) return NextResponse.next()

  // Guard: pages protégées
  const guarded = /^\/(fr|en)\/(?:account|claim|m\/.+)(\/|$|\?)/.test(pathname)
  const auth    = /^\/(fr|en)\/(?:login|signup)(\/|$|\?)/.test(pathname)

  if (guarded && !auth) {
    const has = Boolean(req.cookies.get(COOKIE))
    if (!has) {
      const loc = pathname.startsWith('/fr') ? 'fr' : 'en'
      const url = req.nextUrl.clone()
      url.pathname = `/${loc}/login`
      url.search = ''
      url.searchParams.set('next', pathname + search)
      return NextResponse.redirect(url, 302)
    }
  }

  // Préfixe locale si absent
  if (!isLocalized(pathname)) {
    const lang = req.headers.get('accept-language')?.split(',')[0]?.split('-')[0]?.toLowerCase()
    const locale: (typeof LOCALES)[number] = lang === 'fr' ? 'fr' : 'en'
    const url = req.nextUrl.clone()
    url.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(url, 302)
  }

  return NextResponse.next()
}
