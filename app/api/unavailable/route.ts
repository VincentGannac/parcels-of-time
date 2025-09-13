//app/api/unavailable/route.ts
export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

type ClaimRow = { ts: string | Date }

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
    const { rows } = await pool.query<ClaimRow>(
      `select ts
         from claims
        where ts >= $1::timestamptz
          and ts <  $2::timestamptz`,
      [range.start.toISOString(), range.end.toISOString()]
    )

    const days = Array.from(
      new Set(
        rows
          .map((r: ClaimRow) => {
            const d = new Date(r.ts as any)
            return d.getUTCDate()
          })
          .filter((d: number) => d >= 1 && d <= 31)
      )
    ).sort((a: number, b: number) => a - b)

    return NextResponse.json({ days })
  } catch (e: any) {
    console.error('[unavailable] db error:', e?.message || e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
