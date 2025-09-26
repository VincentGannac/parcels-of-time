// app/api/connect/onboard/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  // 1) Récupérer/Créer le compte Connect
  let accountId: string | null = null
  {
    const { rows } = await pool.query(
      'select stripe_account_id from merchant_accounts where owner_id=$1',
      [sess.ownerId]
    )
    accountId = rows[0]?.stripe_account_id ?? null
  }
  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: sess.email,
      business_type: 'individual', // 👈 particulier
      default_currency: 'eur',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_profile: {
        product_description: 'Vente/achat de certificats numériques Parcels of Time (revente C2C).',
        url: base,
      },
      metadata: { pot_owner_id: String(sess.ownerId) },
      settings: {
        payouts: { schedule: { interval: 'manual' } }, // optionnel : contrôles des transferts
      },
    })
    accountId = acct.id
    await pool.query(
      `insert into merchant_accounts(owner_id, stripe_account_id, charges_enabled, payouts_enabled)
       values($1,$2,$3,$4)
       on conflict(owner_id) do update set stripe_account_id=excluded.stripe_account_id`,
      [sess.ownerId, accountId, !!acct.charges_enabled, !!acct.payouts_enabled]
    )
  }

  // 2) Lien d’onboarding / mise à jour
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh`,
    return_url: `${base}/account?connect=done`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: link.url })
}
