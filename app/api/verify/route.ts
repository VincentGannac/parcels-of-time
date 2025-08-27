export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const ts = url.searchParams.get('ts') || ''
    if (!ts) {
      return NextResponse.json({ valid:false, error:'missing_ts' }, { status: 400 })
    }

    const { rows } = await pool.query(
      `select id as claim_id, cert_hash from claims where ts = $1::timestamptz`,
      [ts]
    )
    if (!rows.length) {
      return NextResponse.json({ valid:false }, { status: 404, headers: { 'Cache-Control':'no-store' } })
    }

    const { claim_id, cert_hash } = rows[0]
    return NextResponse.json(
      { valid:true, hash: String(cert_hash || ''), claim_id: String(claim_id), ts },
      { headers: { 'Cache-Control':'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json({ valid:false, error:'server_error', detail:String(e?.message||e) }, { status: 500 })
  }
}
