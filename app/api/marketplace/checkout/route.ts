// app/api/marketplace/checkout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'

function toYMD(isoLike: string) {
  try {
    const d = new Date(isoLike)
    if (isNaN(d.getTime())) return ''
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const BASE = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const body = await req.json().catch(() => ({} as any))

  const listingId = Number(body?.listing_id || 0)
  if (!listingId) {
    return NextResponse.json({ ok: false, error: 'missing_listing_id' }, { status: 400 })
  }

  // Récupère l’annonce + vendeur + compte Connect
  const { rows } = await pool.query(
    `select l.id, l.ts, l.price_cents, l.currency, l.status,
            c.owner_id as seller_owner_id,
            ma.stripe_account_id
       from listings l
       join claims c on c.ts = l.ts
  left join merchant_accounts ma on ma.owner_id = c.owner_id
      where l.id = $1
      limit 1`,
    [listingId]
  )
  const L = rows[0]
  if (!L)   return NextResponse.json({ ok: false, error: 'listing_not_found' }, { status: 404 })
  if (L.status !== 'active')
    return NextResponse.json({ ok: false, error: 'listing_not_active' }, { status: 400 })
  if (!L.stripe_account_id)
    return NextResponse.json({ ok: false, error: 'seller_not_onboarded' }, { status: 400 })

  const tsYMD = toYMD(L.ts)
  const price = Number(L.price_cents) | 0
  const currency = String(L.currency || 'eur').toLowerCase()

  // Champs optionnels du client (passés en metadata → traités par le webhook/confirm)
  const buyerEmail: string = String(body?.buyer_email || '').trim().toLowerCase()
  const locale: 'fr' | 'en' =
    String(body?.locale || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr'

  const meta = {
    market_kind: 'secondary',
    listing_id: String(listingId),
    ts: tsYMD,

    // champs modifiables
    display_name:  String(body?.display_name || ''),
    title:         String(body?.title || ''),
    message:       String(body?.message || ''),
    link_url:      String(body?.link_url || ''),
    cert_style:    String(body?.cert_style || ''),
    time_display:  String(body?.time_display || ''),
    local_date_only: (body?.local_date_only ? '1' : '0'),
    text_color:      String(body?.text_color || ''),
    title_public:    (body?.title_public ? '1' : '0'),
    message_public:  (body?.message_public ? '1' : '0'),
    public_registry: (body?.public_registry ? '1' : '0'),
    custom_bg_key:   String(body?.custom_bg_key || ''),
    locale,
  } as const

  // Commission plateforme : 10% min 1€
  const applicationFee = Math.max(100, Math.floor(price * 0.10))

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${BASE}/marketplace/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${BASE}/marketplace/cancel`,
    line_items: [{
      price_data: {
        currency,
        unit_amount: price,
        product_data: { name: locale === 'fr' ? `Journée ${tsYMD}` : `Day ${tsYMD}` }
      },
      quantity: 1
    }],
    payment_intent_data: {
      on_behalf_of: L.stripe_account_id,
      application_fee_amount: applicationFee,
      transfer_data: { destination: L.stripe_account_id },
    },
    customer_email: buyerEmail || undefined,
    metadata: meta,
    automatic_tax: { enabled: false },
  })

  return NextResponse.json({ ok: true, id: session.id, url: session.url })
}
