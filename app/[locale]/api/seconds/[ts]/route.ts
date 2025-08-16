export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ts = url.pathname.split('/').pop() || '';
  return NextResponse.redirect(new URL(`/api/minutes/${encodeURIComponent(ts)}`, url).toString(), { status: 308 });
}
