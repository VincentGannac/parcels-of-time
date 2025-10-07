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
async function tableExists(client: any, table: string) {
  const { rows } = await client.query(`select to_regclass($1) as ok`, [`public.${table}`])
  return !!rows[0]?.ok
}

function i18n(locale: 'fr'|'en') {
  return locale === 'fr'
    ? {
        sameOwner: 'Transfert non autorisé : vous êtes déjà propriétaire de ce certificat.',
        claimNotFound: 'Certificat introuvable.',
        hashMismatch: 'Empreinte (SHA-256) invalide pour ce certificat.',
        invalidCode: 'Code invalide.',
        codeRevoked: 'Ce code a été révoqué.',
        codeUsed: 'Ce code a déjà été utilisé.',
        listingCancelFailed: 'Impossible d’annuler l’annonce en cours. Réessayez.',
      }
    : {
        sameOwner: 'Transfer not allowed: you already own this certificate.',
        claimNotFound: 'Certificate not found.',
        hashMismatch: 'Invalid SHA-256 for this certificate.',
        invalidCode: 'Invalid code.',
        codeRevoked: 'This code has been revoked.',
        codeUsed: 'This code has already been used.',
        listingCancelFailed: 'Could not cancel the active listing. Please try again.',
      }
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
  const locale: 'fr'|'en' = (String(body?.locale || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
  const t = i18n(locale)
  const code = normCode5(String(body?.code || ''))

  if (!isUuid(claimId) || !isHex64(certHash) || !code) {
    return NextResponse.json({ ok: false, message: 'bad_input' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1) Lock le token AVANT toute action (sans le consommer)
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
      return NextResponse.json({ ok: false, message: t.invalidCode }, { status: 400 })
    }
    const tok = toks[0]
    if (tok.is_revoked) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: t.codeRevoked }, { status: 400 })
    }
    if (tok.used_at) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: t.codeUsed }, { status: 400 })
    }

    // 2) Lock le claim + vérifications (existence, hash, et receveur != propriétaire actuel)
    const { rows: crows } = await client.query(
      `select id, owner_id, cert_hash, ts
         from claims
        where id=$1
        for update`,
      [claimId]
    )
    if (!crows.length) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: t.claimNotFound }, { status: 404 })
    }
    const row = crows[0]
    const dbHash = String(row.cert_hash || '').toLowerCase()
    if (dbHash !== certHash) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: t.hashMismatch }, { status: 400 })
    }
    const currentOwnerId: string = String(row.owner_id)

    // 🔒 Sécurité : interdire transfert vers soi-même
    if (currentOwnerId === sess.ownerId) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, message: t.sameOwner }, { status: 403 })
    }

    // 3) Si une annonce est active sur cette date pour le propriétaire actuel, on l’annule proprement
    if (await tableExists(client, 'listings')) {
      // Un seul listing par jour attendu, mais on gère le cas multiple par sécurité
      const { rows: lrows } = await client.query(
        `select id, status
           from listings
          where seller_owner_id = $1
            and date_trunc('day', ts) = date_trunc('day', $2::timestamptz)
          for update`,
        [currentOwnerId, row.ts]
      )

      if (lrows.length) {
        // Vérifie s’il y a au moins une annonce 'active'
        const anyActive = lrows.some((r: any) => String(r.status) === 'active')
        if (anyActive) {
          // updated_at est présent dans ton schéma, mais on reste robuste si jamais
          const hasUpdatedAt = await hasColumn(client, 'listings', 'updated_at')
          if (hasUpdatedAt) {
            await client.query(
              `update listings
                  set status='canceled', updated_at=now()
                where seller_owner_id=$1
                  and date_trunc('day', ts) = date_trunc('day', $2::timestamptz)
                  and status='active'`,
              [currentOwnerId, row.ts]
            )
          } else {
            await client.query(
              `update listings
                  set status='canceled'
                where seller_owner_id=$1
                  and date_trunc('day', ts) = date_trunc('day', $2::timestamptz)
                  and status='active'`,
              [currentOwnerId, row.ts]
            )
          }
        }
        // Si les annonces étaient déjà 'sold', on laisse échouer plus tard naturellement
        // car le propriétaire aurait changé via la vente secondaire.
      }
    }

    // 4) Consomme le token (usage unique)
    await client.query(
      `update claim_transfer_tokens set used_at=now() where id=$1`,
      [tok.id]
    )

    // 5) Transfert de propriété au receveur connecté
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
    return NextResponse.json({ ok: false, message: 'server_error' }, { status: 500 })
  } finally {
    client.release()
  }
}
