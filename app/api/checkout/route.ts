// api/checkout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { priceFor } from '@/lib/pricing'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

type CertStyle = 'neutral'|'romantic'|'birthday'|'wedding'|'birth'|'christmas'|'newyear'|'graduation'|'custom'
const ALLOWED_STYLES: readonly CertStyle[] = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const

type Body = {
  ts: string
  email: string
  display_name?: string
  title?: string
  message?: string
  link_url?: string
  cert_style?: string
  custom_bg_data_url?: string
  time_display?: 'utc'|'utc+local'|'local+utc'
  local_date_only?: string | boolean // '1'/'0' ou bool
  text_color?: string // #rrggbb
  // ✅ nouveaux flags public
  title_public?: string | boolean
  message_public?: string | boolean
}

const ipBucket = new Map<string, { count:number; ts:number }>()
function rateLimit(ip: string, limit = 8, windowMs = 60_000) {
  const now = Date.now()
  const rec = ipBucket.get(ip) || { count: 0, ts: now }
  if (now - rec.ts > windowMs) { rec.count = 0; rec.ts = now }
  rec.count += 1
  ipBucket.set(ip, rec)
  return rec.count <= limit
}

export async function POST(req: Request) {
  const accLang = (req.headers.get('accept-language') || '').toLowerCase();
  const locale = accLang.startsWith('fr') ? 'fr' : 'en';
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown'
  if (!rateLimit(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  try {
    const body = (await req.json()) as Body
    if (!body.ts || !body.email) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    const d = new Date(body.ts)
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_ts' }, { status: 400 })
    d.setUTCSeconds(0,0)
    const tsISO = d.toISOString()

    const styleCandidate = String(body.cert_style || 'neutral').toLowerCase()
    const cert_style: CertStyle = (ALLOWED_STYLES as readonly string[]).includes(styleCandidate) ? (styleCandidate as CertStyle) : 'neutral'

    // prefs
    const time_display = (body.time_display === 'utc' || body.time_display === 'utc+local' || body.time_display === 'local+utc')
      ? body.time_display : 'local+utc'
    const local_date_only = (String(body.local_date_only) === '1' || body.local_date_only === true) ? '1' : '0'
    const text_color = /^#[0-9a-fA-F]{6}$/.test(body.text_color || '') ? String(body.text_color).toLowerCase() : '#1a1f2a'

    // ✅ registres publics (opt-in)
    const title_public   = (String(body.title_public)   === '1' || body.title_public   === true) ? '1' : '0'
    const message_public = (String(body.message_public) === '1' || body.message_public === true) ? '1' : '0'

    // custom BG → table temp
    let custom_bg_key = ''
    if (cert_style === 'custom' && body.custom_bg_data_url) {
      const m = /^data:image\/(png|jpe?g);base64,/.exec(body.custom_bg_data_url)
      if (!m) return NextResponse.json({ error: 'custom_bg_invalid' }, { status: 400 })
      custom_bg_key = `cbg_${crypto.randomUUID()}`
      await pool.query(
        `insert into custom_bg_temp(key, data_url)
         values ($1,$2)
         on conflict (key) do update set data_url = excluded.data_url, created_at = now()`,
        [custom_bg_key, body.custom_bg_data_url]
      )
    }

    const origin = new URL(req.url).origin
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return NextResponse.json({ error: 'stripe_key_missing' }, { status: 500 })
    const stripe = new Stripe(key)

    const { price_cents, currency } = priceFor(tsISO)
    if (!price_cents || price_cents < 1) return NextResponse.json({ error: 'bad_price' }, { status: 400 })
    const stripeCurrency = (currency || 'eur').toLowerCase()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: stripeCurrency,
          unit_amount: price_cents,
          product_data: {
            name: `Parcels of Time — ${tsISO}`,
            description: 'Exclusive symbolic claim to a unique minute (UTC).',
          },
        },
      }],
      customer_email: body.email,
      metadata: {
        ts: tsISO,
        email: body.email,
        display_name: body.display_name ?? '',
        title: body.title ?? '',
        message: body.message ?? '',
        link_url: body.link_url ?? '',
        cert_style,
        custom_bg_key,
        time_display,
        local_date_only,
        text_color,
        // ✅ flags publics vers webhook/confirm
        title_public,
        message_public,
      },
      success_url: `${origin}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/claim?ts=${encodeURIComponent(tsISO)}&style=${cert_style}&cancelled=1`,
    })

    if (!session.url) return NextResponse.json({ error: 'no_checkout_url' }, { status: 500 })
    return NextResponse.json({ url: session.url })
  } catch (e:any) {
    console.error('checkout_error:', e?.message || e)
    return NextResponse.json({ error: 'stripe_error', detail: String(e?.message || e) }, { status: 500 })
  }
}
