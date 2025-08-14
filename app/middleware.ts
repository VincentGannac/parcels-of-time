import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const USER = process.env.ADMIN_USER || 'admin'
const PASS = process.env.ADMIN_PASS || 'LaDisciplineMeMeneraLoin123'

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }

export function middleware(req: NextRequest) {
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
