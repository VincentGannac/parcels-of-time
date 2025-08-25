// app/api/minutes/[ts]/public/route.ts
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// (optionnel) si tu veux forcer la fraîcheur côté Vercel
export const dynamic = 'force-dynamic'

/**
 * GET /api/minutes/[ts]/public
 * Renvoie l'état public { ok, is_public }
 */
export async function GET(_req: Request, { params }: any) {
  const ts = decodeURIComponent(params?.ts ?? '')

  // 1) Essaie via flags sur `claims`
  try {
    const { rows } = await pool.query(
      `select coalesce(title_public,false) as title_public,
              coalesce(message_public,false) as message_public
         from claims
        where ts=$1::timestamptz
        limit 1`,
      [ts]
    )
    if (rows.length) {
      const is_public = Boolean(rows[0].title_public || rows[0].message_public)
      return NextResponse.json({ ok: true, is_public })
    }
  } catch {}

  // 2) Fallback: présence dans minute_public
  try {
    const { rows } = await pool.query(
      `select 1 from minute_public where ts=$1::timestamptz limit 1`,
      [ts]
    )
    return NextResponse.json({ ok: true, is_public: rows.length > 0 })
  } catch {}

  return NextResponse.json({ ok: false, is_public: false }, { status: 404 })
}

/**
 * PUT /api/minutes/[ts]/public
 * Body: { is_public: boolean }
 */
export async function PUT(req: Request, { params }: any) {
  const ts = decodeURIComponent(params?.ts ?? '')
  let is_public = false
  try {
    const body = await req.json()
    is_public = !!body?.is_public
  } catch {}

  let ok = false

  // 1) Tente l’update sur `claims`
  try {
    const r = await pool.query(
      `update claims
          set title_public=$1, message_public=$1
        where ts=$2::timestamptz`,
      [is_public, ts]
    )
    const rc = r?.rowCount ?? 0
    ok = rc > 0
  } catch {}

  // 2) Fallback via `minute_public`
  if (!ok) {
    try {
      if (is_public) {
        await pool.query(
          `insert into minute_public (ts)
           values ($1::timestamptz)
           on conflict (ts) do nothing`,
          [ts]
        )
      } else {
        await pool.query(
          `delete from minute_public where ts=$1::timestamptz`,
          [ts]
        )
      }
      ok = true
    } catch {}
  }

  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
