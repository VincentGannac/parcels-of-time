// app/api/marketplace/listing/[id]/status/route.ts
export const runtime = 'nodejs'

import { NextResponse, NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

async function handle(req: NextRequest, ctx: any) {
  const id = String(ctx?.params?.id || '').trim()
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  const session = await readSession()
  if (!session) {
    // redirige vers login
    const next = req.nextUrl.searchParams.get('next') || '/'
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url))
  }

  // status demandé (par défaut: canceled)
  const nextStatus =
    (req.method === 'POST'
      ? (await req.formData()).get('status')?.toString()
      : req.nextUrl.searchParams.get('status')) || 'canceled'

  if (!['canceled'].includes(nextStatus)) {
    return NextResponse.json({ error: 'unsupported_status' }, { status: 400 })
  }

  // Mise à jour protégée (seul le vendeur peut annuler)
  const { rowCount } = await pool.query(
    `update listings
        set status = 'canceled'
      where id = $1::bigint
        and seller_owner_id = $2
        and status = 'active'`,
    [id, session.ownerId]
  )

  const nextUrl =
    (req.method === 'POST'
      ? (await req.formData()).get('next')?.toString()
      : req.nextUrl.searchParams.get('next')) || `/${(req.nextUrl.pathname.split('/')[1] || 'en')}/account`

  // Si pas modifié (0), on redirige quand même
  return NextResponse.redirect(new URL(nextUrl, req.url))
}

export const GET  = handle
export const POST = handle
