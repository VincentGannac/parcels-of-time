//app/api/checkout/edit/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

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
  local_date_only?: string | boolean
  text_color?: string
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
  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale = accLang.startsWith('fr') ? 'fr' : 'en'
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown'
  if (!rateLimit(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  try {
    const body = (await req.json()) as Body
    if (!body.ts || !body.email) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    // ts normalisé
    const d = new Date(body.ts); if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_ts' }, { status: 400 })
    d.setUTCHours(0,0,0,0)
    const tsISO = d.toISOString()

    // Vérifie existence claim
    const { rows } = await pool.query<{ exists: boolean }>(`select exists(select 1 from claims where ts=$1::timestamptz) as exists`, [tsISO])
    if (!rows[0]?.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Stripe
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return NextResponse.json({ error: 'stripe_key_missing' }, { status: 500 })
    const stripe = new Stripe(key)

    // Prix fixe 9,99 €
    const unit_amount = 999
    const currency = 'eur'

    const origin = new URL(req.url).origin

      // --- Stash éventuel de l'image custom comme lors du checkout initial ---
      let custom_bg_key = ''
      if (String((body.cert_style || 'neutral')).toLowerCase() === 'custom' && body.custom_bg_data_url) {
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

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount,
          product_data: {
            name: `Parcels of Time — Modification du certificat`,
            description: `Édition des informations (ts=${tsISO})`,
          },
        },
      }],
      customer_email: body.email,
        metadata: {
        kind: 'edit',
        ts: tsISO.slice(0,10),
        email: body.email,
        display_name: body.display_name ?? '',
        title: body.title ?? '',
        message: body.message ?? '',
        link_url: body.link_url ?? '',
        cert_style: (body.cert_style || 'neutral').toLowerCase(),
        custom_bg_key, 
        time_display: body.time_display || 'local+utc',
        local_date_only: (String(body.local_date_only) === '1' || body.local_date_only === true) ? '1' : '0',
        text_color: (/^#[0-9a-fA-F]{6}$/.test(body.text_color || '') ? String(body.text_color).toLowerCase() : '#1a1f2a'),
        title_public: (String(body.title_public) === '1' || body.title_public === true) ? '1' : '0',
        message_public: (String(body.message_public) === '1' || body.message_public === true) ? '1' : '0',
        locale,
      },
      success_url: `${origin}/api/checkout/edit/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/m/${encodeURIComponent(tsISO.slice(0,10))}?cancelled=1`,
    })

    if (!session.url) return NextResponse.json({ error: 'no_checkout_url' }, { status: 500 })
    return NextResponse.json({ url: session.url })
  } catch (e:any) {
    console.error('[edit checkout] error:', e?.message || e)
    return NextResponse.json({ error: 'stripe_error', detail: String(e?.message || e) }, { status: 500 })
  }
}
