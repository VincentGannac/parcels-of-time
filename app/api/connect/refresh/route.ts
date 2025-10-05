//app/api/connect/refresh/route.ts
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

  // ⬇️ locale portée depuis le refresh_url précédent
  const url = new URL(req.url)
  const raw = (url.searchParams.get('loc') || '').toLowerCase()
  const locale: 'fr' | 'en' = raw === 'fr' ? 'fr' : 'en'

  const { rows } = await pool.query(
    'select stripe_account_id from merchant_accounts where owner_id=$1',
    [sess.ownerId]
  )
  const accountId = rows[0]?.stripe_account_id
  if (!accountId) {
    return NextResponse.redirect(`${base}/${locale}/account?connect=missing`, { status: 303 })
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh?loc=${locale}`, // ⬅️ on conserve loc
    return_url: `${base}/${locale}/account?connect=done`,     // ⬅️ localisé
    type: 'account_onboarding',
    collect: 'eventually_due',
  })
  return NextResponse.redirect(link.url, { status: 303 })
}
