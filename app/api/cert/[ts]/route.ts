// app/api/cert/[ts]/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { generateCertificatePDF } from '@/lib/cert'
import { Buffer } from 'node:buffer'

/** Normalise en ISO jour UTC : 'YYYY-MM-DDT00:00:00.000Z' */
function normIsoDay(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Map legacy time_display -> timeLabelMode (conservé pour compat) */
function toTimeLabelMode(td?: string) {
  const v = String(td || 'local+utc')
  if (v === 'utc+local') return 'utc_plus_local'
  if (v === 'local+utc') return 'local_plus_utc'
  return 'utc'
}

export async function GET(req: Request, ctx: { params: { ts: string } }) {
  // Param dynamique : accepte "YYYY-MM-DD" (évent. suffixe ".xxx")
  const rawParam = String(ctx?.params?.ts || '')
  const decoded = decodeURIComponent(rawParam).split('.')[0] // retire éventuel suffixe
  const tsISO = normIsoDay(decoded)
  if (!tsISO) {
    return NextResponse.json({ error: 'bad_ts' }, { status: 400 })
  }

  // Locale (QR/public URL)
  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale: 'fr' | 'en' = accLang.startsWith('fr') ? 'fr' : 'en'
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  // Lecture claim (clé = JOUR UTC)
  const { rows } = await pool.query(
    `select
       c.id as claim_id,
       c.ts,
       c.title,
       c.message,
       c.link_url,
       c.cert_hash,
       c.cert_style,
       c.time_display,
       c.local_date_only,
       c.text_color,
       o.display_name,
       bg.data_url as custom_bg
     from claims c
     join owners o on o.id = c.owner_id
     left join claim_custom_bg bg on date_trunc('day', c.ts) = date_trunc('day', bg.ts)
     where date_trunc('day', c.ts) = $1::timestamptz
     limit 1`,
    [tsISO]
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const row = rows[0]

  // Options d’affichage (ex: /api/cert/2024-01-01?public=1&hide_meta=1)
  const url = new URL(req.url)
  const hideQr =
    url.searchParams.has('public') ||
    url.searchParams.get('public') === '1' ||
    url.searchParams.get('hide_qr') === '1'
  const hideMeta =
    url.searchParams.get('hide_meta') === '1' ||
    url.searchParams.has('hide_meta')

  // URL publique (basée sur le JOUR normalisé)
  const publicUrl = `${base}/${locale}/m/${encodeURIComponent(tsISO)}`

  // Génération PDF (les valeurs reflètent la DB -> donc les modifs post-vente)
  const pdfBytes = await generateCertificatePDF({
    ts: tsISO, // jour UTC normalisé
    display_name: row.display_name || (locale === 'fr' ? 'Anonyme' : 'Anonymous'),
    title: row.title,
    message: row.message,
    link_url: row.link_url, // conservé pour compat BDD (non rendu)
    claim_id: String(row.claim_id),
    hash: row.cert_hash || 'no-hash',
    public_url: publicUrl,
    style: row.cert_style || 'neutral',
    locale,
    timeLabelMode: toTimeLabelMode(row.time_display) as any, // ignoré mais conservé
    localDateOnly: !!row.local_date_only,
    textColorHex: row.text_color || '#1a1f2a',
    customBgDataUrl:
      String(row.cert_style || '').toLowerCase() === 'custom' ? row.custom_bg : undefined,
    hideQr,
    hideMeta,
  })

  const buf = Buffer.from(pdfBytes)
  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0,10))}.pdf"`,
      // le PDF d’un jour donné est stable : cache public agressif côté CDN
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'Vary': 'Accept-Language',
    },
  })
}
