//app/api/marketplace/checkout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'

function enc(s: string) { return encodeURIComponent(s) }
function toYMD(iso: string) { try { return new Date(iso).toISOString().slice(0,10) } catch { return iso } }

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  let listingId = 0
  let locale: 'fr'|'en' = 'fr'
  let buyerEmail = ''

  if (ctype.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    listingId = Number(form.get('listing_id') || 0)
    const loc = String(form.get('locale') || '')
    locale = (loc === 'en') ? 'en' : 'fr'
    buyerEmail = String(form.get('buyer_email') || '').trim().toLowerCase()
  } else {
    const body = await req.json().catch(() => ({} as any))
    listingId = Number(body.listing_id || 0)
    locale = (String(body.locale || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
    buyerEmail = String(body.buyer_email || '').trim().toLowerCase()
  }

  if (!listingId) {
    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(`${base}/account?err=missing_listing_id`, { status: 303 })
    }
    return NextResponse.json({ error: 'missing_listing_id' }, { status: 400 })
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
  if (!L) {
    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(`${base}/account?err=listing_not_found`, { status: 303 })
    }
    return NextResponse.json({ error: 'listing_not_found' }, { status: 404 })
  }
  if (L.status !== 'active') {
    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(`${base}/account?err=listing_not_active`, { status: 303 })
    }
    return NextResponse.json({ error: 'listing_not_active' }, { status: 400 })
  }
  if (!L.stripe_account_id) {
    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(`${base}/account?err=seller_not_onboarded`, { status: 303 })
    }
    return NextResponse.json({ error: 'seller_not_onboarded' }, { status: 400 })
  }

  const tsYMD = toYMD(L.ts)
  const price = Number(L.price_cents) | 0
  const currency = String(L.currency || 'eur').toLowerCase()

  // Commission plateforme : 10% min 1€
  const applicationFee = Math.max(100, Math.floor(price * 0.10))

  // ✅ On passe par l’endpoint de confirmation (écrit en DB puis redirige vers /[locale]/m/[ts])
  const successUrl = `${base}/api/marketplace/confirm?sid={CHECKOUT_SESSION_ID}&locale=${locale}&ts=${enc(tsYMD)}`
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
    // Connect payout au vendeur + fee plateforme
    payment_intent_data: {
      on_behalf_of: L.stripe_account_id,
      application_fee_amount: applicationFee,
      transfer_data: { destination: L.stripe_account_id },
    },
    // ✅ fixe l’e-mail côté Stripe (utile si l’utilisateur a déjà saisi un mail dans le formulaire)
    customer_email: buyerEmail || undefined,
    metadata: {
      market_kind: 'secondary',
      listing_id: String(listingId),
      ts: tsYMD,
      buyer_email: buyerEmail || '',
      locale,
    },
    automatic_tax: { enabled: false },
  })

  if (ctype.includes('application/x-www-form-urlencoded')) {
    return NextResponse.redirect(session.url!, { status: 303 })
  }
  return NextResponse.json({ url: session.url })
}
