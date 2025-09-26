// app/api/unavailable/route.ts
export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

type ClaimRow = { ts: string | Date }
type DayRow = { d: number }

function startEndUTC(ym: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) return null
  const y = Number(m[1])
  const mm0 = Number(m[2]) - 1 // 0-based
  const start = new Date(Date.UTC(y, mm0, 1, 0, 0, 0, 0))
  const end   = new Date(Date.UTC(y, mm0 + 1, 1, 0, 0, 0, 0))
  return { start, end, y, m: mm0 + 1 }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const ym = url.searchParams.get('ym') || ''
  const range = startEndUTC(ym)
  if (!range) {
    return NextResponse.json({ error: 'bad_ym' }, { status: 400 })
  }

  try {
    // 1) Jours indisponibles (= claims existants)
    const { rows: claimRows } = await pool.query<ClaimRow>(
      `select ts
         from claims
        where ts >= $1::timestamptz
          and ts <  $2::timestamptz`,
      [range.start.toISOString(), range.end.toISOString()]
    )
    const unavailable = Array.from(
      new Set(
        claimRows
          .map(r => new Date(r.ts as any).getUTCDate())
          .filter(d => d >= 1 && d <= 31)
      )
    ).sort((a, b) => a - b)

    // 2) Jours en vente (listings actifs du mois)
    const monthStart = `${range.start.getUTCFullYear()}-${String(range.m).padStart(2, '0')}-01`
    const { rows: saleRows } = await pool.query<DayRow>(
      `select extract(day from l.ts at time zone 'UTC')::int as d
         from listings l
        where date_trunc('month', l.ts) = $1::date
          and l.status = 'active'`,
      [monthStart]
    )
    const for_sale = Array.from(
      new Set(saleRows.map(r => r.d).filter(d => d >= 1 && d <= 31))
    ).sort((a, b) => a - b)

    // 3) Réponse enrichie
    return NextResponse.json({ unavailable, for_sale })
  } catch (e: any) {
    console.error('[unavailable] db error:', e?.message || e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
