// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Zones qui ne doivent jamais être mises en cache (pages privées / retour paiement)
const NO_STORE = [
  /^\/api\/checkout\/confirm/,
  /^\/api\/auth\/login/,
  /^\/api\/auth\/logout/,
  /^\/(fr|en)\/account(?:\/.*)?$/,
  /^\/(fr|en)\/m\/.+$/,
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  for (const re of NO_STORE) {
    if (re.test(pathname)) {
      const res = NextResponse.next()
      res.headers.set('Cache-Control', 'no-store')
      // Quelques en-têtes sécurité utiles
      res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      res.headers.set('X-Content-Type-Options', 'nosniff')
      res.headers.set('X-Frame-Options', 'DENY')
      res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
      return res
    }
  }
  return NextResponse.next()
}

// Facultatif: limiter le middleware à certaines routes
export const config = {
  matcher: [
    '/api/checkout/confirm',
    '/api/auth/:path*',
    '/(fr|en)/account/:path*',
    '/(fr|en)/m/:path*',
  ],
}
