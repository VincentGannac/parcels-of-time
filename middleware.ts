// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Fichiers statiques
function isFile(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 0) Canonical host -> www (prod) pour éviter divergence apex/www
  const host = req.headers.get('host') || ''
  const isProd = process.env.VERCEL_ENV === 'production'
  const isVercelPreview = /\.vercel\.app$/.test(host)

  // on laisse /api tranquilles (pour ne pas casser les POST)
  const isApi = pathname.startsWith('/api')

  if (isProd && !isVercelPreview && host === 'parcelsoftime.com' && !isApi) {
    const url = new URL(req.url)
    url.host = 'www.parcelsoftime.com'
    return NextResponse.redirect(url, 308)
  }

  // 1) Laisse passer tout le reste (pas d’auth ici)
  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (isFile(pathname)) return NextResponse.next()
  if (isApi) return NextResponse.next()

  return NextResponse.next()
}

// Matcher global
export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
