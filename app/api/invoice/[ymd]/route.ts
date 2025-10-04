// app/api/invoice/[ymd]/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { readSession, ownerIdForDay } from '@/lib/auth'

type L = {
  invoice: string
  receipt: string
  invoiceNo: string
  issuedOn: string
  seller: string
  buyer: string
  item: string
  day: string
  total: string
  currency: string
  mpNote: string
  platform: string
}

function pickLocale(req: Request): 'fr'|'en' {
  const h = (req.headers.get('accept-language') || '').toLowerCase()
  return h.startsWith('fr') ? 'fr' : 'en'
}

function labels(loc: 'fr'|'en'): L {
  return loc === 'fr'
    ? {
        invoice: 'Facture',
        receipt: 'Reçu d’achat (Marketplace)',
        invoiceNo: 'N°',
        issuedOn: 'Émis le',
        seller: 'Vendeur',
        buyer: 'Acheteur',
        item: 'Objet',
        day: 'Certificat — Journée',
        total: 'Total',
        currency: 'Devise',
        mpNote: 'Vente opérée via Parcels of Time (Stripe Connect). En cas de vente entre particuliers, ce document fait office de reçu.',
        platform: process.env.INVOICE_ISSUER_NAME || 'Parcels of Time',
      }
    : {
        invoice: 'Invoice',
        receipt: 'Purchase receipt (Marketplace)',
        invoiceNo: 'No.',
        issuedOn: 'Issued on',
        seller: 'Seller',
        buyer: 'Buyer',
        item: 'Item',
        day: 'Certificate — Day',
        total: 'Total',
        currency: 'Currency',
        mpNote: 'Sale operated via Parcels of Time (Stripe Connect). For peer-to-peer sales, this document acts as a receipt.',
        platform: process.env.INVOICE_ISSUER_NAME || 'Parcels of Time',
      }
}

/** Robust YYYY-MM-DD → ISO day */
function toIsoDay(ymd: string): string | null {
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T00:00:00.000Z`) : new Date(ymd)
    if (isNaN(d.getTime())) return null
    d.setUTCHours(0,0,0,0)
    return d.toISOString()
  } catch { return null }
}

async function fetchMarketplaceRow(tsISO: string) {
  // Présent si revente marketplace
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
    [tsISO]
  )
  return rows[0] || null
}

async function fetchPrimaryRow(tsISO: string) {
  // Achat direct (29€ etc.)
  const { rows } = await pool.query(
    `select c.id as claim_id, c.ts, c.price_cents, c.currency, c.created_at,
            o.id as buyer_owner_id, o.email as buyer_email, o.display_name as buyer_name
       from claims c
  left join owners o on o.id = c.owner_id
      where date_trunc('day', c.ts) = $1::timestamptz
      limit 1`,
    [tsISO]
  )
  return rows[0] || null
}

function issuerBlock(loc: 'fr'|'en') {
  // Coordonnées émetteur (plateforme) via ENV
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

async function pdfBuffer(draw: (doc: any)=>void): Promise<Buffer> {
  const mod = await import('pdfkit')
  const PDFDocument = (mod as any).default || (mod as any)
  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  const chunks: Buffer[] = []
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    draw(doc)
    doc.end()
  })
}

function money(v: number, curr: string) {
  return `${(v/100).toFixed(2)} ${curr.toUpperCase()}`
}

export async function GET(req: Request, ctx: { params: { ymd: string } }) {
  const loc = pickLocale(req)
  const t = labels(loc)
  const ymd = decodeURIComponent(ctx.params.ymd || '')
  const tsISO = toIsoDay(ymd)
  if (!tsISO) return NextResponse.json({ error: 'bad_ts' }, { status: 400 })

  // Auth + propriété
  const sess = await readSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const ownerToday = await ownerIdForDay(tsISO)
  if (!ownerToday || ownerToday !== sess.ownerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Marketplace ?
  const mp = await fetchMarketplaceRow(tsISO)
  const isMarketplace = !!mp

  // Données affichage
  let invoiceNumber = ''
  let issueDate = new Date()
  let sellerName = ''
  let sellerEmail = ''
  let buyerName = ''
  let buyerEmail = ''
  let totalCents = 0
  let currency = 'EUR'
  let paymentRef = ''
  let docTitle = isMarketplace ? t.receipt : t.invoice

  if (isMarketplace) {
    invoiceNumber = `MP-${ymd.replace(/-/g,'')}-${mp.listing_id}`
    issueDate = new Date(mp.ts)
    sellerName = mp.seller_name || mp.seller_email || 'Seller'
    sellerEmail = mp.seller_email || ''
    buyerName = mp.buyer_name || mp.buyer_email || ''
    buyerEmail = mp.buyer_email || ''
    totalCents = Number(mp.gross_cents) | 0
    currency = String(mp.currency || 'EUR')
    paymentRef = mp.stripe_payment_intent_id || mp.stripe_session_id || ''
  } else {
    const p = await fetchPrimaryRow(tsISO)
    if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    invoiceNumber = `POT-${ymd.replace(/-/g,'')}-${p.claim_id}`
    issueDate = p.created_at ? new Date(p.created_at) : new Date(p.ts)
    sellerName = t.platform
    buyerName = p.buyer_name || p.buyer_email || ''
    buyerEmail = p.buyer_email || ''
    totalCents = Number(p.price_cents) | 0
    currency = String(p.currency || 'EUR')
  }

  // Génère le PDF
  const buf = await pdfBuffer((doc: any) => {
    // header
    doc.fontSize(18).text(docTitle, { align: 'left' })
    doc.moveDown(0.2)
    doc.fontSize(10).text(`${t.invoiceNo} ${invoiceNumber}`)
    doc.text(`${t.issuedOn} ${issueDate.toISOString().slice(0,10)}`)
    doc.moveDown()

    // émetteur / destinataire
    const topY = doc.y
    doc.fontSize(12).text(isMarketplace ? t.seller : (loc==='fr'?'Émetteur':'Issuer'), { underline: true })
    doc.moveDown(0.3)
    if (isMarketplace) {
      doc.fontSize(10).text([sellerName, sellerEmail].filter(Boolean).join('\n'))
    } else {
      doc.fontSize(10).text(issuerBlock(loc))
    }

    doc.y = topY
    doc.moveDown(0.2)
    doc.text(' ', { continued: false }) // spacer
    doc.moveDown(0.5)
    doc.text(isMarketplace ? t.buyer : t.buyer, 320, topY, { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(10).text([buyerName, buyerEmail].filter(Boolean).join('\n'), 320)

    doc.moveDown(1.2)

    // ligne d'items
    doc.fontSize(12).text(t.item, { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(10)
    const leftX = 40, rightX = 520
    doc.text(`${t.day} ${ymd}`, leftX, doc.y)
    doc.text(money(totalCents, currency), rightX-120, doc.y-12, { width: 120, align: 'right' })
    doc.moveDown(0.5)
    doc.moveTo(leftX, doc.y).lineTo(rightX, doc.y).strokeColor('#999').stroke()
    doc.moveDown(0.6)
    doc.fontSize(12).text(`${t.total}: ${money(totalCents, currency)}`)
    doc.fontSize(10).text(`${t.currency}: ${currency.toUpperCase()}`)
    if (paymentRef) {
      doc.moveDown(0.2)
      doc.fontSize(9).fillColor('#666').text(`Payment: ${paymentRef}`)
      doc.fillColor('#000')
    }

    // note marketplace / conditions
    doc.moveDown(1)
    doc.fontSize(9).fillColor('#666').text(t.mpNote, { align: 'left' })
    doc.moveDown(0.4)
    if (!isMarketplace) {
      const extra = process.env.INVOICE_FOOTNOTE || ''
      if (extra) doc.text(extra)
    }
  })

  const filename = `invoice_${ymd}.pdf`
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    }
  })
}
