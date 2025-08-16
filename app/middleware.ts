// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

// --- Admin Basic Auth
const USER = process.env.ADMIN_USER || 'admin'
const PASS = process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123'

// IMPORTANT: inclure '/' et ignorer _next, api, et fichiers
export const config = {
  matcher: ['/', '/((?!_next|api|.*\\..*).*)'],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname

  // 1) ADMIN / API ADMIN → Basic Auth
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization')
    if (auth?.startsWith('Basic ')) {
      const [u, p] = Buffer.from(auth.replace('Basic ', ''), 'base64').toString().split(':')
      if (u === USER && p === PASS) return NextResponse.next()
    }
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  // 2) i18n — si pas encore préfixé /fr ou /en → rediriger
  const alreadyLocalized = LOCALES.some(
    (l) => path === `/${l}` || path.startsWith(`/${l}/`)
  )
  if (alreadyLocalized) return NextResponse.next()

  // Détection Accept-Language simple
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase() || DEFAULT_LOCALE
  const locale = (LOCALES as readonly string[]).includes(guess) ? guess : DEFAULT_LOCALE

  url.pathname = `/${locale}${path === '/' ? '' : path}`
  return NextResponse.redirect(url)
}
