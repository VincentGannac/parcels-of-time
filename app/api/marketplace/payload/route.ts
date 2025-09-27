// app/api/marketplace/payload/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

type Body = {
  display_name?: string
  title?: string
  message?: string
  link_url?: string
  cert_style?: string
  custom_bg_data_url?: string
  time_display?: 'utc'|'utc+local'|'local+utc'
  local_date_only?: boolean
  text_color?: string
  title_public?: boolean
  message_public?: boolean
  public_registry?: boolean
  locale?: 'fr'|'en'
}

export async function POST(req: Request){
  try {
    const body = await req.json() as Body

    // stash payload JSON
    const payload_key = `pl_${crypto.randomUUID()}`
    const data = {
      display_name: body.display_name ?? '',
      title: body.title ?? '',
      message: body.message ?? '',
      link_url: body.link_url ?? '',
      cert_style: (body.cert_style || 'neutral').toLowerCase(),
      time_display: (body.time_display || 'local+utc'),
      local_date_only: !!body.local_date_only,
      text_color: (/^#[0-9a-f]{6}$/i.test(body.text_color||'') ? String(body.text_color).toLowerCase() : '#1a1f2a'),
      title_public: !!body.title_public,
      message_public: !!body.message_public,
      public_registry: !!body.public_registry,
      locale: (body.locale==='en'?'en':'fr'),
    }
    await pool.query(
      `insert into checkout_payload_temp(key, kind, data)
       values ($1, 'secondary', $2::jsonb)
       on conflict (key) do update set data = excluded.data, created_at = now()`,
      [payload_key, JSON.stringify(data)]
    )

    // stash image éventuelle → custom_bg_temp
    let custom_bg_key = ''
    if (data.cert_style === 'custom' && body.custom_bg_data_url) {
      const ok = /^data:image\/(png|jpe?g);base64,/.test(body.custom_bg_data_url)
      if (!ok) return NextResponse.json({ error:'custom_bg_invalid' }, { status:400 })
      custom_bg_key = `cbg_${crypto.randomUUID()}`
      await pool.query(
        `insert into custom_bg_temp(key, data_url)
         values ($1,$2)
         on conflict (key) do update set data_url = excluded.data_url, created_at = now()`,
        [custom_bg_key, body.custom_bg_data_url]
      )
    }

    return NextResponse.json({ payload_key, custom_bg_key: custom_bg_key || undefined })
  } catch (e:any) {
    console.error('[mk/payload] err:', e?.message||e)
    return NextResponse.json({ error:'server_error' }, { status:500 })
  }
}
