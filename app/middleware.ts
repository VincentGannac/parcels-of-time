import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr','en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

// Admin Basic Auth (Edge-safe: atob)
const USER = process.env.ADMIN_USER || 'admin'
const PASS = process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123'

export const config = {
  matcher: [
    // Intercepte tout SAUF api/_next/assets/favicons/fichiers statiques
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname

  // 1) Admin: Basic Auth
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Basic ')) {
      const decoded = (typeof atob !== 'undefined')
        ? atob(auth.split(' ')[1])
        : Buffer.from(auth.split(' ')[1], 'base64').toString() // fallback Node (dev)
      const [u, p] = decoded.split(':')
      if (u === USER && p === PASS) return NextResponse.next()
    }
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  // 2) Files et chemins déjà localisés → on ne touche pas
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)
  const alreadyLocalized = LOCALES.some(l => path === `/${l}` || path.startsWith(`/${l}/`))
  if (isFile || alreadyLocalized) return NextResponse.next()

  // 3) Redirection / → /{locale}
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any)
    ? (guess as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  url.pathname = `/${locale}${path}`
  return NextResponse.redirect(url)
}
