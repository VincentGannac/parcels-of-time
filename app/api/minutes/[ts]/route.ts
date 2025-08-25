// app/api/minutes/[ts]/route.ts
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/minutes/[ts] → { found, id, ts, title, message }
export async function GET(_req: Request, ctx: any) {
  const ts = decodeURIComponent(ctx?.params?.ts ?? '')

  // 1) nouveau modèle : minute_public => tout le contenu du certificat
  try {
    const q = await pool.query(
      `select c.id, c.ts, c.title, c.message
         from minute_public mp
         join claims c on c.ts = mp.ts
        where mp.ts=$1::timestamptz
        limit 1`,
      [ts]
    )
    if (q.rows.length) {
      const r = q.rows[0]
      return NextResponse.json({
        found: true,
        id: String(r.id),
        ts: new Date(r.ts).toISOString(),
        title: r.title ?? null,
        message: r.message ?? null,
      })
    }
  } catch {}

  // 2) compat (anciens flags titre/message)
  try {
    const q2 = await pool.query(
      `select c.id, c.ts,
              case when c.title_public   then c.title   else null end as title,
              case when c.message_public then c.message else null end as message
         from claims c
        where c.ts=$1::timestamptz
        limit 1`,
      [ts]
    )
    if (q2.rows.length) {
      const r = q2.rows[0]
      const found = r.title != null || r.message != null
      if (found) {
        return NextResponse.json({
          found: true,
          id: String(r.id),
          ts: new Date(r.ts).toISOString(),
          title: r.title,
          message: r.message,
        })
      }
    }
  } catch {}

  return NextResponse.json({ found: false }, { status: 404 })
}
