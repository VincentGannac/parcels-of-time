// app/api/health/db/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const { rows: version } = await client.query('select version()');
      const { rows: cols } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='claims'
        ORDER BY column_name
      `);
      return NextResponse.json({
        ok: true,
        pg_version: version?.[0]?.version ?? null,
        claims_columns: cols.map(c => c.column_name),
      });
    } finally {
      client.release();
    }
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'db_error' }, { status: 500 });
  }
}
