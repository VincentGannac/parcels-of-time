// app/api/cert/[ts]/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['cdg1','fra1']

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { generateCertificatePDF, type CertStyle } from '@/lib/cert'

/** ---------- Utils date ---------- */
function normIsoDay(s: string): string | null {
  if (!s) return null
  let d: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = new Date(`${s}T00:00:00.000Z`)
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(s) && !/[Z+-]\d{2}:?\d{2}$/.test(s)) {
    d = new Date(`${s}Z`)
  } else {
    d = new Date(s)
  }
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Map legacy time_display -> timeLabelMode */
function toTimeLabelMode(td?: string): 'utc' | 'utc_plus_local' | 'local_plus_utc' {
  const v = String(td || 'local+utc')
  if (v === 'utc+local') return 'utc_plus_local'
  if (v === 'local+utc') return 'local_plus_utc'
  return 'utc'
}

/** ---------- Single-flight + concurrency gate + tiny cache ---------- */
type Key = string
type CacheEntry = { at: number; buf: Uint8Array; ttl: number }
const inflight = new Map<Key, Promise<Uint8Array>>()
const cache = new Map<Key, CacheEntry>()
const MAX_CACHE = 96

let active = 0
const waiters: Array<() => void> = []
const MAX_CONCURRENCY = 2

function makeKey(tsISO: string, locale: 'fr'|'en', hideQr: boolean, hideMeta: boolean) {
  return [tsISO.slice(0,10), locale, hideQr ? 'q1' : 'q0', hideMeta ? 'm1' : 'm0'].join('|')
}
function getCached(key: Key): Uint8Array | null {
  const now = Date.now()
  const ent = cache.get(key)
  if (!ent) return null
  if (now - ent.at > ent.ttl) { cache.delete(key); return null }
  return ent.buf
}
function putCache(key: Key, buf: Uint8Array, ttlMs: number) {
  if (ttlMs <= 0) return
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, { at: Date.now(), buf, ttl: ttlMs })
}
async function withSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENCY) {
    await new Promise<void>(resolve => waiters.push(resolve))
  }
  active++
  try { return await fn() }
  finally {
    active = Math.max(0, active - 1)
    const next = waiters.shift()
    if (next) next()
  }
}
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/** ---------- DB helpers ---------- */
async function loadClaimRow(tsISO: string) {
  const { rows } = await pool.query(
    `
      select
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
      limit 1
    `,
    [tsISO]
  )
  return rows[0] || null
}

async function loadCustomBg(tsISO: string): Promise<string | undefined> {
  // exact match, puis fallback day-trunc (compat anciens enregistrements)
  const ex1 = await pool.query(`select data_url from claim_custom_bg where ts = $1::timestamptz limit 1`, [tsISO])
  if (ex1.rows[0]?.data_url) return ex1.rows[0].data_url as string
  const ex2 = await pool.query(
    `select data_url from claim_custom_bg where date_trunc('day', ts) = $1::timestamptz limit 1`,
    [tsISO]
  )
  return ex2.rows[0]?.data_url || undefined
}

/** ---------- Style normalizer (→ CertStyle) ---------- */
const CERT_STYLES = new Set<CertStyle>([
  'neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'
])
function toCertStyle(s: string, hasCustomBg: boolean): CertStyle {
  const v = String(s || '').toLowerCase() as CertStyle
  if (v === 'custom') return hasCustomBg ? 'custom' : 'neutral'
  return CERT_STYLES.has(v) ? v : 'neutral'
}

/** ---------- ArrayBuffer helper (évite ArrayBufferLike/SharedArrayBuffer) ---------- */
function toPlainArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

/** ---------- Handler ---------- */
export async function GET(req: Request, ctx: any) {
  // Param "YYYY-MM-DD[.pdf]"
  const rawParam = String(ctx?.params?.ts || '')
  const decoded = decodeURIComponent(rawParam).replace(/\.pdf$/i, '')
  const tsISO = normIsoDay(decoded)
  if (!tsISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  // Locale pour l’URL publique (QR)
  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale: 'fr' | 'en' = accLang.startsWith('fr') ? 'fr' : 'en'

  // Options d’affichage
  const url = new URL(req.url)
  const hideQr =
    url.searchParams.has('public') ||
    url.searchParams.get('public') === '1' ||
    url.searchParams.get('hide_qr') === '1'
  const hideMeta =
    url.searchParams.get('hide_meta') === '1' ||
    url.searchParams.has('hide_meta')

  const key = makeKey(tsISO, locale, hideQr, hideMeta)

  // Cache public (soulage les rafales d’iframes)
  const isPublicish = hideQr || hideMeta || url.searchParams.get('public') === '1'
  const ttlMs = isPublicish ? 5 * 60_000 : 0
  const cached = getCached(key)
  if (cached) {
    const ab = toPlainArrayBuffer(cached)
    return new Response(ab, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0,10))}.pdf"`,
        'Cache-Control': isPublicish ? 'public, max-age=300, stale-while-revalidate=3600' : 'private, max-age=60',
        'Vary': 'Accept-Language',
      },
    })
  }

  // Single-flight (une seule génération par clé)
  let p = inflight.get(key)
  if (!p) {
    p = withSemaphore(async () => {
      const tryOnce = async () => {
        const claim = await loadClaimRow(tsISO)
        if (!claim) throw new Error('not_found')

        // Style + fond custom
        const rawStyle = String(claim.cert_style || 'neutral')
        let customBgDataUrl: string | undefined
        if (rawStyle.toLowerCase() === 'custom') {
          customBgDataUrl = await loadCustomBg(tsISO)
        }
        const safeStyle: CertStyle = toCertStyle(rawStyle, !!customBgDataUrl)

        // URL publique (QR)
        const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
        const publicUrl = `${base}/${locale}/m/${encodeURIComponent(tsISO.slice(0,10))}`

        // Nom affiché
        const displayName =
          claim.claim_display_name ||
          claim.owner_username ||
          claim.owner_legacy_display_name ||
          (locale === 'fr' ? 'Anonyme' : 'Anonymous')

        // Génération PDF
        const pdfBytes = await generateCertificatePDF({
          ts: tsISO,
          display_name: displayName,
          title: claim.title || null,
          message: claim.message || null,
          link_url: claim.link_url || '',
          claim_id: String(claim.claim_id),
          hash: claim.cert_hash || 'no-hash',
          public_url: publicUrl,
          style: safeStyle,
          locale,
          timeLabelMode: toTimeLabelMode(claim.time_display),
          localDateOnly: !!claim.local_date_only,
          textColorHex: (/^#[0-9a-f]{6}$/i.test(claim.text_color || '') ? String(claim.text_color).toLowerCase() : '#1a1f2a'),
          customBgDataUrl,
          hideQr,
          hideMeta,
        })

        // pdfBytes est un Uint8Array (pdf-lib)
        return pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes as any)
      }

      try { return await tryOnce() }
      catch { await delay(200); return await tryOnce() } // petit backoff pour assets/froid
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
        'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0,10))}.pdf"`,
        'Cache-Control': isPublicish ? 'public, max-age=300, stale-while-revalidate=3600' : 'private, max-age=60',
        'Vary': 'Accept-Language',
      },
    })
  } catch (e: any) {
    inflight.delete(key)
    const msg = String(e?.message || e)
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
