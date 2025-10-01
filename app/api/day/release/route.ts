export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'

function normalizeTs(input: string): { tsISO: string | null; tsYMD: string | null } {
  if (!input) return { tsISO: null, tsYMD: null }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T00:00:00.000Z`) : new Date(input)
  if (isNaN(d.getTime())) return { tsISO: null, tsYMD: null }
  d.setUTCHours(0, 0, 0, 0)
  const tsISO = d.toISOString()
  const tsYMD = tsISO.slice(0, 10)
  return { tsISO, tsYMD }
}

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || ''
  let tsIn: string = ''
  let locale = 'en'

  try {
    if (ct.includes('application/json')) {
      const j = await req.json()
      tsIn = String(j?.ts || '')
      locale = (j?.locale === 'fr' ? 'fr' : 'en')
    } else {
      const fd = await req.formData()
      tsIn = String(fd.get('ts') || '')
      locale = (String(fd.get('locale') || 'en') === 'fr' ? 'fr' : 'en')
    }
  } catch {
    return NextResponse.json({ error: 'bad_payload' }, { status: 400 })
  }

  const { tsISO, tsYMD } = normalizeTs(tsIn)
  if (!tsISO || !tsYMD) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Ownership check (robuste ISO/YMD)
  let owner: string | null = null
  try { owner = await ownerIdForDay(tsISO) as any } catch {}
  if (!owner) {
    try { owner = await ownerIdForDay(tsYMD) as any } catch {}
  }
  if (!owner || owner !== session.ownerId) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1) Retire du registre public
    await client.query(
      `delete from minute_public where date_trunc('day', ts) = $1::timestamptz`,
      [tsISO]
    )

    // 2) Supprime toutes les annonces (actives, sold, canceled) liées à cette journée
    await client.query(
      `delete from listings where date_trunc('day', ts) = $1::timestamptz`,
      [tsISO]
    )

    // 3) Supprime la/les claims de la journée
    //    (si des tables enfants référencent claims avec ON DELETE CASCADE, elles seront nettoyées)
    await client.query(
      `delete from claims where date_trunc('day', ts) = $1::timestamptz`,
      [tsISO]
    )

    await client.query('COMMIT')
  } catch (e:any) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('[release] db error:', e?.message || e)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  } finally {
    client.release()
  }

  // Redirection douce vers le compte
  const next = `/${locale}/account?freed=${encodeURIComponent(tsYMD)}`
  return NextResponse.json({ ok: true, next }, { headers: { 'Cache-Control': 'no-store' } })
}
