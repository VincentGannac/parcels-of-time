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
    // JOIN sur le JOUR pour matcher les anciennes lignes minute_public non normalisées
    const { rows } = await pool.query(
      `select
         c.ts,
         coalesce(o.display_name, 'Anonymous') as owner,
         c.title,
         c.message,
         c.cert_style as style
       from minute_public mp
       join claims c
         on date_trunc('day', c.ts) = date_trunc('day', mp.ts)
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

    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    // En cas d’erreur, on renvoie un tableau vide sans cache
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
