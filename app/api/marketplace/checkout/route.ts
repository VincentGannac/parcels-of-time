export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'

type Body = { listing_id: number; buyer_email: string; locale?: 'fr'|'en' }

export async function POST(req: Request) {
  const body = (await req.json()) as Body
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'stripe_key_missing' }, { status: 500 })
  const stripe = new Stripe(key)

  // 1) Lecture annonce + compte Connect du vendeur
  const { rows: ls } = await pool.query(
    `select l.*, ma.stripe_account_id, ma.charges_enabled
       from listings l
  left join merchant_accounts ma on ma.owner_id = l.seller_owner_id
      where l.id = $1 and l.status='active'`,
    [body.listing_id]
  )
  if (!ls.length) return NextResponse.json({ error: 'listing_not_active' }, { status: 409 })
  const L = ls[0]
  if (!L.stripe_account_id || !L.charges_enabled) {
    return NextResponse.json({ error: 'seller_not_charges_enabled' }, { status: 409 })
  }

  // 2) Frais d’app (10%, min 1€)
  const fee = Math.max(100, Math.round(Number(L.price_cents) * 0.10))

  const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const ymd = String(L.ts).slice(0,10)

  // 3) Checkout (destination charge -> argent chez le vendeur)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: body.buyer_email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: (L.currency || 'EUR').toLowerCase(),
        unit_amount: Number(L.price_cents),
        product_data: {
          name: `Parcels of Time — ${ymd} (Marketplace)`,
          description: 'Symbolic certificate — secondary sale'
        }
      }
    }],
    payment_intent_data: {
      application_fee_amount: fee,
      transfer_data: { destination: L.stripe_account_id }
    },
    metadata: {
      market_kind: 'secondary',
      listing_id: String(L.id),
      ts: String(L.ts),
      currency: String(L.currency || 'EUR')
    },
    success_url: `${origin}/api/marketplace/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${(body.locale||'en')}/m/${encodeURIComponent(ymd)}?cancel=1`
  })

  if (!session.url) return NextResponse.json({ error: 'no_checkout_url' }, { status: 500 })
  return NextResponse.json({ url: session.url })
}
