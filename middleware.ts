// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
type Locale = (typeof LOCALES)[number]
const FALLBACK: Locale = 'en'

function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x as any)
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

  // Laisser passer assets/API/fichiers
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Si déjà /fr ou /en → rien à faire
  const first = pathname.split('/').find(Boolean) ?? ''
  if (isLocale(first)) return NextResponse.next()

  // Racine → redirige vers la locale (cookie puis Accept-Language)
  if (pathname === '/' || pathname === '') {
    const cookieLoc = req.cookies.get('pt_locale')?.value
    const loc: Locale = isLocale(cookieLoc)
      ? cookieLoc
      : pickLocaleFromAcceptLanguage(req.headers.get('accept-language') || '')

    const res = NextResponse.redirect(new URL(`/${loc}`, req.url), 307)
    // Cookie partagé sous-domaine, non cacheable
    res.cookies.set('pt_locale', loc, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: true,
      domain: '.parcelsoftime.com',
    })
    res.headers.set('Cache-Control', 'no-store')
    res.headers.set('x-pt-reason', 'root-redirect')
    return res
  }

  // Pour tout chemin non localisé → on laisse passer (404 si mauvais chemin)
  return NextResponse.next()
}

// S'applique à tout sauf fichiers statiques explicites
export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
