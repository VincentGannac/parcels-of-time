// app/api/auth/forgot/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { findOwnerByEmailWithPassword } from '@/lib/auth'
import { createPasswordReset } from '@/lib/password_reset'
import { sendPasswordResetEmail } from '@/lib/email'

function localeFromUrl(u: URL): 'fr'|'en' {
  return u.pathname.startsWith('/fr/') ? 'fr' : 'en'
}
function getOrigin(req: Request) { return new URL(req.url).origin }

export async function POST(req: Request) {
  try {
    const origin = getOrigin(req)
    const url = new URL(req.url)
    const locale = (url.searchParams.get('locale') as 'fr'|'en') || localeFromUrl(url)

    let email = ''
    const ctype = req.headers.get('content-type') || ''
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      email = String(form.get('email') || '')
    } else {
      const body = await req.json().catch(()=>({}))
      email = String((body as any).email || '')
    }

    // Réponse générique (ne révèle pas si l’e-mail existe)
    const redirectTo = new URL(`/${locale}/forgot?sent=1`, origin)

    if (!email) return NextResponse.redirect(redirectTo, { status: 303 })

    const rec = await findOwnerByEmailWithPassword(email)
    if (!rec?.id) return NextResponse.redirect(redirectTo, { status: 303 })

    // Génère un token (30 min)
    const { token } = await createPasswordReset(String(rec.id), 30)
    const link = `${origin}/${locale}/reset?token=${encodeURIComponent(token)}`
    await sendPasswordResetEmail(String(rec.email), link, locale)

    return NextResponse.redirect(redirectTo, { status: 303 })
  } catch (e) {
    console.error('[forgot] error', e)
    // Toujours réponse générique
    const origin = getOrigin(req)
    const locale = localeFromUrl(new URL(req.url))
    return NextResponse.redirect(new URL(`/${locale}/forgot?sent=1`, origin), { status: 303 })
  }
}

export async function GET(req: Request) {
  // Optionnel : permettre GET /api/auth/forgot?email=...
  const u = new URL(req.url)
  const email = u.searchParams.get('email')
  if (email) return POST(req)
  const origin = u.origin
  const locale = u.pathname.startsWith('/fr/') ? 'fr' : 'en'
  return NextResponse.redirect(new URL(`/${locale}/forgot`, origin), { status: 303 })
}
