// app/api/stripe/webhook/route.ts
export const runtime = 'nodejs'

import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { pool } from '@/lib/db'

/**
 * Écrit (ou met à jour) la claim après un paiement réussi.
 * - transaction SQL avec ROLLBACK en cas d'erreur
 * - calcule le hash du certificat
 */
async function writeClaim(session: any) {
  const ts = String(session.metadata?.ts || '')
  const email = String(session.customer_details?.email || session.metadata?.email || '')
  const display_name = (session.metadata?.display_name || '') || null
  const title = (session.metadata?.title || '') || null
  const message = (session.metadata?.message || '') || null
  const link_url = (session.metadata?.link_url || '') || null
  const amount_total = session.amount_total ?? 0

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: ownerRows } = await client.query(
      `INSERT INTO owners(email, display_name)
       VALUES($1,$2)
       ON CONFLICT(email) DO UPDATE
         SET display_name = COALESCE(EXCLUDED.display_name, owners.display_name)
       RETURNING id`,
      [email.toLowerCase(), display_name]
    )
    const ownerId = ownerRows[0].id

    const { rows: claimRows } = await client.query(
      `INSERT INTO claims (ts, owner_id, price_cents, currency, title, message, link_url)
       VALUES ($1::timestamptz, $2, $3, 'EUR', $4, $5)
       ON CONFLICT (ts) DO UPDATE
         SET message = EXCLUDED.message,
              title = EXCLUDED.title,
             link_url = EXCLUDED.link_url
       RETURNING id, created_at`,
      [ts, ownerId, amount_total, title, message, link_url]
    )
    const claim = claimRows[0]

    const salt = process.env.SECRET_SALT || 'dev_salt'
    const data = `${ts}|${ownerId}|${amount_total}|${claim.created_at.toISOString()}|${salt}`
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    const cert_url = `/api/cert/${encodeURIComponent(ts)}`

    await client.query(
      'UPDATE claims SET cert_hash=$1, cert_url=$2 WHERE id=$3',
      [hash, cert_url, claim.id]
    )

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY
  const wh = process.env.STRIPE_WEBHOOK_SECRET
  if (!key || !wh) {
    return NextResponse.json({ ok: false, error: 'missing env' }, { status: 500 })
  }

  const stripe = new Stripe(key)
  const sig = req.headers.get('stripe-signature') || ''
  const rawBody = await req.text()

  let evt: Stripe.Event
  try {
    evt = stripe.webhooks.constructEvent(rawBody, sig, wh)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 400 })
  }

  // Idempotence robuste : ON CONFLICT DO NOTHING
  const inserted = await pool.query(
    `INSERT INTO stripe_events(id, type)
     VALUES($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [evt.id, evt.type]
  )
  if (inserted.rowCount === 0) {
    // déjà traité
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (evt.type === 'checkout.session.completed') {
    const session = evt.data.object as any
    try {
      await writeClaim(session)
    } catch (e: any) {
      // renvoyer 500 permet à Stripe de retenter automatiquement
      return NextResponse.json(
        { received: true, error: 'db_error' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ received: true })
}
