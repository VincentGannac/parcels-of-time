export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  verifyPassword,
  findOwnerByEmailWithPassword,
  upsertOwnerByEmail,
  setSessionCookieOnResponse,
} from '@/lib/auth'

function pickLocale(h: Headers) {
  const acc = (h.get('accept-language') || '').toLowerCase()
  return acc.startsWith('fr') ? 'fr' : 'en'
}

function safeNext(nxt: string | null | undefined, locale: 'fr' | 'en') {
  if (!nxt) return `/${locale}/account`
  // n’autoriser que des chemins internes prévisibles
  if (!/^\/(fr|en)\//.test(nxt)) return `/${locale}/account`
  // éviter boucle vers /login
  if (/^\/(fr|en)\/login/.test(nxt)) return `/${locale}/account`
  return nxt
}

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
  // fallback: rien
  return {}
}

// ---------- POST: form classique OU JSON ----------
export async function POST(req: Request) {
  const base = new URL(req.url).origin
  const locale = pickLocale(req.headers)
  const url = new URL(req.url)
  const qsNext = url.searchParams.get('next') || undefined

  try {
    const { email, password, next } = await readBody(req)
    const wantedNext = safeNext(next ?? qsNext, locale)

    if (!email || !password) {
      // si POST form → rediriger avec ?err
      const res = NextResponse.redirect(`${base}/${locale}/login?err=missing_credentials&next=${encodeURIComponent(wantedNext)}`, { status: 303 })
      return res
    }

    const rec = await findOwnerByEmailWithPassword(String(email))
    if (!rec || !rec.password_hash) {
      const res = NextResponse.redirect(`${base}/${locale}/login?err=not_found&next=${encodeURIComponent(wantedNext)}`, { status: 303 })
      return res
    }

    const ok = await verifyPassword(String(password), rec.password_hash)
    if (!ok) {
      const res = NextResponse.redirect(`${base}/${locale}/login?err=bad_credentials&next=${encodeURIComponent(wantedNext)}`, { status: 303 })
      return res
    }

    // Succès → poser cookie + 303 vers next (atomique)
    const res = NextResponse.redirect(new URL(wantedNext, base), { status: 303 })
    setSessionCookieOnResponse(res, {
      ownerId: String(rec.id),
      email: String(rec.email),
      displayName: rec.display_name,
      iat: Math.floor(Date.now() / 1000),
    })
    return res
  } catch (e: any) {
    console.error('[login] error:', e?.message || e)
    const res = NextResponse.redirect(`${base}/${locale}/login?err=server_error`, { status: 303 })
    return res
  }
}

