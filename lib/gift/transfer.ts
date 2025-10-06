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
  const code = randomCode5()
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
