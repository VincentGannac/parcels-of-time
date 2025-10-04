// app/api/invoice/[ymd]/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ===== Utils =====
async function ownerIdForDaySafe(tsISO: string): Promise<string | null> {
  const ymd = tsISO.slice(0, 10)
  try { const a = await ownerIdForDay(tsISO); if (a) return a as any } catch {}
  try { const b = await ownerIdForDay(ymd);   if (b) return b as any } catch {}
  return null
}

type L = {
  invoice: string; receipt: string; invoiceNo: string; issuedOn: string;
  seller: string; buyer: string; item: string; day: string; total: string;
  currency: string; mpNote: string; platform: string;
}
function pickLocale(req: Request): 'fr'|'en' {
  const h = (req.headers.get('accept-language') || '').toLowerCase()
  return h.startsWith('fr') ? 'fr' : 'en'
}
function labels(loc:'fr'|'en'): L {
  return loc==='fr'
    ? {
        invoice:'Facture', receipt:'Reçu d’achat (Marketplace)',
        invoiceNo:'N°', issuedOn:'Émis le',
        seller:'Vendeur', buyer:'Acheteur', item:'Objet',
        day:'Certificat — Journée', total:'Total', currency:'Devise',
        mpNote:`Vente opérée via Parcels of Time (Stripe Connect). En cas de vente entre particuliers, ce document fait office de reçu.`,
        platform: process.env.INVOICE_ISSUER_NAME || 'Parcels of Time',
      }
    : {
        invoice:'Invoice', receipt:'Purchase receipt (Marketplace)',
        invoiceNo:'No.', issuedOn:'Issued on',
        seller:'Seller', buyer:'Buyer', item:'Item',
        day:'Certificate — Day', total:'Total', currency:'Currency',
        mpNote:`Sale operated via Parcels of Time (Stripe Connect). For peer-to-peer sales, this document acts as a receipt.`,
        platform: process.env.INVOICE_ISSUER_NAME || 'Parcels of Time',
      }
}
function toIsoDay(ymd: string): string | null {
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T00:00:00.000Z`) : new Date(ymd)
    if (isNaN(d.getTime())) return null
    d.setUTCHours(0,0,0,0)
    return d.toISOString()
  } catch { return null }
}
function issuerBlock(loc:'fr'|'en') {
  const name = process.env.INVOICE_ISSUER_NAME || 'Parcels of Time'
  const addr = process.env.INVOICE_ISSUER_ADDRESS || ''
  const email = process.env.INVOICE_ISSUER_EMAIL || ''
  const vat = process.env.INVOICE_ISSUER_VAT || ''
  const lines = [name]
  if (addr) lines.push(addr)
  if (email) lines.push(email)
  if (vat) lines.push((loc==='fr'?'TVA':'VAT')+': '+vat)
  return lines.join('\n')
}
function money(v:number, curr:string) {
  return `${(v/100).toFixed(2)} ${curr.toUpperCase()}`
}

// ===== DB fetchers =====
async function fetchMarketplaceRow(tsISO: string) {
  const { rows } = await pool.query(
    `select s.listing_id, s.ts, s.gross_cents, s.fee_cents, s.net_cents, s.currency,
            s.seller_owner_id, s.buyer_owner_id,
            s.stripe_session_id, s.stripe_payment_intent_id,
            so.email as seller_email, so.display_name as seller_name,
            bo.email as buyer_email, bo.display_name as buyer_name
       from secondary_sales s
       left join owners so on so.id = s.seller_owner_id
       left join owners bo on bo.id = s.buyer_owner_id
      where date_trunc('day', s.ts) = $1::timestamptz
      limit 1`,
    [tsISO],
  )
  return rows[0] || null
}
async function fetchPrimaryRow(tsISO: string) {
  const { rows } = await pool.query(
    `select c.id as claim_id, c.ts, c.price_cents, c.currency, c.created_at,
            o.id as buyer_owner_id, o.email as buyer_email, o.display_name as buyer_name
       from claims c
       left join owners o on o.id = c.owner_id
      where date_trunc('day', c.ts) = $1::timestamptz
      limit 1`,
    [tsISO],
  )
  return rows[0] || null
}

// ===== PDF (pdf-lib) =====
type PdfData = {
  title: string
  invoiceNo: string
  issuedOn: string
  sellerBlock: string
  buyerBlock: string
  lineLabel: string
  lineAmount: string
  totalLine: string
  currencyLine: string
  note: string
  footnote?: string
}
async function buildPdf(data: PdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4
  const margin = 36
  const { width } = page.getSize()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = 841.89 - margin

  // Title
  page.drawText(data.title, { x: margin, y: y - 20, size: 18, font: fontBold })
  y -= 34
  page.drawText(`${data.invoiceNo}`, { x: margin, y, size: 10, font })
  y -= 14
  page.drawText(`${data.issuedOn}`, { x: margin, y, size: 10, font })
  y -= 22

  // Columns: seller / buyer
  const colW = (width - margin*2) / 2
  const sellerY = y
  page.drawText(' ', { x: margin, y, size: 1, font }) // spacer
  page.drawText(data.sellerBlock.split('\n')[0] || '', { x: margin, y, size: 12, font: fontBold })
  y -= 16
  const sellerLines = data.sellerBlock.split('\n').slice(1)
  for (const line of sellerLines) {
    page.drawText(line, { x: margin, y, size: 10, font })
    y -= 14
  }

  // buyer (same top)
  let y2 = sellerY
  page.drawText(data.buyerBlock.split('\n')[0] || '', { x: margin + colW, y: y2, size: 12, font: fontBold })
  y2 -= 16
  const buyerLines = data.buyerBlock.split('\n').slice(1)
  for (const line of buyerLines) {
    page.drawText(line, { x: margin + colW, y: y2, size: 10, font })
    y2 -= 14
  }

  // Move y under the tallest column
  y = Math.min(y, y2) - 18

  // Item line header
  page.drawText(data.lineLabel, { x: margin, y, size: 12, font: fontBold })
  y -= 18

  // Item line (label at left, amount at right)
  page.drawText(data.lineLabel, { x: margin, y, size: 10, font })
  page.drawText(data.lineAmount, {
    x: width - margin - font.widthOfTextAtSize(data.lineAmount, 10),
    y, size: 10, font
  })
  y -= 10

  // Divider
  y -= 6
  page.drawLine({
    start: { x: margin, y },
    end:   { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.6,0.6,0.6),
  })
  y -= 16

  // Totals
  page.drawText(data.totalLine, { x: margin, y, size: 12, font: fontBold })
  y -= 16
  page.drawText(data.currencyLine, { x: margin, y, size: 10, font })
  y -= 14

  // Note / footnote
  const noteLines = [data.note, data.footnote].filter(Boolean).join('\n')
  if (noteLines) {
    y -= 8
    const lines = noteLines.split('\n')
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.35,0.35,0.35) })
      y -= 12
    }
  }

  const bytes = await doc.save()
  return bytes
}

// ===== Route =====
export async function GET(req: Request, ctx: any) {
  const raw = decodeURIComponent(String(ctx?.params?.ymd || ''))
  const tsISO = toIsoDay(raw)
  if (!tsISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Accès : owner du jour OU (si marketplace) buyer/seller
  const resolvedOwnerId = await ownerIdForDaySafe(tsISO)
  let canAccess = resolvedOwnerId === sess.ownerId

  const mp = await fetchMarketplaceRow(tsISO)
  const isMarketplace = !!mp
  if (isMarketplace && mp) {
    if (sess.ownerId === String(mp.seller_owner_id) || sess.ownerId === String(mp.buyer_owner_id)) {
      canAccess = true
    }
  }
  if (!canAccess) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Données
  const loc = pickLocale(req)
  const t = labels(loc)

  let invoiceNumber = ''
  let issueDateISO = ''
  let sellerBlock = ''
  let buyerBlock = ''
  let totalCents = 0
  let currency = 'EUR'
  let paymentRef = ''
  const ymd = tsISO.slice(0,10)
  const docTitle = isMarketplace ? t.receipt : t.invoice

  if (isMarketplace && mp) {
    invoiceNumber = `MP-${ymd.replace(/-/g,'')}-${mp.listing_id}`
    issueDateISO = new Date(mp.ts).toISOString().slice(0,10)
    const sellerName = mp.seller_name || mp.seller_email || 'Seller'
    const sellerEmail = mp.seller_email || ''
    const buyerName = mp.buyer_name || mp.buyer_email || ''
    const buyerEmail = mp.buyer_email || ''
    sellerBlock = [t.seller, sellerName, sellerEmail].filter(Boolean).join('\n')
    buyerBlock  = [t.buyer,  buyerName,  buyerEmail ].filter(Boolean).join('\n')
    totalCents = Number(mp.gross_cents) | 0
    currency = String(mp.currency || 'EUR')
    paymentRef = mp.stripe_payment_intent_id || mp.stripe_session_id || ''
  } else {
    const p = await fetchPrimaryRow(tsISO)
    if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    invoiceNumber = `POT-${ymd.replace(/-/g,'')}-${p.claim_id}`
    issueDateISO = (p.created_at ? new Date(p.created_at) : new Date(p.ts)).toISOString().slice(0,10)
    sellerBlock = ['Issuer', issuerBlock(loc)].join('\n')
    const buyerName = p.buyer_name || p.buyer_email || ''
    const buyerEmail = p.buyer_email || ''
    buyerBlock = [t.buyer, buyerName, buyerEmail].filter(Boolean).join('\n')
    totalCents = Number(p.price_cents) | 0
    currency = String(p.currency || 'EUR')
  }

  // PDF
  const pdfBytes = await buildPdf({
    title: docTitle,
    invoiceNo: `${t.invoiceNo} ${invoiceNumber}`,
    issuedOn: `${t.issuedOn} ${issueDateISO}`,
    sellerBlock,
    buyerBlock,
    lineLabel: `${t.day} ${ymd}`,
    lineAmount: money(totalCents, currency),
    totalLine: `${t.total}: ${money(totalCents, currency)}`,
    currencyLine: `${t.currency}: ${currency.toUpperCase()}`,
    note: [t.mpNote, paymentRef ? `Payment: ${paymentRef}` : ''].filter(Boolean).join('\n'),
    footnote: !isMarketplace ? (process.env.INVOICE_FOOTNOTE || '') : undefined,
  })

  const body = new Uint8Array(pdfBytes)
  const filename = `invoice_${ymd}.pdf`
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
      'content-length': String(body.byteLength),
    },
  })
}
