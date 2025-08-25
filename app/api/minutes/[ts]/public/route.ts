// app/api/minutes/[ts]/public/route.ts
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET — état public (présence dans minute_public)
export async function GET(_req: Request, ctx: any) {
  const ts = decodeURIComponent(ctx?.params?.ts ?? '')
  try {
    const { rows } = await pool.query(
      `select 1 from minute_public where ts=$1::timestamptz limit 1`,
      [ts]
    )
    return NextResponse.json({ ok: true, is_public: rows.length > 0 })
  } catch {}
  return NextResponse.json({ ok: false, is_public: false }, { status: 404 })
}

// PUT — publie / retire du registre public
export async function PUT(req: Request, ctx: any) {
  const ts = decodeURIComponent(ctx?.params?.ts ?? '')
  let is_public = false
  try {
    const body = await req.json()
    is_public = !!body?.is_public
  } catch {}

  try {
    if (is_public) {
      await pool.query(
        `insert into minute_public (ts) values ($1::timestamptz) on conflict (ts) do nothing`,
        [ts]
      )
    } else {
      await pool.query(`delete from minute_public where ts=$1::timestamptz`, [ts])
    }
    return NextResponse.json({ ok: true })
  } catch {}
  return NextResponse.json({ ok: false }, { status: 400 })
}
