// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

// Admin Basic Auth (Edge-safe)
const USER = process.env.ADMIN_USER || 'admin'
const PASS = process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123'

export const config = {
  matcher: [
    // ✅ protéger explicitement /api/admin/**
    '/api/admin/:path*',
    // ✅ intercepter tout le reste SAUF api/_next/assets/favicons/fichiers statiques
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname

  // ---------- 1) Admin: Basic Auth ----------
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Basic ')) {
      const decoded = (typeof atob !== 'undefined')
        ? atob(auth.split(' ')[1])
        : Buffer.from(auth.split(' ')[1], 'base64').toString()
      const [u, p] = decoded.split(':')
      if (u === USER && p === PASS) return NextResponse.next()
    }
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  // ---------- 2) Fichiers statiques : pass-through ----------
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)

  // ---------- 3) Déjà localisé ? ----------
  const alreadyLocalized = LOCALES.some(
    (l) => path === `/${l}` || path.startsWith(`/${l}/`)
  )

  // 3.1) Garde-barrière cookie sur /{locale}/m/YYYY-MM-DD
  if (
    alreadyLocalized &&
    /^\/(fr|en)\/m\/\d{4}-\d{2}-\d{2}(?:$|[/?#])/.test(path)
  ) {
    const hasCookie = req.cookies.has('pot_sess')
    if (!hasCookie) {
      const locale = path.split('/')[1] || 'en'
      const login = url.clone()
      login.pathname = `/${locale}/login`
      login.searchParams.set('next', url.pathname + url.search)
      return NextResponse.redirect(login)
    }
  }

  // ---------- 4) Laisser passer les fichiers et URLs déjà localisées ----------
  if (isFile) return NextResponse.next()
  if (alreadyLocalized) return NextResponse.next()

  // ---------- 5) Détection de la locale préférée ----------
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any)
    ? (guess as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  // ---------- 6) Compat : anciennes URLs /m/:ts → /{locale}/m/:ts ----------
  if (path.startsWith('/m/')) {
    const legacy = url.clone()
    legacy.pathname = `/${locale}${path}`
    return NextResponse.redirect(legacy, 308) // permanent
  }

  // ---------- 7) Préfixer toute URL non localisée ----------
  const localized = url.clone()
  localized.pathname = `/${locale}${path}`
  return NextResponse.redirect(localized)
}
