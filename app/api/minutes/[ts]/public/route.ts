//app/api/minutes/[ts]/public/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

/** Normalise un input en minuit UTC (ISO) — accepte YYYY-MM-DD, ou ISO divers */
function toIsoDayUTC(s: string) {
  if (!s) return null
  const raw = String(s).trim()
  // cas simple YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00.000Z`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(_: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const dayISO = toIsoDayUTC(tsRaw)
  if (!dayISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  const { rows } = await pool.query(
    `select 1 from minute_public where date_trunc('day', ts) = $1::timestamptz limit 1`,
    [dayISO]
  )
  return NextResponse.json({ is_public: rows.length > 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const dayISO = toIsoDayUTC(tsRaw)
  if (!dayISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  const { is_public } = await req.json().catch(() => ({}))

  if (is_public === true) {
    // vérifie qu'au moins une claim existe ce jour-là
    const { rows: chk } = await pool.query(
      `select 1 from claims where date_trunc('day', ts) = $1::timestamptz limit 1`,
      [dayISO]
    )
    if (!chk.length) return NextResponse.json({ ok: false, error: 'claim_not_found_for_day' }, { status: 409 })

    // on supprime d'anciens enregistrements non normalisés, puis insère la ligne normalisée (minuit)
    await pool.query(`delete from minute_public where date_trunc('day', ts) = $1::timestamptz`, [dayISO])
    await pool.query(
      `insert into minute_public(ts) values($1::timestamptz) on conflict (ts) do nothing`,
      [dayISO]
    )
  } else {
    await pool.query(`delete from minute_public where date_trunc('day', ts) = $1::timestamptz`, [dayISO])
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
