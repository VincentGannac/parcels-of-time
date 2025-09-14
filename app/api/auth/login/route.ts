// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { authenticateWithPassword, writeSessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') || '')
  const password = String(form.get('password') || '')
  const next = String(form.get('next') || '')
  const locale = String(form.get('locale') || 'en')

  if (!email || !password) {
    return NextResponse.redirect(new URL(`/${locale}/login?err=missing&next=${encodeURIComponent(next || `/${locale}/account`)}`, req.url), { status: 303 })
  }

  try {
    const user = await authenticateWithPassword(email, password)
    if (!user) {
      return NextResponse.redirect(new URL(`/${locale}/login?err=badcreds&next=${encodeURIComponent(next || `/${locale}/account`)}`, req.url), { status: 303 })
    }

    await writeSessionCookie({
      ownerId: user.id,
      email: user.email,
      displayName: user.display_name,
      iat: Math.floor(Date.now() / 1000),
    })

    const target = next || `/${locale}/account`
    return NextResponse.redirect(new URL(target, req.url), { status: 303 })
  } catch {
    return NextResponse.redirect(new URL(`/${locale}/login?err=server&next=${encodeURIComponent(next || `/${locale}/account`)}`, req.url), { status: 303 })
  }
}
