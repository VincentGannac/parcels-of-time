// middleware.ts
import { NextResponse, NextRequest } from 'next/server'

const LOCALES = ['fr', 'en'] as const
const DEFAULT_LOCALE: (typeof LOCALES)[number] = 'en'

export const config = {
  matcher: [
    // On inclut explicitement l'auth API et toutes les pages locales
    '/api/auth/:path*',
    '/fr/:path*',
    '/en/:path*',
    // Catch-all (hors statiques & images & HMR & api racine)
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)).*)',
  ],
}

function nextWithMirroredCookie(req: NextRequest) {
  const requestHeaders = new Headers(req.headers)
  const sess = req.cookies.get('pot_sess')?.value
  if (sess) {
    // en-tête **interne** lu seulement côté serveur (pas renvoyé au client)
    requestHeaders.set('x-pot-sess', sess)
  } else {
    requestHeaders.delete('x-pot-sess')
  }
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const host = req.headers.get('host') || ''

  /* 0) Normalisation d’hôte : www -> apex (redirection 308) */
  if (host === 'www.parcelsoftime.com') {
    const target = new URL(req.url)
    target.host = 'parcelsoftime.com'
    target.protocol = 'https:'
    return NextResponse.redirect(target, 308)
  }

  /* 1) Admin Basic Auth (optionnel) */
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

  /* 2) Toujours laisser passer /api/auth/* (login/logout/signup)
        mais on **miroir** le cookie pour les pages suivantes */
  if (path.startsWith('/api/auth/')) {
    return nextWithMirroredCookie(req)
  }

  /* 3) Si déjà localisé ou fichier → on laisse passer (avec garde sélective) */
  const isFile = /\.[a-zA-Z0-9]+$/.test(path)
  const alreadyLocalized = path === '/fr' || path === '/en' || path.startsWith('/fr/') || path.startsWith('/en/')

  if (isFile || alreadyLocalized) {
    // Garde ses routes (jamais /{locale}/login|signup)
    const isGuarded =
      /^\/(fr|en)\/(?:claim|account)(?:\/|$)/.test(path) ||
      /^\/(fr|en)\/m\/.+/.test(path)
    const isAuthPage = /^\/(fr|en)\/(?:login|signup)(?:\/|$)/.test(path)

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
        return NextResponse.redirect(target, 302)
      }
    }

    // IMPORTANT: on renvoie toujours la requête avec l’en-tête x-pot-sess reflétant le cookie courant
    return nextWithMirroredCookie(req)
  }

  /* 4) Ajout auto de la locale si absente */
  const header = req.headers.get('accept-language') || ''
  const guess = header.split(',')[0]?.split('-')[0]?.toLowerCase()
  const locale = (LOCALES as readonly string[]).includes(guess as any)
    ? (guess as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  const target = new URL(req.url)
  target.pathname = `/${locale}${path}`
  return NextResponse.redirect(target, { status: 302 })
}
