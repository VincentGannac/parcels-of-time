export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

type Body = { action: 'pause'|'resume'|'cancel' }

export async function POST(req: Request, ctx: any) {
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = Number(ctx.params?.id || 0)
  const body = (await req.json()) as Body

  const allowed = new Set(['pause','resume','cancel'])
  if (!allowed.has(body.action)) return NextResponse.json({ error: 'bad_action' }, { status: 400 })

  const nextStatus = body.action === 'pause' ? 'paused'
                  : body.action === 'resume' ? 'active'
                  : 'cancelled'

  const { rows } = await pool.query(
    `update listings
        set status = $3
      where id = $1
        and seller_owner_id = $2
        and status in ('active','paused')
      returning id, status`,
    [id, sess.ownerId, nextStatus]
  )
  if (!rows.length) return NextResponse.json({ error: 'not_allowed' }, { status: 403 })
  return NextResponse.json({ ok: true, listing: rows[0] })
}
