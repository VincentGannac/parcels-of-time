// app/api/_diag/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'
import { debugSessionSnapshot } from '@/lib/auth'

export async function GET() {
  const h = await headers()
  const ck = await cookies() // <-- await obligatoire en Next 15
  const diag = await debugSessionSnapshot()

  // Typage explicite pour éviter "implicit any"
  const cookieStoreKeys = ck.getAll().map((c: { name: string }) => c.name)

  return NextResponse.json({
    host:  h.get('host') ?? '',
    xfh:   h.get('x-forwarded-host') ?? '',
    proto: h.get('x-forwarded-proto') ?? '',
    cookieHeader: h.get('cookie') ?? h.get('Cookie') ?? '',
    cookieStoreKeys,
    debug: diag,
  })
}
