//app/api/registry/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

type Row = {
  ts: string
  owner: string
  title: string | null
  message: string | null
  style: string
  is_public: true
}

export async function GET() {
  try {
    // JOIN strict (FK minute_public.ts -> claims.ts)
    const { rows } = await pool.query(
      `select
         c.ts,
         coalesce(o.display_name, 'Anonymous') as owner,
         c.title,
         c.message,
         c.cert_style as style
       from minute_public mp
       join claims c on c.ts = mp.ts
       join owners o on o.id = c.owner_id
       order by c.ts desc
       limit 500`
    )

    const out: Row[] = rows.map((r: any) => ({
      ts: new Date(r.ts).toISOString(),
      owner: String(r.owner || 'Anonymous'),
      title: r.title ?? null,
      message: r.message ?? null,
      style: (r.style || 'neutral'),
      is_public: true,
    }))

    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[api/registry] error:', (e as any)?.message || e)
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }
}
