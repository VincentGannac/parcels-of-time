//api/checkout/edit/confirm/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

function safeBool1(v: unknown) { return String(v) === '1' || v === true }
function safeHex(v: unknown, fallback='#1a1f2a') {
  return /^#[0-9a-fA-F]{6}$/.test(String(v||'')) ? String(v).toLowerCase() : fallback
}
function safeStyle(v: unknown) {
  const allowed = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const
  const s = String(v||'neutral').toLowerCase()
  return (allowed as readonly string[]).includes(s as any) ? s : 'neutral'
}
function normIsoDay(s: string): string | null {
  if (!s) return null
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0); return d.toISOString()
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale = accLang.startsWith('fr') ? 'fr' : 'en'
  const url = new URL(req.url)
  const session_id = url.searchParams.get('session_id')
  if (!session_id) return NextResponse.redirect(`${base}/`, { status:302 })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
    const s = await stripe.checkout.sessions.retrieve(session_id)
    if (s.payment_status !== 'paid') {
      const backTs = String(s.metadata?.ts || '')
      const safeBack = backTs && !isNaN(Date.parse(backTs))
        ? encodeURIComponent(new Date(backTs).toISOString())
        : ''
      return NextResponse.redirect(`${base}/${locale}/m/${safeBack}?status=unpaid`, { status:302 })
    }

    if ((s.metadata?.kind || '') !== 'edit') {
      const tsBack = normIsoDay(String(s.metadata?.ts || '')) || ''
      return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsBack)}`, { status:303 })
    }

    const tsISO = normIsoDay(String(s.metadata?.ts || ''))
    if (!tsISO) return NextResponse.redirect(`${base}/`, { status:302 })

    const payloadKey = String(s.metadata?.payload_key || '').trim()
    const custom_bg_key = String(s.metadata?.custom_bg_key || '')
    const email = String(s.metadata?.email || '').trim().toLowerCase()

    // Fallback par défaut (au cas où)
    let displayName: string | null = (s.metadata?.display_name || '') || null
    let title: string | null       = (s.metadata?.title || '') || null
    let message: string | null     = (s.metadata?.message || '') || null
    let link_url: string | null    = (s.metadata?.link_url || '') || null
    let cert_style                 = safeStyle(s.metadata?.cert_style)
    let time_display: 'utc'|'utc+local'|'local+utc' = ((): any => {
      const td = String(s.metadata?.time_display || 'local+utc')
      return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
    })()
    let local_date_only            = safeBool1(s.metadata?.local_date_only)
    let text_color                 = safeHex(s.metadata?.text_color)
    let title_public               = safeBool1(s.metadata?.title_public)
    let message_public             = safeBool1(s.metadata?.message_public)

    // ⛳️ NOUVEAU : lecture du payload complet si payload_key
    if (payloadKey) {
      const { rows: p } = await pool.query(
        `select data from checkout_payload_temp where key = $1 and kind = 'edit'`,
        [payloadKey]
      )
      if (p.length) {
        const d = p[0].data || {}
        displayName     = (d.display_name ?? displayName) || null
        title           = (d.title ?? title) || null
        message         = (d.message ?? message) || null   // ← conserve les \n
        link_url        = (d.link_url ?? link_url) || null
        cert_style      = safeStyle(d.cert_style ?? cert_style)
        time_display    = ((): any => {
          const td = String(d.time_display ?? time_display)
          return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
        })()
        local_date_only = !!(d.local_date_only ?? local_date_only)
        text_color      = safeHex(d.text_color ?? text_color)
        title_public    = !!(d.title_public ?? title_public)
        message_public  = !!(d.message_public ?? message_public)

        await pool.query(`delete from checkout_payload_temp where key = $1`, [payloadKey])
      }
    }

    // === Écriture DB ===
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1) owners : maj display_name si fourni
      if (email) {
        await client.query(
          `insert into owners(email, display_name)
           values ($1,$2)
           on conflict(email) do update
             set display_name = coalesce(excluded.display_name, owners.display_name)`,
          [email, displayName]
        )
      }

      // 2) claims : maj champs éditables
      const { rowCount } = await client.query(
        `update claims set
           title=$1, message=$2, link_url=$3,
           cert_style=$4, time_display=$5, local_date_only=$6, text_color=$7,
           title_public=$8, message_public=$9
         where ts=$10::timestamptz`,
        [title, message, link_url, cert_style, time_display, local_date_only, text_color, title_public, message_public, tsISO]
      )

      if (rowCount === 0) {
        await client.query('ROLLBACK')
        return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsISO)}?updated=0`, { status:303 })
      }

      // 3) fond custom : purge/persist selon le style
      if (cert_style !== 'custom') {
        await client.query('delete from claim_custom_bg where ts = $1::timestamptz', [tsISO])
      } else if (custom_bg_key) {
        const { rows: tmp } = await client.query(
          'select data_url from custom_bg_temp where key = $1',
          [custom_bg_key]
        )
        if (tmp.length) {
          await client.query(
            `insert into claim_custom_bg (ts, data_url)
             values ($1::timestamptz, $2)
             on conflict (ts) do update set data_url = excluded.data_url, created_at = now()`,
            [tsISO, tmp[0].data_url]
          )
          await client.query('delete from custom_bg_temp where key = $1', [custom_bg_key])
        }
      }

      // 4) Recalcul cert_hash
      const { rows: cur } = await client.query(
        `select owner_id, price_cents, created_at from claims where ts=$1::timestamptz`,
        [tsISO]
      )
      if (cur.length) {
        const owner_id = cur[0].owner_id
        const price_cents = Number(cur[0].price_cents) | 0
        const createdISO =
          cur[0].created_at instanceof Date ? cur[0].created_at.toISOString() : new Date(cur[0].created_at).toISOString()
        const salt = process.env.SECRET_SALT || 'dev_salt'
        const data = `${tsISO}|${owner_id}|${price_cents}|${createdISO}|${salt}`
        const hash = crypto.createHash('sha256').update(data).digest('hex')
        
        const ymd = tsISO.slice(0,10)
        const cert_url = `/api/cert/${encodeURIComponent(ymd)}.pdf`
        await client.query(
          `update claims set cert_hash=$1, cert_url=$2 where ts=$3::timestamptz`,
          [hash, cert_url, tsISO]
        )
      }

      await client.query('COMMIT')
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      console.error('[edit confirm] db error:', (e as any)?.message || e)
    } finally {
      client.release()
    }
    
    return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsISO.slice(0,10))}?updated=1`, { status:303 })

  } catch (e:any) {
    console.error('[edit confirm] error:', e?.message || e)
    const base2 = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base2}/`, { status:302 })
  }
}
