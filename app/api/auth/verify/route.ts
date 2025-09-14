// app/api/auth/verify/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'
import { setSession } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, code } = await req.json().catch(()=>({}))
  const clean = String(email || '').trim().toLowerCase()
  const c = String(code || '').replace(/\D/g, '')
  if (!clean || c.length < 4) return NextResponse.json({ ok:false, error:'bad_input' }, { status:400 })

  const tokenHash = crypto.createHash('sha256')
    .update((process.env.SECRET_SALT || 'salt') + clean + c)
    .digest('hex')

  const { rows } = await pool.query(
    `select id from login_tokens
      where email=$1 and token_hash=$2 and used_at is null and expires_at > now()
      order by created_at desc
      limit 1`,
    [clean, tokenHash]
  )
  if (!rows.length) return NextResponse.json({ ok:false, error:'invalid_code' }, { status:401 })

  await pool.query(`update login_tokens set used_at = now() where id = $1`, [rows[0].id])
  setSession(clean, 30)

  return NextResponse.json({ ok:true })
}
