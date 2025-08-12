import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query('select now() as now');
    return NextResponse.json({ ok: true, now: rows[0].now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
