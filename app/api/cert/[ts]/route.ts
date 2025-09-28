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

export async function GET(req: Request, ctx: any) {
  // Param dynamique : "YYYY-MM-DD" (ignore le suffixe après un point)
  const rawParam = String(ctx?.params?.ts || '')
  const decoded = decodeURIComponent(rawParam).split('.')[0]
  const tsISO = normIsoDay(decoded)
  if (!tsISO) {
    return NextResponse.json({ error: 'bad_ts' }, { status: 400 })
  }

  try {
    // Locale (QR/public URL)
    const accLang = (req.headers.get('accept-language') || '').toLowerCase()
    const locale: 'fr' | 'en' = accLang.startsWith('fr') ? 'fr' : 'en'
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

    // Claim le plus récent pour ce jour
    const { rows } = await pool.query(
      `
      select
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
        o.display_name
      from claims c
      join owners o on o.id = c.owner_id
      where date_trunc('day', c.ts) = $1::timestamptz
      order by c.ts desc
      limit 1
      `,
      [tsISO]
    )
    if (!rows.length) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const claim = rows[0]

    // Fond custom STRICTEMENT lié à ce ts (pas de fallback par jour)
    let customBgDataUrl: string | undefined
    if (String(claim.cert_style || '').toLowerCase() === 'custom') {
      const { rows: bgRows } = await pool.query(
        `select data_url from claim_custom_bg where ts = $1::timestamptz limit 1`,
        [tsISO]
      )
      if (bgRows[0]?.data_url) {
        customBgDataUrl = String(bgRows[0].data_url)
      }
    }

    // Options d’affichage (ex: /api/cert/2024-01-01?public=1&hide_meta=1)
    const url = new URL(req.url)
    const hideQr =
      url.searchParams.has('public') ||
      url.searchParams.get('public') === '1' ||
      url.searchParams.get('hide_qr') === '1'
    const hideMeta =
      url.searchParams.get('hide_meta') === '1' ||
      url.searchParams.has('hide_meta')

    // URL publique
    const publicUrl = `${base}/${locale}/m/${encodeURIComponent(tsISO)}`

    // Génération PDF (interface legacy)
    const pdfBytes = await generateCertificatePDF({
      ts: tsISO,
      display_name: claim.display_name || (locale === 'fr' ? 'Anonyme' : 'Anonymous'),
      title: claim.title,
      message: claim.message,
      link_url: claim.link_url || '',
      claim_id: String(claim.claim_id),
      hash: claim.cert_hash || 'no-hash',
      public_url: publicUrl,
      style: claim.cert_style || 'neutral',
      locale,
      timeLabelMode: toTimeLabelMode(claim.time_display) as any, // compat
      localDateOnly: !!claim.local_date_only,
      textColorHex: claim.text_color || '#1a1f2a',
      customBgDataUrl, // ← lié exactement à ce ts
      hideQr,
      hideMeta,
    })

    const buf = Buffer.from(pdfBytes)
    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0, 10))}.pdf"`,
        'Cache-Control': 'no-store',
        'Vary': 'Accept-Language',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
