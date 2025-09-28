// app/api/marketplace/confirm/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { applySecondarySaleFromSession } from '@/lib/marketplace'

function normIsoDay(s: string) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(req: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 })
  }

  const url = new URL(req.url)
  const sid = url.searchParams.get('session_id') || url.searchParams.get('sid') || ''
  if (!sid) {
    return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const s = await stripe.checkout.sessions.retrieve(sid, { expand: ['payment_intent'] })
  const paid = !s.payment_status || s.payment_status === 'paid'
  const kind = String(s.metadata?.market_kind || '')

  // Double-application tolérante (idempotente) pour garantir l’effet immédiat,
  // même si le webhook a du retard.
  if (paid && kind === 'secondary') {
    try {
      await applySecondarySaleFromSession(s)
    } catch (e) {
      // on journalise seulement — le webhook rattrapera si conflit logique
      console.warn('[confirm][secondary] apply error:', (e as any)?.message || e)
    }
  }

  const tsIso = normIsoDay(String(s.metadata?.ts || ''))
  const ts = tsIso ? tsIso.slice(0, 10) : null

  return NextResponse.json({
    ok: true,
    paid,
    market_kind: kind,
    ts,
  })
}
