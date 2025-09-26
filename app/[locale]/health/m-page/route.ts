export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'

function toIsoDayUTC(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T00:00:00.000Z`
  const d = new Date(input); if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0); return d.toISOString()
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  const tsRaw = u.searchParams.get('ts') || ''
  const tsISO = toIsoDayUTC(tsRaw)
  if (!tsISO) return NextResponse.json({ ok:false, error:'bad_ts' }, { status:400 })
  const tsYMD = tsISO.slice(0,10)

  const steps:any = { tsISO, tsYMD }

  try {
    steps.session = await readSession()
    steps.hasSession = !!steps.session
  } catch (e:any) {
    steps.session = { error: e?.message || String(e) }
  }

  try {
    const { rows } = await pool.query(`select owner_id, id, cert_hash from claims where date_trunc('day', ts)=$1::timestamptz limit 1`, [tsISO])
    steps.claim = rows[0] || null
  } catch (e:any) {
    steps.claim = { error: e?.message || String(e) }
  }

  try {
    const { rows } = await pool.query(`select 1 from minute_public where date_trunc('day', ts)=$1::timestamptz`, [tsISO])
    steps.public = !!rows.length
  } catch (e:any) {
    steps.public = { error: e?.message || String(e) }
  }

  // Décision de la page
  steps.isOwner = !!(steps.session && steps.claim && steps.session.ownerId === String(steps.claim.owner_id))
  steps.allowed = !!(steps.isOwner || steps.public)

  return NextResponse.json({ ok:true, steps }, { headers: { 'Cache-Control':'no-store' }})
}
