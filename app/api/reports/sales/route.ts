// app/api/reports/sales/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['cdg1','fra1']

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

async function tableExists(table: string) {
  const { rows } = await pool.query(`select to_regclass($1) as ok`, [`public.${table}`])
  return !!rows[0]?.ok
}
async function hasColumn(table: string, col: string) {
  const { rows } = await pool.query(
    `select 1 from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2 limit 1`,
    [table, col]
  )
  return !!rows.length
}

type Row = {
  date: string
  listing_id: string
  gross_cents: number
  fee_cents: number
  net_cents: number
  currency: string
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
function rowsToCSV(rows: Row[]) {
  const header = 'date,listing_id,gross_cents,fee_cents,net_cents,currency'
  const lines = rows.map(r =>
    [r.date, r.listing_id, r.gross_cents, r.fee_cents, r.net_cents, r.currency].map(v=>csvEscape(String(v))).join(',')
  )
  return [header, ...lines].join('\n')
}

export async function GET(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const y = Number(url.searchParams.get('year') || new Date().getUTCFullYear())
  const format = (url.searchParams.get('format') || 'csv').toLowerCase()

  const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
  const end   = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0))

  const hasSecondary = await tableExists('secondary_sales')
  const rows: Row[] = []

  if (hasSecondary) {
    const hasGross = await hasColumn('secondary_sales', 'gross_cents')
    const hasPrice = await hasColumn('secondary_sales', 'price_cents')

    if (hasGross) {
      const { rows: r } = await pool.query(
        `select listing_id, ts, gross_cents, fee_cents, net_cents, currency
           from secondary_sales
          where seller_owner_id=$1
            and ts >= $2::timestamptz
            and ts <  $3::timestamptz
          order by ts asc`,
        [sess.ownerId, start.toISOString(), end.toISOString()]
      )
      for (const x of r) {
        rows.push({
          date: new Date(x.ts).toISOString().slice(0,10),
          listing_id: String(x.listing_id),
          gross_cents: Number(x.gross_cents) | 0,
          fee_cents: Number(x.fee_cents) | 0,
          net_cents: Number(x.net_cents) | 0,
          currency: String(x.currency || 'EUR'),
        })
      }
    } else if (hasPrice) {
      const { rows: r } = await pool.query(
        `select listing_id, ts, price_cents, currency
           from secondary_sales
          where seller_owner_id=$1
            and ts >= $2::timestamptz
            and ts <  $3::timestamptz
          order by ts asc`,
        [sess.ownerId, start.toISOString(), end.toISOString()]
      )
      for (const x of r) {
        const gross = Number(x.price_cents) | 0
        const fee = Math.max(100, Math.round(gross * 0.15))
        const net = Math.max(0, gross - fee)
        rows.push({
          date: new Date(x.ts).toISOString().slice(0,10),
          listing_id: String(x.listing_id),
          gross_cents: gross,
          fee_cents: fee,
          net_cents: net,
          currency: String(x.currency || 'EUR'),
        })
      }
    }
  } else {
    // Fallback : derive depuis listings vendues (si pas de journal)
    const { rows: r } = await pool.query(
      `select id, ts, price_cents, currency
         from listings
        where seller_owner_id=$1
          and status='sold'
          and ts >= $2::timestamptz
          and ts <  $3::timestamptz
        order by ts asc`,
      [sess.ownerId, start.toISOString(), end.toISOString()]
    )
    for (const x of r) {
      const gross = Number(x.price_cents) | 0
      const fee = Math.max(100, Math.round(gross * 0.15))
      const net = Math.max(0, gross - fee)
      rows.push({
        date: new Date(x.ts).toISOString().slice(0,10),
        listing_id: String(x.id),
        gross_cents: gross,
        fee_cents: fee,
        net_cents: net,
        currency: String(x.currency || 'EUR'),
      })
    }
  }

  // Totaux
  const totals = rows.reduce(
    (acc, r) => {
      acc.gross_cents += r.gross_cents
      acc.fee_cents += r.fee_cents
      acc.net_cents += r.net_cents
      return acc
    },
    { gross_cents: 0, fee_cents: 0, net_cents: 0 }
  )

  if (format === 'json') {
    return NextResponse.json({ year: y, rows, totals })
  }

  const csv = rowsToCSV(rows)
  const fn = `sales_${y}.csv`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${fn}"`,
      'cache-control': 'no-store',
    },
  })
}
