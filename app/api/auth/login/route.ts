// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { authenticateWithPassword, setSessionCookieOnResponse } from '@/lib/auth'

function safeNext(input: string, locale: 'fr'|'en'): string {
  const s = (input || '').trim()
  // autorise uniquement chemins internes commençant par /fr/ ou /en/
  if (/^\/(fr|en)\//.test(s)) return s
  return `/${locale}/account`
}

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') || '')
  const password = String(form.get('password') || '')
  const nextRaw = String(form.get('next') || '')
  const locale = (String(form.get('locale') || 'en') === 'fr' ? 'fr' : 'en') as 'fr'|'en'

  if (!email || !password) {
    return NextResponse.redirect(new URL(`/${locale}/login?err=missing&next=${encodeURIComponent(nextRaw || `/${locale}/account`)}`, req.url), { status: 303 })
  }

  try {
    const user = await authenticateWithPassword(email, password)
    if (!user) {
      return NextResponse.redirect(new URL(`/${locale}/login?err=badcreds&next=${encodeURIComponent(nextRaw || `/${locale}/account`)}`, req.url), { status: 303 })
    }

    const target = safeNext(nextRaw, locale)
    const res = NextResponse.redirect(new URL(target, req.url), { status: 303 })
    setSessionCookieOnResponse(res, {
      ownerId: user.id,
      email: user.email,
      displayName: user.display_name,
      iat: Math.floor(Date.now() / 1000),
    })
    return res
  } catch {
    return NextResponse.redirect(new URL(`/${locale}/login?err=server&next=${encodeURIComponent(nextRaw || `/${locale}/account`)}`, req.url), { status: 303 })
  }
}
