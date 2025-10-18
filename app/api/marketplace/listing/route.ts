// app/api/marketplace/listing/route.ts
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession } from '@/lib/auth' // on n'utilise plus ownerIdForDay ici

function normIsoDay(s: string) {
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0)
  return { iso: d.toISOString(), ymd: d.toISOString().slice(0,10) }
}
// Type guard pour affiner le type et satisfaire TS
function isGoodPrice(p: unknown): p is number {
  return typeof p === 'number' && Number.isInteger(p) && p >= 3
}

// 👇 helper robuste: owner pour le JOUR (UTC minuit)
async function ownerIdForDayDb(tsISO: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `select owner_id
         from claims
        where date_trunc('day', ts) = $1::timestamptz
        limit 1`,
      [tsISO]
    )
    return rows[0]?.owner_id ?? null
  } catch { return null }
}

export async function POST(req: Request) {
  const sess = await readSession()
  if (!sess) {
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base}/login`, { status: 303 })
  }

  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  let tsInput = ''
  let currency = 'EUR'
  let locale: 'fr'|'en' = 'fr'
  let hideClaimDetails = false  // false = afficher infos ; true = “vierge”
  let parsedPrice: number | null = null  // <-- prix en euros entiers

  // ---- lecture & parsing prix (entier ≥ 3) ----
  const parsePriceFromForm = async () => {
    const form = await req.formData()
    tsInput = String(form.get('ts') || '')
    const cur = String(form.get('currency') || '').toUpperCase()
    if (cur) currency = cur
    const loc = String(form.get('locale') || '')
    if (loc === 'en' || loc === 'fr') locale = loc

    const dm = String(form.get('display_mode') || '').toLowerCase()
    if (dm === 'blank') hideClaimDetails = true
    if (dm === 'full')  hideClaimDetails = false
    const b = String(form.get('blank') || form.get('hide_claim_details') || '').toLowerCase()
    if (['1','true','yes','on'].includes(b)) hideClaimDetails = true

    // Prix prioritaire: "price" (euros entiers)
    const priceRaw = String(form.get('price') ?? '').trim()
    if (priceRaw !== '' && /^\d+$/.test(priceRaw)) {
      parsedPrice = parseInt(priceRaw, 10)
    }

    // Fallback strict: "price_cents" (multiple de 100 >= 300)
    if (parsedPrice === null) {
      const pc = Number(form.get('price_cents') || 0)
      if (Number.isInteger(pc) && pc >= 300 && pc % 100 === 0) {
        parsedPrice = pc / 100
      }
    }
  }

  const parsePriceFromJSON = async () => {
    const body = await req.json().catch(() => ({} as any))
    tsInput = String(body.ts || '')
    currency = String(body.currency || 'EUR').toUpperCase()
    const loc = String(body.locale || '')
    if (loc === 'en' || loc === 'fr') locale = loc

    const dm = String(body.display_mode || '').toLowerCase()
    if (dm === 'blank') hideClaimDetails = true
    if (dm === 'full')  hideClaimDetails = false
    if (body.blank === true || body.hide_claim_details === true) hideClaimDetails = true

    // Prix prioritaire: "price" (doit être entier)
    if (Number.isInteger(body.price)) {
      parsedPrice = Number(body.price)
    } else if (typeof body.price === 'string' && /^\d+$/.test(body.price)) {
      parsedPrice = parseInt(body.price, 10)
    }

    // Fallback strict: "price_cents"
    if (parsedPrice === null) {
      const pc = Number(body.price_cents || 0)
      if (Number.isInteger(pc) && pc >= 300 && pc % 100 === 0) {
        parsedPrice = pc / 100
      }
    }
  }

  if (ctype.includes('application/x-www-form-urlencoded')) {
    await parsePriceFromForm()
  } else {
    await parsePriceFromJSON()
  }

  // Normalisation TS
  const norm = normIsoDay(tsInput)
  if (!norm) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })
  const tsISO = norm.iso
  const tsYMD = norm.ymd

  // ✅ ownership robuste sur le JOUR
  const actualOwnerId = await ownerIdForDayDb(tsISO)
  if (!actualOwnerId || actualOwnerId !== sess.ownerId) {
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return NextResponse.redirect(`${base}/${locale}/account?err=not_owner`, { status: 303 })
  }

    // ✅ validations prix : entier et ≥ 3
    if (!isGoodPrice(parsedPrice)) {
      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
      if (ctype.includes('application/x-www-form-urlencoded')) {
        return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsYMD)}?listing=err&reason=price`, { status: 303 })
      }
      return NextResponse.json({ error: 'bad_price', detail: 'price must be an integer number of euros >= 3' }, { status: 400 })
    }

    const price_cents = parsedPrice * 100 // OK: parsedPrice est bien un number ici

    const client = await pool.connect()
    try {
    await client.query('BEGIN')

    // 🔒 on verrouille TOUTES les annonces de ce jour pour éviter les races
    await client.query(`select id from listings where date_trunc('day', ts) = $1::timestamptz for update`, [tsISO])

    // 🧹 si un reliquat "active|paused" existe pour ce jour mais d’un autre vendeur, on l’annule
    await client.query(
      `update listings
          set status = 'canceled', updated_at = now()
        where date_trunc('day', ts) = $1::timestamptz
          and status in ('active','paused')
          and seller_owner_id <> $2`,
      [tsISO, sess.ownerId]
    )

    // Re-cherche d’une annonce existante pour CE vendeur (si réactivation)
    const { rows: existing } = await client.query(
      `select id, status from listings
        where date_trunc('day', ts) = $1::timestamptz
          and seller_owner_id = $2
        order by id asc
        for update`,
      [tsISO, sess.ownerId]
    )

    if (existing.length) {
      // réactive / met à jour le prix + mode d’affichage
      await client.query(
        `update listings
            set price_cents=$2, currency=$3, status='active'::listing_status,
                hide_claim_details=$4, updated_at=now()
          where id=$1`,
        [existing[0].id, price_cents, currency, hideClaimDetails]
      )
    } else {
      // insert propre pour le nouveau propriétaire
      await client.query(
        `insert into listings (ts, seller_owner_id, price_cents, currency, status, hide_claim_details)
         values ($1, $2, $3, $4, 'active'::listing_status, $5)`,
        [tsISO, sess.ownerId, price_cents, currency, hideClaimDetails]
      )
    }

    await client.query('COMMIT')

    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    if (ctype.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsYMD)}?listing=ok`, { status: 303 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('[listing POST] error:', e?.message || e)
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    if (ctype.includes('application/x-www-form-urlencoded')) {
      // on garde la même sémantique pour l’UI (avec raison explicite)
      return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(tsYMD)}?listing=err`, { status: 303 })
    }
    return NextResponse.json({ error: 'db_error', detail: String(e?.message || e) }, { status: 500 })
  } finally {
    client.release()
  }
}
