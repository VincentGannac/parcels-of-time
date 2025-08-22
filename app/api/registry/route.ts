export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * Query params supportés:
 * - limit (default 24)
 * - cursor (ISO ts) : pagination
 * - q : recherche (title/message/ts/id)
 * - hasTitle=1 / hasMessage=1 : filtres
 * - sort=new|old (default new)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '24', 10) || 24, 1), 100);
    const cursor = url.searchParams.get('cursor') || null;
    const q = (url.searchParams.get('q') || '').trim();
    const hasTitle = url.searchParams.get('hasTitle') === '1';
    const hasMessage = url.searchParams.get('hasMessage') === '1';
    const sort = (url.searchParams.get('sort') === 'old') ? 'old' : 'new';

    const where: string[] = [];
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, q); // title, message, ts::text, id::text (prefix)
      where.push(`(title ILIKE $${params.length-3} OR message ILIKE $${params.length-2} OR to_char(ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ILIKE $${params.length-1} OR id::text ILIKE $${params.length} || '%')`);
    }
    if (hasTitle)  where.push(`title IS NOT NULL AND length(trim(title)) > 0`);
    if (hasMessage) where.push(`message IS NOT NULL AND length(trim(message)) > 0`);

    if (cursor) {
      params.push(cursor);
      if (sort === 'new') where.push(`ts < $${params.length}`); // pagination descendante
      else                where.push(`ts > $${params.length}`); // pagination ascendante
    }

    const order = (sort === 'new') ? 'ORDER BY ts DESC' : 'ORDER BY ts ASC';
    const sql = `
      SELECT id::text, ts, title, message
      FROM public.minute_public
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ${order}
      LIMIT ${limit + 1}
    `;

    const { rows } = await pool.query(sql, params);
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore ? slice[slice.length - 1].ts.toISOString() : null;

    return NextResponse.json({
      items: slice.map((r: any) => ({
        id: r.id,
        ts: (r.ts instanceof Date ? r.ts : new Date(r.ts)).toISOString(),
        title: r.title ?? null,
        message: r.message ?? null,
      })),
      nextCursor,
    });
  } catch (e: any) {
    console.error('registry_error:', e?.message || e);
    // Ne casse pas l’UI (la page gère ce cas)
    return NextResponse.json({ items: [], nextCursor: null }, { status: 200 });
  }
}
