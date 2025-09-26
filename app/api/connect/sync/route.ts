export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

export async function POST() {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { rows } = await pool.query(
    'select stripe_account_id from merchant_accounts where owner_id=$1',
    [sess.ownerId]
  )
  const acctId = rows[0]?.stripe_account_id
  if (!acctId) return NextResponse.json({ ok: true })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const acct = await stripe.accounts.retrieve(acctId)
  await pool.query(
    `update merchant_accounts
        set charges_enabled=$2,
            payouts_enabled=$3,
            requirements_due=$4::jsonb
      where owner_id=$1`,
    [sess.ownerId, !!acct.charges_enabled, !!acct.payouts_enabled, JSON.stringify(acct.requirements?.currently_due || [])]
  )
  return NextResponse.json({ ok: true })
}
