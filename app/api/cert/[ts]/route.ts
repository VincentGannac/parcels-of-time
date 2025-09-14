//api/cert/[ts]
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getSessionFromRequest, ownerEmailForDay } from '@/lib/auth'
import { pool } from '@/lib/db'
import { generateCertificatePDF } from '@/lib/cert'
import { Buffer } from 'node:buffer'


 /** Normalise un input JOUR → ISO minuit UTC. Rejette toute heure. */
function toIsoDayUTC(input: string): string | null {
    if (!input) return null
    const s = input.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
    const d = new Date(`${s}T00:00:00.000Z`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

export async function GET(req: Request, ctx: any) {
  // Récup du paramètre dynamique
  const rawParam = Array.isArray(ctx?.params?.ts)
    ? ctx.params.ts.join('/')
    : String(ctx?.params?.ts ?? '')

  const decoded = decodeURIComponent(rawParam)
  const tsISO = toIsoDayUTC(decoded)
  if (!tsISO) {
    return NextResponse.json({ error: 'bad_ts' }, { status: 400 })
  }

  // Jour public ?
  const { rows: pubRows } = await pool.query(
    `select 1 from minute_public where date_trunc('day', ts) = $1::timestamptz limit 1`,
    [tsISO]
  )
  const isDayPublic = pubRows.length > 0
  const isRegistryRender = new URL(req.url).searchParams.get('public') === '1'

  if (!isDayPublic && !isRegistryRender) {
    // contrôle session propriétaire
    const sess = getSessionFromRequest(req)
    const ownerEmail = await ownerEmailForDay(tsISO)
    if (!sess || !ownerEmail || ownerEmail !== sess.email.toLowerCase()) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  // Localisation pour le QR
  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale = accLang.startsWith('fr') ? 'fr' : 'en'
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  // Lecture claim (match EXACT sur la minute normalisée)
  const { rows } = await pool.query(
    `SELECT
       c.id AS claim_id, c.ts, c.title, c.message, c.link_url, c.cert_hash, c.created_at,
       c.cert_style, c.time_display, c.local_date_only, c.text_color,
       o.display_name
     FROM claims c
     JOIN owners o ON o.id = c.owner_id
     WHERE c.ts = $1::timestamptz`,
    [tsISO]
  )

  if (rows.length === 0) {
    // filet de sécurité : on tente un match "minute" même si la précision DB diffère
    const { rows: alt } = await pool.query(
      `SELECT
         c.id AS claim_id, c.ts, c.title, c.message, c.link_url, c.cert_hash, c.created_at,
         c.cert_style, c.time_display, c.local_date_only, c.text_color,
         o.display_name
       FROM claims c
       JOIN owners o ON o.id = c.owner_id
       WHERE date_trunc('day', c.ts) = $1::timestamptz
       LIMIT 1`,
      [tsISO]
    )
    if (alt.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    rows.push(alt[0])
  }

  const row = rows[0]

  // Fond custom éventuel (sur la minute normalisée)
  const { rows: bgRows } = await pool.query(
    'select data_url from claim_custom_bg where ts=$1::timestamptz',
    [tsISO]
  )
  const customBgDataUrl = bgRows[0]?.data_url

  // Mode d’affichage de l’heure (legacy → conservé)
  const td: string = row.time_display || 'local+utc'
  const timeLabelMode =
    td === 'utc+local' ? 'utc_plus_local'
  : td === 'local+utc' ? 'local_plus_utc'
  : 'utc'

  // Options d’affichage (registre public, etc.)
  const url = new URL(req.url)
  const hideQr =
    url.searchParams.has('public') ||
    url.searchParams.get('public') === '1' ||
    url.searchParams.get('hide_qr') === '1'
  const hideMeta =
    url.searchParams.get('hide_meta') === '1' ||
    url.searchParams.has('hide_meta')

  // URL publique (pour le QR) 
  const day = tsISO.slice(0,10)
  const publicUrl = `${base}/${locale}/m/${encodeURIComponent(day)}`

  // Génération PDF
  const pdfBytes = await generateCertificatePDF({
    ts: tsISO, // 👈 toujours la minute UTC normalisée
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
    hideMeta,
  })

  const buf = Buffer.from(pdfBytes)
  const headers: Record<string,string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="cert-${encodeURIComponent(day)}.pdf"`,
    'Vary': 'Accept-Language, Cookie',
  }
  if (isDayPublic || isRegistryRender) {
    headers['Cache-Control'] = 'public, s-maxage=86400, stale-while-revalidate=604800'
  } else {
    headers['Cache-Control'] = 'private, no-store' // pas de cache partagé
  }
  return new Response(buf as unknown as BodyInit, { headers })
}
