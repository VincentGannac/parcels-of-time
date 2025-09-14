export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST() {
  clearSessionCookie()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  clearSessionCookie()
  return NextResponse.redirect('/fr')
}
