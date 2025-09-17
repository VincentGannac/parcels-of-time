// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Matcher très large mais neutre (aucune logique bloquante).
export const config = {
  matcher: ['/((?!_next/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt)).*)'],
}

export function middleware(_req: NextRequest) {
  // Pas de redirection forcée ici pour éviter tout loop — la protection est gérée dans les pages.
  return NextResponse.next()
}
