// app/api/minutes/[ts]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(_req: Request, ctx: { params: Promise<{ ts: string }> }) {
  const { ts } = await ctx.params;
  const decodedTs = decodeURIComponent(ts);

  // 1) Vue minute_public si dispo
  try {
    const { rows } = await pool.query(
      `select id, ts, title, message
         from minute_public
        where ts = $1::timestamptz`,
      [decodedTs]
    );

    if (rows.length === 0) return NextResponse.json({ found: false });
    const r = rows[0];
    return NextResponse.json({
      found: true,
      id: String(r.id),
      ts: new Date(r.ts).toISOString(),
      title: r.title ?? null,
      message: r.message ?? null,
    });
  } catch (e) {
    // 2) Fallback si la vue n’existe pas
    try {
      const { rows } = await pool.query(
        `select c.id, c.ts,
                case when c.title_public   then c.title   else null end as title,
                case when c.message_public then c.message else null end as message
           from claims c
          where c.ts = $1::timestamptz`,
        [decodedTs]
      );

      if (rows.length === 0) return NextResponse.json({ found: false });
      const r = rows[0];
      return NextResponse.json({
        found: true,
        id: String(r.id),
        ts: new Date(r.ts).toISOString(),
        title: r.title,
        message: r.message,
      });
    } catch (err2) {
      console.error(
        'api/minutes error:',
        (e as any)?.message || e,
        'fallback:',
        (err2 as any)?.message || err2
      );
      // On ne casse pas la page publique
      return NextResponse.json({ found: false }, { status: 200 });
    }
  }
}
