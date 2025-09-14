// app/api/auth/logout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  await clearSessionCookie()
  const url = new URL(req.url)
  // Essaie de retrouver la locale depuis le Referer
  const ref = req.headers.get('referer') || ''
  const m = /^https?:\/\/[^/]+\/(fr|en)(\/|$)/i.exec(ref)
  const locale = (m?.[1] || 'en').toLowerCase()
  return NextResponse.redirect(new URL(`/${locale}`, url), { status: 303 })
}
