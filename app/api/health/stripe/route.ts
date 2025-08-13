// app/api/health/stripe/route.ts
export const runtime = 'nodejs'

import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      return NextResponse.json(
        { ok: false, error: 'STRIPE_SECRET_KEY not set' },
        { status: 500 }
      )
    }

    // Pas d'apiVersion ici
    const stripe = new Stripe(key)

    // On cast en 'any' pour éviter les soucis de typings divergents.
    const account: any = await stripe.accounts.retrieve()

    const mode = key.startsWith('sk_live_') ? 'live' : 'test'

    return NextResponse.json({
      ok: true,
      id: account?.id ?? null,
      mode, // "test" ou "live"
      country: account?.country ?? null,
      charges_enabled: account?.charges_enabled ?? null,
      payouts_enabled: account?.payouts_enabled ?? null,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'stripe_error' },
      { status: 500 }
    )
  }
}
