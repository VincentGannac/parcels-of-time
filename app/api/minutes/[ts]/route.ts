//app/api/minutes/[ts]/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

/** Normalise au début de journée UTC (aligné avec claims.ts) */
function normDayTs(ts: string) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(_: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const day = normDayTs(tsRaw)
  if (!day) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  // Existe-t-il une publication pour ce jour ?
  const { rows } = await pool.query(
    `select 1
       from minute_public
      where ts = $1::timestamptz
      limit 1`,
    [day]
  )
  return NextResponse.json({ is_public: rows.length > 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const day = normDayTs(tsRaw)
  if (!day) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const is_public = body?.is_public === true

  // ⚠️ FK → vérifie que la claim existe exactement à ce ts (début de journée)
  const { rows: chk } = await pool.query(`select 1 from claims where ts = $1::timestamptz`, [day])
  if (is_public && chk.length === 0) {
    return NextResponse.json({ ok: false, error: 'claim_not_found_for_ts' }, { status: 409 })
  }

  if (is_public) {
    // Upsert (FK sur claims.ts)
    await pool.query(
      `insert into minute_public(ts)
       values($1::timestamptz)
       on conflict (ts) do nothing`,
      [day]
    )
  } else {
    await pool.query(`delete from minute_public where ts = $1::timestamptz`, [day])
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
