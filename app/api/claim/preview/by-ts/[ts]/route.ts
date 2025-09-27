//app/api/claim/preview/by-ts/[ts]/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

function normIsoDay(s:string){
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0)
  return d.toISOString()
}

export async function GET(_req: Request, ctx: any){
  const raw = String(ctx.params?.ts || '')
  const iso = normIsoDay(decodeURIComponent(raw))
  if (!iso) return NextResponse.json({ error:'bad_ts' }, { status:400 })

  const { rows } = await pool.query(
    `select c.title, c.message, c.link_url, c.cert_style, c.time_display,
            c.local_date_only, c.text_color, c.title_public, c.message_public,
            o.display_name
       from claims c
       left join owners o on o.id = c.owner_id
      where date_trunc('day', c.ts) = $1::timestamptz
      limit 1`,
    [iso]
  )
  if (!rows.length) return NextResponse.json({ claim:null })

  const claim = rows[0]

  let custom_bg_data_url: string | null = null
  try {
    const { rows: bg } = await pool.query(
      `select data_url from claim_custom_bg where ts=$1::timestamptz limit 1`,
      [iso]
    )
    custom_bg_data_url = bg[0]?.data_url || null
  } catch {}

  return NextResponse.json({
    claim: {
      display_name: claim.display_name || '',
      title:        claim.title || '',
      message:      claim.message || '',
      link_url:     claim.link_url || '',
      cert_style:   claim.cert_style || 'neutral',
      time_display: claim.time_display || 'local+utc',
      local_date_only: !!claim.local_date_only,
      text_color:   claim.text_color || '#1a1f2a',
      title_public: !!claim.title_public,
      message_public: !!claim.message_public,
    },
    custom_bg_data_url,
  })
}
