// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

// --- Admin Basic Auth (inchangé)
const USER = process.env.ADMIN_USER || 'admin'
const PASS = process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123'

export const config = {
  // On intercepte tout (sauf assets Next) pour gérer i18n et /admin
  matcher: ['/((?!_next).*)'],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname

  // 1) ADMIN / API ADMIN → Basic Auth
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization')
    if (auth && auth.startsWith('Basic ')) {
      const [u, p] = Buffer.from(auth.replace('Basic ', ''), 'base64')
        .toString()
        .split(':')
      if (u === USER && p === PASS) return NextResponse.next()
    }
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  // 2) i18n redirect par préfixe /fr /en
  // On ignore API, fichiers statiques et pages déjà localisées
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)
  const alreadyLocalized = LOCALES.some(
    (l) => path === `/${l}` || path.startsWith(`/${l}/`)
  )
  if (path.startsWith('/api') || isFile || alreadyLocalized) {
    return NextResponse.next()
  }

  // Détection Accept-Language très simple
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase() || DEFAULT_LOCALE
  const locale = (LOCALES as readonly string[]).includes(guess) ? guess : DEFAULT_LOCALE

  url.pathname = `/${locale}${path}`
  return NextResponse.redirect(url)
}
