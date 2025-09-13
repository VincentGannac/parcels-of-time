//app/api/registry/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

type Row = {
  ts: string         // ISO minuit UTC du jour
  owner: string
  title: string | null
  message: string | null
  style: string
  is_public: true
}

export async function GET() {
  try {
    // On sélectionne UNE claim par jour publié (la plus récente si plusieurs, par sécurité)
    const { rows } = await pool.query(
      `
      select distinct on (day_utc)
        day_utc,
        owner,
        title,
        message,
        style
      from (
        select
          date_trunc('day', c.ts) as day_utc,
          coalesce(o.display_name, 'Anonymous') as owner,
          c.title,
          c.message,
          c.cert_style as style,
          c.ts as claim_ts
        from minute_public mp
        join claims c on date_trunc('day', c.ts) = date_trunc('day', mp.ts)
        join owners o on o.id = c.owner_id
      ) t
      order by day_utc desc, claim_ts desc
      limit 500
      `
    )

    const out: Row[] = rows.map((r: any) => ({
      ts: new Date(r.day_utc).toISOString().slice(0,10),
      owner: String(r.owner || 'Anonymous'),
      title: r.title ?? null,
      message: r.message ?? null,
      style: r.style || 'neutral',
      is_public: true,
    }))

    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[api/registry] error:', (e as any)?.message || e)
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }
}
