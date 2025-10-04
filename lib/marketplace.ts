// lib/marketplace.ts
import Stripe from 'stripe'
import { pool } from '@/lib/db'

function normIsoDay(s:string){ const d=new Date(s); if(isNaN(d.getTime())) return null; d.setUTCHours(0,0,0,0); return d.toISOString() }
const asBool1 = (v: unknown) => String(v) === '1' || v === true
const asHex = (v: unknown, fallback = '#1a1f2a') =>
  /^#[0-9a-fA-F]{6}$/.test(String(v||'')) ? String(v).toLowerCase() : fallback
const asStyle = (v: unknown) => {
  const A = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const
  const s = String(v||'neutral').toLowerCase()
  return (A as readonly string[]).includes(s as any) ? (s as any) : 'neutral'
}
const asTimeDisplay = (v: unknown) => {
  const td = String(v || 'local+utc')
  return (td === 'utc' || td === 'utc+local' || td === 'local+utc') ? td : 'local+utc'
}
async function tableExists(client: any, table: string) {
  const { rows } = await client.query(`select to_regclass($1) as ok`, [`public.${table}`]); return !!rows[0]?.ok
}
async function hasColumn(client:any, table:string, col:string){
  const { rows } = await client.query(
    `select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2 limit 1`,
    [table, col]
  )
  return !!rows.length
}

export async function applySecondarySaleFromSession(s: Stripe.Checkout.Session) {
  const listingId = Number(s.metadata?.listing_id || 0)
  const tsISO = normIsoDay(String(s.metadata?.ts || ''))
  const buyerEmail = String(s.customer_details?.email || s.metadata?.email || '').trim().toLowerCase()
  if (!listingId || !tsISO || !buyerEmail) throw new Error('bad_metadata')

  // champs modifiables reçus du checkout marketplace
  const display_name: string | null = (s.customer_details?.name || s.metadata?.display_name || '') || null
  const title: string | null        = (s.metadata?.title   || '') || null
  const message: string | null      = (s.metadata?.message || '') || null
  const link_url: string | null     = (s.metadata?.link_url|| '') || null
  const cert_style                  = asStyle(s.metadata?.cert_style)
  const time_display                = asTimeDisplay(s.metadata?.time_display)
  const local_date_only             = asBool1(s.metadata?.local_date_only)
  const text_color                  = asHex(s.metadata?.text_color)
  const title_public                = asBool1(s.metadata?.title_public)
  const message_public              = asBool1(s.metadata?.message_public)
  const wantsPublic                 = asBool1(s.metadata?.public_registry)
  const custom_bg_key               = String(s.metadata?.custom_bg_key || '')

  // montant payé (en cents) — pour cohérence avec le listing
  const amount =
    s.amount_total ??
    (typeof s.payment_intent !== 'string' && s.payment_intent
      ? (s.payment_intent.amount_received ?? s.payment_intent.amount ?? 0)
      : 0)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // verrou annonce + claim
    const { rows: L } = await client.query(
      `select l.*, c.owner_id as claim_owner
         from listings l
         join claims c on c.ts = l.ts
        where l.id=$1
        for update`,
      [listingId]
    )
    const listing = L[0]
    if (!listing) throw new Error('listing_not_found')
    if (listing.status !== 'active') { await client.query('COMMIT'); return { ok: true } }

    // validations
    if (listing.claim_owner !== listing.seller_owner_id) throw new Error('seller_mismatch')
    if (Number(amount) !== Number(listing.price_cents)) throw new Error('amount_mismatch')

    // upsert acheteur (avec display_name si fourni)
    const { rows: buyerRows } = await client.query(
      `insert into owners(email, display_name)
       values ($1, $2)
       on conflict (email) do update
         set display_name = coalesce(excluded.display_name, owners.display_name)
       returning id`,
      [buyerEmail, display_name]
    )
    const buyerId = buyerRows[0].id

    // transfert de propriété + ✅ appliquer les MODIFS (titre, message, style, couleur, etc.)
    await client.query(
      `update claims
          set owner_id        = $1,
              price_cents     = $2,
              currency        = $3,
              display_name    = $4,  
              title           = $5,
              message         = $6,
              link_url        = $7,
              cert_style      = $8,
              time_display    = $9,
              local_date_only = $10,
              text_color      = $11,
              title_public    = $12,
              message_public  = $13
        where date_trunc('day', ts) = $14::timestamptz`,
      [
        buyerId,
        listing.price_cents, listing.currency,
        title, message, link_url,
        cert_style, time_display, local_date_only, text_color,
        title_public, message_public,
        tsISO
      ]
    )

    // ➕ background custom : temp → persist (si présent)
    if (cert_style === 'custom' && custom_bg_key) {
      const hasTemp = await tableExists(client, 'custom_bg_temp')
      const hasPersist = await tableExists(client, 'claim_custom_bg')
      if (hasTemp && hasPersist) {
        const { rows: tmp } = await client.query('select data_url from custom_bg_temp where key = $1', [custom_bg_key])
        if (tmp.length) {
          await client.query(
            `insert into claim_custom_bg (ts, data_url)
             values ($1::timestamptz, $2)
             on conflict (ts) do update set data_url = excluded.data_url, created_at = now()`,
            [tsISO, tmp[0].data_url]
          )
          await client.query('delete from custom_bg_temp where key = $1', [custom_bg_key])
        }
      }
    }

    // annonce -> sold
    await client.query(
      `update listings set status='sold', updated_at=now() where id=$1`,
      [listingId]
    )

    // registre public si demandé
    if (wantsPublic) {
      await client.query(
        `insert into minute_public(ts) values($1::timestamptz) on conflict (ts) do nothing`,
        [tsISO]
      )
    }

    // journal vente (tolérant au schéma)
    try {
      const { rows: cols } = await client.query(
        `select column_name from information_schema.columns
          where table_schema='public' and table_name='secondary_sales'`
      )
      const names = cols.map((r:any)=>r.column_name)
      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id || null)
      if (names.includes('gross_cents')) {
        const gross = Number(listing.price_cents) | 0
        const fee = Math.max(100, Math.round(gross * 0.15))
        const net = Math.max(0, gross - fee)
        await client.query(
          `insert into secondary_sales(listing_id, ts, seller_owner_id, buyer_owner_id,
             gross_cents, fee_cents, net_cents, currency, stripe_session_id, stripe_payment_intent_id)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [listingId, tsISO, listing.seller_owner_id, buyerId, gross, fee, net, listing.currency, s.id, pi]
        )
      } else if (names.includes('price_cents')) {
        await client.query(
          `insert into secondary_sales(listing_id, ts, seller_owner_id, buyer_owner_id,
             price_cents, currency, stripe_session_id, stripe_payment_intent_id)
           values($1,$2,$3,$4,$5,$6,$7,$8)`,
          [listingId, tsISO, listing.seller_owner_id, buyerId, listing.price_cents, listing.currency, s.id, pi]
        )
      }
    } catch {}

    await client.query('COMMIT')
    return { ok: true }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally {
    client.release()
  }
}
