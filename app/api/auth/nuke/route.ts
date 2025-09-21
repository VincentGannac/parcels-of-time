//app/api/auth/nuke/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/auth'

export async function POST(req: Request) {
  const host = new URL(req.url).hostname
  const res = NextResponse.json({ ok: true, host, note: 'All cookie variants cleared' })
  clearSessionCookies(res, host)
  return res
}
export async function GET(req: Request) { return POST(req) }
