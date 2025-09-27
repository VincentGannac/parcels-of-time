//app/api/marketplace/checkout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import crypto from 'node:crypto'

function enc(s: string) { return encodeURIComponent(s) }
function toYMD(iso: string) { try { return new Date(iso).toISOString().slice(0,10) } catch { return iso } }

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  let listingId = 0
  let locale: 'fr'|'en' = 'fr'
  let buyerEmail = ''
  // ➕ champs optionnels de personnalisation
  let display_name = ''
  let title = ''
  let message = ''
  let link_url = ''
  let cert_style = 'neutral'
  let time_display: 'utc'|'utc+local'|'local+utc' = 'local+utc'
  let local_date_only = '1'
  let text_color = '#1a1f2a'
  let title_public = '0'
  let message_public = '0'
  let public_registry = '0'
  let custom_bg_data_url: string | undefined
 

  if (ctype.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    listingId = Number(form.get('listing_id') || 0)
    const loc = String(form.get('locale') || '')
    locale = (loc === 'en') ? 'en' : 'fr'
    buyerEmail = String(form.get('buyer_email') || '').trim().toLowerCase()
    // ➕ récup des personnalisations éventuelles
    display_name    = String(form.get('display_name') || '')
    title           = String(form.get('title') || '')
    message         = String(form.get('message') || '')
    link_url        = String(form.get('link_url') || '')
    cert_style      = String(form.get('cert_style') || 'neutral').toLowerCase()
    time_display    = ((): any => {
      const td = String(form.get('time_display') || 'local+utc')
      return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
    })()
    local_date_only = (String(form.get('local_date_only')) === '1' || String(form.get('local_date_only')) === 'true') ? '1' : '1'
    text_color      = /^#[0-9a-fA-F]{6}$/.test(String(form.get('text_color')||'')) ? String(form.get('text_color')).toLowerCase() : '#1a1f2a'
    title_public    = (String(form.get('title_public')) === '1' || String(form.get('title_public')) === 'true') ? '1' : '0'
    message_public  = (String(form.get('message_public')) === '1' || String(form.get('message_public')) === 'true') ? '1' : '0'
    public_registry = (String(form.get('public_registry')) === '1' || String(form.get('public_registry')) === 'true') ? '1' : '0'
    custom_bg_data_url = String(form.get('custom_bg_data_url') || '') || undefined

  } else {
    const body = await req.json().catch(() => ({} as any))
    listingId = Number(body.listing_id || 0)
    locale = (String(body.locale || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
    buyerEmail = String(body.buyer_email || '').trim().toLowerCase()
    display_name    = String(body.display_name || '')
    title           = String(body.title || '')
    message         = String(body.message || '')
    link_url        = String(body.link_url || '')
    cert_style      = String(body.cert_style || 'neutral').toLowerCase()
    time_display    = ((): any => {
      const td = String(body.time_display || 'local+utc')
      return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
    })()
    local_date_only = (body.local_date_only === '1' || body.local_date_only === true) ? '1' : '1'
    text_color      = /^#[0-9a-fA-F]{6}$/.test(String(body.text_color||'')) ? String(body.text_color).toLowerCase() : '#1a1f2a'
    title_public    = (body.title_public === '1' || body.title_public === true) ? '1' : '0'
    message_public  = (body.message_public === '1' || body.message_public === true) ? '1' : '0'
    public_registry = (body.public_registry === '1' || body.public_registry === true) ? '1' : '0'
    custom_bg_data_url = String(body.custom_bg_data_url || '') || undefined
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


    // ➕ stocker le payload complet côté DB et ne passer qu'une clé à Stripe
  const payloadKey = `pl_${crypto.randomUUID()}`
  await pool.query(
    `insert into checkout_payload_temp(key, kind, data)
     values ($1, 'secondary', $2::jsonb)
     on conflict (key) do update set data = excluded.data, created_at = now()`,
    [payloadKey, JSON.stringify({
      display_name, title, message, link_url,
      cert_style, time_display, local_date_only, text_color,
      title_public, message_public, public_registry, locale
    })]
  )

  // ➕ image custom éventuelle
  let custom_bg_key = ''
  if (cert_style === 'custom' && custom_bg_data_url) {
    const m = /^data:image\/(png|jpe?g);base64,/.exec(custom_bg_data_url)
    if (m) {
      custom_bg_key = `cbg_${crypto.randomUUID()}`
      await pool.query(
        `insert into custom_bg_temp(key, data_url)
         values ($1,$2)
         on conflict (key) do update set data_url = excluded.data_url, created_at = now()`,
        [custom_bg_key, custom_bg_data_url]
      )
    }
  }

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
      payload_key: payloadKey,
      custom_bg_key,
    },
    automatic_tax: { enabled: false },
  })

  if (ctype.includes('application/x-www-form-urlencoded')) {
    return NextResponse.redirect(session.url!, { status: 303 })
  }
  return NextResponse.json({ url: session.url })
}
