// app/api/stripe/webhook/route.ts
export const runtime = 'nodejs'

import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

async function tableExists(client: any, table: string) {
  const { rows } = await client.query(`select to_regclass($1) as exists`, [`public.${table}`])
  return !!rows[0]?.exists
}

/**
 * Écrit (ou met à jour) la claim après un paiement réussi (Cas A).
 * - Transaction SQL avec ROLLBACK en cas d'erreur.
 * - Gère custom background (temp -> persist).
 * - Calcule et enregistre le hash + cert_url.
 * - Après COMMIT : publie dans minute_public si demandé.
 */
async function writeClaim(session: any) {
  const ts: string = String(session.metadata?.ts || '')
  const email: string = String(session.customer_details?.email || session.metadata?.email || '')
  const display_name: string | null = (session.customer_details?.name || session.metadata?.display_name || '') || null
  const title: string | null = (session.metadata?.title || '') || null
  const message: string | null = (session.metadata?.message || '') || null

  const styleCandidate = String(session.metadata?.cert_style || 'neutral').toLowerCase()
  const CERT_STYLES = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const
  const cert_style: (typeof CERT_STYLES)[number] =
    (CERT_STYLES as readonly string[]).includes(styleCandidate) ? (styleCandidate as any) : 'neutral'

  const time_display =
    session.metadata?.time_display === 'utc' ||
    session.metadata?.time_display === 'utc+local' ||
    session.metadata?.time_display === 'local+utc'
      ? session.metadata?.time_display
      : 'local+utc'

  const local_date_only = String(session.metadata?.local_date_only) === '1'
  const text_color =
    /^#[0-9a-fA-F]{6}$/.test(String(session.metadata?.text_color || ''))
      ? String(session.metadata?.text_color).toLowerCase()
      : '#1a1f2a'

  const custom_bg_key = String(session.metadata?.custom_bg_key || '')
  const wantsPublic = String(session.metadata?.public_registry || '') === '1'

  const amount_total =
    session.amount_total ??
    (typeof session.payment_intent !== 'string' && session.payment_intent
      ? (session.payment_intent.amount_received ?? session.payment_intent.amount ?? 0)
      : 0)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Owner
    const { rows: ownerRows } = await client.query(
      `insert into owners(email, display_name)
       values($1,$2)
       on conflict(email) do update
         set display_name = coalesce(excluded.display_name, owners.display_name)
       returning id`,
      [email.toLowerCase(), display_name]
    )
    const ownerId = ownerRows[0].id

    // Claim (upsert complet)
    await client.query(
      `insert into claims (
         ts, owner_id, price_cents, currency,
         title, message,
         cert_style, time_display, local_date_only, text_color
       )
       values (
         $1::timestamptz, $2, $3, 'EUR',
         $4, $5,
         $6, $7, $8, $9
       )
       on conflict (ts) do update set
         owner_id      = excluded.owner_id,
         price_cents   = excluded.price_cents,
         currency      = excluded.currency,
         title         = excluded.title,
         message       = excluded.message,
         cert_style    = excluded.cert_style,
         time_display  = excluded.time_display,
         local_date_only = excluded.local_date_only,
         text_color    = excluded.text_color`,
      [ts, ownerId, amount_total, title, message, cert_style, time_display, local_date_only, text_color]
    )

    // Custom background: temp -> persist
    if (cert_style === 'custom' && custom_bg_key) {
      const hasTemp = await tableExists(client, 'custom_bg_temp')
      const hasPersist = await tableExists(client, 'claim_custom_bg')
      if (hasTemp && hasPersist) {
        const { rows: tmp } = await client.query('select data_url from custom_bg_temp where key = $1', [custom_bg_key])
        if (tmp.length) {
          await client.query(
            `insert into claim_custom_bg (ts, data_url)
             values ($1::timestamptz, $2)
             on conflict (ts) do update
               set data_url = excluded.data_url, created_at = now()`,
            [ts, tmp[0].data_url]
          )
          await client.query('delete from custom_bg_temp where key = $1', [custom_bg_key])
        }
      }
    }

    // Hash + cert_url
    const salt = process.env.SECRET_SALT || 'dev_salt'
    const createdRow = await client.query('select created_at from claims where ts=$1::timestamptz', [ts])
    const createdISO =
      createdRow.rows[0]?.created_at instanceof Date
        ? createdRow.rows[0].created_at.toISOString()
        : new Date(createdRow.rows[0]?.created_at || Date.now()).toISOString()

    const data = `${ts}|${ownerId}|${amount_total}|${createdISO}|${salt}`
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    const cert_url = `/api/cert/${encodeURIComponent(ts)}`
    await client.query(
      `update claims set cert_hash=$1, cert_url=$2 where ts=$3::timestamptz`,
      [hash, cert_url, ts]
    )

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  // ✅ Après COMMIT : inscription dans le registre public si demandé
  if (wantsPublic && ts) {
    await pool.query(
      `insert into minute_public (ts)
       values ($1::timestamptz)
       on conflict (ts) do nothing`,
      [ts]
    )
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

  // Idempotence : on ne traite chaque event qu'une fois
  const inserted = await pool.query(
    `insert into stripe_events(id, type)
     values($1, $2)
     on conflict (id) do nothing`,
    [evt.id, evt.type]
  )
  if (inserted.rowCount === 0) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (evt.type === 'checkout.session.completed') {
    const session = evt.data.object as any
    try {
      await writeClaim(session)
    } catch (e:any) {
      // Stripe retentera automatiquement
      return NextResponse.json({ received: true, error: 'db_error' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
