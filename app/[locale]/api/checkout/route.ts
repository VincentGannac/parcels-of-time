export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { priceFor } from '@/lib/pricing'
import { LRUCache } from 'lru-cache'

type CertStyle = 'neutral'|'romantic'|'birthday'|'wedding'|'birth'|'christmas'|'newyear'|'graduation'
const ALLOWED_STYLES: readonly CertStyle[] = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation'] as const

type Body = {
  ts: string
  email: string
  display_name?: string
  title?: string
  message?: string
  link_url?: string
  cert_style?: string
}

const ipBucket = new LRUCache<string, { count:number; ts:number }>({ max: 10000 })
function rateLimit(ip: string, limit = 8, windowMs = 60_000) {
  const now = Date.now()
  const rec = ipBucket.get(ip) || { count: 0, ts: now }
  if (now - rec.ts > windowMs) { rec.count = 0; rec.ts = now }
  rec.count += 1
  ipBucket.set(ip, rec)
  return rec.count <= limit
}

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown'
  if (!rateLimit(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = (await req.json()) as Body
  if (!body.ts || !body.email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const d = new Date(body.ts)
  if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_ts' }, { status: 400 })
  d.setUTCSeconds(0,0) // ⬅️ minute
  const tsISO = d.toISOString()

  const styleCandidate = String(body.cert_style || 'neutral').toLowerCase()
  const cert_style: CertStyle = (ALLOWED_STYLES as readonly string[]).includes(styleCandidate) ? (styleCandidate as CertStyle) : 'neutral'

  const origin = new URL(req.url).origin
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

  const { price_cents, currency } = priceFor(tsISO)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
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
    },
    success_url: `${origin}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/claim?ts=${encodeURIComponent(tsISO)}&cancelled=1`,
  })

  return NextResponse.json({ url: session.url })
}
