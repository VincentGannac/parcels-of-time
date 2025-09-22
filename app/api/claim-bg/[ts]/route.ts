// app/api/claim-bg/[ts]/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

function toIsoMinuteUTC(input: string): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`)
    return isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, '.000Z')
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    const d = new Date(`${s}:00.000Z`)
    return isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, '.000Z')
  }
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCSeconds(0,0)
  return d.toISOString()
}

function parseDataUrl(u: string | null) {
  if (!u) return null
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(u)
  if (!m) return null
  const kind = m[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg'
  const bytes = Buffer.from(m[2], 'base64')
  return { bytes, contentType: kind }
}

export async function GET(_: Request, ctx: any) {
  const raw = Array.isArray(ctx?.params?.ts) ? ctx.params.ts[0] : String(ctx?.params?.ts || '')
  const decoded = decodeURIComponent(raw)
  const tsISO = toIsoMinuteUTC(decoded)
  if (!tsISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  // essaie match exact, puis fallback sur la minute
  let row
  {
    const { rows } = await pool.query('select data_url from claim_custom_bg where ts=$1::timestamptz limit 1', [tsISO])
    row = rows[0]
  }
  if (!row) {
    const { rows } = await pool.query(
      'select data_url from claim_custom_bg where date_trunc(\'minute\', ts) = $1::timestamptz limit 1',
      [tsISO]
    )
    row = rows[0]
  }
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const parsed = parseDataUrl(row.data_url)
  if (!parsed) return NextResponse.json({ error: 'bad_data_url' }, { status: 500 })

  return new Response(parsed.bytes, {
    headers: {
      'Content-Type': parsed.contentType,
      // Cache agressif : l’image est liée à une minute immuable (si remplacée, une nouvelle édition changera l’URL de PDF ; ici c’est ok d’avoir 1j de cache)
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    }
  })
}
