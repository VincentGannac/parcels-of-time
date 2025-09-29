// app/api/connect/onboard/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

/** Utilitaires */
function getBaseFromReq(req: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
}

function sellerPublicUrl(base: string, ownerId: string) {
  // Si tu as une page vendeur, remplace par `${base}/u/${ownerId}`
  return base
}

/** Création / récupération + PREFILL du compte Connect (mcc, url, description…) */
async function ensurePrefilledAccount(stripe: Stripe, ownerId: string, email: string, base: string) {
  const sellerUrl = sellerPublicUrl(base, ownerId)

  // 1) Lire un éventuel compte existant
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
      business_type: 'individual',              // particuliers (C2C)
      default_currency: 'eur',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_profile: {
        // ✅ Pré-remplissage pour éviter l’écran "Secteur d’activité / Site web"
        mcc: '5815', // Digital goods – ajuste au besoin
        url: sellerUrl,
        product_description: 'C2C resale of Parcels of Time certificates (marketplace)',
        support_url: `${base}/help`,
        support_email: 'support@parcelsoftime.com',
      },
      metadata: { pot_owner_id: String(ownerId) },
    })
    accountId = acct.id

    await pool.query(
      `insert into merchant_accounts(owner_id, stripe_account_id, charges_enabled, payouts_enabled)
       values($1,$2,$3,$4)
       on conflict(owner_id) do update set stripe_account_id=excluded.stripe_account_id`,
      [ownerId, accountId, !!acct.charges_enabled, !!acct.payouts_enabled]
    )
  } else {
    // 3) Mettre à jour le profil (si le compte existe déjà)
    await stripe.accounts.update(accountId, {
      business_profile: {
        mcc: '5815',
        url: sellerUrl,
        product_description: 'C2C resale of Parcels of Time certificates (marketplace)',
        support_url: `${base}/help`,
        support_email: 'support@parcelsoftime.com',
      },
    })
  }

  return accountId!
}

/** Lien d’onboarding (collecte minimale immédiate) */
async function makeOnboardingLink(stripe: Stripe, accountId: string, base: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh`,
    return_url: `${base}/account?connect=done`,
    type: 'account_onboarding',
    collect: 'eventually_due', // réduit la friction initiale, Stripe demandera le reste avant le premier payout
  })
}

/** POST: appelé depuis un <form> ou via fetch */
export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = getBaseFromReq(req)

  try {
    const accountId = await ensurePrefilledAccount(stripe, sess.ownerId, sess.email, base)
    const link = await makeOnboardingLink(stripe, accountId, base)

    // ✅ si c'est un <form> → redirige, sinon JSON
    const ctype = (req.headers.get('content-type') || '').toLowerCase()
    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(link.url, { status: 303 })
    }
    return NextResponse.json({ url: link.url })
  } catch (e: any) {
    const msg = String(e?.message || e)
    const ctype = (req.headers.get('content-type') || '').toLowerCase()
    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(`${base}/account?connect=err`, { status: 303 })
    }
    return NextResponse.json({ error: 'server_error', detail: msg }, { status: 500 })
  }
}

/** GET: permet de (re)lancer l’onboarding par simple lien */
export async function GET(req: Request) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const base = getBaseFromReq(req)

  try {
    const accountId = await ensurePrefilledAccount(stripe, sess.ownerId, sess.email, base)
    const link = await makeOnboardingLink(stripe, accountId, base)
    return NextResponse.redirect(link.url, { status: 303 })
  } catch (e: any) {
    return NextResponse.redirect(`${base}/account?connect=err`, { status: 303 })
  }
}
