export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { generateCertificatePDF } from '@/lib/cert'
import { Buffer } from 'node:buffer'

function toIsoDayUTC(input: string): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(req: Request, ctx: any) {
  const rawParam = Array.isArray(ctx?.params?.ts) ? ctx.params.ts.join('/') : String(ctx?.params?.ts ?? '')
  const decoded = decodeURIComponent(rawParam)
  const dayISO = toIsoDayUTC(decoded)
  if (!dayISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale = accLang.startsWith('fr') ? 'fr' : 'en'
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  // On récupère la claim du jour (la plus récente si plusieurs)
  const { rows } = await pool.query(
    `SELECT
       c.id AS claim_id, c.ts, c.title, c.message, c.link_url, c.cert_hash, c.created_at,
       c.cert_style, c.time_display, c.local_date_only, c.text_color,
       o.display_name
     FROM claims c
     JOIN owners o ON o.id = c.owner_id
     WHERE date_trunc('day', c.ts) = $1::timestamptz
     ORDER BY c.ts DESC
     LIMIT 1`,
    [dayISO]
  )
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const row = rows[0]

  // fond custom attaché à CETTE claim exacte
  const { rows: bgRows } = await pool.query(
    'select data_url from claim_custom_bg where ts=$1::timestamptz',
    [row.ts]
  )
  const customBgDataUrl = bgRows[0]?.data_url

  const td: string = row.time_display || 'local+utc'
  const timeLabelMode =
    td === 'utc+local' ? 'utc_plus_local'
  : td === 'local+utc' ? 'local_plus_utc'
  : 'utc'

  const url = new URL(req.url)
  const hideQr =
    url.searchParams.has('public') ||
    url.searchParams.get('public') === '1' ||
    url.searchParams.get('hide_qr') === '1'
  const hideMeta =
    url.searchParams.get('hide_meta') === '1' ||
    url.searchParams.has('hide_meta')

  // URL publique pour le QR (basée sur le JOUR)
  const publicUrl = `${base}/${locale}/m/${encodeURIComponent(dayISO)}`

  const pdfBytes = await generateCertificatePDF({
    ts: dayISO, // 👈 le PDF affiche AAAA-MM-JJ via ymdFromUTC()
    display_name: row.display_name || '',
    title: row.title,
    message: row.message,
    link_url: row.link_url,
    claim_id: row.claim_id,
    hash: row.cert_hash || 'no-hash',
    public_url: publicUrl,
    style: row.cert_style || 'neutral',
    customBgDataUrl,
    locale,
    timeLabelMode: timeLabelMode as any,
    localDateOnly: !!row.local_date_only,
    textColorHex: (row.text_color || '#1a1f2a'),
    hideQr,
    hideMeta,
  })

  const buf = Buffer.from(pdfBytes)
  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cert-${encodeURIComponent(dayISO.slice(0,10))}.pdf"`,
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'Vary': 'Accept-Language',
    },
  })
}
