export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'
import { getAuthOwnerId } from '@/lib/auth'
import { ClaimTransferRequestSchema, ClaimTransferResponseSchema } from '@/lib/schemas/gift'

const sha256hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

export async function POST(req: Request) {
  try {
    const meOwnerId = await getAuthOwnerId(req)
    if (!meOwnerId) {
      return NextResponse.json(
        { ok:false, code:'unauthorized', message:'Login required' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => null)
    const parsed = ClaimTransferRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok:false, code:'server_error', message:'Bad payload' },
        { status: 400 }
      )
    }
    const { claim_id, cert_hash, code, locale } = parsed.data
    const codeHash = sha256hex(code.trim().toUpperCase())

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1) Lock claim
      const { rows: claims } = await client.query(
        `select id, owner_id, cert_hash, ts
           from claims
          where id = $1 and cert_hash = $2
          for update`,
        [claim_id, cert_hash]
      )
      const claim = claims[0]
      if (!claim) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { ok:false, code:'not_found', message:'Certificate not found' },
          { status: 404 }
        )
      }

      // 2) Lock token
      const { rows: tokens } = await client.query(
        `select id, used_at, is_revoked
           from claim_transfer_tokens
          where claim_id = $1 and code_hash = $2
          for update`,
        [claim.id, codeHash]
      )
      const token = tokens[0]
      if (!token) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { ok:false, code:'invalid_code', message:'Invalid transfer code' },
          { status: 400 }
        )
      }
      if (token.is_revoked) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { ok:false, code:'revoked', message:'Transfer code revoked' },
          { status: 403 }
        )
      }
      if (token.used_at) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { ok:false, code:'already_used', message:'Transfer code already used' },
          { status: 409 }
        )
      }

      const fromOwnerId = String(claim.owner_id)
      const toOwnerId   = String(meOwnerId)

      // 3) Transfert (si pas déjà le propriétaire)
      if (fromOwnerId !== toOwnerId) {
        await client.query(
          `update claims set owner_id = $1 where id = $2`,
          [toOwnerId, claim.id]
        )

        // 3.b Annuler une annonce active éventuelle
        await client.query(
          `update listings
              set status = 'canceled'
            where ts = $1::timestamptz
              and status = 'active'`,
          [claim.ts]
        )
      }

      // 4) Marquer token utilisé + journal
      await client.query(
        `update claim_transfer_tokens
            set used_at = now(), used_by_owner_id = $1
          where id = $2`,
        [toOwnerId, token.id]
      )
      await client.query(
        `insert into claim_transfers
           (claim_id, from_owner_id, to_owner_id, token_id, ip, ua)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          claim.id,
          fromOwnerId,
          toOwnerId,
          token.id,
          (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || null,
          req.headers.get('user-agent') || null
        ]
      )

      await client.query('COMMIT')

      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
      const accountUrl = `${base}/${locale || 'en'}/account`
      const payload = { ok: true as const, account_url: accountUrl }
      const out = ClaimTransferResponseSchema.parse(payload)
      return NextResponse.json(out)
    } catch (e) {
      try { await pool.query('ROLLBACK') } catch {}
      return NextResponse.json(
        { ok:false, code:'server_error', message:'Server error' },
        { status: 500 }
      )
    } finally {
      client.release()
    }
  } catch {
    return NextResponse.json(
      { ok:false, code:'server_error', message:'Server error' },
      { status: 500 }
    )
  }
}
