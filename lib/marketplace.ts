// lib/marketplace.ts
import Stripe from 'stripe'
import { pool } from '@/lib/db'

/** Normalise une date quelconque vers le jour (00:00:00 UTC) → ISO */
function normIsoDay(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function tableExists(client: any, table: string) {
  const { rows } = await client.query(
    `select to_regclass($1) as ok`,
    [`public.${table}`]
  )
  return !!rows[0]?.ok
}

async function hasColumn(client: any, table: string, col: string) {
  const { rows } = await client.query(
    `select 1
       from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2
      limit 1`,
    [table, col]
  )
  return !!rows.length
}

/**
 * Applique une vente secondaire (marketplace) à partir d'une session Stripe Checkout.
 * - idempotent (vérifie secondary_sales si présent)
 * - tolérant aux variations de schéma (price_cents vs gross/fee/net, buyer_owner_id, etc.)
 * - mise à jour atomique (BEGIN/COMMIT)
 */
export async function applySecondarySaleFromSession(s: Stripe.Checkout.Session) {
  const listingId = Number(s.metadata?.listing_id || 0)
  const tsISO = normIsoDay(String(s.metadata?.ts || ''))
  const buyerEmail = String(
    s.customer_details?.email ||
    (s.metadata?.buyer_email ?? s.metadata?.email) ||
    ''
  ).trim().toLowerCase()

  if (!listingId || !tsISO || !buyerEmail) {
    throw new Error('bad_metadata')
  }

  const piId = typeof s.payment_intent === 'string'
    ? s.payment_intent
    : (s.payment_intent?.id || null)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verrouille l’annonce et récupère l’owner actuel du claim
    const { rows: L } = await client.query(
      `select
         l.id, l.ts, l.price_cents, l.currency, l.status, l.seller_owner_id,
         c.owner_id as claim_owner
       from listings l
       join claims c on c.ts = l.ts
       where l.id = $1
       for update`,
      [listingId]
    )
    const listing = L[0]
    if (!listing) throw new Error('listing_not_found')

    // Si l’annonce n’est plus "active", on considère la vente déjà appliquée (confirm route ou run précédent)
    if (listing.status !== 'active') {
      await client.query('COMMIT')
      return { ok: true }
    }

    // Idempotence supplémentaire si la table existe : on ne réinsère pas la vente
    const hasSecondary = await tableExists(client, 'secondary_sales')
    if (hasSecondary) {
      const { rows: dupe } = await client.query(
        `select 1 from secondary_sales
          where stripe_session_id = $1 or stripe_payment_intent_id = $2
          limit 1`,
        [s.id, piId]
      )
      if (dupe.length) {
        // On peut tout de même marquer l’annonce "sold" si ce n’est pas encore le cas
        await client.query(
          `update listings set status='sold', updated_at=now() where id=$1`,
          [listingId]
        )
        await client.query('COMMIT')
        return { ok: true }
      }
    }

    // Upsert acheteur
    const { rows: buyerRows } = await client.query(
      `insert into owners(email)
       values ($1)
       on conflict (email) do update set email = excluded.email
       returning id`,
      [buyerEmail]
    )
    const buyerId = buyerRows[0].id

    // Transfert de propriété (tolérant : on cible le JOUR)
    await client.query(
      `update claims
          set owner_id = $1,
              price_cents = $2,
              currency = $3,
              last_secondary_sold_at = now(),
              last_secondary_price_cents = $2
        where date_trunc('day', ts) = $4::timestamptz`,
      [buyerId, listing.price_cents, listing.currency, tsISO]
    )

    // Marquer l’annonce "sold" (avec buyer_owner_id si présent)
    const hasBuyerCol = await hasColumn(client, 'listings', 'buyer_owner_id')
    if (hasBuyerCol) {
      await client.query(
        `update listings
            set status='sold',
                buyer_owner_id=$2,
                updated_at=now()
          where id=$1`,
        [listingId, buyerId]
      )
    } else {
      await client.query(
        `update listings
            set status='sold',
                updated_at=now()
          where id=$1`,
        [listingId]
      )
    }

    // Journal de vente (best-effort, schéma variable)
    if (hasSecondary) {
      const hasGross = await hasColumn(client, 'secondary_sales', 'gross_cents')
      const hasPrice = await hasColumn(client, 'secondary_sales', 'price_cents')

      if (hasGross) {
        const gross = Number(listing.price_cents) | 0
        const fee = Math.max(100, Math.round(gross * 0.10))
        const net = Math.max(0, gross - fee)
        await client.query(
          `insert into secondary_sales(
             listing_id, ts, seller_owner_id, buyer_owner_id,
             gross_cents, fee_cents, net_cents, currency,
             stripe_session_id, stripe_payment_intent_id
           )
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [listingId, tsISO, listing.seller_owner_id, buyerId, gross, fee, net, listing.currency, s.id, piId]
        )
      } else if (hasPrice) {
        await client.query(
          `insert into secondary_sales(
             listing_id, ts, seller_owner_id, buyer_owner_id,
             price_cents, currency, stripe_session_id, stripe_payment_intent_id
           )
           values($1,$2,$3,$4,$5,$6,$7,$8)`,
          [listingId, tsISO, listing.seller_owner_id, buyerId, listing.price_cents, listing.currency, s.id, piId]
        )
      }
      // si aucune des colonnes attendues : on ne casse pas la vente
    }

    await client.query('COMMIT')
    return { ok: true }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally {
    client.release()
  }
}
