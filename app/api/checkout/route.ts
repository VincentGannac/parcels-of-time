//app/api/checkout/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { priceFor } from '@/lib/pricing'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

type CertStyle =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation' | 'custom'

const ALLOWED_STYLES: readonly CertStyle[] = [
  'neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'
] as const

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
  public_registry?: string | boolean
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

function todayUtcStart() {
  const t = new Date()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}
function oneYearAfter(d: Date) {
  const x = new Date(d)
  x.setUTCFullYear(x.getUTCFullYear() + 1)
  return x
}

export async function POST(req: Request) {
  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale = accLang.startsWith('fr') ? 'fr' : 'en'
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown'
  if (!rateLimit(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  try {
    const body = (await req.json()) as Body
    if (!body.ts || !body.email) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    const d = new Date(body.ts)
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_ts' }, { status: 400 })
    d.setUTCHours(0,0,0,0)
    const tsISO = d.toISOString()

    const maxAllowed = oneYearAfter(todayUtcStart())
    if (d.getTime() > maxAllowed.getTime()) {
      return NextResponse.json({ error: 'ts_out_of_range' }, { status: 400 })
    }

    const styleCandidate = String(body.cert_style || 'neutral').toLowerCase()
    const cert_style: CertStyle =
      (ALLOWED_STYLES as readonly string[]).includes(styleCandidate) ? (styleCandidate as CertStyle) : 'neutral'

    const time_display =
      body.time_display === 'utc' || body.time_display === 'utc+local' || body.time_display === 'local+utc'
        ? body.time_display
        : 'local+utc'

    const local_date_only = (String(body.local_date_only) === '1' || body.local_date_only === true) ? '1' : '0'
    const text_color =
      /^#[0-9a-fA-F]{6}$/.test(body.text_color || '') ? String(body.text_color).toLowerCase() : '#1a1f2a'

    const title_public   = (String(body.title_public)   === '1' || body.title_public   === true) ? '1' : '0'
    const message_public = (String(body.message_public) === '1' || body.message_public === true) ? '1' : '0'
    const public_registry =
      (String(body.public_registry) === '1' || body.public_registry === true) ? '1' : '0'

    // Image custom éventuelle -> stash temporaire
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

    // ⚠️ Unicité côté serveur (journée déjà vendue ?)
    {
      const { rows } = await pool.query<{ exists: boolean }>(
        `select exists(select 1 from claims where ts = $1::timestamptz) as exists`,
        [tsISO]
      )
      if (rows[0]?.exists) {
        return NextResponse.json({ error: 'date_unavailable' }, { status: 409 })
      }
    }

    const origin = new URL(req.url).origin
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return NextResponse.json({ error: 'stripe_key_missing' }, { status: 500 })
    const stripe = new Stripe(key)

    const { price_cents, currency } = priceFor(tsISO)
    if (!price_cents || price_cents < 1) return NextResponse.json({ error: 'bad_price' }, { status: 400 })
    const stripeCurrency = (currency || 'eur').toLowerCase()

    // ⛳️ NOUVEAU : on stocke le payload complet côté DB et on donne seulement une clé à Stripe
    const payloadKey = `pl_${crypto.randomUUID()}`
    const payloadData = {
      display_name: body.display_name ?? '',
      title:        body.title ?? '',
      message:      body.message ?? '',  // ← 100% du texte, sauts de ligne conservés
      link_url:     body.link_url ?? '',
      cert_style,
      time_display,
      local_date_only,
      text_color,
      title_public,
      message_public,
      public_registry,
      locale,
    }
    await pool.query(
      `insert into checkout_payload_temp(key, kind, data)
       values ($1, 'create', $2::jsonb)
       on conflict (key) do update set data = excluded.data, created_at = now()`,
      [payloadKey, JSON.stringify(payloadData)]
    )

    const ymd = tsISO.slice(0,10)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: stripeCurrency,
          unit_amount: price_cents,
          product_data: {
            name: `Parcels of Time — ${ymd}`,
            description: 'Exclusive symbolic claim to a unique day (UTC).',
          },
        },
      }],
      customer_email: body.email,
      // ✅ metadata MINIMALES
      metadata: {
        ts: tsISO,
        email: body.email,
        payload_key: payloadKey,  // 👈 clé courte
        custom_bg_key,
        locale,
      },
      success_url: `${origin}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}${
        public_registry === '1' ? '&autopub=1' : ''
      }`,
      cancel_url: `${origin}/${locale}/claim?ts=${encodeURIComponent(ymd)}&style=${cert_style}&cancelled=1`,
    })

    if (!session.url) return NextResponse.json({ error: 'no_checkout_url' }, { status: 500 })
    return NextResponse.json({ url: session.url })
  } catch (e:any) {
    console.error('checkout_error:', e?.message || e)
    return NextResponse.json({ error: 'stripe_error', detail: String(e?.message || e) }, { status: 500 })
  }
}
