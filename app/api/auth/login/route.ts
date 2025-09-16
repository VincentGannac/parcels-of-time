// app/api/auth/login/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { authenticateWithPassword, encodeSessionForCookie } from '@/lib/auth'

const COOKIE_NAME = 'pot_sess' as const
const COOKIE_DOMAIN = '.parcelsoftime.com' as const
const MAX_AGE = 60 * 60 * 24 * 30 // 30j

function safeNext(n: string | null | undefined, locale: 'fr'|'en') {
  if (!n) return `/${locale}/account`
  try {
    const dec = decodeURIComponent(n)
    // Autoriser uniquement chemins internes localisés
    if (/^\/(fr|en)\//.test(dec)) return dec
  } catch {}
  return `/${locale}/account`
}

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '')
  const locale = (String(form.get('locale') || 'en') === 'fr') ? 'fr' : 'en'
  const next = safeNext(String(form.get('next') || ''), locale)

  if (!email || !password) {
    return NextResponse.redirect(`/${locale}/login?err=missing&next=${encodeURIComponent(next)}`, 303)
  }

  const owner = await authenticateWithPassword(email, password)
  if (!owner) {
    return NextResponse.redirect(`/${locale}/login?err=badcreds&next=${encodeURIComponent(next)}`, 303)
  }

  const payload = { ownerId: owner.id, email: owner.email, displayName: owner.display_name || null, iat: Math.floor(Date.now()/1000) }
  const val = encodeSessionForCookie(payload)

  const res = NextResponse.redirect(next, 303)
  // Un SEUL cookie, de domaine, pour éviter les doublons {www, apex}
  res.headers.append('Set-Cookie',
    `${COOKIE_NAME}=${val}; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`)
  return res
}
