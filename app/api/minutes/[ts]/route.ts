// api/minutes/[ts]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';


type Params = { ts: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { ts } = await ctx.params;
  const decodedTs = decodeURIComponent(ts);

  const { rows } = await pool.query(
    `SELECT c.ts, o.display_name, c.title, c.message, c.link_url, c.created_at AS claimed_at, c.cert_url
     FROM claims c
     JOIN owners o ON o.id = c.owner_id
     WHERE c.ts = $1::timestamptz`,
    [decodedTs]
  );

  if (rows.length === 0) return NextResponse.json({ claimed: false });

  const r = rows[0];
  return NextResponse.json({
    claimed: true,
    display_name: r.display_name,
    title: r.title,
    message: r.message,
    link_url: r.link_url,
    claimed_at: r.claimed_at,
    cert_url: r.cert_url,
  });
}
