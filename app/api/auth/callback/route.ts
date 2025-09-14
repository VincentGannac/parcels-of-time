export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { writeSessionCookie } from '@/lib/auth'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''
  const next = url.searchParams.get('next') || '/fr/account'

  if (!token) return NextResponse.redirect(next)

  const { rows } = await pool.query(
    `delete from auth_login_tokens
       where token = $1 and expires_at > now()
       returning owner_id, email`,
    [token]
  )
  const row = rows[0]
  if (!row) return NextResponse.redirect(next) // token invalide/expiré → on laisse continuer

  // Récup display_name
  const { rows: o } = await pool.query(`select display_name from owners where id=$1`, [row.owner_id])
  writeSessionCookie({
    ownerId: String(row.owner_id),   // ← string
    email: String(row.email),
    displayName: o[0]?.display_name ?? null,
    iat: Math.floor(Date.now()/1000),
  })
  

  return NextResponse.redirect(next)
}
