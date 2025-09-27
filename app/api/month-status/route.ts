//api/month-status/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(req: Request) {
  const ym = new URL(req.url).searchParams.get('ym') || ''
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) return NextResponse.json({ unavailable:[], for_sale:[] })

  const y = +m[1], mo = +m[2]
  const first = new Date(Date.UTC(y, mo-1, 1))
  const next = new Date(Date.UTC(y, mo, 1))

  // indisponibles = jours déjà dans claims
  const { rows: sold } = await pool.query(
    `select extract(day from ts at time zone 'UTC')::int as d
       from claims
      where ts >= $1 and ts < $2`,
    [first.toISOString(), next.toISOString()]
  )
  const { rows: sale } = await pool.query(
    `select extract(day from ts at time zone 'UTC')::int as d
       from listings
      where ts >= $1 and ts < $2 and status='active'`,
    [first.toISOString(), next.toISOString()]
  )
  return NextResponse.json({
    unavailable: sold.map(r=>r.d),
    for_sale: sale.map(r=>r.d)
  })
}
