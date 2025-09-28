// app/api/marketplace/checkout/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import crypto from 'node:crypto'

/** Utils */
function enc(s: string) { return encodeURIComponent(s) }
function toYMD(iso: string) { try { const d = new Date(iso); d.setUTCHours(0,0,0,0); return d.toISOString().slice(0,10) } catch { return '' } }
function jsonError(code: string, status = 400, extra: Record<string, any> = {}) {
  return NextResponse.json({ ok:false, error: code, ...extra }, { status })
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">
  <title>Marketplace Checkout API</title>
  <body style="font:14px system-ui;background:#0B0E14;color:#E6EAF2;padding:24px">
    <div style="max-width:720px;margin:auto;background:#111726;border:1px solid #1E2A3C;border-radius:12px;padding:18px">
      <h1>Marketplace Checkout API</h1>
      <p>Cette URL est une API. Utilisez <code>POST</code> avec <code>listing_id</code> depuis l’UI.</p>
      <p><a href="${base}" style="color:#E4B73D">&larr; Retour</a></p>
    </div>
  </body>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'allow': 'POST, OPTIONS, GET',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400'
    }
  })
}

export async function POST(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  if (!STRIPE_SECRET_KEY) return jsonError('missing_env', 500)
  const stripe = new Stripe(STRIPE_SECRET_KEY)

  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  const isForm = ctype.includes('application/x-www-form-urlencoded')

  try {
    // ---------- lecture entrée ----------
    let listingId = 0
    let buyerEmail = ''
    let locale: 'fr'|'en' = 'fr'

    // Stash optionnel
    let payload_key = ''
    let custom_bg_key = ''

    // Fallback léger si pas de payload_key (texte court UNIQUEMENT)
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

    if (isForm) {
      const form = await req.formData()
      listingId      = Number(form.get('listing_id') || 0)
      buyerEmail     = String(form.get('buyer_email') || '').trim().toLowerCase()
      locale         = (String(form.get('locale') || '').toLowerCase() === 'en') ? 'en' : 'fr'
      payload_key    = String(form.get('payload_key') || '')
      custom_bg_key  = String(form.get('custom_bg_key') || '')
      if (!payload_key) {
        display_name    = String(form.get('display_name') || '')
        title           = String(form.get('title') || '')
        message         = String(form.get('message') || '')
        link_url        = String(form.get('link_url') || '')
        cert_style      = String(form.get('cert_style') || 'neutral').toLowerCase()
        const td        = String(form.get('time_display') || 'local+utc')
        time_display    = (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
        local_date_only = (String(form.get('local_date_only')) === '1' || String(form.get('local_date_only')) === 'true') ? '1' : '0'
        text_color      = /^#[0-9a-fA-F]{6}$/.test(String(form.get('text_color')||'')) ? String(form.get('text_color')).toLowerCase() : '#1a1f2a'
        title_public    = (String(form.get('title_public')) === '1' || String(form.get('title_public')) === 'true') ? '1' : '0'
        message_public  = (String(form.get('message_public')) === '1' || String(form.get('message_public')) === 'true') ? '1' : '0'
        public_registry = (String(form.get('public_registry')) === '1' || String(form.get('public_registry')) === 'true') ? '1' : '0'
      }
    } else {
      const body = await req.json().catch(() => ({} as any))
      listingId      = Number(body.listing_id || 0)
      buyerEmail     = String(body.buyer_email || '').trim().toLowerCase()
      locale         = (String(body.locale || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
      payload_key    = String(body.payload_key || '')
      custom_bg_key  = String(body.custom_bg_key || '')
      if (!payload_key) {
        display_name    = String(body.display_name || '')
        title           = String(body.title || '')
        message         = String(body.message || '')
        link_url        = String(body.link_url || '')
        cert_style      = String(body.cert_style || 'neutral').toLowerCase()
        const td        = String(body.time_display || 'local+utc')
        time_display    = (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
        local_date_only = (body.local_date_only === '1' || body.local_date_only === true) ? '1' : '0'
        text_color      = /^#[0-9a-fA-F]{6}$/.test(String(body.text_color||'')) ? String(body.text_color).toLowerCase() : '#1a1f2a'
        title_public    = (body.title_public === '1' || body.title_public === true) ? '1' : '0'
        message_public  = (body.message_public === '1' || body.message_public === true) ? '1' : '0'
        public_registry = (body.public_registry === '1' || body.public_registry === true) ? '1' : '0'
      }
    }

    // ---------- validations ----------
    if (!listingId) return isForm
      ? NextResponse.redirect(`${base}/account?err=missing_listing_id`, { status: 303 })
      : jsonError('missing_listing_id', 400)

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
    if (!L) return isForm
      ? NextResponse.redirect(`${base}/account?err=listing_not_found`, { status: 303 })
      : jsonError('listing_not_found', 404)

    if (L.status !== 'active') return isForm
      ? NextResponse.redirect(`${base}/account?err=listing_not_active`, { status: 303 })
      : jsonError('listing_not_active', 400)

    if (!L.stripe_account_id) return isForm
      ? NextResponse.redirect(`${base}/account?err=seller_not_onboarded`, { status: 303 })
      : jsonError('seller_not_onboarded', 400)

    const price = Number(L.price_cents)
    if (!Number.isInteger(price) || price < 1) {
      return isForm
        ? NextResponse.redirect(`${base}/account?err=listing_bad_price`, { status: 303 })
        : jsonError('listing_bad_price', 400, { detail: 'unit_amount must be >= 1' })
    }
    const currencyRaw = String(L.currency || '').toLowerCase()
    const currency = /^[a-z]{3}$/.test(currencyRaw) ? currencyRaw : 'eur'
    const tsYMD = toYMD(L.ts)

    // Stash payload si pas déjà fourni → **kind 'create'** (compatible contrainte CHECK)
    const payloadKey = payload_key || `pl_${crypto.randomUUID()}`
    if (!payload_key) {
      try {
        await pool.query(
          `insert into checkout_payload_temp(key, kind, data)
           values ($1, 'create', $2::jsonb)
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
      } catch (e: any) {
        const msg = String(e?.message || e)
        if (msg.includes('checkout_payload_temp_kind_check')) {
          return isForm
            ? NextResponse.redirect(`${base}/account?err=db_payload_kind_invalid`, { status: 303 })
            : jsonError('db_payload_kind_invalid', 500, { detail: msg })
        }
        throw e
      }
    }

    // Commission 10% min 1€, mais jamais >= price
    let applicationFee = Math.max(100, Math.floor(price * 0.10))
    if (applicationFee >= price) applicationFee = Math.max(0, price - 1)

    // ✅ On repasse par la route confirm côté serveur pour appliquer tout de suite
    const successUrl = `${base}/api/marketplace/confirm?sid={CHECKOUT_SESSION_ID}&locale=${locale}&ts=${enc(tsYMD)}`
    const cancelUrl  = `${base}/${locale}/m/${enc(tsYMD)}?buy=cancel`

    let session
    try {
      session = await stripe.checkout.sessions.create({
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
        cancel_url:  cancelUrl,
        payment_intent_data: {
          on_behalf_of: L.stripe_account_id,
          application_fee_amount: applicationFee,
          transfer_data: { destination: L.stripe_account_id },
        },
        customer_email: buyerEmail || undefined,
        // ✅ Metadata MINIMALES (≤ 500 chars)
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
    } catch (e: any) {
      const errLike = e?.raw || e
      console.error('[marketplace/checkout] stripe error:', {
        type: e?.type, code: errLike?.code, param: errLike?.param, message: e?.message
      })
      return isForm
        ? NextResponse.redirect(`${base}/account?err=stripe_error&code=${encodeURIComponent(errLike?.code||'')}`, { status: 303 })
        : jsonError('stripe_error', 500, { code: errLike?.code, param: errLike?.param, detail: String(e?.message || e) })
    }

    if (isForm) return NextResponse.redirect(session.url!, { status: 303 })
    if (!session.url) return jsonError('no_checkout_url', 500)
    return NextResponse.json({ ok:true, url: session.url })
  } catch (err: any) {
    console.error('[marketplace/checkout] error:', err?.message || err)
    return jsonError('stripe_error', 500, { detail: String(err?.message || err) })
  }
}
