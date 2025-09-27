export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { setSessionCookieOnResponse } from '@/lib/auth'

function isoDay(s: string) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const url = new URL(req.url)

  // Compat: accepter ?sid=... (nouveau) et ?session_id=... (ancien)
  const sid = url.searchParams.get('sid') || url.searchParams.get('session_id') || ''
  if (!sid) return NextResponse.redirect(`${base}/`, { status: 302 })

  // Locale fournie par l’URL (sinon on laissera Stripe décider)
  const urlLocale = (url.searchParams.get('locale') || '').toLowerCase()
  const qpLocale: 'fr' | 'en' | '' = urlLocale === 'en' ? 'en' : urlLocale === 'fr' ? 'fr' : ''

  // (Optionnel) ts YMD passé dans l’URL par le success_url récent
  const tsYParam = url.searchParams.get('ts') || ''

  let buyerOwnerId = ''
  let buyerEmail = ''
  let tsISO: string | null = null
  let finalLocale: 'fr' | 'en' = qpLocale || 'fr'

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
    const s = await stripe.checkout.sessions.retrieve(sid, { expand: ['payment_intent'] })

    if (s.payment_status !== 'paid') {
      // Tentative d’afficher la page jour si possible
      const tryTs = isoDay(String(s.metadata?.ts || tsYParam || ''))
      const ymd = tryTs ? tryTs.slice(0, 10) : ''
      return NextResponse.redirect(ymd ? `${base}/${finalLocale}/m/${encodeURIComponent(ymd)}?buy=unpaid` : `${base}/`, { status: 302 })
    }

    // Métadonnées nécessaires
    const listingId = Number(s.metadata?.listing_id || 0)
    buyerEmail = String(s.customer_details?.email || s.metadata?.buyer_email || '').trim().toLowerCase()
    tsISO = isoDay(String(s.metadata?.ts || tsYParam || ''))
    if (!listingId || !buyerEmail || !tsISO) {
      return NextResponse.redirect(`${base}/`, { status: 302 })
    }

    // Locale finale: query param > Stripe
    if (!qpLocale) {
      const locGuess = String(s.locale || '').toLowerCase()
      finalLocale = locGuess.startsWith('en') ? 'en' : locGuess.startsWith('fr') ? 'fr' : 'fr'
    }

    const piId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id

    // ===== Transaction atomique =====
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Verrou sur l’annonce
      const { rows: lrows } = await client.query(
        `select id, ts, seller_owner_id, price_cents, currency, status
           from listings
          where id=$1
          for update`,
        [listingId]
      )
      if (!lrows.length) throw new Error('listing_not_found')
      const L = lrows[0]
      if (L.status !== 'active') {
        await client.query('COMMIT')
        const ymd = tsISO.slice(0, 10)
        return NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}?buy=already`, { status: 302 })
      }

      // Idempotence via secondary_sales
      const { rows: already } = await client.query(
        `select id from secondary_sales
          where stripe_session_id=$1
             or stripe_payment_intent_id=$2
          limit 1`,
        [sid, piId]
      )
      if (already.length) {
        await client.query('COMMIT')
        const ymd = tsISO.slice(0, 10)
        const res = NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}`, { status: 303 })
        // On (ré)pose le cookie session acheteur par confort
        if (buyerOwnerId && buyerEmail) {
          setSessionCookieOnResponse(res, {
            ownerId: buyerOwnerId,
            email: buyerEmail,
            displayName: null,
            iat: Math.floor(Date.now() / 1000),
          })
        }
        return res
      }

      // Upsert acheteur
      const { rows: brow } = await client.query(
        `insert into owners(email)
         values($1)
         on conflict(email) do update set email = excluded.email
         returning id`,
        [buyerEmail]
      )
      const buyerId = brow[0].id
      buyerOwnerId = String(buyerId)

      // Transfert de propriété (sécurisé : seulement si le owner actuel est bien le vendeur de l’annonce)
      await client.query(
        `update claims
            set owner_id = $1,
                price_cents = $2,
                currency = $3,
                last_secondary_sold_at = now(),
                last_secondary_price_cents = $2
          where ts = $4::timestamptz
            and owner_id = $5`,
        [buyerId, L.price_cents, L.currency, tsISO, L.seller_owner_id]
      )

      // Marquer l’annonce « sold » + buyer
      await client.query(
        `update listings
            set status='sold',
                buyer_owner_id = $2,
                updated_at = now()
          where id = $1`,
        [listingId, buyerId]
      )

      // Enregistrer la vente secondaire
      const gross = Number(L.price_cents) | 0
      const fee = Math.max(100, Math.round(gross * 0.10)) // 10% min 1€
      const net = Math.max(0, gross - fee)

      await client.query(
        `insert into secondary_sales(
           listing_id, ts, seller_owner_id, buyer_owner_id,
           gross_cents, fee_cents, net_cents, currency,
           stripe_session_id, stripe_payment_intent_id
         )
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [listingId, tsISO, L.seller_owner_id, buyerId, gross, fee, net, L.currency, sid, piId]
      )

      await client.query('COMMIT')
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      throw e
    } finally {
      client.release()
    }

    // Emails async (buyer + seller) et re-génération du PDF à la volée via /api/cert/[ts]
    try {
      const ymd = tsISO.slice(0, 10)
      const pdfUrl = `${base}/api/cert/${encodeURIComponent(ymd)}`
      const publicUrl = `${base}/${finalLocale}/m/${encodeURIComponent(ymd)}`
      import('@/lib/email').then(async ({ sendSecondarySaleEmails }) => {
        await sendSecondarySaleEmails({
          ts: ymd,
          buyerEmail,
          pdfUrl,
          publicUrl,
          sessionId: sid,
        })
      }).catch(() => {})
    } catch {}

    // Redirection finale + cookie de session pour le nouvel owner
    const ymd = tsISO.slice(0, 10)
    const res = NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}?buy=success`, { status: 303 })
    if (buyerOwnerId && buyerEmail) {
      setSessionCookieOnResponse(res, {
        ownerId: buyerOwnerId,
        email: buyerEmail,
        displayName: null,
        iat: Math.floor(Date.now() / 1000),
      })
    }
    return res
  } catch {
    return NextResponse.redirect(`${base}/`, { status: 302 })
  }
}
