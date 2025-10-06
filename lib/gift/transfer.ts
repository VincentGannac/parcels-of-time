// lib/gift/transfer.ts
import crypto from 'node:crypto'
import { pool } from '@/lib/db'

const sha256hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode5(): string {
  const bytes = crypto.randomBytes(5)
  let code = ''
  for (let i = 0; i < 5; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

/** Crée/remplace le jeton ACTIF (révoque l’éventuel précédent non utilisé) */
export async function createTransferTokenForClaim(claimId: string) {
  const code = randomCode5() // déjà uppercase
  const codeHash = sha256hex(code)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `update claim_transfer_tokens
          set is_revoked = true
        where claim_id=$1 and used_at is null and is_revoked=false`,
      [claimId]
    )
    await client.query(
      `insert into claim_transfer_tokens(claim_id, code_hash) values ($1,$2)`,
      [claimId, codeHash]
    )
    await client.query('COMMIT')
    return { code }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally {
    client.release()
  }
}

/** (Optionnel) Vérifie + consomme atomiquement un token pour un claim */
export async function verifyAndConsumeTransferToken(claimId: string, code5: string) {
  const code = String(code5 || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{5}$/.test(code)) return { ok: false as const, reason: 'bad_code' }
  const codeHash = sha256hex(code)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `select id, is_revoked, used_at
         from claim_transfer_tokens
        where claim_id=$1 and code_hash=$2
        for update`,
      [claimId, codeHash]
    )
    if (!rows.length) {
      await client.query('ROLLBACK')
      return { ok: false as const, reason: 'invalid_code' }
    }
    const t = rows[0]
    if (t.is_revoked) {
      await client.query('ROLLBACK')
      return { ok: false as const, reason: 'code_revoked' }
    }
    if (t.used_at) {
      await client.query('ROLLBACK')
      return { ok: false as const, reason: 'code_used' }
    }
    await client.query(`update claim_transfer_tokens set used_at=now() where id=$1`, [t.id])
    await client.query('COMMIT')
    return { ok: true as const }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally {
    client.release()
  }
}
