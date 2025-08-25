// app/api/minutes/[ts]/route.ts
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/minutes/[ts] → { found, id, ts, title, message }
export async function GET(_req: Request, ctx: any) {
  const ts = decodeURIComponent(ctx?.params?.ts ?? '')

  try {
    const { rows } = await pool.query(
      `select c.id, c.ts,
              case when c.title_public   then c.title   else null end as title,
              case when c.message_public then c.message else null end as message
         from claims c
        where c.ts=$1::timestamptz
        limit 1`,
      [ts]
    )
    if (rows.length) {
      const r = rows[0]
      return NextResponse.json({
        found: true,
        id: String(r.id),
        ts: new Date(r.ts).toISOString(),
        title: r.title ?? null,
        message: r.message ?? null,
      })
    }
  } catch {}

  return NextResponse.json({ found: false }, { status: 404 })
}
