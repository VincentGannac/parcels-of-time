// app/api/auth/callback/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = url.searchParams.get('next') || '/en/account'
  const locale = /^\/fr\//.test(next) ? 'fr' : 'en'
  // On informe que le magic link n'est plus supporté
  return NextResponse.redirect(new URL(`/${locale}/login?info=magic_disabled&next=${encodeURIComponent(next)}`, req.url), { status: 303 })
}
