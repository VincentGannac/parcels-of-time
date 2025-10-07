// app/api/marketplace/confirm/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { setSessionCookieOnResponse } from '@/lib/auth'
import { normalizeClaimUpdates, applyClaimUpdatesLikeEdit } from '@/lib/claim-input'

function normIsoDay(s: string): string | null {
  if (!s) return null
  let d: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = new Date(`${s}T00:00:00.000Z`) // date-only → UTC minuit
  } else if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(s) &&
    !/[Z+-]\d{2}:?\d{2}$/.test(s)
  ) {
    d = new Date(`${s}Z`)              // ISO sans fuseau → force UTC
  } else {
    d = new Date(s)
  }
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0)
  return d.toISOString()
}

async function tableExists(client: any, table: string) {
  const { rows } = await client.query(`select to_regclass($1) as ok`, [`public.${table}`])
  return !!rows[0]?.ok
}
async function hasColumn(client: any, table: string, col: string) {
  const { rows } = await client.query(
    `select 1 from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2 limit 1`,
    [table, col]
  )
  return !!rows.length
}
async function getColumns(client: any, table: string) {
  const { rows } = await client.query(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name=$1`,
    [table]
  )
  return new Set<string>(rows.map((r:any)=>r.column_name))
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const url = new URL(req.url)

  // Compat: ?sid=... (nouveau) ou ?session_id=... (ancien)
  const sid = url.searchParams.get('sid') || url.searchParams.get('session_id') || ''
  const qpLocale = (url.searchParams.get('locale') || '').toLowerCase()
  let finalLocale: 'fr' | 'en' = qpLocale === 'en' ? 'en' : 'fr'
  const tsYParam = url.searchParams.get('ts') || ''
  const chosenLocale: 'fr'|'en' = finalLocale
  let fallbackYMD = ''

  try {
    if (!sid) return NextResponse.redirect(`${base}/`, { status: 302 })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
    const s = await stripe.checkout.sessions.retrieve(sid, { expand: ['payment_intent'] })
    const paid = s.payment_status === 'paid'

    // Normalise jour ISO depuis metadata/URL
    const tsISO = normIsoDay(String(s.metadata?.ts || tsYParam || ''))

    if (tsISO) fallbackYMD = tsISO.slice(0, 10)

    if (!paid) {
      // Paiement non confirmé → renvoi simple
      return NextResponse.redirect(
        fallbackYMD ? `${base}/${finalLocale}/m/${encodeURIComponent(fallbackYMD)}?buy=unpaid` : `${base}/`,
        { status: 302 }
      )
    }

    const listingId = Number(s.metadata?.listing_id || 0)
    const buyerEmail = String(s.customer_details?.email || s.metadata?.buyer_email || '').trim().toLowerCase()
    if (!listingId || !buyerEmail || !tsISO) {
      return NextResponse.redirect(`${base}/`, { status: 302 })
    }

    // Payload custom (stash)
    const payloadKey = String(s.metadata?.payload_key || '').trim()
    const customBgKey = String(s.metadata?.custom_bg_key || '').trim()
    let P: any = {}
    if (payloadKey) {
      const { rows: p } = await pool.query(`select data from checkout_payload_temp where key=$1`, [payloadKey])
      if (p.length) {
        P = p[0].data || {}
        await pool.query(`delete from checkout_payload_temp where key=$1`, [payloadKey]) // hygiène
      }
    }

    // Locale finale si absente
    if (!qpLocale) {
      const guess = String(s.locale || '').toLowerCase()
      finalLocale = guess.startsWith('en') ? 'en' : guess.startsWith('fr') ? 'fr' : 'fr'
    }

    const piId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id

    // ===== Transaction atomique & idempotente =====
    const client = await pool.connect()
    let buyerOwnerId = ''
    try {
      await client.query('BEGIN')

      // 1) Lock annonce
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
        // évite un second transfert si une autre confirmation est passée entre-temps
        await client.query('ROLLBACK')
        const ymd = tsISO.slice(0,10)
        return NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}?buy=already_sold`, { status: 303 })
      }

      // 2) Idempotence (si journal présent)
      const hasSecondary = await tableExists(client, 'secondary_sales')
      if (hasSecondary) {
        const { rows: dup } = await client.query(
          `select 1 from secondary_sales
            where stripe_session_id=$1 or stripe_payment_intent_id=$2
            limit 1`,
          [sid, piId || null]
        )
        if (dup.length) {
          await client.query('COMMIT')
          const ymd = tsISO.slice(0, 10)
          return NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}`, { status: 303 })
        }
      }

      // 3) Upsert acheteur — NE PAS écraser le display_name du compte
      let buyerId = ''
      {
        const { rows: brow } = await client.query(
          `insert into owners(email)
          values ($1)
          on conflict (email) do nothing
          returning id`,
          [buyerEmail]
        )
        if (brow.length) {
          buyerId = String(brow[0].id)
        } else {
          const { rows: got } = await client.query(
            `select id from owners where email=$1 limit 1`,
            [buyerEmail]
          )
          buyerId = String(got[0].id)
        }
      }
      buyerOwnerId = buyerId

      // 4) Appliquer modifs “comme Edit/confirm” + transfert owner
      const updates = normalizeClaimUpdates(P) // titre, message, style, couleurs, flags…
      await applyClaimUpdatesLikeEdit(client, tsISO, updates, { newOwnerId: buyerOwnerId })

      // 4bis) Mettre à jour prix/devise + champs secondaires si présents
      const cols = await getColumns(client, 'claims')
      const sets: string[] = []
      const vals: any[] = [tsISO]
      const push = (frag: string, v: any) => { vals.push(v); sets.push(`${frag} = $${vals.length}`) }
      push('price_cents', L.price_cents)
      push('currency', L.currency)
      if (cols.has('last_secondary_sold_at')) push('last_secondary_sold_at', new Date())
      if (cols.has('last_secondary_price_cents')) push('last_secondary_price_cents', L.price_cents)
      await client.query(
        `update claims set ${sets.join(', ')} where date_trunc('day', ts) = $1::timestamptz`,
        vals
      )

      // 4ter) Image custom : temp -> persist si style=custom
      const styleLower = String(updates.cert_style || '').toLowerCase()
      if (styleLower === 'custom') {
        const hasPersist = await tableExists(client, 'claim_custom_bg')

        // a) voie 'custom_bg_temp' si key fourni
        const hasTemp = await tableExists(client, 'custom_bg_temp')
        if (hasTemp && customBgKey) {
          const { rows: tmp } = await client.query(
            'select data_url from custom_bg_temp where key = $1',
            [customBgKey]
          )
          if (tmp.length && hasPersist) {
            await client.query(
              `insert into claim_custom_bg (ts, data_url)
               values ($1::timestamptz, $2)
               on conflict (ts) do update
                 set data_url = excluded.data_url, created_at = now()`,
              [tsISO, tmp[0].data_url]
            )
            await client.query('delete from custom_bg_temp where key = $1', [customBgKey])
          }
        }

        // b) fallback direct : data_url dans le payload
        const rawDataUrl = String(P.custom_bg_data_url || '')
        if (rawDataUrl && hasPersist) {
          const ok = /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(rawDataUrl)
          if (ok) {
            await client.query(
              `insert into claim_custom_bg (ts, data_url)
               values ($1::timestamptz, $2)
               on conflict (ts) do update
                 set data_url = excluded.data_url, created_at = now()`,
              [tsISO, rawDataUrl]
            )
          }
        }
      }

      // 4quater) Registre public si demandé
      if (updates.public_registry === true) {
        await client.query(
          `insert into minute_public(ts) values($1::timestamptz) on conflict (ts) do nothing`,
          [tsISO]
        )
      }

      // 5) Annonce → sold (+ buyer_owner_id si présent)
      const hasBuyerCol = await hasColumn(client, 'listings', 'buyer_owner_id')
      if (hasBuyerCol) {
        await client.query(
          `update listings
              set status='sold', buyer_owner_id=$2, updated_at=now()
            where id=$1`,
          [listingId, buyerId]
        )
      } else {
        await client.query(
          `update listings
              set status='sold', updated_at=now()
            where id=$1`,
          [listingId]
        )
      }

      // 6) Journal secondaire (si table présente)
      const hasSecondary2 = await tableExists(client, 'secondary_sales')
      if (hasSecondary2) {
        const hasGross = await hasColumn(client, 'secondary_sales', 'gross_cents')
        const hasPrice = await hasColumn(client, 'secondary_sales', 'price_cents')
        const currency = String(L.currency || 'EUR')
        if (hasGross) {
          const gross = Number(L.price_cents) | 0
          const fee = Math.max(100, Math.round(gross * 0.15))
          const net = Math.max(0, gross - fee)
          await client.query(
            `insert into secondary_sales(listing_id, ts, seller_owner_id, buyer_owner_id,
               gross_cents, fee_cents, net_cents, currency, stripe_session_id, stripe_payment_intent_id)
             values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [listingId, tsISO, L.seller_owner_id, buyerId, gross, fee, net, currency, sid, piId || null]
          )
        } else if (hasPrice) {
          await client.query(
            `insert into secondary_sales(listing_id, ts, seller_owner_id, buyer_owner_id,
               price_cents, currency, stripe_session_id, stripe_payment_intent_id)
             values($1,$2,$3,$4,$5,$6,$7,$8)`,
            [listingId, tsISO, L.seller_owner_id, buyerId, L.price_cents, currency, sid, piId || null]
          )
        }
      }

      await client.query('COMMIT')

      // 7) Email best-effort (SECONDARY)
      try {
        const ymd = tsISO.slice(0, 10)
        const pdfUrl = `${base}/api/cert/${encodeURIComponent(ymd)}.pdf`
        const publicUrl = `${base}/${finalLocale}/m/${encodeURIComponent(ymd)}`
        import('@/lib/email').then(async ({ sendSecondarySaleEmails }) => {
          await sendSecondarySaleEmails({
            ts: ymd, buyerEmail, pdfUrl, publicUrl, sessionId: sid,locale: chosenLocale
          })
        }).catch(()=>{})
      } catch {}

      // 8) Redirection finale + cookie
      const to = `${base}/${finalLocale}/m/${encodeURIComponent(tsISO.slice(0,10))}?buy=success`
      const res = NextResponse.redirect(to, { status: 303 })
      setSessionCookieOnResponse(res, {
        ownerId: buyerOwnerId,
        email: buyerEmail,
        displayName: null,
        iat: Math.floor(Date.now()/1000),
      })
      return res
    } catch (err) {
      try { await pool.query('ROLLBACK') } catch {}
      const ymd = fallbackYMD || '1970-01-01'
      return NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}?buy=pending`, { status: 302 })
    }
  } catch (e) {
    if (fallbackYMD) {
      return NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(fallbackYMD)}?buy=pending`, { status: 302 })
    }
    return NextResponse.redirect(`${base}/`, { status: 302 })
  }
}
