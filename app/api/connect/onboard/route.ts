// app/api/connect/onboard/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

/** Helpers */
function getBaseFromReq(req: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
}
function sellerPublicUrl(base: string, ownerId: string) {
  // Si tu as une page vendeur: return `${base}/u/${ownerId}`
  return base
}
function extractLocaleFromPath(pathname: string): 'fr' | 'en' | null {
  const m = pathname.match(/^\/(fr|en)(\/|$)/i)
  return (m?.[1]?.toLowerCase() as any) || null
}
function localeFromReq(req: Request): 'fr' | 'en' {
  // 1) Referer → /fr/... ou /en/...
  const ref = req.headers.get('referer') || ''
  try {
    const u = ref ? new URL(ref) : null
    const fromPath = u ? extractLocaleFromPath(u.pathname) : null
    if (fromPath) return fromPath
  } catch {}
  // 2) Par défaut
  return 'en'
}

/** Création / récupération + PREFILL du compte Connect */
async function ensurePrefilledAccount(
  stripe: Stripe,
  ownerId: string,
  email: string,
  base: string,
  sellerKind: 'individual' | 'company'
) {
  const sellerUrl = sellerPublicUrl(base, ownerId)

  // 1) Lire compte existant
  const { rows } = await pool.query(
    'select stripe_account_id from merchant_accounts where owner_id=$1',
    [ownerId]
  )
  let accountId: string | null = rows[0]?.stripe_account_id ?? null

  // 2) Créer si absent
  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email,
      business_type: sellerKind === 'company' ? 'company' : 'individual',
      default_currency: 'eur',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      // ✅ Particulier : on préremplit pour éviter l’écran “secteur / site”
      business_profile: {
        mcc: '5815', // digital goods (ajuste si besoin)
        url: sellerUrl,
        product_description: 'C2C resale of Parcels of Time certificates (marketplace)',
        support_url: `${base}/help`,
        support_email: 'support@parcelsoftime.com',
      },
      metadata: {
        pot_owner_id: String(ownerId),
        seller_kind: sellerKind,
      },
    })
    accountId = acct.id

    await pool.query(
      `insert into merchant_accounts(owner_id, stripe_account_id, charges_enabled, payouts_enabled)
       values($1,$2,$3,$4)
       on conflict(owner_id) do update set stripe_account_id=excluded.stripe_account_id`,
      [ownerId, accountId, !!acct.charges_enabled, !!acct.payouts_enabled]
    )
  } else {
    // 3) Mettre à jour le profil & le type si besoin (ex: passage pro)
    await stripe.accounts.update(accountId, {
      business_type: sellerKind === 'company' ? 'company' : 'individual',
      business_profile: {
        mcc: '5815',
        url: sellerUrl,
        product_description: 'C2C resale of Parcels of Time certificates (marketplace)',
        support_url: `${base}/help`,
        support_email: 'support@parcelsoftime.com',
      },
      metadata: { seller_kind: sellerKind },
    })
  }

  return accountId!
}

/** Lien d’onboarding : collecte minimale immédiate */
function makeOnboardingLink(stripe: Stripe, accountId: string, base: string, locale: 'fr' | 'en') {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh`,
    return_url: `${base}/${locale}/account?connect=done`,
    type: 'account_onboarding',
    collect: 'eventually_due', // Stripe demandera le reste avant le 1er payout
  })
}

/** POST : depuis le formulaire avec radio Particulier/Pro (ou via fetch JSON) */
export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = getBaseFromReq(req)

  // Lire body UNE seule fois
  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  let sellerKind: 'individual' | 'company' = 'individual'
  let locale: 'fr' | 'en' = localeFromReq(req)

  if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
    // @ts-ignore - Next runtime FormData
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
    } catch { /* no-op */ }
  }

  try {
    const accountId = await ensurePrefilledAccount(stripe, sess.ownerId, sess.email, base, sellerKind)
    const link = await makeOnboardingLink(stripe, accountId, base, locale)

    if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
      return NextResponse.redirect(link.url, { status: 303 })
    }
    return NextResponse.json({ url: link.url })
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
      return NextResponse.redirect(`${base}/${locale}/account?connect=err`, { status: 303 })
    }
    return NextResponse.json({ error: 'server_error', detail: msg }, { status: 500 })
  }
}

/** GET : simple lien pour relancer l’onboarding (par défaut “Particulier”) */
export async function GET(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = getBaseFromReq(req)
  const sellerKind: 'individual' = 'individual'
  const locale = localeFromReq(req)

  try {
    const accountId = await ensurePrefilledAccount(stripe, sess.ownerId, sess.email, base, sellerKind)
    const link = await makeOnboardingLink(stripe, accountId, base, locale)
    return NextResponse.redirect(link.url, { status: 303 })
  } catch {
    return NextResponse.redirect(`${base}/${locale}/account?connect=err`, { status: 303 })
  }
}
