//api/marketplace/checkout/route
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'

function enc(s: string) { return encodeURIComponent(s) }
function localeFrom(h: Headers): 'fr'|'en' {
  const ref = h.get('referer') || ''
  return ref.includes('/en/') ? 'en' : 'fr'
}

export async function POST(req: Request) {
  try {
    const ctype = req.headers.get('content-type') || ''
    let listingId = 0, buyerEmail = '', locale: 'fr'|'en' = localeFrom(req.headers)

    if (ctype.includes('application/x-www-form-urlencoded')) {
      const f = await req.formData()
      listingId = Number(f.get('listing_id') || 0)
      buyerEmail = String(f.get('buyer_email') || '')
    } else {
      const body: any = await req.json().catch(()=> ({}))
      listingId = Number(body?.listing_id || 0)
      buyerEmail = String(body?.buyer_email || '')
      locale = (String(body?.locale || '').toLowerCase() === 'en') ? 'en' : 'fr'
    }
    if (!listingId) return NextResponse.json({ error: 'missing_listing_id' }, { status: 400 })

    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

    // Récupère l’annonce + vendeur + compte Connect
    const { rows } = await pool.query(
      `select l.id, l.ts, l.price_cents, l.currency, l.status,
              c.owner_id as seller_owner_id,
              ma.stripe_account_id
         from listings l
         join claims c on c.ts = l.ts
    left join merchant_accounts ma on ma.owner_id = c.owner_id
        where l.id = $1 limit 1`,
      [listingId]
    )
    const L = rows[0]
    if (!L) return NextResponse.json({ error: 'listing_not_found' }, { status: 404 })
    if (L.status !== 'active') return NextResponse.json({ error: 'listing_not_active' }, { status: 400 })
    if (!L.stripe_account_id) return NextResponse.json({ error: 'seller_not_onboarded' }, { status: 400 })

    const tsYMD = new Date(L.ts).toISOString().slice(0,10)
    const price = Number(L.price_cents) | 0
    const currency = String(L.currency || 'eur').toLowerCase()

    const bps = Number(process.env.MARKETPLACE_FEE_BPS || 0)
    const appFee = Math.max(0, Math.floor(price * bps / 10_000))

    const successUrl = `${base}/${locale}/m/${enc(tsYMD)}?buy=success&sid={CHECKOUT_SESSION_ID}`
    const cancelUrl  = `${base}/${locale}/m/${enc(tsYMD)}?buy=cancel`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: price,
          product_data: { name: locale==='fr' ? `Journée ${tsYMD}` : `Day ${tsYMD}` },
        },
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: buyerEmail || undefined,
      payment_intent_data: {
        on_behalf_of: L.stripe_account_id,
        application_fee_amount: appFee || undefined,
        transfer_data: { destination: L.stripe_account_id },
      },
      metadata: { market_kind: 'secondary', listing_id: String(listingId), ts: tsYMD },
      automatic_tax: { enabled: false },
    })

    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(session.url!, { status: 303 })
    }
    return NextResponse.json({ url: session.url })
  } catch (e:any) {
    console.error('[marketplace/checkout] error:', e?.message || e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
