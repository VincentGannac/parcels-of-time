// app/api/unavailable/route.ts
export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

type ClaimRow = { ts: string | Date }
type ListingDayRow = { d: number; id: string; price_cents: number; currency: string }


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
    // 1) Jours avec claim (mois)
    const { rows: claimRows } = await pool.query<ClaimRow>(
      `select ts
         from claims
        where ts >= $1::timestamptz
          and ts <  $2::timestamptz`,
      [range.start.toISOString(), range.end.toISOString()]
    )
    const claimDays = new Set(
      claimRows
        .map(r => new Date(r.ts as any).getUTCDate())
        .filter(d => d >= 1 && d <= 31)
    )

    // 2) Listings actifs (jaunes) du mois — avec prix & id
    const monthStart = `${range.start.getUTCFullYear()}-${String(range.m).padStart(2, '0')}-01`
    const { rows: saleRows } = await pool.query<ListingDayRow>(
      `select
         extract(day from l.ts at time zone 'UTC')::int as d,
         l.id,
         l.price_cents,
         l.currency
       from listings l
      where l.ts >= $1::date
        and l.ts <  ($1::date + interval '1 month')
        and l.status = 'active'`,
      [monthStart]
    )

    // map jour -> listing (un seul par jour attendu)
    const saleByDay = new Map<number, { id: string; price_cents: number; currency: string }>()
    for (const r of saleRows) {
      if (r.d >= 1 && r.d <= 31 && !saleByDay.has(r.d)) {
        saleByDay.set(r.d, { id: String(r.id), price_cents: r.price_cents, currency: r.currency })
      }
    }

    // 3) Jaunes & rouges
    const for_sale = Array.from(saleByDay.keys()).sort((a,b)=>a-b)
    // ⚠️ IMPORTANT : on retire les jours en vente du set indisponible
    for (const d of for_sale) claimDays.delete(d)
    const unavailable = Array.from(claimDays).sort((a,b)=>a-b)

    // 4) listings enrichis (pour le prix dans l’UI)
    const listings = for_sale.map(d => ({ d, ...saleByDay.get(d)! }))

    return NextResponse.json({ unavailable, for_sale, listings })
  } catch (e: any) {
    console.error('[unavailable] db error:', e?.message || e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
