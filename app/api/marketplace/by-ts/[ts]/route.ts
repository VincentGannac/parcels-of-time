export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

function normIsoDay(s:string){ const d=new Date(s); if(isNaN(d.getTime()))return null; d.setUTCHours(0,0,0,0); return d.toISOString() }

export async function GET(_req: Request, ctx: any) {
  const tsISO = normIsoDay(decodeURIComponent(String(ctx.params?.ts || '')))
  if (!tsISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })
  const { rows } = await pool.query(
    `select l.id, l.ts, l.price_cents, l.currency, l.status,
            o.display_name as seller_display_name
       from listings l
       join owners o on o.id = l.seller_owner_id
      where l.ts = $1 and l.status = 'active'`,
    [tsISO]
  )
  if (!rows.length) return NextResponse.json({ listing:null })
  return NextResponse.json({ listing: rows[0] })
}
