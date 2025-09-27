// app/api/marketplace/confirm/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { pool } from '@/lib/db'
import { setSessionCookieOnResponse } from '@/lib/auth'
import crypto from 'node:crypto'

function isoDay(s: string) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function tableExists(client: any, table: string) {
  const { rows } = await client.query(`select to_regclass($1) as ok`, [`public.${table}`])
  return !!rows[0]?.ok
}
async function hasColumn(client: any, table: string, col: string) {
  const { rows } = await client.query(
    `select 1
       from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2
      limit 1`,
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

function safeBool(v: unknown) { return String(v) === '1' || v === true }
function safeHex(v: unknown, fallback='#1a1f2a') {
  return /^#[0-9a-fA-F]{6}$/.test(String(v||'')) ? String(v).toLowerCase() : fallback
}
function safeStyle(v: unknown) {
  const ALLOWED = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const
  const s = String(v||'neutral').toLowerCase()
  return (ALLOWED as readonly string[]).includes(s as any) ? s : 'neutral'
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const url = new URL(req.url)

  // Compat: ?sid=... (nouveau) ou ?session_id=... (ancien)
  const sid = url.searchParams.get('sid') || url.searchParams.get('session_id') || ''
  const qpLocale = (url.searchParams.get('locale') || '').toLowerCase()
  const urlLocale: 'fr' | 'en' = qpLocale === 'en' ? 'en' : qpLocale === 'fr' ? 'fr' : 'fr'
  const tsYParam = url.searchParams.get('ts') || ''

  let fallbackYMD = ''
  let finalLocale: 'fr' | 'en' = urlLocale

  try {
    if (!sid) return NextResponse.redirect(`${base}/`, { status: 302 })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
    const s = await stripe.checkout.sessions.retrieve(sid, { expand: ['payment_intent'] })
    const paid = s.payment_status === 'paid'

    // Normalise TS
    const tsISO = isoDay(String(s.metadata?.ts || tsYParam || ''))
    if (tsISO) fallbackYMD = tsISO.slice(0, 10)

    if (!paid) {
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

    // ➕ payload personnalisé
    const payloadKey = String(s.metadata?.payload_key || '').trim()
    const customBgKey = String(s.metadata?.custom_bg_key || '').trim()
    let P: any = {}
    if (payloadKey) {
      const { rows: p } = await pool.query(`select data from checkout_payload_temp where key=$1`, [payloadKey])
      if (p.length) {
        P = p[0].data || {}
        await pool.query(`delete from checkout_payload_temp where key=$1`, [payloadKey])
      }
    }
    // normalisation des valeurs
    const p_display_name   = String(P.display_name || '')
    const p_title          = (P.title ?? '') as string
    const p_message        = (P.message ?? '') as string
    const p_link_url       = (P.link_url ?? '') as string
    const p_style          = safeStyle(P.cert_style)
    const p_time_display   = ((): any => {
      const td = String(P.time_display || 'local+utc')
      return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
    })()
    const p_local_day      = safeBool(P.local_date_only)
    const p_text_color     = safeHex(P.text_color)
    const p_title_public   = safeBool(P.title_public)
    const p_message_public = safeBool(P.message_public)
    const p_public_reg     = safeBool(P.public_registry)

    // Locale finale si absente de l’URL
    if (!qpLocale) {
      const locGuess = String(s.locale || '').toLowerCase()
      finalLocale = locGuess.startsWith('en') ? 'en' : locGuess.startsWith('fr') ? 'fr' : 'fr'
    }

    const piId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id

    // ===== Transaction atomique =====
    const client = await pool.connect()
    let buyerOwnerId = ''
    try {
      await client.query('BEGIN')

      // 1) Lock listing
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
        const res = NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}?buy=already`, { status: 302 })
        return res
      }

      // 2) Idempotence (si table présente) — calculée UNE FOIS
      const hasSecondarySalesTbl = await tableExists(client, 'secondary_sales')
      if (hasSecondarySalesTbl) {
        const { rows: dup } = await client.query(
          `select 1 from secondary_sales
            where stripe_session_id=$1 or stripe_payment_intent_id=$2
            limit 1`,
          [sid, piId || null]
        )
        if (dup.length) {
          await client.query('COMMIT')
          const ymd = tsISO.slice(0, 10)
          const res = NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(ymd)}`, { status: 303 })
          try {
            const { rows: who } = await client.query(
              `select owner_id from claims where date_trunc('day', ts) = $1::timestamptz`,
              [tsISO]
            )
            if (who.length) buyerOwnerId = String(who[0].owner_id)
          } catch {}
          if (buyerOwnerId) {
            setSessionCookieOnResponse(res, {
              ownerId: buyerOwnerId,
              email: buyerEmail,
              displayName: null,
              iat: Math.floor(Date.now() / 1000),
            })
          }
          return res
        }
      }

      // 3) Upsert acheteur
      const { rows: brow } = await client.query(
        `insert into owners(email, display_name)
        values($1,$2)
        on conflict(email) do update
          set display_name = coalesce(excluded.display_name, owners.display_name)
        returning id`,
        [buyerEmail, p_display_name || null]
      )
      const buyerId = brow[0].id
      buyerOwnerId = String(buyerId)

      // 4) Transfert + personnalisations tolérantes au schéma
      const cols = await getColumns(client, 'claims')
      const sets: string[] = [
        `owner_id = $1`,
        `price_cents = $2`,
        `currency = $3`,
        `last_secondary_sold_at = now()`,
        `last_secondary_price_cents = $2`,
      ]
      const vals: any[] = [buyerId, L.price_cents, L.currency]
      let idx = vals.length
      const push = (sqlFrag: string, v: any) => { vals.push(v); sets.push(`${sqlFrag} = $${++idx}`) }
      if (cols.has('title'))           push('title', p_title || null)
      if (cols.has('message'))         push('message', p_message || null)
      if (cols.has('link_url'))        push('link_url', p_link_url || null)
      if (cols.has('cert_style'))      push('cert_style', p_style)
      if (cols.has('time_display'))    push('time_display', p_time_display)
      if (cols.has('local_date_only')) push('local_date_only', p_local_day)
      if (cols.has('text_color'))      push('text_color', p_text_color)
      if (cols.has('title_public'))    push('title_public', p_title_public)
      if (cols.has('message_public'))  push('message_public', p_message_public)

      const sql = `
        update claims
           set ${sets.join(', ')}
         where date_trunc('day', ts) = $${++idx}::timestamptz
           and owner_id = $${++idx}
      `
      vals.push(tsISO, L.seller_owner_id)
      const { rowCount: upCount } = await client.query(sql, vals)
      if (!upCount) throw new Error('claim_not_updated')

      // 4bis) Image custom
      if (p_style === 'custom' && customBgKey) {
        const hasTemp = await tableExists(client, 'custom_bg_temp')
        const hasPersist = await tableExists(client, 'claim_custom_bg')
        if (hasTemp && hasPersist) {
          const { rows: tmp } = await client.query('select data_url from custom_bg_temp where key = $1', [customBgKey])
          if (tmp.length) {
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
      }

      // 4ter) Publication registre
      if (p_public_reg) {
        await client.query(
          `insert into minute_public (ts)
             values ($1::timestamptz)
             on conflict (ts) do nothing`,
          [tsISO]
        )
      }

      // 5) Marquer l’annonce « sold »
      const hasBuyerCol = await hasColumn(client, 'listings', 'buyer_owner_id')
      if (hasBuyerCol) {
        await client.query(
          `update listings
              set status = 'sold',
                  buyer_owner_id = $2,
                  updated_at = now()
            where id = $1`,
          [listingId, buyerId]
        )
      } else {
        await client.query(
          `update listings
              set status = 'sold',
                  updated_at = now()
            where id = $1`,
          [listingId]
        )
      }

      // 6) Journalisation vente secondaire (réutilise hasSecondarySalesTbl)
      if (hasSecondarySalesTbl) {
        const hasGross = await hasColumn(client, 'secondary_sales', 'gross_cents')
        const hasPrice = await hasColumn(client, 'secondary_sales', 'price_cents')
        const gross = Number(L.price_cents) | 0
        const fee = Math.max(100, Math.round(gross * 0.10))
        const net = Math.max(0, gross - fee)

        if (hasGross) {
          await client.query(
            `insert into secondary_sales(
               listing_id, ts, seller_owner_id, buyer_owner_id,
               gross_cents, fee_cents, net_cents, currency,
               stripe_session_id, stripe_payment_intent_id
             )
             values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [listingId, tsISO, L.seller_owner_id, buyerId, gross, fee, net, L.currency, sid, piId || null]
          )
        } else if (hasPrice) {
          await client.query(
            `insert into secondary_sales(
               listing_id, ts, seller_owner_id, buyer_owner_id,
               price_cents, currency, stripe_session_id, stripe_payment_intent_id
             )
             values($1,$2,$3,$4,$5,$6,$7,$8)`,
            [listingId, tsISO, L.seller_owner_id, buyerId, L.price_cents, L.currency, sid, piId || null]
          )
        }
      }

      // 7) 🔁 Recalcule et stocke le certificat (identique aux autres flux)
      {
        const { rows: cur } = await client.query(
          `select owner_id, price_cents, created_at
             from claims
            where date_trunc('day', ts) = $1::timestamptz
            limit 1`,
          [tsISO]
        )
        if (cur.length) {
          const owner_id = cur[0].owner_id
          const price_cents = Number(cur[0].price_cents) | 0
          const createdISO =
            cur[0].created_at instanceof Date
              ? cur[0].created_at.toISOString()
              : new Date(cur[0].created_at).toISOString()

          const salt = process.env.SECRET_SALT || 'dev_salt'
          const data = `${tsISO}|${owner_id}|${price_cents}|${createdISO}|${salt}`
          const hash = crypto.createHash('sha256').update(data).digest('hex')
          const cert_url = `/api/cert/${encodeURIComponent(tsISO.slice(0,10))}`

          const cols2 = await getColumns(client, 'claims')
          if (cols2.has('cert_hash') || cols2.has('cert_url')) {
            await client.query(
              `update claims
                  set ${cols2.has('cert_hash') ? 'cert_hash = $1' : 'cert_hash = cert_hash'},
                      ${cols2.has('cert_url')  ? 'cert_url  = $2' : 'cert_url  = cert_url'}
                where date_trunc('day', ts) = $3::timestamptz`,
              [hash, cert_url, tsISO]
            )
          }
        }
      }

      await client.query('COMMIT')

      // 8) E-mails (best-effort)
      try {
        const ymd = tsISO.slice(0, 10)
        const pdfUrl = `${base}/api/cert/${encodeURIComponent(ymd)}`
        const publicUrl = `${base}/${finalLocale}/m/${encodeURIComponent(ymd)}`
        import('@/lib/email').then(async ({ sendSecondarySaleEmails }) => {
          await sendSecondarySaleEmails({
            ts: ymd, buyerEmail, pdfUrl, publicUrl, sessionId: sid
          })
        }).catch(()=>{})
      } catch {}

      // 9) Redirection finale + cookie
      const ymd = tsISO.slice(0,10)
      const to = `${base}/${finalLocale}/m/${encodeURIComponent(ymd)}?buy=success${p_public_reg ? '&autopub=1' : ''}`
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
  } catch {
    if (fallbackYMD) {
      return NextResponse.redirect(`${base}/${finalLocale}/m/${encodeURIComponent(fallbackYMD)}?buy=pending`, { status: 302 })
    }
    return NextResponse.redirect(`${base}/`, { status: 302 })
  }
}
