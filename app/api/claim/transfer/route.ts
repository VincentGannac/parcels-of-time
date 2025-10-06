// app/api/claim/transfer/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth'

function sha256hex(s: string) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}

function isUuid(s: string) {
  return /^[0-9a-fA-F-]{36}$/.test(s || '')
}
function isHex64(s: string) {
  return /^[0-9a-f]{64}$/.test((s || '').toLowerCase())
}
function normCode5(s: string) {
  const x = String(s || '').trim().toUpperCase()
  return /^[A-Z0-9]{5}$/.test(x) ? x : null
}

async function hasColumn(client: any, table: string, col: string) {
  const { rows } = await client.query(
    `select 1
       from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2
      limit 1`,
    [table, col]
  )
  return !!rows.length
}

export async function POST(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin

  // Auth: le receveur doit être connecté
  const sess = await readSession()
  if (!sess?.ownerId) {
    return NextResponse.json({ ok: false, message: 'auth_required' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'bad_payload' }, { status: 400 })
  }

  const claimId = String(body?.claim_id || '').trim()
  const certHash = String(body?.cert_hash || '').trim().toLowerCase()
  const locale = (String(body?.locale || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
  const code = normCode5(String(body?.code || ''))

  if (!isUuid(claimId) || !isHex64(certHash) || !code) {
    return NextResponse.json({ ok: false, message: 'bad_input' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1) Vérifie le claim + hash
    const { rows: crows } = await client.query(
      `select id, owner_id, cert_hash from claims where id=$1 limit 1`,
      [claimId]
    )
    if (!crows.length) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: 'claim_not_found' }, { status: 404 })
    }
    const dbHash = String(crows[0].cert_hash || '').toLowerCase()
    if (dbHash !== certHash) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: 'hash_mismatch' }, { status: 400 })
    }

    // 2) Vérifie le token actif (non révoqué, non utilisé) et verrouille la ligne
    const codeHash = sha256hex(code)
    const { rows: toks } = await client.query(
      `select id, used_at, is_revoked
         from claim_transfer_tokens
        where claim_id=$1 and code_hash=$2
        for update`,
      [claimId, codeHash]
    )
    if (!toks.length) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: 'invalid_code' }, { status: 400 })
    }
    const tok = toks[0]
    if (tok.is_revoked) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: 'code_revoked' }, { status: 400 })
    }
    if (tok.used_at) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: 'code_used' }, { status: 400 })
    }

    // 3) Consomme le token
    await client.query(
      `update claim_transfer_tokens set used_at=now() where id=$1`,
      [tok.id]
    )

    // 4) Transfert de propriété au receveur connecté
    const hasUpdatedAt = await hasColumn(client, 'claims', 'updated_at')
    if (hasUpdatedAt) {
      await client.query(
        `update claims set owner_id=$1, updated_at=now() where id=$2`,
        [sess.ownerId, claimId]
      )
    } else {
      await client.query(
        `update claims set owner_id=$1 where id=$2`,
        [sess.ownerId, claimId]
      )
    }

    await client.query('COMMIT')

    const accountUrl = `/${locale}/account`
    return NextResponse.json({ ok: true, account_url: accountUrl })
  } catch (e: any) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('[claim/transfer] error:', e?.message || e, e?.stack)
    // Réponse générique côté client
    return NextResponse.json({ ok: false, message: 'server_error' }, { status: 500 })
  } finally {
    client.release()
  }
}
