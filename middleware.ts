// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

const SUPPORTED_LOCALES = ['fr', 'en'] as const
type Locale = (typeof SUPPORTED_LOCALES)[number]
const FALLBACK: Locale = 'en'

function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(x as any)
}

function pickLocaleFromAcceptLanguage(al: string): Locale {
  const items = (al || '')
    .split(',')
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Laisse passer assets / fichiers / API
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || /\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next()
  }

  // Déjà localisé → on laisse passer
  const firstSeg = pathname.split('/').find(Boolean) ?? ''
  if (isLocale(firstSeg)) return NextResponse.next()

  // Racine → redirige selon cookie puis Accept-Language
  if (pathname === '/' || pathname === '') {
    const cookieLoc = req.cookies.get('pt_locale')?.value
    const loc: Locale = isLocale(cookieLoc) ? cookieLoc : pickLocaleFromAcceptLanguage(req.headers.get('accept-language') || '')

    const url = new URL(`/${loc}`, req.url)
    const res = NextResponse.redirect(url, 307)
    res.cookies.set('pt_locale', loc, { path: '/', maxAge: 60 * 60 * 24 * 365 }) // 1 an
    return res
  }

  // Autre chemin non localisé → réécrit vers la locale par défaut
  const url = req.nextUrl.clone()
  url.pathname = `/${FALLBACK}${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
