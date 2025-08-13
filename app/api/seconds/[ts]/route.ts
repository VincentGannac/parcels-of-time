// app/api/seconds/[ts]/route.ts
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { ts: string }

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> }
) {
  const { ts } = await ctx.params
  const tsParam = decodeURIComponent(ts)

  try {
    const { rows } = await pool.query(
      'SELECT * FROM second_public WHERE ts = $1::timestamptz',
      [tsParam]
    )

    if (rows.length === 0) {
      return NextResponse.json({ claimed: false })
    }

    const s = rows[0] as {
      display_name: string | null
      message: string | null
      link_url: string | null
      claimed_at: string | Date | null
      cert_url?: string | null
    }

    return NextResponse.json({
      claimed: true,
      display_name: s.display_name,
      message: s.message,
      link_url: s.link_url,
      claimed_at: s.claimed_at,
      // utilise la colonne de la vue si présente, sinon construit l’URL par défaut
      cert_url: s.cert_url ?? `/api/cert/${encodeURIComponent(tsParam)}`,
    })
  } catch (e: any) {
    console.error('seconds GET error', e?.message || e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
