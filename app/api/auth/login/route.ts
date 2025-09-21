// app/api/auth/login/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  verifyPassword,
  findOwnerByEmailWithPassword,
  setSessionCookieOnResponse,
} from '@/lib/auth'

/**
 * Retourne l'origin fiable de la requête courante.
 * Ne dépend PAS d'une env côté serveur.
 */
function getOrigin(req: Request): string {
  // URL(req.url) est déjà fiable côté Next (inclut le proto/host)
  return new URL(req.url).origin
}

/**
 * Valide le "next" : on n'autorise que des chemins absolus internes
 * de forme "/fr/..." ou "/en/...".
 */
function sanitizeNext(next: unknown, fallback: string) {
  const s = typeof next === 'string' ? next : ''
  if (/^\/(fr|en)\/.+/.test(s)) return s
  return fallback
}

function pickLocaleFromHeader(h: Headers): 'fr' | 'en' {
  const a = (h.get('accept-language') || '').toLowerCase()
  return a.startsWith('fr') ? 'fr' : 'en'
}

export async function POST(req: Request) {
  try {
    const ctype = req.headers.get('content-type') || ''
    const origin = getOrigin(req)
    const hostname = new URL(req.url).hostname
    const locale = pickLocaleFromHeader(req.headers)

    // ---- 1) Form POST
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      const email = String(form.get('email') ?? '')
      const password = String(form.get('password') ?? '')
      const requestedNext = form.get('next')
      const next = sanitizeNext(requestedNext, `/${locale}/account`)

      // Champs requis
      if (!email || !password) {
        const back = new URL(`/${locale}/login`, origin)
        back.searchParams.set('err', 'missing_credentials')
        back.searchParams.set('next', next)
        return NextResponse.redirect(back, { status: 303 })
      }

      // Lookup user
      const rec = await findOwnerByEmailWithPassword(email)
      if (!rec?.password_hash) {
        const back = new URL(`/${locale}/login`, origin)
        back.searchParams.set('err', 'not_found')
        back.searchParams.set('next', next)
        return NextResponse.redirect(back, { status: 303 })
      }

      // Password
      const ok = await verifyPassword(password, rec.password_hash)
      if (!ok) {
        const back = new URL(`/${locale}/login`, origin)
        back.searchParams.set('err', 'bad_credentials')
        back.searchParams.set('next', next)
        return NextResponse.redirect(back, { status: 303 })
      }

      // ✅ Set cookie + redirect DIRECTEMENT vers la destination finale
      const to = new URL(next, origin)
      const res = NextResponse.redirect(to, { status: 303 })

      // Laisse setSessionCookieOnResponse décider Domain:
      // - en preview/vercel.app => host-only
      // - en prod => Domain=.parcelsoftime.com
      setSessionCookieOnResponse(
        res,
        {
          ownerId: String(rec.id),
          email: String(rec.email),
          displayName: rec.display_name,
          iat: Math.floor(Date.now() / 1000),
        },
        /* options? */ undefined,
        /* hostHint */ hostname,
      )

      // Anti-cache
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    // ---- 2) JSON fallback (API style)
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '')
    const password = String(body.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: 'missing_credentials' }, { status: 400 })
    }

    const rec = await findOwnerByEmailWithPassword(email)
    if (!rec?.password_hash) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const ok = await verifyPassword(password, rec.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'bad_credentials' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true, ownerId: rec.id })
    setSessionCookieOnResponse(
      res,
      {
        ownerId: String(rec.id),
        email: String(rec.email),
        displayName: rec.display_name,
        iat: Math.floor(Date.now() / 1000),
      },
      undefined,
      new URL(req.url).hostname,
    )
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e) {
    console.error('[login] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
