// app/api/_diag/route.ts
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  return NextResponse.json({
    host: req.headers.get('host') || '',
    cookieHeader: req.headers.get('cookie') || '',
    hasPotSess: (req.headers.get('cookie') || '').includes('pot_sess='),
    url: url.pathname + url.search,
  })
}
