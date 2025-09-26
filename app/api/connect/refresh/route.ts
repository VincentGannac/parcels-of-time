export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

export async function GET(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  const { rows } = await pool.query(
    'select stripe_account_id from merchant_accounts where owner_id=$1',
    [sess.ownerId]
  )
  const accountId = rows[0]?.stripe_account_id
  if (!accountId) return NextResponse.redirect(`${base}/account?connect=missing`, { status: 303 })

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh`,
    return_url: `${base}/account?connect=done`,
    type: 'account_onboarding',
  })
  return NextResponse.redirect(link.url, { status: 303 })
}
