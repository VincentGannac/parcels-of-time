// lib/auth_magic.ts (petit helper)
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

export async function createMagicLoginLink({
  email,
  nextPath,
  locale = 'en',
  ttlMinutes = 15,
}: {
  email: string
  nextPath: string
  locale?: 'fr'|'en'
  ttlMinutes?: number
}) {
  const clean = email.trim().toLowerCase()
  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 chiffres
  const tokenHash = crypto
    .createHash('sha256')
    .update((process.env.SECRET_SALT || 'salt') + clean + code)
    .digest('hex')

  await pool.query(
    `insert into login_tokens(email, token_hash, expires_at)
     values ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [clean, tokenHash, String(ttlMinutes)]
  )

  const base =
    process.env.NEXT_PUBLIC_BASE_URL || 'https://www.parcelsoftime.com'
  const search = new URLSearchParams({
    email: clean,
    code,
    next: nextPath,
  }).toString()
  return `${base}/${locale}/login?${search}`
}
