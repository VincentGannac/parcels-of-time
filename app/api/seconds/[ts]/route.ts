import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

type Params = { ts: string }

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> }
) {
  const { ts } = await ctx.params;     // 👈 on attend params
  const tsParam = decodeURIComponent(ts);

  try {
    const { rows } = await pool.query(
      'SELECT * FROM second_public WHERE ts = $1::timestamptz',
      [tsParam]
    );
    if (rows.length === 0) return NextResponse.json({ claimed: false });
    const s = rows[0];
    return NextResponse.json({
      claimed: true,
      display_name: s.display_name,
      message: s.message,
      link_url: s.link_url,
      claimed_at: s.claimed_at,
    });
  } catch (e: any) {
    console.error('seconds GET error', e?.message || e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
