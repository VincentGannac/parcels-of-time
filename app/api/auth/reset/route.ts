// app/api/auth/reset/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { consumePasswordReset } from '@/lib/password_reset'
import { setOwnerPassword, setSessionCookieOnResponse } from '@/lib/auth' // nettoie l'import inutile

function localeFromUrl(u: URL): 'fr'|'en' { return u.pathname.startsWith('/fr/') ? 'fr':'en' }

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const origin = url.origin
    const locale = (url.searchParams.get('locale') as 'fr'|'en') || localeFromUrl(url)

    let token = '', pw = '', pw2 = ''
    const ctype = req.headers.get('content-type') || ''
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      token = String(form.get('token') || '')
      pw = String(form.get('password') || '')
      pw2 = String(form.get('password2') || '')
    } else {
      const j = await req.json().catch(()=>({}))
      token = String((j as any).token || '')
      pw = String((j as any).password || '')
      pw2 = String((j as any).password2 || '')
    }

    if (!token) {
      return NextResponse.redirect(new URL(`/${locale}/reset?err=bad_token`, origin), { status: 303 })
    }
    if (pw.length < 8) {
      return NextResponse.redirect(new URL(`/${locale}/reset?token=${encodeURIComponent(token)}&err=weak_password`, origin), { status: 303 })
    }
    if (pw !== pw2) {
      return NextResponse.redirect(new URL(`/${locale}/reset?token=${encodeURIComponent(token)}&err=mismatch`, origin), { status: 303 })
    }

    const ownerId = await consumePasswordReset(token)
    if (!ownerId) {
      return NextResponse.redirect(new URL(`/${locale}/reset?err=bad_token`, origin), { status: 303 })
    }

    // Met à jour le mot de passe
    await setOwnerPassword(ownerId, pw)

    // Auto-login: relit email + username (+ display_name) et renseigne displayName = display_name || username
    try {
      const { rows } = await (await import('@/lib/db')).pool.query(
        `select email, username, display_name from owners where id = $1 limit 1`,
        [ownerId]
      )
      if (rows?.[0]?.email) {
        const hostname = new URL(req.url).hostname
        const res = NextResponse.redirect(new URL(`/${locale}/account?pw=ok`, origin), { status: 303 })
        const displayName = rows[0].display_name ?? rows[0].username ?? null
        setSessionCookieOnResponse(res, {
          ownerId,
          email: String(rows[0].email),
          displayName,
          iat: Math.floor(Date.now()/1000),
        }, undefined, hostname)
        res.headers.set('Cache-Control', 'no-store')
        return res
      }
    } catch {}

    // Fallback: retour login
    return NextResponse.redirect(new URL(`/${locale}/login?info=reset_ok`, origin), { status: 303 })
  } catch (e) {
    console.error('[reset] error', e)
    const u = new URL(req.url)
    const origin = u.origin
    const locale = localeFromUrl(u)
    return NextResponse.redirect(new URL(`/${locale}/reset?err=bad_token`, origin), { status: 303 })
  }
}
