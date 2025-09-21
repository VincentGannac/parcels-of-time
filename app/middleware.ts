// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

function isStatic(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.[a-z0-9]+$/i.test(pathname)
  )
}

// IMPORTANT : ce middleware ne fait que la canonique apex -> www
export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const host = req.headers.get('host') ?? ''
  const isProd = process.env.VERCEL_ENV === 'production'
  const isVercelPreview = /\.vercel\.app$/.test(host)

  // 1) Canonical host : apex -> www (en prod, hors preview)
  if (isProd && !isVercelPreview && host === 'parcelsoftime.com') {
    url.host = 'www.parcelsoftime.com'
    // Conserve path + query automatiquement
    return NextResponse.redirect(url, 308)
  }

  // 2) Laisse tout passer (aucune auth ici)
  if (isStatic(url.pathname)) return NextResponse.next()
  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
