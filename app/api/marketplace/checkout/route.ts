// app/api/marketplace/checkout/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'

export async function POST(req: Request) {
  const { listing_id, email } = await req.json()
  if (!listing_id || !email) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const BASE = process.env.NEXT_PUBLIC_BASE_URL
  if (!STRIPE_SECRET_KEY || !BASE) return NextResponse.json({ error: 'missing_env' }, { status: 500 })

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  // 1) lecture annonce + contrôle de base
  const { rows } = await pool.query(
    `select l.*, c.owner_id as claim_owner
       from listings l
       join claims c on c.ts = l.ts
      where l.id=$1`,
    [listing_id]
  )
  const listing = rows[0]
  if (!listing || listing.status !== 'active') return NextResponse.json({ error: 'listing_unavailable' }, { status: 400 })
  if (listing.claim_owner !== listing.seller_owner_id) return NextResponse.json({ error: 'seller_mismatch' }, { status: 400 })

  // 2) commission (ex: 10%)
  const feeBps = 1000 // 10% (1000 basis points)
  const application_fee_amount = Math.round(listing.price_cents * feeBps / 10_000)

  // 3) création session (marché secondaire)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${BASE}/market/success?sid={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${BASE}/market/cancel`,
    customer_email: email,
    line_items: [{
      price_data: {
        currency: listing.currency,
        product_data: { name: `Parcels of Time — ${new Date(listing.ts).toISOString().slice(0,10)}` },
        unit_amount: listing.price_cents,
      },
      quantity: 1,
    }],
    metadata: {
      market_kind: 'secondary',
      listing_id: String(listing_id),
      ts: new Date(listing.ts).toISOString(),
      email,
    },
    // ➜ si tu passes à Stripe Connect plus tard :
    // payment_intent_data: {
    //   application_fee_amount,
    //   transfer_data: { destination: '<acct_xxx du vendeur>' },
    // },
  })

  return NextResponse.json({ url: session.url })
}
