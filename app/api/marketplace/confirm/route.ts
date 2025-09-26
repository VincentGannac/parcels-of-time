//app/api/marketplace/confirm
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { setSessionCookieOnResponse } from '@/lib/auth'

function normIsoDay(s:string){ const d=new Date(s); if(isNaN(d.getTime()))return null; d.setUTCHours(0,0,0,0); return d.toISOString() }

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const url = new URL(req.url)
  const session_id = url.searchParams.get('session_id')
  if (!session_id) return NextResponse.redirect(`${base}/`, { status: 302 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  const s = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] })
  if (s.payment_status !== 'paid') return NextResponse.redirect(`${base}/`, { status: 302 })

  // Métadonnées
  const listingId = Number(s.metadata?.listing_id || 0)
  const tsISO = normIsoDay(String(s.metadata?.ts || ''))
  const buyerEmail = String(s.customer_details?.email || '').toLowerCase()
  const piId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id

  if (!listingId || !tsISO || !buyerEmail) return NextResponse.redirect(`${base}/`, { status: 302 })

  // Transaction atomique
  const client = await pool.connect()
  let newOwnerId = ''
  try {
    await client.query('BEGIN')

    // Récup listing + lock
    const { rows: lrows } = await client.query(
      `select * from listings where id=$1 for update`,
      [listingId]
    )
    if (!lrows.length || lrows[0].status !== 'active') throw new Error('listing_not_active')
    const L = lrows[0]

    // Idempotence : déjà vendu ?
    const { rows: already } = await client.query(
      `select id from secondary_sales where stripe_session_id=$1 or stripe_payment_intent_id=$2`,
      [session_id, piId]
    )
    if (already.length) {
      await client.query('COMMIT')
      return NextResponse.redirect(`${base}/m/${encodeURIComponent(String(tsISO).slice(0,10))}`, { status: 303 })
    }

    // Upsert buyer in owners
    const { rows: brow } = await client.query(
      `insert into owners(email) values($1)
       on conflict(email) do update set email = excluded.email
       returning id`,
      [buyerEmail]
    )
    const buyerId = brow[0].id
    newOwnerId = String(buyerId)

    // Transfert d’ownership claims -> buyer (vérifie le vendeur)
    await client.query(
      `update claims set owner_id=$1,
                         price_cents=$2,
                         currency=$3,
                         last_secondary_sold_at=now(),
                         last_secondary_price_cents=$2
        where ts=$4::timestamptz and owner_id=$5`,
      [buyerId, L.price_cents, L.currency, tsISO, L.seller_owner_id]
    )

    // Marquer l’annonce sold
    await client.query(
      `update listings set status='sold' where id=$1`,
      [listingId]
    )

    // Enregistrer la vente
    const gross = Number(L.price_cents)
    const fee = Math.max(100, Math.round(gross * 0.10))
    const net = Math.max(0, gross - fee)

    await client.query(
      `insert into secondary_sales(listing_id, ts, seller_owner_id, buyer_owner_id,
                                   gross_cents, fee_cents, net_cents, currency,
                                   stripe_session_id, stripe_payment_intent_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [listingId, tsISO, L.seller_owner_id, buyerId, gross, fee, net, L.currency, session_id, piId]
    )

    await client.query('COMMIT')
  } catch (e:any) {
    try { await client.query('ROLLBACK') } catch {}
    // Le webhook rattrapera si conflit transitoire
  } finally {
    client.release()
  }

  // Emails async (buyer+seller) + re-génération PDF côté /api/cert/<ts>
  try {
    const locale = (s.locale || 'auto').toString().startsWith('fr') ? 'fr' : 'en'
    const ymd = String(tsISO).slice(0,10)
    const pdfUrl = `${base}/api/cert/${encodeURIComponent(ymd)}`
    const publicUrl = `${base}/${locale}/m/${encodeURIComponent(ymd)}`
    import('@/lib/email').then(async ({ sendSecondarySaleEmails }) => {
      await sendSecondarySaleEmails({
        ts: ymd, buyerEmail, pdfUrl, publicUrl, sessionId: session_id
      })
    }).catch(()=>{})
  } catch {}

  // Cookie session pour le nouveau propriétaire (optionnel)
  let res = NextResponse.redirect(`${base}/m/${encodeURIComponent(String(tsISO).slice(0,10))}`, { status: 303 })
  if (newOwnerId && buyerEmail) {
    setSessionCookieOnResponse(res, {
      ownerId: newOwnerId,
      email: buyerEmail,
      displayName: null,
      iat: Math.floor(Date.now()/1000),
    })
  }
  return res
}
