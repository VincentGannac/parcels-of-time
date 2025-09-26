//app/api/marketplace/listing
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'

type Body = { ts: string; price_cents: number; currency?: string }

function normIsoDay(s: string) {
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0); return d.toISOString()
}

export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json()) as Body

  const tsISO = normIsoDay(body.ts); if (!tsISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })
  const ownerId = await ownerIdForDay(tsISO)
  if (!ownerId || ownerId !== sess.ownerId) return NextResponse.json({ error: 'not_owner' }, { status: 403 })

  const price = Math.max(100, Math.floor(+body.price_cents || 0))
  const currency = (body.currency || 'EUR').toUpperCase()

  // vendeur doit avoir un compte connect usable
  const { rows: ma } = await pool.query(
    'select charges_enabled, payouts_enabled from merchant_accounts where owner_id=$1',
    [sess.ownerId]
  )
  if (!ma.length || !ma[0].charges_enabled) {
    return NextResponse.json({ error: 'connect_not_ready' }, { status: 409 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // upsert listing -> status ACTIVE
    const { rows } = await client.query(
      `insert into listings (ts, seller_owner_id, price_cents, currency, status)
       values ($1,$2,$3,$4,'active')
       on conflict on constraint uniq_listings_ts_active
       do update set price_cents=excluded.price_cents, currency=excluded.currency, status='active'
       returning id, status, price_cents, currency`,
      [tsISO, sess.ownerId, price, currency]
    )

    await client.query('COMMIT')
    return NextResponse.json({ ok: true, listing: rows[0] })
  } catch (e:any) {
    try { await client.query('ROLLBACK') } catch {}
    return NextResponse.json({ error: 'db_error', detail: String(e?.message || e) }, { status: 500 })
  } finally {
    client.release()
  }
}
