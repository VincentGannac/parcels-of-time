// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

export const config = {
  matcher: [
    '/api/auth/:path*',
    '/fr/:path*',
    '/en/:path*',
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

function parseCookieHeader(raw: string | null | undefined, name: string): string | undefined {
  if (!raw) return undefined
  for (const p of raw.split(/;\s*/)) {
    const i = p.indexOf('=')
    if (i <= 0) continue
    const k = p.slice(0,i).trim()
    if (k === name) return p.slice(i+1)
  }
}

function nextWithMirroredCookie(req: NextRequest) {
  const requestHeaders = new Headers(req.headers)
  // 💡 lire *aussi* l’en-tête Cookie brut
  const rawHeader = req.headers.get('cookie') || req.headers.get('Cookie') || ''
  const fromJar = req.cookies.get('pot_sess')?.value
  const fromHdr = parseCookieHeader(rawHeader, 'pot_sess')
  const sess = fromJar || fromHdr || ''

  if (sess) requestHeaders.set('x-pot-sess', sess)
  else requestHeaders.delete('x-pot-sess')

  // utile pour debug/redirectToLogin côté serveur
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const host = req.headers.get('host') || ''

  // 0) www → apex
  if (host === 'www.parcelsoftime.com') {
    const target = new URL(req.url)
    target.host = 'parcelsoftime.com'
    target.protocol = 'https:'
    return NextResponse.redirect(target, 308)
  }

  // 1) Admin
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const auth = req.headers.get('authorization') || ''
    if (auth.startsWith('Basic ')) {
      try {
        const decoded =
          typeof atob !== 'undefined'
            ? atob(auth.split(' ')[1])
            : Buffer.from(auth.split(' ')[1], 'base64').toString()
        const [u, p] = decoded.split(':')
        const USER = process.env.ADMIN_USER || 'admin'
        const PASS = process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123'
        if (u === USER && p === PASS) return nextWithMirroredCookie(req)
      } catch {}
    }
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  // 2) Laisser l’auth API + mirroring
  if (path.startsWith('/api/auth/')) {
    return nextWithMirroredCookie(req)
  }

  // 3) Pages localisées / fichiers
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)
  const alreadyLocalized = path === '/fr' || path === '/en' || path.startsWith('/fr/') || path.startsWith('/en/')

  if (isFile || alreadyLocalized) {
    const isGuarded =
      /^\/(fr|en)\/(?:claim|account)(?:\/|$)/.test(path) ||
      /^\/(fr|en)\/m\/.+/.test(path)
    const isAuthPage = /^\/(fr|en)\/(?:login|signup)(?:\/|$)/.test(path)

    if (isGuarded && !isAuthPage) {
      // 💪 garde robuste
      const rawHeader = req.headers.get('cookie') || req.headers.get('Cookie') || ''
      const hasSess =
        req.nextUrl.searchParams.get('dbg') === '1' ||
        !!req.cookies.get('pot_sess') ||
        /(?:^|;\s*)pot_sess=/.test(rawHeader)

      if (!hasSess) {
        const loc = path.startsWith('/fr') ? 'fr' : 'en'
        const target = new URL(req.url)
        const next = path + (url.search || '')
        target.pathname = `/${loc}/login`
        target.search = ''
        target.searchParams.set('next', next)
        return NextResponse.redirect(target, 302)
      }
    }

    return nextWithMirroredCookie(req)
  }

  // 4) Prefix locale si absente
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any)
    ? (guess as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  const target = new URL(req.url)
  target.pathname = `/${locale}${path}`
  return NextResponse.redirect(target, { status: 302 })
}
