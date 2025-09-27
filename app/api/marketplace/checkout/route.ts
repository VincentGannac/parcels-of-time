// app/api/marketplace/checkout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import crypto from 'node:crypto'

/** Utils */
function enc(s: string) { return encodeURIComponent(s) }
function toYMD(iso: string) { try { return new Date(iso).toISOString().slice(0,10) } catch { return iso } }

/**
 * Cette route déclenche un checkout Stripe "secondary market" (revente).
 * ⚠️ Elle n'accepte plus d'image en data URL (custom_bg_data_url) pour éviter les 413.
 *    → On passe par un pré-stash côté serveur (/api/marketplace/payload par ex.)
 *      qui renvoie payload_key (+ custom_bg_key si image), et ICI on n’envoie que ces clés.
 *
 * Form POST (recommandé) ou JSON:
 *  - listing_id (number)          REQUIRED
 *  - buyer_email (string)         OPTIONAL (meilleur UX si fourni)
 *  - locale ('fr'|'en')           OPTIONAL (default 'fr')
 *  - payload_key (string)         OPTIONAL (clé de checkout_payload_temp)
 *  - custom_bg_key (string)       OPTIONAL (clé de custom_bg_temp si style=custom)
 *
 * Fallback (si pas de payload_key): on peut recevoir de PETITS champs texte,
 * qui seront stockés en DB et référencés via une clé générée ici.
 * (Toujours sans image)
 */
export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  const ctype = (req.headers.get('content-type') || '').toLowerCase()

  // Reçus
  let listingId = 0
  let locale: 'fr'|'en' = 'fr'
  let buyerEmail = ''

  // Option pré-stash
  let payload_key = ''
  let custom_bg_key = ''

  // Fallback "léger" si pas de payload_key (aucune image ici)
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

  if (ctype.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    listingId      = Number(form.get('listing_id') || 0)
    buyerEmail     = String(form.get('buyer_email') || '').trim().toLowerCase()
    const loc      = String(form.get('locale') || '')
    locale         = (loc === 'en') ? 'en' : 'fr'
    payload_key    = String(form.get('payload_key') || '')
    custom_bg_key  = String(form.get('custom_bg_key') || '')

    // Fallback texte si pas de payload_key (champ légers uniquement)
    if (!payload_key) {
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
    }
  } else {
    // JSON léger (mais on recommande le <form> POST)
    const body = await req.json().catch(() => ({} as any))
    listingId      = Number(body.listing_id || 0)
    buyerEmail     = String(body.buyer_email || '').trim().toLowerCase()
    locale         = (String(body.locale || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
    payload_key    = String(body.payload_key || '')
    custom_bg_key  = String(body.custom_bg_key || '')

    // Fallback texte si pas de payload_key (aucune image ici)
    if (!payload_key) {
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
    }
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

  // Clé de payload:
  // - si le client a déjà un payload_key (pré-stash), on le réutilise.
  // - sinon on crée un stash "léger" (texte seulement) ici même.
  const payloadKey = payload_key || `pl_${crypto.randomUUID()}`
  if (!payload_key) {
    await pool.query(
      `insert into checkout_payload_temp(key, kind, data)
       values ($1, 'secondary', $2::jsonb)
       on conflict (key) do update set data = excluded.data, created_at = now()`,
      [payloadKey, JSON.stringify({
        display_name,
        title,
        message,
        link_url,
        cert_style,
        time_display,
        local_date_only,
        text_color,
        title_public,
        message_public,
        public_registry,
        locale
      })]
    )
  }

  // Commission plateforme : 10% min 1€
  const applicationFee = Math.max(100, Math.floor(price * 0.10))

  // ✅ Confirmation passe par /api/marketplace/confirm (écrit en DB + redirige vers /[locale]/m/[ts])
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
    // e-mail si déjà saisi
    customer_email: buyerEmail || undefined,
    // On ne met que des CLÉS ici (pas de gros payload)
    metadata: {
      market_kind: 'secondary',
      listing_id: String(listingId),
      ts: tsYMD,
      buyer_email: buyerEmail || '',
      locale,
      payload_key: payloadKey,
      custom_bg_key, // fourni si le client a pré-stashé l'image ; sinon ''
    },
    automatic_tax: { enabled: false },
  })

  if (ctype.includes('application/x-www-form-urlencoded')) {
    return NextResponse.redirect(session.url!, { status: 303 })
  }
  return NextResponse.json({ url: session.url })
}
