//app/api/marketplace/listing/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'

function normIsoDay(s: string) {
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0)
  return { iso: d.toISOString(), ymd: d.toISOString().slice(0,10) }
}

export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) {
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base}/login`, { status: 303 })
  }

  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  let tsInput = ''
  let priceEuros = 0
  let currency = 'EUR'
  let locale = 'fr'

  if (ctype.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    tsInput = String(form.get('ts') || '')
    // accepte price (euros) ou price_cents
    const p = Number(form.get('price') || 0)
    const pc = Number(form.get('price_cents') || 0)
    priceEuros = isFinite(p) && p > 0 ? p : Math.floor(pc/100)
    const cur = String(form.get('currency') || '').toUpperCase()
    if (cur) currency = cur
    const loc = String(form.get('locale') || '')
    if (loc === 'en' || loc === 'fr') locale = loc
  } else {
    const body = await req.json().catch(() => ({} as any))
    tsInput = String(body.ts || '')
    const p = Number(body.price || 0)
    const pc = Number(body.price_cents || 0)
    priceEuros = isFinite(p) && p > 0 ? p : Math.floor(pc/100)
    currency = String(body.currency || 'EUR').toUpperCase()
    const loc = String(body.locale || '')
    if (loc === 'en' || loc === 'fr') locale = loc
  }

  const norm = normIsoDay(tsInput)
  if (!norm) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })
  const tsISO = norm.iso
  const tsYMD = norm.ymd

  const ownerId = await ownerIdForDay(tsISO)
  if (!ownerId || ownerId !== sess.ownerId) {
    // pas propriétaire
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base}/${locale}/account?err=not_owner`, { status: 303 })
  }

  const price_cents = Math.max(100, Math.floor((priceEuros || 0) * 100)) // min 1 €
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // upsert sans contrainte partielle : on verrouille s’il existe
    const { rows: existing } = await client.query(
      `select id, status from listings
        where ts=$1 and seller_owner_id=$2
        order by id asc
        for update`,
      [tsISO, sess.ownerId]
    )

    if (existing.length) {
      await client.query(
        `update listings
            set price_cents=$3, currency=$4, status='active', updated_at=now()
          where id=$1`,
        [existing[0].id, price_cents, currency]
      )
    } else {
      await client.query(
        `insert into listings (ts, seller_owner_id, price_cents, currency, status)
         values ($1,$2,$3,$4,'active')`,
        [tsISO, sess.ownerId, price_cents, currency]
      )
    }

    await client.query('COMMIT')

    // Si formulaire → redirection sympa
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
      return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsYMD)}?listing=ok`, { status: 303 })
    }

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    try { await client.query('ROLLBACK') } catch {}
    const msg = String(e?.message || e)
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
      return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsYMD)}?listing=err`, { status: 303 })
    }
    return NextResponse.json({ error: 'db_error', detail: msg }, { status: 500 })
  } finally {
    client.release()
  }
}
