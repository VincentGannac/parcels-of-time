// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// ⚠️ IMPORTANT : ce middleware NE gère plus l'auth.
// Les pages serveur (Node) protègent /account, /claim, /m/[ts] via readSession().
// Cela supprime tout risque de secret différent côté Edge.

// fichiers statiques
function isFile(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 0) Canonical host -> www (prod hors previews vercel) pour unifier les cookies
  const host = req.headers.get('host') || ''
  const isProd = process.env.VERCEL_ENV === 'production'
  const isVercelPreview = /\.vercel\.app$/.test(host)
  if (isProd && !isVercelPreview && host === 'parcelsoftime.com') {
    const url = new URL(req.url)
    url.host = 'www.parcelsoftime.com'
    return NextResponse.redirect(url, 308)
  }

  // 1) Ignore assets & fichiers & API
  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (isFile(pathname)) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()

  // 2) Laisser passer tout le reste (auth faite dans les pages)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)'],
}
