// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr','en'] as const
const DEFAULT_LOCALE = 'en' as const

export const config = {
  matcher: [
    // Ne PAS matcher l’API
    '/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
    '/fr/:path*',
    '/en/:path*',
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const host = req.headers.get('host') || ''

  // Aligner avec Vercel (traces: apex -> www). Canonique: www
  if (host === 'parcelsoftime.com') {
    const target = new URL(req.url)
    target.host = 'www.parcelsoftime.com'
    target.protocol = 'https:'
    return NextResponse.redirect(target, 308)
  }

  // Laisser passer toute l'API (sécurité)
  if (path.startsWith('/api/')) return NextResponse.next()

  // Routes localisées déjà
  const alreadyLoc = path === '/fr' || path === '/en' || path.startsWith('/fr/') || path.startsWith('/en/')
  if (alreadyLoc) {
    // Garde : account, claim, m/*
    const isGuarded = /^\/(fr|en)\/(?:account|claim|m\/)/.test(path)
    const isAuth = /^\/(fr|en)\/(?:login|signup)(?:\/|$)/.test(path)

    if (isGuarded && !isAuth) {
      // Lecture cookie robuste (évite bugs de parse multi entrées)
      const ch = req.headers.get('cookie') || ''
      const hasSess = /(?:^|;\s*)pot_sess=/.test(ch)
      if (!hasSess) {
        const loc = path.startsWith('/fr') ? 'fr' : 'en'
        const next = path + (url.search || '')
        const dest = new URL(req.url)
        dest.pathname = `/${loc}/login`
        dest.search = ''
        dest.searchParams.set('next', next)
        return NextResponse.redirect(dest, 302)
      }
    }
    return NextResponse.next()
  }

  // Préfixe de locale
  const guess = (req.headers.get('accept-language') || '').split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any) ? (guess as 'fr'|'en') : DEFAULT_LOCALE
  const target = new URL(req.url)
  target.pathname = `/${locale}${path}`
  return NextResponse.redirect(target, 302)
}
