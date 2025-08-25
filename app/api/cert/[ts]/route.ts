// app/api/cert/[ts]/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { generateCertificatePDF } from '@/lib/cert'
import { Buffer } from 'node:buffer'

export async function GET(req: Request, ctx: any) {
  const tsParam = ctx?.params?.ts ?? ''
  const decodedTs = decodeURIComponent(String(tsParam))

  const url = new URL(req.url)
  const hideQr =
    url.searchParams.has('public') ||
    url.searchParams.get('public') === '1' ||
    url.searchParams.get('hide_qr') === '1'

  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale = accLang.startsWith('fr') ? 'fr' : 'en'

  const { rows } = await pool.query(
    `SELECT
       c.id AS claim_id, c.ts, c.title, c.message, c.link_url, c.cert_hash, c.created_at, c.cert_style,
       c.time_display, c.local_date_only, c.text_color,
       o.display_name
     FROM claims c
     JOIN owners o ON o.id = c.owner_id
     WHERE c.ts = $1::timestamptz`,
    [decodedTs]
  )
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const row = rows[0]
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const publicUrl = `${base}/${locale}/m/${encodeURIComponent(decodedTs)}`

  const { rows: bgRows } = await pool.query(
    'select data_url from claim_custom_bg where ts=$1::timestamptz',
    [decodedTs]
  )
  const customBgDataUrl = bgRows[0]?.data_url

  const td: string = row.time_display || 'local+utc'
  const timeLabelMode =
    td === 'utc+local' ? 'utc_plus_local'
  : td === 'local+utc' ? 'local_plus_utc'
  : 'utc'

  const pdfBytes = await generateCertificatePDF({
    ts: row.ts.toISOString(),
    display_name: row.display_name || (locale === 'fr' ? 'Anonyme' : 'Anonymous'),
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
  })

  const buf = Buffer.from(pdfBytes)
  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cert-${encodeURIComponent(decodedTs)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
