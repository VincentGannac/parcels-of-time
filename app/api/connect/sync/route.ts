// app/api/connect/sync/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'


function extractLocaleFromPath(pathname: string): 'fr' | 'en' | null {
  const m = pathname.match(/^\/(fr|en)(\/|$)/i)
  return (m?.[1]?.toLowerCase() as any) || null
}

export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { rows } = await pool.query('select stripe_account_id from merchant_accounts where owner_id=$1', [sess.ownerId])
  const acctId = rows[0]?.stripe_account_id
  if (!acctId) {
    const ctype = req.headers.get('content-type') || ''
  if (ctype.includes('application/x-www-form-urlencoded')) {
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const ref = req.headers.get('referer') || ''
    let locale: 'fr' | 'en' = 'en'
    try {
      const u = ref ? new URL(ref) : null
      const fromPath = u ? extractLocaleFromPath(u.pathname) : null
      if (fromPath) locale = fromPath
    } catch {}
    return NextResponse.redirect(`${base}/${locale}/account?sync=done`, { status: 303 })
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
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const ref = req.headers.get('referer') || ''
    let locale: 'fr' | 'en' = 'en'
    try {
      const u = ref ? new URL(ref) : null
      const m = u?.pathname.match(/^\/(fr|en)(\/|$)/i)
      if (m?.[1]) locale = m[1].toLowerCase() as any
    } catch {}
    return NextResponse.redirect(`${base}/${locale}/account?sync=done`, { status: 303 })
  }
  return NextResponse.json({ ok: true })
  
}
