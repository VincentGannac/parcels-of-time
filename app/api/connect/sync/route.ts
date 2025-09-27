// app/api/connect/sync/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { rows } = await pool.query('select stripe_account_id from merchant_accounts where owner_id=$1', [sess.ownerId])
  const acctId = rows[0]?.stripe_account_id
  if (!acctId) {
    // si form → redirect élégant, sinon JSON
    const ctype = req.headers.get('content-type') || ''
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const ref = new URL(req.headers.get('referer') || '/', new URL(req.url).origin)
      return NextResponse.redirect(`${ref.origin}/account?connect=missing`, { status: 303 })
    }
    return NextResponse.json({ ok: true })
  }

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

  const ctype = req.headers.get('content-type') || ''
  if (ctype.includes('application/x-www-form-urlencoded')) {
    // retour propre sur la page compte
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base}/account?sync=done`, { status: 303 })
  }
  return NextResponse.json({ ok: true })
}
