//app/api/marketplace/listing/[id]/status/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

type Body = { action: 'cancel' }

export async function POST(req: Request, ctx: any) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = Number(ctx.params?.id || 0)
  const body = await req.json().catch(()=>({})) as Body
  if (body.action !== 'cancel') return NextResponse.json({ error: 'bad_action' }, { status: 400 })

  const { rows } = await pool.query(
    `update listings
        set status = 'canceled', updated_at=now()
      where id = $1
        and seller_owner_id = $2
        and status = 'active'
      returning id, status`,
    [id, sess.ownerId]
  )
  if (!rows.length) return NextResponse.json({ error: 'not_allowed' }, { status: 403 })
  return NextResponse.json({ ok: true, listing: rows[0] })
}
