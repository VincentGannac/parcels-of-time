// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { authenticateWithPassword, setSessionCookieOnResponse } from '@/lib/auth'

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') || '')
  const password = String(form.get('password') || '')
  const next = String(form.get('next') || '')
  const locale = String(form.get('locale') || 'en')

  const fallback = `/${locale}/account`
  const safeNext = /^\/(fr|en)\//.test(next) ? next : fallback

  if (!email || !password) {
    return NextResponse.redirect(new URL(`/${locale}/login?err=missing&next=${encodeURIComponent(safeNext)}`, req.url), { status: 303 })
  }

  try {
    const user = await authenticateWithPassword(email, password)
    if (!user) {
      return NextResponse.redirect(new URL(`/${locale}/login?err=badcreds&next=${encodeURIComponent(safeNext)}`, req.url), { status: 303 })
    }

    const res = NextResponse.redirect(new URL(safeNext, req.url), { status: 303 })
    setSessionCookieOnResponse(res, {
      ownerId: user.id,
      email: user.email,
      displayName: user.display_name,
      iat: Math.floor(Date.now() / 1000),
    })
    return res
  } catch {
    return NextResponse.redirect(new URL(`/${locale}/login?err=server&next=${encodeURIComponent(safeNext)}`, req.url), { status: 303 })
  }
}
