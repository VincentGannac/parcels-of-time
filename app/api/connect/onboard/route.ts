// app/api/connect/onboard/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

function getBaseFromReq(req: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
}
function extractLocaleFromPath(pathname: string): 'fr' | 'en' | null {
  const m = pathname.match(/^\/(fr|en)(\/|$)/i)
  return (m?.[1]?.toLowerCase() as any) || null
}
function localeFromReq(req: Request): 'fr' | 'en' {
  const ref = req.headers.get('referer') || ''
  try {
    const u = ref ? new URL(ref) : null
    const fromPath = u ? extractLocaleFromPath(u.pathname) : null
    if (fromPath) return fromPath
  } catch {}
  return 'en'
}
function sellerPublicUrl(base: string, ownerId: string) {
  return base
}
async function ensurePrefilledAccount(
  stripe: Stripe,
  ownerId: string,
  email: string,
  base: string,
  sellerKind: 'individual' | 'company'
) {
  const sellerUrl = sellerPublicUrl(base, ownerId)
  const { rows } = await pool.query('select stripe_account_id from merchant_accounts where owner_id=$1', [ownerId])
  let accountId: string | null = rows[0]?.stripe_account_id ?? null

  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email,
      business_type: sellerKind === 'company' ? 'company' : 'individual',
      default_currency: 'eur',
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      business_profile: {
        mcc: '5815',
        url: sellerUrl,
        product_description: 'C2C resale of Parcels of Time certificates (marketplace)',
        support_url: `${base}/help`,
        support_email: 'support@parcelsoftime.com',
      },
      metadata: { pot_owner_id: String(ownerId), seller_kind: sellerKind },
    })
    accountId = acct.id
    await pool.query(
      `insert into merchant_accounts(owner_id, stripe_account_id, charges_enabled, payouts_enabled)
       values($1,$2,$3,$4)
       on conflict(owner_id) do update set stripe_account_id=excluded.stripe_account_id`,
      [ownerId, accountId, !!acct.charges_enabled, !!acct.payouts_enabled]
    )
  } else {
    // Mise à jour — utile pour passer Particulier → Pro
    await stripe.accounts.update(accountId, {
      business_type: sellerKind === 'company' ? 'company' : 'individual',
      business_profile: {
        mcc: '5815',
        url: sellerPublicUrl(base, ownerId),
        product_description: 'C2C resale of Parcels of Time certificates (marketplace)',
        support_url: `${base}/help`,
        support_email: 'support@parcelsoftime.com',
      },
      metadata: { seller_kind: sellerKind },
    })
  }
  return accountId!
}

function makeOnboardingLink(stripe: Stripe, accountId: string, base: string, locale: 'fr' | 'en') {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh?loc=${locale}`, // ⬅️ important
    return_url: `${base}/${locale}/account?connect=done`,
    type: 'account_onboarding',
    collect: 'eventually_due',
  })
}



export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = getBaseFromReq(req)
  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  let sellerKind: 'individual' | 'company' = 'individual'
  let locale: 'fr' | 'en' = localeFromReq(req)

  if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
    // @ts-ignore
    const form = await req.formData()
    const v = String(form.get('seller_kind') || '').toLowerCase()
    sellerKind = v === 'company' ? 'company' : 'individual'
    const loc = String(form.get('locale') || '').toLowerCase()
    if (loc === 'fr' || loc === 'en') locale = loc
  } else if (ctype.includes('application/json')) {
    try {
      const body = await req.json()
      const v = String(body?.seller_kind || '').toLowerCase()
      sellerKind = v === 'company' ? 'company' : 'individual'
      const loc = String(body?.locale || '').toLowerCase()
      if (loc === 'fr' || loc === 'en') locale = loc
    } catch {}
  }

  try {
    const accountId = await ensurePrefilledAccount(stripe, sess.ownerId, sess.email, base, sellerKind)
    const link = await makeOnboardingLink(stripe, accountId, base, locale)
    if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
      return NextResponse.redirect(link.url, { status: 303 })
    }
    return NextResponse.json({ url: link.url })
  } catch (e: any) {
    const code = e?.raw?.code || e?.code || e?.raw?.type || 'unknown'
    const msg  = String(e?.message || '')
    const url  = `${base}/${locale}/account?connect=err&code=${encodeURIComponent(code)}&msg=${encodeURIComponent(msg)}`
    if ((req.headers.get('content-type') || '').toLowerCase().includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(url, { status: 303 })
    }
    return NextResponse.json({ error: 'server_error', code, detail: msg }, { status: 500 })
  }  
}

export async function GET(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = getBaseFromReq(req)
  const locale = localeFromReq(req)

  try {
    // ⬇️ on récupère l'account_id si présent, sans update
    const { rows } = await pool.query(
      'select stripe_account_id from merchant_accounts where owner_id=$1',
      [sess.ownerId]
    )
    let accountId: string | null = rows[0]?.stripe_account_id ?? null

    // ⬇️ si absent, on crée (individual par défaut) puis on stocke
    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: sess.email,
        business_type: 'individual',
        default_currency: 'eur',
        capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
        business_profile: {
          mcc: '5815',
          url: base,
          product_description: 'C2C resale of Parcels of Time certificates (marketplace)',
          support_url: `${base}/help`,
          support_email: 'support@parcelsoftime.com',
        },
        metadata: { pot_owner_id: String(sess.ownerId), seller_kind: 'individual' },
      })
      accountId = acct.id
      await pool.query(
        `insert into merchant_accounts(owner_id, stripe_account_id, charges_enabled, payouts_enabled)
         values($1,$2,$3,$4)
         on conflict(owner_id) do update set stripe_account_id=excluded.stripe_account_id`,
        [sess.ownerId, accountId, !!acct.charges_enabled, !!acct.payouts_enabled]
      )
    }

    // ⬇️ lien d'onboarding localisé (sans changer business_type)
    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: `${base}/api/connect/refresh?loc=${locale}`,
      return_url: `${base}/${locale}/account?connect=done`,
      type: 'account_onboarding',
      collect: 'eventually_due',
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
