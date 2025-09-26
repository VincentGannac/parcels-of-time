// lib/marketplace.ts
import Stripe from 'stripe'
import { pool } from '@/lib/db'

export async function applySecondarySaleFromSession(s: Stripe.Checkout.Session) {
  const listingId = Number(s.metadata?.listing_id || 0)
  const tsISO = String(s.metadata?.ts || '')
  const buyerEmail = String(s.customer_details?.email || s.metadata?.email || '').toLowerCase().trim()
  if (!listingId || !tsISO || !buyerEmail) throw new Error('bad_metadata')

  // montant payé (en cents)
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
    if (listing.status !== 'active') throw new Error('listing_not_active')

    // valider cohérence
    if (listing.claim_owner !== listing.seller_owner_id) throw new Error('seller_mismatch')
    if (amount !== listing.price_cents) throw new Error('amount_mismatch')

    // upsert buyer
    const { rows: buyerRows } = await client.query(
      `insert into owners(email) values ($1)
       on conflict (email) do update set email=excluded.email
       returning id, email`,
      [buyerEmail]
    )
    const buyerId = buyerRows[0].id

    // transfert de propriété
    await client.query(
      `update claims set owner_id = $1 where ts = $2::timestamptz`,
      [buyerId, tsISO]
    )

    // annonce -> sold
    await client.query(
      `update listings
          set status='sold', updated_at=now()
        where id=$1`,
      [listingId]
    )

    // journal de vente
    const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id || null)
    await client.query(
      `insert into secondary_sales(
         listing_id, ts, seller_owner_id, buyer_owner_id, price_cents, currency,
         stripe_session_id, stripe_payment_intent_id,
         application_fee_cents, transfer_amount_cents
       )
       values ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, 0, 0)`,
      [listingId, tsISO, listing.seller_owner_id, buyerId, listing.price_cents, listing.currency, s.id, pi]
    )

    await client.query('COMMIT')
    return { ok: true }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally {
    client.release()
  }
}
