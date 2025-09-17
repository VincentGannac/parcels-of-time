export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

function detectLocaleFromReferer(ref: string | null): 'fr' | 'en' {
  if (!ref) return 'en'
  try {
    const u = new URL(ref)
    return u.pathname.startsWith('/fr') ? 'fr' : 'en'
  } catch { return 'en' }
}

export async function POST(req: Request) {
  let locale: 'fr'|'en' = 'en'

  // 1) locale depuis le form (si présente)
  try {
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const fd = await req.formData()
      const l = String(fd.get('locale') || '').toLowerCase()
      locale = l === 'fr' ? 'fr' : 'en'
    }
  } catch {}

  // 2) fallback : Referer
  if (!locale) {
    const ref = req.headers.get('referer')
    locale = detectLocaleFromReferer(ref)
  }

  const back = `/${locale}`

  const res = NextResponse.redirect(new URL(back, req.url), { status: 303 })
  // purge host-only
  res.cookies.set('pot_sess', '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax' })
  // purge domaine (apex + www)
  res.cookies.set('pot_sess', '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax', domain: '.parcelsoftime.com' })
  return res
}
