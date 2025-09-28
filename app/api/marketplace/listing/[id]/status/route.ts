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

  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  let action = ''
  let locale = 'fr'
  if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
    const form = await req.formData()
    action = String(form.get('action') || '')
    locale = String(form.get('locale') || 'fr')
  } else {
    const body = await req.json().catch(()=>({}))
    action = String((body as any).action || '')
    locale = String((body as any).locale || 'fr')
  }

  if (action !== 'cancel') return NextResponse.json({ error: 'bad_action' }, { status: 400 })

  const { rows } = await pool.query(
    `update listings
        set status = 'canceled', updated_at=now()
      where id = $1
        and seller_owner_id = $2
        and status = 'active'
      returning id, status`,
    [id, sess.ownerId]
  )

  if (!rows.length) {
    // si requête formulaire → redirige avec erreur
    if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
      return NextResponse.redirect(`${base}/${locale}/account?cancel=err`, { status: 303 })
    }
    return NextResponse.json({ error: 'not_allowed' }, { status: 403 })
  }

  // si requête formulaire → redirige vers /account avec un flag
  if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base}/${locale}/account?cancel=ok`, { status: 303 })
  }

  return NextResponse.json({ ok: true, listing: rows[0] })
}
