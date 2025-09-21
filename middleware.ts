// middleware.ts (racine du repo)
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Considère tout ce qui ressemble à un fichier comme statique
const isFile = (p: string) => /\.[a-z0-9]+$/i.test(p)

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1) Laisser passer internals / fichiers / API
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || isFile(pathname)) {
    return NextResponse.next()
  }

  // 2) Hôte canonique (prod) : apex -> www
  // Si tu actives "Redirect to www" dans Vercel Domains, supprime ce bloc.
  const host = req.headers.get('host') || ''
  const isVercelPreview = /\.vercel\.app$/i.test(host)
  const isProd = process.env.VERCEL_ENV === 'production'
  if (isProd && !isVercelPreview && host === 'parcelsoftime.com') {
    const url = new URL(req.url)
    url.host = 'www.parcelsoftime.com'
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
