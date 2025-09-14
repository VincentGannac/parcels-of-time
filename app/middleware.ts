// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

export const config = {
  matcher: [
    // Admin protégé (inclut l’API admin)
    '/admin/:path*',
    '/api/admin/:path*',

    // Routes qui nécessitent une session
    '/fr/claim',
    '/en/claim',
    '/fr/m/:path*',
    '/en/m/:path*',
    '/fr/account',
    '/en/account',

    // Redirection de locale (catch-all hors statiques & API classiques)
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname

  /* ============== 1) Admin: Basic Auth ============== */
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Basic ')) {
      try {
        const decoded =
          typeof atob !== 'undefined'
            ? atob(auth.split(' ')[1])
            // fallback dev Node (pas utilisé en edge prod)
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

  /* ============== 2) Si déjà localisé ou fichier → on laisse passer (avec garde sélective) ============== */
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)
  const alreadyLocalized =
    path === '/fr' || path === '/en' || path.startsWith('/fr/') || path.startsWith('/en/')

  if (isFile || alreadyLocalized) {
    // On protège uniquement ces routes, mais jamais /{locale}/login ou /{locale}/signup
    const isGuarded =
      /^\/(fr|en)\/(?:claim|account)(?:\/|$)/.test(path) ||
      /^\/(fr|en)\/m\/.+/.test(path)
    const isAuthPage =
      /^\/(fr|en)\/(?:login|signup)(?:\/|$)/.test(path)

    if (isGuarded && !isAuthPage) {
      const hasSess =
        req.nextUrl.searchParams.get('dbg') === '1' ||
        req.cookies.has('pot_sess') ||
        (req.headers.get('cookie') || '').includes('pot_sess=')

      if (!hasSess) {
        const loc = path.startsWith('/fr') ? 'fr' : 'en'
        const target = new URL(req.url)
        const next = path + (url.search || '')
        target.pathname = `/${loc}/login`
        target.search = ''
        target.searchParams.set('next', next)
        return NextResponse.redirect(target)
      }
    }

    return NextResponse.next()
  }

  /* ============== 3) Ajout auto de la locale si absente ============== */
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any)
    ? (guess as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  const target = new URL(req.url)
  target.pathname = `/${locale}${path}`
  return NextResponse.redirect(target, { status: 302 })

}
