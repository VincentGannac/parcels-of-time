// api/registry/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import crypto from 'node:crypto';

const ART_SALT = process.env.ART_SALT || 'dev_art_salt';

/** Dérive une palette & une variante à partir d’un hash salé (id, ts). */
function deriveArt(id: string, tsISO: string) {
  const buf = crypto.createHash('sha256').update(`${id}|${tsISO}|${ART_SALT}`).digest();
  // Helpers
  const pick = (i: number, mod: number) => buf[i] % mod;
  const hue = pick(0, 360);
  const shift = 20 + pick(1, 140);     // 20..159
  const angle = pick(2, 360);          // 0..359
  const variant = pick(3, 4);          // 0..3
  // Palette triadique douce
  const c1 = `hsl(${hue},72%,62%)`;
  const c2 = `hsl(${(hue+shift)%360},72%,54%)`;
  const c3 = `hsl(${(hue+180)%360},26%,86%)`;
  return { pal: [c1, c2, c3], angle, variant };
}

/**
 * Query params supportés:
 * - limit (default 24)
 * - cursor (ISO ts)
 * - q : recherche
 * - hasTitle=1 / hasMessage=1
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
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, q);
      where.push(`(title ILIKE $${params.length-3}
               OR message ILIKE $${params.length-2}
               OR to_char(ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ILIKE $${params.length-1}
               OR id::text ILIKE $${params.length} || '%')`);
    }
    if (hasTitle)  where.push(`title IS NOT NULL AND length(trim(title)) > 0`);
    if (hasMessage) where.push(`message IS NOT NULL AND length(trim(message)) > 0`);

    if (cursor) {
      params.push(cursor);
      if (sort === 'new') where.push(`ts < $${params.length}`);
      else                where.push(`ts > $${params.length}`);
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
      items: slice.map((r: any) => {
        const tsISO = (r.ts instanceof Date ? r.ts : new Date(r.ts)).toISOString();
        const art = deriveArt(r.id, tsISO);
        return {
          id: r.id,
          ts: tsISO,
          title: r.title ?? null,
          message: r.message ?? null,
          art, // ← palette & motif dérivés, privacy-safe
        };
      }),
      nextCursor,
    });
  } catch (e: any) {
    console.error('registry_error:', e?.message || e);
    return NextResponse.json({ items: [], nextCursor: null }, { status: 200 });
  }
}
