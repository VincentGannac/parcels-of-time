// app/api/cert/[ts]/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['cdg1', 'fra1']

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { generateCertificatePDF } from '@/lib/cert'

/* ========================= Date utils ========================= */
function normIsoDay(s: string): string | null {
  if (!s) return null
  let d: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d = new Date(`${s}T00:00:00.000Z`)
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(s) && !/[Z+-]\d{2}:?\d{2}$/.test(s)) d = new Date(`${s}Z`)
  else d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
function toTimeLabelMode(td?: string) {
  const v = String(td || 'local+utc')
  if (v === 'utc+local') return 'utc_plus_local'
  if (v === 'local+utc') return 'local_plus_utc'
  return 'utc'
}

/* ========================= Message normalizer =========================
   Objectif : ne JAMAIS passer l’attestation dans message (le renderer la gère),
   préserver “Offert par / Gifted by”, et propager [[HIDE_OWNED_BY]].
======================================================================= */
function normalizeClaimMessage(raw: unknown, locale: 'fr' | 'en') {
  const inp = String(raw || '').trim()
  if (!inp) return { message: '', giftedBy: '', hideOwned: false, hadAttestation: false }

  const RE_ATTEST_FR = /Ce certificat atteste que[\s\S]+?cette acquisition\./i
  const RE_ATTEST_EN = /This certificate attests that[\s\S]+?this acquisition\./i
  const hadAttestation = RE_ATTEST_FR.test(inp) || RE_ATTEST_EN.test(inp)

  let msg = inp.replace(RE_ATTEST_FR, '').replace(RE_ATTEST_EN, '').trim()

  let hideOwned = false
  if (/\[\[\s*HIDE_OWNED_BY\s*\]\]/i.test(msg)) {
    hideOwned = true
    msg = msg.replace(/\s*\[\[\s*HIDE_OWNED_BY\s*\]\]\s*/gi, '').trim()
  }

  let giftedBy = ''
  const giftedRe = /(?:^|\n)\s*(?:Offert\s+par|Gifted\s+by)\s*:\s*(.+)\s*$/i
  const m = msg.match(giftedRe)
  if (m) {
    giftedBy = (m[1] || '').trim().slice(0, 40)
    msg = msg.replace(giftedRe, '').trim()
  }

  // On ré-appose proprement gifted + hideOwned pour que le renderer les voie si besoin.
  let out = msg
  if (giftedBy) out = (out ? out + '\n' : '') + (locale === 'fr' ? `Offert par: ${giftedBy}` : `Gifted by: ${giftedBy}`)
  if (hideOwned) out = (out ? out + '\n' : '') + '[[HIDE_OWNED_BY]]'

  return { message: out, giftedBy, hideOwned, hadAttestation }
}

/* ========================= In-memory cache & single-flight ========================= */
type Key = string
type CacheEntry = { at: number; buf: Uint8Array; ttl: number }
const cache = new Map<Key, CacheEntry>()
const inflight = new Map<Key, Promise<Uint8Array>>()
const MAX_CACHE = 96

let active = 0
const waiters: Array<() => void> = []
const MAX_CONCURRENCY = 2

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function makeKey(tsISO: string, locale: 'fr' | 'en', hideQr: boolean, hideMeta: boolean) {
  return [tsISO.slice(0, 10), locale, hideQr ? 'q1' : 'q0', hideMeta ? 'm1' : 'm0'].join('|')
}
function getCached(key: Key): Uint8Array | null {
  const ent = cache.get(key)
  if (!ent) return null
  if (Date.now() - ent.at > ent.ttl) { cache.delete(key); return null }
  return ent.buf
}
function putCache(key: Key, buf: Uint8Array, ttl: number) {
  if (ttl <= 0) return
  if (cache.size >= MAX_CACHE) { const first = cache.keys().next().value; if (first) cache.delete(first) }
  cache.set(key, { at: Date.now(), buf, ttl })
}
async function withSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENCY) await new Promise<void>(r => waiters.push(r))
  active++
  try { return await fn() }
  finally { active = Math.max(0, active - 1); const n = waiters.shift(); if (n) n() }
}

/** Copie vers un ArrayBuffer *non partagé* pour éviter l’erreur TS durant le build */
function toPlainArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

/* ========================= DB helpers ========================= */
async function loadClaimRow(tsISO: string) {
  const { rows } = await pool.query(
    `select
        c.id as claim_id,
        c.ts,
        c.title,
        c.message,
        c.link_url,
        c.cert_hash,
        c.cert_style,
        c.time_display,
        c.local_date_only,
        c.text_color,
        c.display_name as claim_display_name,
        o.username as owner_username,
        o.display_name as owner_legacy_display_name
      from claims c
      join owners o on o.id = c.owner_id
      where date_trunc('day', c.ts) = $1::timestamptz
      order by c.ts desc
      limit 1`,
    [tsISO]
  )
  return rows[0] || null
}
async function loadCustomBg(tsISO: string): Promise<string | undefined> {
  const r1 = await pool.query(`select data_url from claim_custom_bg where ts = $1::timestamptz limit 1`, [tsISO])
  if (r1.rows[0]?.data_url) return r1.rows[0].data_url as string
  const r2 = await pool.query(
    `select data_url from claim_custom_bg where date_trunc('day', ts) = $1::timestamptz limit 1`,
    [tsISO]
  )
  return r2.rows[0]?.data_url || undefined
}

/* ========================= Handler ========================= */
export async function GET(req: Request, ctx: any) {
  // paramètre : /api/cert/[ts] (YYYY-MM-DD[.pdf])
  const raw = String(ctx?.params?.ts || '')
  const decoded = decodeURIComponent(raw).replace(/\.pdf$/i, '')
  const tsISO = normIsoDay(decoded)
  if (!tsISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  // locale + options
  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale: 'fr' | 'en' = accLang.startsWith('fr') ? 'fr' : 'en'
  const url = new URL(req.url)
  const hideQr   = url.searchParams.has('public') || url.searchParams.get('public') === '1' || url.searchParams.get('hide_qr') === '1'
  const hideMeta = url.searchParams.get('hide_meta') === '1' || url.searchParams.has('hide_meta')

  const isPublicish = hideQr || hideMeta || url.searchParams.get('public') === '1'
  const ttlMs = isPublicish ? 5 * 60_000 : 0

  const key = makeKey(tsISO, locale, hideQr, hideMeta)
  const cached = getCached(key)
  if (cached) {
    const ab = toPlainArrayBuffer(cached)
    return new Response(ab, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0, 10))}.pdf"`,
        'Cache-Control': isPublicish ? 'public, max-age=300, stale-while-revalidate=3600' : 'private, max-age=60',
        'Vary': 'Accept-Language',
        'Content-Length': String(cached.byteLength),
      },
    })
  }

  // Single-flight + retries
  let p = inflight.get(key)
  if (!p) {
    p = withSemaphore(async () => {
      const attempt = async () => {
        const claim = await loadClaimRow(tsISO)
        if (!claim) throw new Error('not_found')

        // Style & fond custom
        const styleRaw = String(claim.cert_style || 'neutral').toLowerCase()
        const known = new Set(['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'])
        let customBgDataUrl: string | undefined
        let safeStyle: any = 'neutral'
        if (styleRaw === 'custom') {
          customBgDataUrl = await loadCustomBg(tsISO)
          safeStyle = customBgDataUrl ? 'custom' : 'neutral'
        } else {
          safeStyle = known.has(styleRaw) ? styleRaw : 'neutral'
        }

        // URL publique (QR)
        const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
        const publicUrl = `${base}/${locale}/m/${encodeURIComponent(tsISO.slice(0, 10))}`

        // Normalisation message + hideOwned
        const { message: messageNorm, hideOwned } = normalizeClaimMessage(claim.message, locale)

        // Nom à afficher :
        //  - si hideOwned => on passe null (le renderer gèrera attestation “anonymous” si nécessaire)
        //  - sinon on applique les fallbacks lisibles
        const displayName = hideOwned
          ? null
          : (claim.claim_display_name || claim.owner_username || claim.owner_legacy_display_name || (locale === 'fr' ? 'Anonyme' : 'Anonymous'))

        // Couleur texte sûre
        const textColorHex = /^#[0-9a-f]{6}$/i.test(claim.text_color || '') ? String(claim.text_color).toLowerCase() : '#1a1f2a'

        // Génération PDF
        const pdf = await generateCertificatePDF({
          ts: tsISO,
          display_name: displayName,               // <- peut être null si masqué
          title: claim.title || null,
          message: messageNorm || null,            // <- jamais l’attestation
          link_url: claim.link_url || '',
          claim_id: String(claim.claim_id),
          hash: claim.cert_hash || 'no-hash',
          public_url: publicUrl,
          style: safeStyle,
          locale,
          timeLabelMode: toTimeLabelMode(claim.time_display) as any,
          localDateOnly: !!claim.local_date_only,
          textColorHex,
          customBgDataUrl,
          hideQr,
          hideMeta,
        })

        return pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf as any)
      }

      // retries progressifs (utile juste après un achat / assets encore tièdes)
      const tries = [0, 200, 500, 1000]
      let lastErr: unknown
      for (const delay of tries) {
        try { if (delay) await sleep(delay); return await attempt() }
        catch (e) { lastErr = e }
      }
      throw lastErr
    })
    inflight.set(key, p)
  }

  try {
    const body = await p
    inflight.delete(key)
    if (ttlMs > 0) putCache(key, body, ttlMs)

    const ab = toPlainArrayBuffer(body)
    return new Response(ab, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0, 10))}.pdf"`,
        'Cache-Control': isPublicish ? 'public, max-age=300, stale-while-revalidate=3600' : 'private, max-age=60',
        'Vary': 'Accept-Language',
        'Content-Length': String(body.byteLength),
      },
    })
  } catch (e: any) {
    inflight.delete(key)
    const msg = String(e?.message || e)
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
