import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

type Body = { ts: string; email: string; display_name?: string; message?: string; link_url?: string }

export async function POST(req: Request) {
  const body = (await req.json()) as Body
  const ts = body.ts?.trim()
  const email = body.email?.trim().toLowerCase()

  if (!ts || !email) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  let iso: string
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) throw new Error('bad date')
    d.setMilliseconds(0)
    iso = d.toISOString()
  } catch { return NextResponse.json({ error: 'invalid_ts' }, { status: 400 }) }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: ownerRows } = await client.query(
      'INSERT INTO owners(email, display_name) VALUES($1, $2) ON CONFLICT(email) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, owners.display_name) RETURNING id',
      [email, body.display_name || null]
    )
    const ownerId = ownerRows[0].id

    await client.query(
      `INSERT INTO claims (ts, owner_id, price_cents, currency, message, link_url)
       VALUES ($1::timestamptz, $2, 0, 'EUR', $3, $4)`,
      [iso, ownerId, body.message || null, body.link_url || null]
    )
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, ts: iso })
  } catch (e:any) {
    await client.query('ROLLBACK')
    if (e?.code === '23505') return NextResponse.json({ error: 'already_claimed' }, { status: 409 })
    console.error('claim POST error', e?.message || e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  } finally {
    client.release()
  }
}
