export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import crypto from 'crypto'
import { pool } from '@/lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const session_id = url.searchParams.get('session_id')
  if (!session_id) return NextResponse.redirect(new URL('/', url).toString(), { status: 302 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!); // ✅ pas d'apiVersion
  const s = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] })

  if (s.payment_status !== 'paid') {
    return NextResponse.redirect(new URL(`/claim?ts=${encodeURIComponent(String(s.metadata?.ts || ''))}&status=unpaid`, url).toString(), { status: 302 })
  }

  const ts = String(s.metadata?.ts || '')
  const email = String(s.metadata?.email || '')
  const display_name = (s.metadata?.display_name || '') || null
  const message = (s.metadata?.message || '') || null
  const link_url = (s.metadata?.link_url || '') || null
  const amount_total = s.amount_total ?? 0

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: ownerRows } = await client.query(
      'INSERT INTO owners(email, display_name) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, owners.display_name) RETURNING id',
      [email.toLowerCase(), display_name]
    )
    const ownerId = ownerRows[0].id

    const { rows: claimRows } = await client.query(
      `INSERT INTO claims (ts, owner_id, price_cents, currency, message, link_url)
       VALUES ($1::timestamptz, $2, $3, 'EUR', $4, $5)
       ON CONFLICT (ts) DO UPDATE SET message = EXCLUDED.message, link_url = EXCLUDED.link_url
       RETURNING id, created_at`,
      [ts, ownerId, amount_total, message, link_url]
    )
    const claim = claimRows[0]

    const salt = process.env.SECRET_SALT || 'dev_salt'
    const data = `${ts}|${ownerId}|${amount_total}|${claim.created_at.toISOString()}|${salt}`
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    const cert_url = `/api/cert/${encodeURIComponent(ts)}`
    await client.query('UPDATE claims SET cert_hash=$1, cert_url=$2 WHERE id=$3', [hash, cert_url, claim.id])

    await client.query('COMMIT')
  } catch (e: any) {
    await client.query('ROLLBACK')
  } finally {
    client.release()
  }

  return NextResponse.redirect(new URL(`/s/${encodeURIComponent(ts)}`, url).toString(), { status: 303 })
}
