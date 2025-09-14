// app/api/auth/request/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'
import { sendLoginCodeEmail } from '@/lib/email' // ajoute un simple template

export async function POST(req: Request) {
  const { email } = await req.json().catch(()=>({}))
  const clean = String(email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean))
    return NextResponse.json({ ok:false, error:'bad_email' }, { status:400 })

  const code = String(Math.floor(100000 + Math.random()*900000)) // 6 chiffres
  const tokenHash = crypto.createHash('sha256')
    .update((process.env.SECRET_SALT || 'salt') + clean + code)
    .digest('hex')

  await pool.query(
    `insert into login_tokens(email, token_hash, expires_at, ip, user_agent)
     values($1,$2, now() + interval '15 minutes', $3, $4)`,
    [clean, tokenHash, (req.headers.get('x-forwarded-for')||'').split(',')[0]||null, req.headers.get('user-agent')||null]
  )

  const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const locale = (req.headers.get('accept-language') || '').toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const magicUrl = `${origin}/${locale}/login?email=${encodeURIComponent(clean)}&code=${encodeURIComponent(code)}`

  await sendLoginCodeEmail({ to: clean, code, magicUrl })

  return NextResponse.json({ ok:true })
}
