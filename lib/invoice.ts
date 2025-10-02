// lib/invoice.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type Party = {
  name: string
  email?: string
  address?: string
  siret?: string
  vatNumber?: string
}

export type InvoiceLine = {
  description: string
  quantity: number
  unitPrice: number
  total?: number // auto-calculé si absent
}

export type InvoiceData = {
  language: 'fr'|'en'
  currency: 'EUR'|'USD'
  issuer: Party         // émetteur (vous, ou le vendeur en marketplace/autofacturation)
  customer: Party       // acheteur
  invoiceNumber: string // ex: 2025-000123
  issueDate: string     // ISO (yyyy-mm-dd)
  dueDate?: string      // optionnel
  lines: InvoiceLine[]
  vatRate?: number      // 0 pour micro; sinon 0.2 etc.
  notes?: string        // pied de page
  meta?: Record<string,string|number|boolean>
}

function money(n: number, currency: InvoiceData['currency']) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(n)
}

function sum(lines: InvoiceLine[]) {
  return lines.reduce((acc, l) => acc + (l.total ?? l.quantity * l.unitPrice), 0)
}

/** Génère un PDF d'une page (A4) — renvoie un Buffer/Uint8Array utilisable en pièce jointe. */
export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 portrait (points)
  const { width } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const PADDING = 40
  let y = 800

  // Header band
  page.drawRectangle({ x:0, y:780, width, height:60, color: rgb(0.043,0.055,0.078) }) // ~#0B0E14
  page.drawText(data.language === 'fr' ? 'FACTURE' : 'INVOICE', {
    x: PADDING, y: 798, size: 18, font: fontBold, color: rgb(0.898,0.917,0.949)
  })
  page.drawText(`${data.invoiceNumber} — ${data.issueDate}`, {
    x: PADDING, y: 780, size: 10, font, color: rgb(0.898,0.917,0.949)
  })

  // Issuer / Customer
  y = 740
  const labels = data.language === 'fr'
    ? { issuer:'Émetteur', customer:'Client', siret:'SIRET', vat:'TVA' }
    : { issuer:'Issuer', customer:'Customer', siret:'SIRET', vat:'VAT' }

  const block = (title: string, p: Party, x: number) => {
    page.drawText(title, { x, y, size: 10, font: fontBold })
    let yy = y - 14
    page.drawText(p.name || '', { x, y: yy, size: 10, font })
    yy -= 12
    if (p.address) { page.drawText(p.address, { x, y: yy, size: 10, font }); yy -= 12 }
    if (p.email)   { page.drawText(p.email,   { x, y: yy, size: 10, font }); yy -= 12 }
    if (p.siret)   { page.drawText(`${labels.siret}: ${p.siret}`, { x, y: yy, size: 10, font }); yy -= 12 }
    if (p.vatNumber) { page.drawText(`${labels.vat}: ${p.vatNumber}`, { x, y: yy, size: 10, font }); }
  }
  block(labels.issuer, data.issuer, PADDING)
  block(labels.customer, data.customer, width/2)

  // Table header
  y = 620
  page.drawText(data.language === 'fr' ? 'Désignation' : 'Description', { x:PADDING, y, size: 10, font: fontBold })
  page.drawText(data.language === 'fr' ? 'Qté' : 'Qty', { x: 360, y, size:10, font: fontBold })
  page.drawText(data.language === 'fr' ? 'PU' : 'Unit', { x: 410, y, size:10, font: fontBold })
  page.drawText(data.language === 'fr' ? 'Total' : 'Total', { x: 480, y, size:10, font: fontBold })
  y -= 8
  page.drawLine({ start:{x:PADDING, y}, end:{x:width-PADDING, y}, thickness:1, color: rgb(0.118,0.165,0.235) })
  y -= 14

  // Lines
  data.lines.forEach(line => {
    const total = line.total ?? line.quantity * line.unitPrice
    page.drawText(line.description, { x:PADDING, y, size:10, font })
    page.drawText(String(line.quantity), { x:365, y, size:10, font })
    page.drawText(money(line.unitPrice, data.currency), { x:410, y, size:10, font })
    page.drawText(money(total, data.currency), { x:480, y, size:10, font: fontBold })
    y -= 16
  })

  // Totals
  y -= 10
  const exVat = sum(data.lines)
  const rate = data.vatRate ?? 0
  const vat = +(exVat * rate).toFixed(2)
  const grand = exVat + vat

  const right = (label: string, val: string, yy: number, bold=false) => {
    page.drawText(label, { x: 360, y: yy, size: 10, font: bold ? fontBold : font })
    page.drawText(val, { x: 480, y: yy, size: 10, font: bold ? fontBold : font })
  }
  right(data.language === 'fr' ? 'Sous-total HT' : 'Subtotal (ex VAT)', money(exVat, data.currency), y); y -= 14
  right(data.language === 'fr' ? `TVA (${(rate*100).toFixed(0)}%)` : `VAT (${(rate*100).toFixed(0)}%)`, money(vat, data.currency), y); y -= 14
  right(data.language === 'fr' ? 'Total à payer' : 'Total due', money(grand, data.currency), y, true); y -= 22

  // Notes (TVA art. 293 B, retrait, médiateur…)
  const note = data.notes ?? ''
  if (note) {
    page.drawLine({ start:{x:PADDING, y}, end:{x:width-PADDING, y}, thickness:1, color: rgb(0.118,0.165,0.235) })
    y -= 12
    const wrap = (t: string, max = 88) => t.match(new RegExp(`.{1,${max}}(\\s|$)`, 'g')) ?? [t]
    wrap(note).forEach((ln) => { page.drawText(ln.trim(), { x:PADDING, y, size:9, font }); y -= 12 })
  }

  return await pdf.save()
}

/* Aides de construction prêtes à l’emploi */

// 1) Achat « classique » (vous => client)
export async function buildClassicInvoicePdf(opts: {
  language: 'fr'|'en'
  issuer: Party
  customer: Party
  tsLabel: string           // ex: "2025-03-15 12:34"
  unitPrice: number         // TTC si TVA=0
  currency?: 'EUR'|'USD'
  invoiceNumber: string
  issueDate: string         // yyyy-mm-dd
  microEntrepreneur?: boolean
}): Promise<Uint8Array> {
  const notes = opts.language === 'fr'
    ? [
        'Contenu numérique fourni immédiatement — droit de rétractation non applicable (art. 16 m, Dir. 2011/83/UE).',
        opts.microEntrepreneur ? 'TVA non applicable, art. 293 B du CGI.' : '',
        'Médiateur de la consommation (CM2C) : 49 rue de Ponthieu, 75008 Paris — litiges@cm2c.net — https://www.cm2c.net/declarer-un-litige.php',
      ].filter(Boolean).join(' ')
    : [
        'Digital content delivered immediately — withdrawal right not applicable (Art. 16 m, Dir. 2011/83/EU).',
        opts.microEntrepreneur ? 'VAT not applicable (French VAT exemption — Art. 293 B CGI).' : '',
        'Consumer mediation (CM2C): 49 rue de Ponthieu, 75008 Paris — litiges@cm2c.net — https://www.cm2c.net/declarer-un-litige.php',
      ].filter(Boolean).join(' ')

  return buildInvoicePdf({
    language: opts.language,
    currency: opts.currency ?? 'EUR',
    issuer: opts.issuer,
    customer: opts.customer,
    invoiceNumber: opts.invoiceNumber,
    issueDate: opts.issueDate,
    lines: [{
      description: opts.language === 'fr'
        ? `Certificat numérique — journée ${opts.tsLabel}`
        : `Digital certificate — day ${opts.tsLabel}`,
      quantity: 1,
      unitPrice: opts.unitPrice,
    }],
    vatRate: 0, // micro par défaut
    notes,
  })
}

// 2) Marketplace (vendeur => acheteur) + commission (vous => vendeur)
export async function buildMarketplacePdfs(opts: {
  language: 'fr'|'en'
  platform: Party             // Parcels of Time (pour la commission)
  seller: Party               // profil vendeur
  buyer: Party
  tsLabel: string
  salePrice: number
  fee: number                 // votre commission
  currency?: 'EUR'|'USD'
  invoiceNumberBuyer: string  // facture de vente (seller->buyer)
  invoiceNumberFee: string    // facture de commission (platform->seller)
  issueDate: string
  selfBilling?: boolean       // si true: mention "émise pour le compte du vendeur"
}): Promise<{ buyerInvoice: Uint8Array, feeInvoice: Uint8Array }> {
  const buyerNotes = opts.language === 'fr'
    ? [
        opts.selfBilling ? 'Facture émise par la plateforme au nom et pour le compte du vendeur (autofacturation).' : '',
        'Contenu numérique fourni immédiatement — droit de rétractation non applicable (art. 16 m, Dir. 2011/83/UE).',
        'TVA non applicable, art. 293 B du CGI (si vendeur en franchise en base).',
        'Médiateur : CM2C — 49 rue de Ponthieu, 75008 Paris — litiges@cm2c.net — https://www.cm2c.net/declarer-un-litige.php',
      ].filter(Boolean).join(' ')
    : [
        opts.selfBilling ? 'Invoice issued by the platform on behalf of the seller (self-billing).' : '',
        'Digital content delivered immediately — withdrawal right not applicable (Art. 16 m, Dir. 2011/83/EU).',
        'VAT not applicable (French micro-entrepreneur VAT exemption — Art. 293 B CGI, if applicable).',
        'Mediator: CM2C — 49 rue de Ponthieu, 75008 Paris — litiges@cm2c.net — https://www.cm2c.net/declarer-un-litige.php',
      ].filter(Boolean).join(' ')

  const buyerInvoice = await buildInvoicePdf({
    language: opts.language,
    currency: opts.currency ?? 'EUR',
    issuer: opts.selfBilling ? { ...opts.seller, name: `${opts.seller.name} (via Parcels of Time)` } : opts.seller,
    customer: opts.buyer,
    invoiceNumber: opts.invoiceNumberBuyer,
    issueDate: opts.issueDate,
    lines: [{
      description: opts.language === 'fr'
        ? `Revente certificat numérique — journée ${opts.tsLabel}`
        : `Secondary sale — digital certificate for ${opts.tsLabel}`,
      quantity: 1,
      unitPrice: opts.salePrice,
    }],
    vatRate: 0,
    notes: buyerNotes,
  })

  const feeNotes = opts.language === 'fr'
    ? 'Commission de plateforme liée à la transaction marketplace.'
    : 'Platform fee related to marketplace transaction.'

  const feeInvoice = await buildInvoicePdf({
    language: opts.language,
    currency: opts.currency ?? 'EUR',
    issuer: opts.platform,
    customer: opts.seller,
    invoiceNumber: opts.invoiceNumberFee,
    issueDate: opts.issueDate,
    lines: [{
      description: opts.language === 'fr' ? 'Commission marketplace' : 'Marketplace fee',
      quantity: 1,
      unitPrice: opts.fee,
    }],
    vatRate: 0,
    notes: feeNotes,
  })

  return { buyerInvoice, feeInvoice }
}
