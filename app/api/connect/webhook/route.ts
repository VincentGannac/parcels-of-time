// app/api/connect/webhook/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const sig = req.headers.get('stripe-signature') || ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'missing_webhook_secret' }, { status: 500 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_signature', detail: String(e?.message || e) }, { status: 400 })
  }

  try {
    if (event.type === 'account.updated' || event.type === 'capability.updated') {
      const acct = event.data.object as Stripe.Account
      await pool.query(
        `update merchant_accounts
            set charges_enabled=$2,
                payouts_enabled=$3,
                requirements_due=$4::jsonb
          where stripe_account_id=$1`,
        [acct.id, !!acct.charges_enabled, !!acct.payouts_enabled, JSON.stringify(acct.requirements?.currently_due || [])]
      )
      // NOTE : si tu veux, ajoute aussi disabled_reason, details_submitted, etc.
    }
  } catch (e) {
    // on ne renvoie pas d’erreur 5xx à Stripe pour éviter les retries infinis
    console.error('[connect webhook] error', e)
  }

  return NextResponse.json({ received: true })
}
