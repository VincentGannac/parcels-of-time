export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

function validUsername(u: string) {
  return /^[a-zA-Z0-9._-]{3,20}$/.test(u)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = (url.searchParams.get('u') || '').trim()

  // invalide => “non disponible” (on évite de divulguer trop d’info)
  if (!validUsername(raw)) {
    return NextResponse.json({ available: false, reason: 'invalid' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const { rows } = await pool.query(
    `select 1 from owners where lower(display_name) = lower($1) limit 1`,
    [raw],
  )
  const available = rows.length === 0
  return NextResponse.json({ available }, { headers: { 'Cache-Control': 'no-store' } })
}
