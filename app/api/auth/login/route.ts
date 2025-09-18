// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  verifyPassword,
  findOwnerByEmailWithPassword,
  setSessionCookieOnResponse,
  clearSessionCookies,
} from '@/lib/auth'

// Détermine la langue à partir du header
function pickLocale(h: Headers) {
  const acc = (h.get('accept-language') || '').toLowerCase()
  return acc.startsWith('fr') ? 'fr' : 'en'
}

// Ne laisse passer que des chemins internes valides et jamais /login
function safeNext(nxt: string | null | undefined, locale: 'fr' | 'en') {
  if (!nxt) return `/${locale}/account`
  if (!/^\/(fr|en)\//.test(nxt)) return `/${locale}/account`
  if (/^\/(fr|en)\/login/.test(nxt)) return `/${locale}/account`
  return nxt
}

// Support JSON et form-urlencoded
async function readBody(req: Request): Promise<{ email?: string; password?: string; next?: string }> {
  const ct = (req.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('application/json')) {
    try { return await req.json() } catch { return {} }
  }
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const f = await req.formData()
    return {
      email: String(f.get('email') || ''),
      password: String(f.get('password') || ''),
      next: String(f.get('next') || ''),
    }
  }
  return {}
}

// ---------- POST (connexion classique email + mot de passe) ----------
export async function POST(req: Request) {
  const base = new URL(req.url).origin
  const url = new URL(req.url)
  const locale = pickLocale(req.headers)
  const qsNext = url.searchParams.get('next') || undefined

  try {
    const { email, password, next } = await readBody(req)
    const wantedNext = safeNext(next ?? qsNext, locale)

    if (!email || !password) {
      return NextResponse.redirect(
        `${base}/${locale}/login?err=missing_credentials&next=${encodeURIComponent(wantedNext)}`,
        { status: 303 }
      )
    }

    const rec = await findOwnerByEmailWithPassword(String(email))
    if (!rec || !rec.password_hash) {
      return NextResponse.redirect(
        `${base}/${locale}/login?err=not_found&next=${encodeURIComponent(wantedNext)}`,
        { status: 303 }
      )
    }

    const ok = await verifyPassword(String(password), rec.password_hash)
    if (!ok) {
      return NextResponse.redirect(
        `${base}/${locale}/login?err=bad_credentials&next=${encodeURIComponent(wantedNext)}`,
        { status: 303 }
      )
    }

    // Succès : purge agressive des anciens cookies puis pose la nouvelle session.
    const res = NextResponse.redirect(new URL(wantedNext, base), { status: 303 })
    clearSessionCookies(res)
    setSessionCookieOnResponse(res, {
      ownerId: String(rec.id),
      email: String(rec.email),
      displayName: rec.display_name,
      iat: Math.floor(Date.now() / 1000),
    })
    // Aide certains navigateurs / proxies à suivre la redirection immédiatement
    res.headers.set('Refresh', `0;url=${wantedNext}`)
    return res
  } catch (e: any) {
    console.error('[login] error:', e?.message || e)
    return NextResponse.redirect(`${base}/${locale}/login?err=server_error`, { status: 303 })
  }
}
