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

  // 1) Récupérer/Créer le compte Connect pour ce owner
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
      country: 'FR', // adapte si besoin
      email: sess.email,
      default_currency: 'eur',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
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

  // 2) Account Link (onboarding / update)
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh`,
    return_url: `${base}/account?connect=done`,
    type: 'account_onboarding',
  })

  // Si appel depuis un <form> → redirection 303 (flow UX)
  const ctype = req.headers.get('content-type') || ''
  const accept = req.headers.get('accept') || ''
  const wantsHtml = ctype.includes('application/x-www-form-urlencoded') || accept.includes('text/html')

  if (wantsHtml) {
    return NextResponse.redirect(link.url, { status: 303 })
  }
  // Sinon, JSON (utile si tu déclenches via fetch/ajax)
  return NextResponse.json({ url: link.url })
}
