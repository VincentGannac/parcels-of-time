// api/minutes/[ts]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type Params = { ts: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { ts } = await ctx.params;
  const decodedTs = decodeURIComponent(ts);

  const { rows } = await pool.query(
    `SELECT id, ts, title, message
       FROM minute_public
      WHERE ts = $1::timestamptz`,
    [decodedTs]
  );

  if (rows.length === 0) {
    return NextResponse.json({ found: false });
  }

  const r = rows[0];
  return NextResponse.json({
    found: true,
    id: r.id,
    ts: r.ts,
    title: r.title,
    message: r.message,
  });
}
