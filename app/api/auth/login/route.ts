// app/api/auth/login/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import {
  authenticateWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function resolveNext(nextRaw: string, locale: 'fr' | 'en') {
  let next = ''
  try { next = decodeURIComponent(nextRaw || '') } catch { next = nextRaw || '' }
  // On autorise seulement un chemin local /fr/... ou /en/... (pas de boucle vers login/signup)
  if (/^\/(fr|en)\//.test(next) && !/^\/(fr|en)\/(?:login|signup)(\/|$)/.test(next)) {
    return next
  }
  return `/${locale}/account`
}

export async function POST(req: Request) {
  const form = await req.formData()
  const email   = String(form.get('email') || '').trim()
  const password= String(form.get('password') || '')
  const locale  = (String(form.get('locale') || 'en') === 'fr') ? 'fr' : 'en'
  const nextRaw = String(form.get('next') || '')

  if (!email || !password) {
    const url = new URL(`/${locale}/login`, req.url)
    url.searchParams.set('err', 'missing')
    if (nextRaw) url.searchParams.set('next', nextRaw)
    return NextResponse.redirect(url, 303)
  }

  const owner = await authenticateWithPassword(email, password)
  if (!owner) {
    const url = new URL(`/${locale}/login`, req.url)
    url.searchParams.set('err', 'badcreds')
    if (nextRaw) url.searchParams.set('next', nextRaw)
    return NextResponse.redirect(url, 303)
  }

  const dest = resolveNext(nextRaw, locale)       // ✅ HONORE le next demandé
  const res  = NextResponse.redirect(dest, 303)   // ✅ redirection relative

  setSessionCookieOnResponse(res, {
    ownerId: owner.id,
    email: owner.email,
    displayName: owner.display_name ?? null,
    iat: Math.floor(Date.now() / 1000),
  })

  return res
}
