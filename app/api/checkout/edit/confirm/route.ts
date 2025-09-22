//app/api/checkout/edit/confirm/route.ts
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
      // pas une session d’édition → retour minute
      const tsBack = normIsoDay(String(s.metadata?.ts || '')) || ''
      return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsBack)}`, { status:303 })
    }

    const tsISO = normIsoDay(String(s.metadata?.ts || ''))
    if (!tsISO) return NextResponse.redirect(`${base}/`, { status:302 })

    // === Écriture DB ===
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1) owner: maj display_name si fourni
      const email = String(s.metadata?.email || '').trim().toLowerCase()
      const displayName = (s.metadata?.display_name || '') || null
      if (email) {
        await client.query(
          `insert into owners(email, display_name)
           values ($1,$2)
           on conflict(email) do update
             set display_name = coalesce(excluded.display_name, owners.display_name)`,
          [email, displayName]
        )
      }

      // 2) claims: maj champs éditables uniquement (où ts = tsISO)
      const title = (s.metadata?.title || '') || null
      const message = (s.metadata?.message || '') || null
      const link_url = (s.metadata?.link_url || '') || null
      const cert_style = safeStyle(s.metadata?.cert_style)
      const custom_bg_key = String(s.metadata?.custom_bg_key || '')
      const time_display = ((): 'utc'|'utc+local'|'local+utc' => {
        const td = String(s.metadata?.time_display || 'local+utc')
        return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
      })()
      const local_date_only = safeBool1(s.metadata?.local_date_only)
      const text_color = safeHex(s.metadata?.text_color)
      const title_public = safeBool1(s.metadata?.title_public)
      const message_public = safeBool1(s.metadata?.message_public)

      const { rowCount } = await client.query(
        `update claims set
           title=$1, message=$2, link_url=$3,
           cert_style=$4, time_display=$5, local_date_only=$6, text_color=$7,
           title_public=$8, message_public=$9
         where ts=$10::timestamptz`,
        [title, message, link_url, cert_style, time_display, local_date_only, text_color, title_public, message_public, tsISO]
      )

      // si la claim n’existe pas (course condition improbable) -> rollback logique
      if (rowCount === 0) {
        await client.query('ROLLBACK')
        return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsISO)}?updated=0`, { status:303 })
      }

          // --- Si style custom & key fournie : persiste le nouveau fond ---
    if (cert_style === 'custom' && custom_bg_key) {
      // mêmes gardes que dans /api/checkout/confirm
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

      // 3) Recalcul cert_hash (avec price_cents & created_at déjà présents)
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
        const cert_url = `/api/cert/${encodeURIComponent(tsISO.slice(0,10))}`
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
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base}/`, { status:302 })
  }
}
