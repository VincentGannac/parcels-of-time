// app/api/minutes/[ts]/public/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

function normTs(ts: string) {
  const d = new Date(ts); if (isNaN(d.getTime())) return null
  d.setUTCSeconds(0,0); return d.toISOString()
}

export async function GET(_: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const ts = normTs(tsRaw); if (!ts) return NextResponse.json({ error:'bad_ts' }, { status:400 })
  const { rows } = await pool.query('select 1 from minute_public where ts=$1::timestamptz', [ts])
  return NextResponse.json({ is_public: rows.length > 0 })
}

export async function PUT(req: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const ts = normTs(tsRaw); if (!ts) return NextResponse.json({ error:'bad_ts' }, { status:400 })
  const { is_public } = await req.json().catch(()=>({}))
  if (is_public === true) {
    // nécessite que la claim existe
    await pool.query('insert into minute_public(ts) values($1::timestamptz) on conflict (ts) do nothing', [ts])
  } else {
    await pool.query('delete from minute_public where ts=$1::timestamptz', [ts])
  }
  return NextResponse.json({ ok:true })
}
