// app/api/stripe/webhook/route.ts
export const runtime = 'nodejs'

import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

/** Utilitaires DB */
async function tableExists(client: any, table: string) {
  const { rows } = await client.query(`select to_regclass($1) as exists`, [`public.${table}`])
  return !!rows[0]?.exists
}
function normIsoDay(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
function asBool1(v: unknown) {
  return String(v) === '1' || v === true
}
function asHex(v: unknown, fallback = '#1a1f2a') {
  return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toLowerCase() : fallback
}
function asStyle(v: unknown) {
  const ALLOWED = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const
  const s = String(v || 'neutral').toLowerCase()
  return (ALLOWED as readonly string[]).includes(s as any) ? s : 'neutral'
}
function asTimeDisplay(v: unknown) {
  const td = String(v || 'local+utc')
  return (td === 'utc' || td === 'utc+local' || td === 'local+utc') ? td : 'local+utc'
}

/**
 * Upsert de la claim après paiement. Tout est fait dans 1 transaction :
 * - owners upsert
 * - claims upsert (toutes colonnes pertinentes)
 * - custom_bg_temp -> claim_custom_bg (si présent)
 * - cert_hash + cert_url
 * - publication minute_public si demandé (FK ok)
 */
async function writeClaimFromSession(session: Stripe.Checkout.Session) {
  const tsISO = normIsoDay(String(session.metadata?.ts || ''))
  if (!tsISO) throw new Error('bad_ts')

  const email = String(session.customer_details?.email || session.metadata?.email || '').trim().toLowerCase()
  if (!email) throw new Error('missing_email')

  const display_name: string | null =
    (session.customer_details?.name || session.metadata?.display_name || '') || null

  const title: string | null   = (session.metadata?.title   || '') || null
  const message: string | null = (session.metadata?.message || '') || null
  const link_url: string | null = (session.metadata?.link_url || '') || null

  const cert_style = asStyle(session.metadata?.cert_style)
  const time_display = asTimeDisplay(session.metadata?.time_display)
  const local_date_only = asBool1(session.metadata?.local_date_only)
  const text_color = asHex(session.metadata?.text_color)

  const title_public = asBool1(session.metadata?.title_public)
  const message_public = asBool1(session.metadata?.message_public)
  const wantsPublic = asBool1(session.metadata?.public_registry)

  const custom_bg_key = String(session.metadata?.custom_bg_key || '')

  const amount_total =
    session.amount_total ??
    (typeof session.payment_intent !== 'string' && session.payment_intent
      ? (session.payment_intent.amount_received ?? session.payment_intent.amount ?? 0)
      : 0)
  const price_cents = Math.max(0, Number(amount_total) | 0)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // owners
    const { rows: ownerRows } = await client.query(
      `insert into owners(email, display_name)
       values ($1,$2)
       on conflict (email) do update
         set display_name = coalesce(excluded.display_name, owners.display_name)
       returning id`,
      [email, display_name]
    )
    const ownerId = ownerRows[0].id

    // claims (upsert complet)
    await client.query(
      `insert into claims (
         ts, owner_id, price_cents, currency,
         title, message, link_url,
         cert_style, time_display, local_date_only, text_color,
         title_public, message_public
       )
       values (
         $1::timestamptz, $2, $3, 'EUR',
         $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12
       )
       on conflict (ts) do update set
         owner_id        = excluded.owner_id,
         price_cents     = excluded.price_cents,
         currency        = excluded.currency,
         title           = excluded.title,
         message         = excluded.message,
         link_url        = excluded.link_url,
         cert_style      = excluded.cert_style,
         time_display    = excluded.time_display,
         local_date_only = excluded.local_date_only,
         text_color      = excluded.text_color,
         title_public    = excluded.title_public,
         message_public  = excluded.message_public`,
      [
        tsISO, ownerId, price_cents,
        title, message, link_url,
        cert_style, time_display, local_date_only, text_color,
        title_public, message_public
      ]
    )

    // custom background : temp -> persist
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
            [tsISO, tmp[0].data_url]
          )
          await client.query('delete from custom_bg_temp where key = $1', [custom_bg_key])
        }
      }
    }

    // cert_hash + cert_url
    const createdRow = await client.query('select owner_id, price_cents, created_at from claims where ts=$1::timestamptz', [tsISO])
    const createdISO =
      createdRow.rows[0]?.created_at instanceof Date
        ? createdRow.rows[0].created_at.toISOString()
        : new Date(createdRow.rows[0]?.created_at || Date.now()).toISOString()

    const salt = process.env.SECRET_SALT || 'dev_salt'
    const data = `${tsISO}|${createdRow.rows[0]?.owner_id || ownerId}|${price_cents}|${createdISO}|${salt}`
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    const cert_url = `/api/cert/${encodeURIComponent(tsISO.slice(0,10))}`
    await client.query(
      `update claims set cert_hash=$1, cert_url=$2 where ts=$3::timestamptz`,
      [hash, cert_url, tsISO]
    )

    // publication registre public
    if (wantsPublic) {
      await client.query(
        `insert into minute_public(ts)
         values($1::timestamptz)
         on conflict (ts) do nothing`,
        [tsISO]
      )
    }

    await client.query('COMMIT')

    return { tsISO, email, display_name, cert_url }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally {
    client.release()
  }
}

export async function POST(req: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 })
  }

  // Stripe exige le raw body (pas de JSON parse)
  const sig = req.headers.get('stripe-signature') || ''
  const rawBody = await req.text()

  // ✅ Pas d'apiVersion forcée pour éviter l'erreur TS (on laisse Stripe choisir)
  const stripe = new Stripe(STRIPE_SECRET_KEY)

  let evt: Stripe.Event
  try {
    evt = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'invalid_signature', detail: String(e?.message || e) }, { status: 400 })
  }

  // Idempotence simple
  try {
    const ins = await pool.query(
      `insert into stripe_events(id, type)
       values($1, $2)
       on conflict (id) do nothing`,
      [evt.id, evt.type]
    )
    if (ins.rowCount === 0) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  } catch (e: any) {
    console.warn('[webhook] idempotence insert failed:', e?.message || e)
  }

  try {
    switch (evt.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = evt.data.object as Stripe.Checkout.Session
        if (session.payment_status && session.payment_status !== 'paid') break

        const res = await writeClaimFromSession(session)

        // Email de secours
        try {
          const base = process.env.NEXT_PUBLIC_BASE_URL || ''
          if (base && res?.tsISO && res?.email) {
            const guessedLocale =
              String(session.metadata?.locale || '').toLowerCase().startsWith('fr') ? 'fr' : 'en'
            const publicUrl = `${base}/${guessedLocale}/m/${encodeURIComponent(res.tsISO)}`
           const pdfUrl = `${base}/api/cert/${encodeURIComponent(res.tsISO.slice(0,10))}`
            const { sendClaimReceiptEmail } = await import('@/lib/email')
            await sendClaimReceiptEmail({
              to: res.email,
              ts: res.tsISO,
              displayName: res.display_name || null,
              publicUrl,
              certUrl: pdfUrl,
            })
          }
        } catch (e) {
          console.warn('[webhook] email warn:', (e as any)?.message || e)
        }
        break
      }
      default:
        break
    }
  } catch (e: any) {
    console.error('[webhook] handler error:', e?.message || e)
    return NextResponse.json({ ok: false, error: 'handler_error', detail: String(e?.message || e) }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
