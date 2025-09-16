// app/api/auth/logout/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
const COOKIE_NAME = 'pot_sess'
const COOKIE_DOMAIN = '.parcelsoftime.com'

export async function POST() {
  const res = NextResponse.redirect('/en/login', 303)
  res.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`)
  return res
}
