//app/api/connect/dashboard/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

export async function GET(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

  const { rows } = await pool.query(
    'select stripe_account_id from merchant_accounts where owner_id=$1',
    [sess.ownerId]
  )
  const acctId = rows[0]?.stripe_account_id
  if (!acctId) return NextResponse.json({ error:'no_account' }, { status: 400 })

  const login = await stripe.accounts.createLoginLink(acctId)
  return NextResponse.redirect(login.url, { status: 303 })
}
