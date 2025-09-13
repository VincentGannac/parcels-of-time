//app/api/minutes/[ts]/public/route.ts
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

  // Supporte les anciennes lignes minute_public non normalisées (minute/heure)
  const { rows } = await pool.query(
    `select 1
       from minute_public
      where date_trunc('day', ts) = $1::timestamptz
      limit 1`,
    [day]
  )
  return NextResponse.json({ is_public: rows.length > 0 })
}

export async function PUT(req: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const day = normDayTs(tsRaw)
  if (!day) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  const { is_public } = await req.json().catch(() => ({}))

  if (is_public === true) {
    // 1) Nettoie d'éventuelles anciennes lignes non normalisées (à la minute)
    await pool.query(
      `delete from minute_public where date_trunc('day', ts) = $1::timestamptz`,
      [day]
    )
    // 2) Insère la ligne normalisée au début de journée UTC
    await pool.query(
      `insert into minute_public(ts)
       values($1::timestamptz)
       on conflict (ts) do nothing`,
      [day]
    )
  } else {
    // Supprime pour toute valeur du jour (normalisée ou non)
    await pool.query(
      `delete from minute_public where date_trunc('day', ts) = $1::timestamptz`,
      [day]
    )
  }

  return NextResponse.json({ ok: true })
}
