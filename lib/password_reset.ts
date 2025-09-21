// lib/password_reset.ts
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

function randomToken(len = 32) {
  return crypto.randomBytes(len).toString('base64url')
}
function sha256hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export type ResetRecord = {
  token: string
  expiresAt: Date
}

export async function createPasswordReset(ownerId: string, ttlMinutes = 30): Promise<ResetRecord> {
  const token = randomToken(32)
  const tokenHash = sha256hex(token)
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
  await pool.query(
    `insert into password_resets (token_hash, owner_id, expires_at)
     values ($1, $2, $3)`,
    [tokenHash, ownerId, expiresAt]
  )
  return { token, expiresAt }
}

/** Consomme le token (one-time). Retourne l’owner_id ou null. */
export async function consumePasswordReset(rawToken: string): Promise<string | null> {
  const tokenHash = sha256hex(rawToken)
  const { rows } = await pool.query(
    `update password_resets
       set used_at = now()
     where token_hash = $1
       and used_at is null
       and expires_at > now()
     returning owner_id`,
    [tokenHash]
  )
  return rows?.[0]?.owner_id ? String(rows[0].owner_id) : null
}
