// app/api/marketplace/listing/[id]/status/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

function pickLocale(v: string | null | undefined): 'fr' | 'en' {
  const s = String(v || '').toLowerCase()
  return s === 'en' ? 'en' : 'fr'
}

async function handle(req: Request, ctx: any) {
  const idRaw = String(ctx?.params?.id || '').trim()
  if (!/^\d+$/.test(idRaw)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  // Session requise
  const session = await readSession()
  const url = new URL(req.url)
  if (!session) {
    const next = url.searchParams.get('next') || `/${pickLocale(url.searchParams.get('locale'))}/account`
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin), { status: 303 })
  }

  // Lecture des inputs (form ou query)
  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  const isForm =
    ctype.includes('application/x-www-form-urlencoded') ||
    ctype.includes('multipart/form-data')

  const form = isForm ? await req.formData() : null

  const locale = pickLocale(isForm ? String(form?.get('locale') || '') : url.searchParams.get('locale'))
  const action = isForm ? String(form?.get('action') || '') : String(url.searchParams.get('action') || '')
  const statusParam = isForm ? String(form?.get('status') || '') : String(url.searchParams.get('status') || '')
  const nextUrl = (
    isForm ? String(form?.get('next') || '') : String(url.searchParams.get('next') || '')
  ) || `/${locale}/account`

  // Compat action=cancel → status=canceled (par défaut)
  const nextStatus = (statusParam || (action === 'cancel' ? 'canceled' : '') || 'canceled').toLowerCase()
  if (nextStatus !== 'canceled') {
    // pour l’instant on ne supporte que "canceled"
    return NextResponse.json({ error: 'unsupported_status' }, { status: 400 })
  }

  // --- UPDATE protégé
  let rowCount = 0
  try {
    const res = await pool.query(
      `update listings
          set status = 'canceled', updated_at = now()
        where id = $1::bigint
          and seller_owner_id = $2
          and status = 'active'`,
      [idRaw, session.ownerId]
    )
    rowCount = Number(res?.rowCount || 0)
  } catch (e: any) {
    const msg = String(e?.message || e)
    // Si l’enum n’a pas la valeur "canceled", on évite le 500 et on renvoie un feedback clair
    const reason = /invalid input value for enum/i.test(msg) ? 'db_enum_missing' : 'db_error'
    if (isForm) {
      const to = new URL(`${nextUrl}${nextUrl.includes('?') ? '&' : '?'}cancel=${reason}`, url.origin)
      return NextResponse.redirect(to, { status: 303 })
    }
    return NextResponse.json({ ok: false, error: reason, detail: msg }, { status: 500 })
  }

  // Form → redirect friendly
  if (isForm) {
    const flag = rowCount > 0 ? 'ok' : 'err'
    const to = new URL(`${nextUrl}${nextUrl.includes('?') ? '&' : '?'}cancel=${flag}`, url.origin)
    return NextResponse.redirect(to, { status: 303 })
  }

  // GET/JSON
  if (rowCount === 0) {
    return NextResponse.json({ ok: false, error: 'not_allowed_or_not_active' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}

export const GET  = handle
export const POST = handle
