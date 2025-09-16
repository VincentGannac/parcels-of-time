// app/api/auth/logout/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const res = NextResponse.redirect('/fr/login', 303) // ou vers /en/login selon ton UI
  res.cookies.set('pot_sess', '', { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0 })
  res.cookies.set('pot_sess', '', { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0, domain: '.parcelsoftime.com' })
  return res
}
