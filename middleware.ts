// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Helpers
function isFile(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

const SUPPORTED_LOCALES = ['fr', 'en'] as const
type Locale = (typeof SUPPORTED_LOCALES)[number]
const FALLBACK: Locale = 'en'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 0) Canonical host -> www en prod (hors préview vercel)
  const host = req.headers.get('host') || ''
  const isProd = process.env.VERCEL_ENV === 'production'
  const isVercelPreview = /\.vercel\.app$/.test(host)
  const isApi = pathname.startsWith('/api')

  if (isProd && !isVercelPreview && host === 'parcelsoftime.com' && !isApi) {
    const url = new URL(req.url)
    url.host = 'www.parcelsoftime.com'
    return NextResponse.redirect(url, 308)
  }

  // 1) Laisse passer assets / fichiers / API
  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (isFile(pathname)) return NextResponse.next()
  if (isApi) return NextResponse.next()

  // 2) Si déjà sous /fr ou /en → next()
  const firstSeg = pathname.split('/').find(Boolean) ?? ''
  if (isLocale(firstSeg)) {
    return NextResponse.next()
  }

  // 3) Détection de langue pour la racine
  if (pathname === '/' || pathname === '') {
    const langHeader = (req.headers.get('accept-language') || '').toLowerCase()
    const guessRaw = langHeader.split(',')[0]?.split('-')[0] ?? ''
    const locale: Locale = isLocale(guessRaw) ? guessRaw : FALLBACK
    const url = new URL(`/${locale}`, req.url)
    return NextResponse.redirect(url, 307)
  }

  // 4) Autres chemins non localisés (rares) → laisser passer
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
