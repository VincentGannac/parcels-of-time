// app/api/auth/signup/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createOwnerWithPassword, writeSessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') || '')
  const password = String(form.get('password') || '')
  const next = String(form.get('next') || '')
  const locale = String(form.get('locale') || 'en')

  if (!email || !password || password.length < 8) {
    return NextResponse.redirect(new URL(`/${locale}/signup?err=weak&next=${encodeURIComponent(next || `/${locale}/account`)}`, req.url), { status: 303 })
  }

  try {
    const user = await createOwnerWithPassword(email, password)
    await writeSessionCookie({
      ownerId: user.id,
      email: user.email,
      displayName: user.display_name,
      iat: Math.floor(Date.now() / 1000),
    })

    const target = next || `/${locale}/account`
    return NextResponse.redirect(new URL(target, req.url), { status: 303 })
  } catch {
    return NextResponse.redirect(new URL(`/${locale}/signup?err=server&next=${encodeURIComponent(next || `/${locale}/account`)}`, req.url), { status: 303 })
  }
}
