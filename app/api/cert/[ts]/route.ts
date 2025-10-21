// app/api/cert/[ts]/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['cdg1', 'fra1']

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { generateCertificatePDF } from '@/lib/cert'

/* ========================= Utils ========================= */
function mkTraceId() {
  return 'cert_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/* Date utils */
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

/* ========================= Message normalizer ========================= */
function normalizeClaimMessage(raw: unknown) {
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

  return { message: msg, giftedBy, hideOwned, hadAttestation }
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
  const traceId = mkTraceId()
  const t0 = Date.now()

  // ---- params & flags
  const raw = String(ctx?.params?.ts || '')
  const decoded = decodeURIComponent(raw).replace(/\.pdf$/i, '')
  const tsISO = normIsoDay(decoded)
  const url = new URL(req.url)

  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale: 'fr' | 'en' = accLang.startsWith('fr') ? 'fr' : 'en'
  const hideQr   = url.searchParams.has('public') || url.searchParams.get('public') === '1' || url.searchParams.get('hide_qr') === '1'
  const hideMeta = url.searchParams.get('hide_meta') === '1' || url.searchParams.has('hide_meta')
  const isPublicish = hideQr || hideMeta || url.searchParams.get('public') === '1'
  const ttlMs = isPublicish ? 5 * 60_000 : 0

  const wantsJson  = url.searchParams.get('debug') === '1' ||
    (req.headers.get('accept') || '').toLowerCase().includes('application/json')
  const wantsProbe = url.searchParams.get('probe') === '1'

  const baseHeaders: Record<string, string> = {
    'X-Trace-Id': traceId,
    'Vary': 'Accept-Language',
  }

  if (!tsISO) {
    const body = { error: 'bad_ts', trace_id: traceId, message: 'ts param must be YYYY-MM-DD or ISO date', received: raw }
    return new NextResponse(JSON.stringify(body), {
      status: 400,
      headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  const key = makeKey(tsISO, locale, hideQr, hideMeta)
  const cached = getCached(key)

  // ------------------------------------------------------------------
  // 💡 MODE DEBUG JSON — NE PAS UTILISER inflight (évite le type mixte)
  // ------------------------------------------------------------------
  if (wantsJson) {
    const tDb0 = Date.now()
    let claim: any = null
    try { claim = await loadClaimRow(tsISO) } catch {}
    const tDb1 = Date.now()

    if (!claim) {
      const diag = {
        ok: false,
        error: 'not_found',
        trace_id: traceId,
        tsISO, ymd: tsISO.slice(0,10), locale, hideQr, hideMeta, isPublicish,
        cache: cached ? 'hit' : 'miss',
        db_lookup_ms: tDb1 - tDb0,
        hint: 'No DB row for this day. If this follows a recent purchase, retry later.',
        elapsed_ms: Date.now() - t0,
      }
      return new NextResponse(JSON.stringify(diag, null, 2), {
        status: 200,
        headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }

    // Style & fond custom
    const styleRaw = String(claim.cert_style || 'neutral').toLowerCase()
    const known = new Set(['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'])
    let customBgDataUrl: string | undefined
    let safeStyle: any = 'neutral'
    if (styleRaw === 'custom') {
      try { customBgDataUrl = await loadCustomBg(tsISO) } catch {}
      safeStyle = customBgDataUrl ? 'custom' : 'neutral'
    } else {
      safeStyle = known.has(styleRaw) ? styleRaw : 'neutral'
    }

    // URL publique (QR)
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const publicUrl = `${base}/${locale}/m/${encodeURIComponent(tsISO.slice(0, 10))}`

    // Normalisation du message
    const { message: msgNoAttest, giftedBy, hideOwned, hadAttestation } = normalizeClaimMessage(claim.message)

    // Nom affiché
    const displayName =
      hideOwned ? null
      : (claim.claim_display_name || claim.owner_username || claim.owner_legacy_display_name || (locale === 'fr' ? 'Anonyme' : 'Anonymous'))

    // Attestation
    const ymd = tsISO.slice(0,10)
    const ownerForText = (displayName && displayName.trim()) ? displayName.trim() : (locale === 'fr' ? 'Anonyme' : 'Anonymous')
    const attestation =
      locale === 'fr'
        ? `Ce certificat atteste que ${ownerForText} est reconnu(e) comme propriétaire symbolique de la journée du ${ymd}. Le présent document confirme la validité et l'authenticité de cette acquisition.`
        : `This certificate attests that ${ownerForText} is recognized as the symbolic owner of the day ${ymd}. This document confirms the validity and authenticity of this acquisition.`

    const parts: string[] = []
    if (msgNoAttest) parts.push(msgNoAttest)
    if (giftedBy) parts.push((/^[A-Za-zÀ-ÿ]/.test(giftedBy) ? (locale === 'fr' ? `Offert par: ${giftedBy}` : `Gifted by: ${giftedBy}`) : String(giftedBy)))
    if (hadAttestation) parts.push(attestation)
    const finalMessage = parts.join('\n').trim() || null

    const textColorHex = /^#[0-9a-f]{6}$/i.test(claim.text_color || '') ? String(claim.text_color).toLowerCase() : '#1a1f2a'

    // Si probe => tenter la génération en local (pas d’inflight, pas de cache)
    let genOk = false
    let genErr: any = null
    let genBytes = 0
    let genMs = 0
    if (wantsProbe) {
      const tGen0 = Date.now()
      try {
        const pdf = await generateCertificatePDF({
          ts: tsISO,
          display_name: displayName,
          title: claim.title || null,
          message: finalMessage,
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
        const u8 = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf as any)
        genOk = true
        genBytes = u8.byteLength
      } catch (e: any) {
        genErr = { message: String(e?.message || e), stack_trunc: String(e?.stack || '').slice(0, 800) }
      } finally {
        genMs = Date.now() - tGen0
      }
    }

    const diag = {
      ok: true,
      mode: wantsProbe ? 'debug_probe' : 'debug',
      tsISO, ymd, locale, hideQr, hideMeta, isPublicish,
      cache: cached ? 'hit' : 'miss',
      db: { found: true, claim_id: String(claim.claim_id) },
      style: { requested: styleRaw, resolved: safeStyle, has_custom_bg: !!customBgDataUrl },
      message_meta: { hadAttestation, giftedBy_present: !!giftedBy, hideOwned },
      display_name_present: !!displayName,
      text_color: textColorHex,
      timings_ms: { db: tDb1 - tDb0, probe_gen: genMs },
      generator_ok: genOk,
      generator_error: genErr,
      pdf_bytes: genBytes,
      hint: genOk ? 'Generator OK' : (wantsProbe ? 'Generator FAILURE (see generator_error)' : 'Add &probe=1 to test generation'),
      elapsed_ms: Date.now() - t0,
    }

    return new NextResponse(JSON.stringify(diag, null, 2), {
      status: 200,
      headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  // ------------------------------------------------------------------
  // 💾 Fast-path cache PDF (réponse binaire)
  // ------------------------------------------------------------------
  if (cached) {
    const ab = toPlainArrayBuffer(cached)
    return new Response(ab, {
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0, 10))}.pdf"`,
        'Cache-Control': isPublicish ? 'public, max-age=300, stale-while-revalidate=3600' : 'private, max-age=60',
        'X-Cert-Cache': 'hit',
        'X-Cert-Locale': locale,
        'X-Cert-Opts': `qr:${hideQr?1:0},meta:${hideMeta?1:0}`,
        'Content-Length': String(cached.byteLength),
      },
    })
  }

  // ------------------------------------------------------------------
  // 🛠️ Single-flight (PDF uniquement) — inflight = Promise<Uint8Array>
  // ------------------------------------------------------------------
  let p: Promise<Uint8Array> | undefined = inflight.get(key)
  if (!p) {
    const pNew: Promise<Uint8Array> = withSemaphore(async () => {
      const attempt = async (): Promise<Uint8Array> => {
        const tDb0 = Date.now()
        const claim = await loadClaimRow(tsISO)
        const tDb1 = Date.now()
        if (!claim) {
          const err: any = new Error('not_found')
          err.__diag = { tsISO, ymd: tsISO.slice(0,10), locale, hideQr, hideMeta, db_lookup_ms: tDb1 - tDb0 }
          throw err
        }

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

        // Normalisation du message
        const { message: msgNoAttest, giftedBy, hideOwned, hadAttestation } = normalizeClaimMessage(claim.message)

        // Nom affiché
        const displayName =
          hideOwned ? null
          : (claim.claim_display_name || claim.owner_username || claim.owner_legacy_display_name || (locale === 'fr' ? 'Anonyme' : 'Anonymous'))

        // Attestation
        const ymd = tsISO.slice(0,10)
        const ownerForText = (displayName && displayName.trim()) ? displayName.trim() : (locale === 'fr' ? 'Anonyme' : 'Anonymous')
        const attestation =
          locale === 'fr'
            ? `Ce certificat atteste que ${ownerForText} est reconnu(e) comme propriétaire symbolique de la journée du ${ymd}. Le présent document confirme la validité et l'authenticité de cette acquisition.`
            : `This certificate attests that ${ownerForText} is recognized as the symbolic owner of the day ${ymd}. This document confirms the validity and authenticity of this acquisition.`

        const parts: string[] = []
        if (msgNoAttest) parts.push(msgNoAttest)
        if (giftedBy) parts.push((/^[A-Za-zÀ-ÿ]/.test(giftedBy) ? (locale === 'fr' ? `Offert par: ${giftedBy}` : `Gifted by: ${giftedBy}`) : String(giftedBy)))
        if (hadAttestation) parts.push(attestation)
        const finalMessage = parts.join('\n').trim() || null

        const textColorHex = /^#[0-9a-f]{6}$/i.test(claim.text_color || '') ? String(claim.text_color).toLowerCase() : '#1a1f2a'

        const tGen0 = Date.now()
        const pdf = await generateCertificatePDF({
          ts: tsISO,
          display_name: displayName,
          title: claim.title || null,
          message: finalMessage,
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
        const u8 = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf as any)
        const genMs = Date.now() - tGen0

        // cache public only
        if (ttlMs > 0) putCache(key, u8, ttlMs)

        // On renvoie UNIQUEMENT l’u8 ici (jamais Response) => type OK
        ;(u8 as any)._genMs = genMs  // (optionnel) stocker pour header après await
        return u8
      }

      // retries progressifs
      const tries = [0, 200, 500, 1000]
      let lastErr: any
      for (const d of tries) {
        try { if (d) await sleep(d); return await attempt() }
        catch (e: any) { lastErr = e }
      }
      throw lastErr
    })
    inflight.set(key, pNew)
    p = pNew
  }

  try {
    const body = await p
    inflight.delete(key)

    const ab = toPlainArrayBuffer(body)
    const genMs = (body as any)._genMs ? String((body as any)._genMs) : undefined

    return new Response(ab, {
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cert-${encodeURIComponent(tsISO.slice(0, 10))}.pdf"`,
        'Cache-Control': isPublicish ? 'public, max-age=300, stale-while-revalidate=3600' : 'private, max-age=60',
        'X-Cert-Cache': 'miss',
        'X-Cert-Locale': locale,
        'X-Cert-Opts': `qr:${hideQr?1:0},meta:${hideMeta?1:0}`,
        ...(genMs ? { 'X-Cert-Genms': genMs } : {}),
        'Content-Length': String(body.byteLength),
      },
    })
  } catch (e: any) {
    inflight.delete(key)
    const errMsg = String(e?.message || e)
    const diag = e?.__diag || null
    console.error('[api/cert] error', { traceId, err: errMsg, diag })

    const status = errMsg === 'not_found' ? 404 : 500
    const payload = {
      error: errMsg === 'not_found' ? 'not_found' : 'internal',
      trace_id: traceId,
      cause: errMsg,
      diag: diag || {
        tsISO, ymd: tsISO.slice(0,10), locale, hideQr, hideMeta, isPublicish,
        note: 'Add ?debug=1 for full diagnostics or ?debug=1&probe=1 to test PDF generation.'
      }
    }
    return new NextResponse(JSON.stringify(payload), {
      status,
      headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
}

