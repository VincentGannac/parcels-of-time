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

  // Option : déduire la locale depuis le referer (même logique que dans onboard)
  let locale: 'fr' | 'en' = 'fr'
  try {
    const ref = req.headers.get('referer') || ''
    const u = ref ? new URL(ref) : null
    const m = u?.pathname.match(/^\/(fr|en)(\/|$)/i)
    if (m?.[1]) locale = m[1].toLowerCase() as any
  } catch {}

  const { rows } = await pool.query(
    'select stripe_account_id from merchant_accounts where owner_id=$1',
    [sess.ownerId]
  )
  const accountId = rows[0]?.stripe_account_id
  if (!accountId) return NextResponse.redirect(`${base}/${locale}/account?connect=missing`, { status: 303 })

  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/api/connect/refresh`,
      return_url: `${base}/${locale}/account?connect=done`,
      type: 'account_onboarding',
    })
    return NextResponse.redirect(link.url, { status: 303 })
  } catch (e: any) {
    const code = e?.raw?.code || e?.code || e?.raw?.type || 'unknown'
    const msg  = String(e?.message || '')
    return NextResponse.redirect(
      `${base}/${locale}/account?connect=err&code=${encodeURIComponent(code)}&msg=${encodeURIComponent(msg)}`,
      { status: 303 }
    )
  }
}
