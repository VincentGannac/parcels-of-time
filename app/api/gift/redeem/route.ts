//app/api/gift/redeem/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'
import { upsertOwnerByEmail } from '@/lib/auth'
import { sendClaimReceiptEmail } from '@/lib/email'
import { GiftRedeemRequestSchema, GiftRedeemResponseSchema } from '@/lib/schemas/gift'

function sha256hex(s: string) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}

function normIsoDay(input: string): { tsISO: string | null, ymd: string | null } {
  try {
    let d: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) d = new Date(`${input}T00:00:00.000Z`)
    else if (/^\d{4}-\d{2}-\d{2}T/.test(input) && !/[Z+-]\d{2}:?\d{2}$/.test(input)) d = new Date(input + 'Z')
    else d = new Date(input)
    if (isNaN(d.getTime())) return { tsISO: null, ymd: null }
    d.setUTCHours(0,0,0,0)
    const iso = d.toISOString()
    return { tsISO: iso, ymd: iso.slice(0,10) }
  } catch { return { tsISO: null, ymd: null } }
}

// Petites helpers pour normaliser les champs
const asBool1 = (v: unknown) => v === true || String(v) === 'true' || String(v) === '1'
const asHex = (v: unknown, fallback = '#1a1f2a') =>
  /^#[0-9a-fA-F]{6}$/.test(String(v||'')) ? String(v).toLowerCase() : fallback
const asStyle = (v: unknown) => {
  const A = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const
  const s = String(v||'neutral').toLowerCase()
  return (A as readonly string[]).includes(s as any) ? s : 'neutral'
}
const asTimeDisplay = (v: unknown) => {
  const td = String(v || 'local+utc')
  return (td === 'utc' || td === 'utc+local' || td === 'local+utc') ? td : 'local+utc'
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null)
    const parse = GiftRedeemRequestSchema.safeParse(json)
    if (!parse.success) {
      return NextResponse.json({ ok:false, code:'server_error', message:'Bad payload' }, { status: 400 })
    }
    const body = parse.data

    const { tsISO, ymd } = normIsoDay(body.ts)
    if (!tsISO || !ymd) {
      return NextResponse.json({ ok:false, code:'bad_ts', message: 'Bad date' }, { status: 400 })
    }

    const tokenHash = sha256hex(body.code.trim())
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1) Verrouille le code
      const { rows: codes } = await client.query(
        `select id, is_disabled, max_uses, uses_count
           from gift_codes
          where token_hash = $1
          for update`,
        [tokenHash]
      )
      const row = codes[0]
      if (!row) {
        await client.query('ROLLBACK')
        return NextResponse.json({ ok:false, code:'invalid_code', message: 'Code not found' }, { status: 404 })
      }
      if (row.is_disabled) {
        await client.query('ROLLBACK')
        return NextResponse.json({ ok:false, code:'disabled_code', message: 'Code disabled' }, { status: 403 })
      }
      const limited = row.max_uses !== null && row.max_uses !== undefined
      if (limited && Number(row.uses_count) >= Number(row.max_uses)) {
        await client.query('ROLLBACK')
        return NextResponse.json({ ok:false, code:'exhausted_code', message: 'Code uses exhausted' }, { status: 403 })
      }

      // 2) Assure l’owner
      const ownerId = await upsertOwnerByEmail(body.email, body.display_name || null)

      // 3) Tente l’insertion du claim (prix 0 — cadeau)
      const title = body.title ?? null
      const message = body.message ?? null
      const link_url = body.link_url ? String(body.link_url) : null

      const { rows: inserted } = await client.query(
        `insert into claims (
           ts, owner_id, price_cents, currency,
           title, message, link_url,
           cert_style, time_display, local_date_only, text_color,
           title_public, message_public, display_name
         )
         values (
           $1::timestamptz, $2, 0, 'EUR',
           $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12
         )
         on conflict (ts) do nothing
         returning id, created_at`,
        [
          tsISO, ownerId,
          title, message, link_url,
          asStyle(body.cert_style), asTimeDisplay(body.time_display), !!body.local_date_only, asHex(body.text_color),
          !!body.title_public, !!body.message_public, body.display_name ?? null
        ]
      )

      if (!inserted.length) {
        // La journée est déjà revendiquée : on ne consomme PAS le code
        await client.query('ROLLBACK')
        return NextResponse.json({ ok:false, code:'already_claimed', message:'Day already claimed' }, { status: 409 })
      }

      const claimId = inserted[0].id as string
      const createdISO: string =
        inserted[0].created_at instanceof Date
          ? inserted[0].created_at.toISOString()
          : new Date(inserted[0].created_at || Date.now()).toISOString()

      // 4) Met à jour hash/URL du certificat
      const salt = process.env.SECRET_SALT || 'dev_salt'
      const data = `${tsISO}|${ownerId}|0|${createdISO}|${salt}`
      const certHash = sha256hex(data)
      const certUrl = `/api/cert/${encodeURIComponent(ymd)}`
      await client.query(
        `update claims set cert_hash=$2, cert_url=$3 where id=$1`,
        [claimId, certHash, certUrl]
      )

      // 5) Registre public si demandé
      if (asBool1(body.public_registry)) {
        await client.query(
          `insert into minute_public(ts)
           values($1::timestamptz)
           on conflict (ts) do nothing`,
          [tsISO]
        )
      }

      // 6) Journal redemption + conso d’usage
      await client.query(
        `insert into gift_redemptions (gift_code_id, claim_id, claimer_owner_id, ip, ua)
         values ($1,$2,$3,$4,$5)`,
        [
          row.id, claimId, ownerId,
          (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || null,
          req.headers.get('user-agent') || null
        ]
      )
      await client.query(
        `update gift_codes
            set uses_count = uses_count + 1
          where id = $1`,
        [row.id]
      )

      await client.query('COMMIT')

      // 7) Email de reçu (optionnel)
      try {
        const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
        const locale = body.locale || 'en'
        const publicUrl = `${base}/${locale}/m/${encodeURIComponent(ymd)}`
        const pdfUrl = `${base}/api/cert/${encodeURIComponent(ymd)}`
        await sendClaimReceiptEmail({
          to: body.email,
          ts: tsISO,
          displayName: body.display_name || null,
          publicUrl,
          certUrl: pdfUrl,
        })
      } catch { /* non bloquant */ }

      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
      const claimUrl = `/${body.locale || 'en'}/m/${encodeURIComponent(ymd)}`
      const pdfUrl = `/api/cert/${encodeURIComponent(ymd)}`

      const payload = { ok: true as const, ymd, claim_url: claimUrl, pdf_url: pdfUrl }
      const out = GiftRedeemResponseSchema.parse(payload)
      return NextResponse.json(out)
    } catch (e) {
      try { await pool.query('ROLLBACK') } catch {}
      return NextResponse.json({ ok:false, code:'server_error', message:'Server error' }, { status: 500 })
    } finally {
      client.release()
    }
  } catch {
    return NextResponse.json({ ok:false, code:'server_error', message:'Server error' }, { status: 500 })
  }
}
