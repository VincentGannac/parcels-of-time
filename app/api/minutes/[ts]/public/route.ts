export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

function normTs(ts: string) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  d.setUTCSeconds(0, 0) // précision minute
  return d.toISOString()
}

/** GET: statut publication pour CETTE minute exacte */
export async function GET(_: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const ts = normTs(tsRaw)
  if (!ts) return NextResponse.json({ error:'bad_ts' }, { status:400 })

  const { rows } = await pool.query(
    'select 1 from minute_public where ts=$1::timestamptz limit 1',
    [ts]
  )
  return NextResponse.json({ is_public: rows.length > 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

/** PUT: publie / dépublie CETTE minute exacte */
export async function PUT(req: Request, ctx: any) {
  const tsRaw = decodeURIComponent(String(ctx?.params?.ts ?? ''))
  const ts = normTs(tsRaw)
  if (!ts) return NextResponse.json({ error:'bad_ts' }, { status:400 })

  const body = await req.json().catch(()=>({}))
  const is_public = body?.is_public === true

  if (is_public) {
    // Vérifie l’existence de la claim à CETTE minute
    const chk = await pool.query('select 1 from claims where ts=$1::timestamptz limit 1', [ts])
    if (chk.rows.length === 0) {
      return NextResponse.json({ ok:false, error:'claim_not_found_for_ts' }, { status:409 })
    }
    await pool.query(
      'insert into minute_public(ts) values($1::timestamptz) on conflict (ts) do nothing',
      [ts]
    )
  } else {
    await pool.query('delete from minute_public where ts=$1::timestamptz', [ts])
  }

  return NextResponse.json({ ok:true }, { headers: { 'Cache-Control': 'no-store' } })
}
