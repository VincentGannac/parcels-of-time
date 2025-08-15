// lib/cert.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'node:fs/promises'
import path from 'node:path'

export type CertStyle =
  | 'neutral'
  | 'romantic'
  | 'birthday'
  | 'wedding'
  | 'birth'
  | 'christmas'
  | 'newyear'
  | 'graduation'

async function loadBgFromPublic(style: CertStyle): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' } | null> {
  const base = path.join(process.cwd(), 'public', 'cert_bg')
  const candidates = [
    path.join(base, `${style}.png`),
    path.join(base, `${style}.jpg`),
    path.join(base, `${style}.jpeg`),
  ]
  for (const p of candidates) {
    try {
      const buf = await fs.readFile(p)
      const low = p.toLowerCase()
      return { bytes: new Uint8Array(buf), kind: low.endsWith('.png') ? 'png' : 'jpg' }
    } catch {}
  }
  return null
}

/** Safe area (marges depuis les bords), en points PDF (72dpi) */
function getSafeArea(style: CertStyle) {
  // base généreuse; on ajuste style par style pour tenir compte des bordures décorées
  const base = { top: 140, right: 90, bottom: 170, left: 90 }

  switch (style) {
    case 'romantic':   return { top: 160, right: 110, bottom: 170, left: 110 }
    case 'birthday':   return { top: 140, right: 130, bottom: 170, left: 130 }
    case 'birth':      return { top: 150, right: 105, bottom: 170, left: 105 }
    case 'wedding':    return { top: 160, right: 120, bottom: 170, left: 120 }
    case 'christmas':  return { top: 150, right: 105, bottom: 170, left: 105 }
    case 'newyear':    return { top: 150, right: 105, bottom: 170, left: 105 }
    case 'graduation': return { top: 150, right: 105, bottom: 170, left: 105 }
    default:           return base
  }
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    const wpx = font.widthOfTextAtSize(test, size)
    if (wpx <= maxWidth) line = test
    else { if (line) lines.push(line); line = w }
  }
  if (line) lines.push(line)
  return lines
}

export async function generateCertificatePDF(opts: {
  ts: string
  display_name: string
  message?: string | null
  link_url?: string | null
  claim_id: string
  hash: string
  public_url: string
  style?: CertStyle
}) {
  const { ts, display_name, message, link_url, claim_id, hash, public_url } = opts
  const style: CertStyle = (opts.style || 'neutral')

  const pdf = await PDFDocument.create()
  // A4 portrait
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  // Fond image
  try {
    const bg = await loadBgFromPublic(style)
    if (bg) {
      const img = bg.kind === 'png' ? await pdf.embedPng(bg.bytes) : await pdf.embedJpg(bg.bytes)
      page.drawImage(img, { x: 0, y: 0, width, height })
    } else {
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.98, 0.96) })
    }
  } catch {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) })
  }

  // Cadre discret
  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: rgb(0.88, 0.86, 0.83), borderWidth: 1
  })

  // Fonts & couleurs
  const font     = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const cMain = rgb(0.05,0.05,0.05)
  const cSub  = rgb(0.35,0.35,0.35)

  // ---------- ZONES ----------
  const SA = getSafeArea(style)
  const LEFT   = SA.left
  const RIGHT  = width - SA.right
  const TOP_Y  = height - SA.top
  const BOT_Y  = SA.bottom
  const CENTER_X = (LEFT + RIGHT) / 2
  const COLW  = RIGHT - LEFT

  // Réserve pour pied de page (QR + meta)
  const FOOTER_H = 132 + 20 // QR + marge
  const FOOTER_TOP = BOT_Y + FOOTER_H

  // 1) HEADER (descendu un peu)
  let y = TOP_Y - 20  // 👈 "redescend un peu"
  const brandSize = 18
  const subtitleSize = 12

  const brandW = fontBold.widthOfTextAtSize('Parcels of Time', brandSize)
  page.drawText('Parcels of Time', { x: CENTER_X - brandW/2, y, size: brandSize, font: fontBold, color: cMain })
  y -= 22
  const subW = font.widthOfTextAtSize('Certificate of Claim', subtitleSize)
  page.drawText('Certificate of Claim', { x: CENTER_X - subW/2, y, size: subtitleSize, font, color: rgb(0.18,0.18,0.18) })

  // 2) CONTENU CENTRAL — centré HORIZONTALEMENT et VERTICALEMENT dans la zone libre
  // On calcule d'abord la hauteur du bloc (titre + owned + message + (éventuel) lien), pour centrer verticalement.
  const tsSize = 26, labelSize = 10.5, nameSize = 15, msgSize = 12.5, linkSize = 10.5
  const lineGap = 8, sectionGap = 14

  const tsText = ts.replace('T',' ').replace('Z',' UTC')
  const tsH = 26 // approximé (asc/desc peu prononcés en Helvetica)
  const ownedLabelH = labelSize + 2
  const nameH = nameSize + 4

  const contentTopMax = y - 42      // marge après header
  const contentBottomMin = FOOTER_TOP + 16
  const contentAvailH = contentTopMax - contentBottomMin

  // Message lines (on fixe un max en fonction de l'espace)
  const msgLinesAll = message ? wrapText('“' + message + '”', font, msgSize, COLW) : []
  const msgLineHeight = 16
  const msgMaxLines = Math.max(0, Math.floor((contentAvailH - (tsH + ownedLabelH + nameH + sectionGap*3)) / msgLineHeight))
  const msgLines = msgLinesAll.slice(0, Math.min(msgLinesAll.length, msgMaxLines))

  // Link lines (1 à 2 lignes max si la place le permet)
  const linkLinesAll = link_url ? wrapText(link_url, font, linkSize, COLW) : []
  const linkMaxLines = Math.min(2, Math.max(0, Math.floor((contentAvailH - (tsH + ownedLabelH + nameH + sectionGap*3 + msgLines.length*msgLineHeight)) / 14)))
  const linkLines = linkLinesAll.slice(0, linkMaxLines)

  // Hauteur totale du bloc
  let blockH =
    tsH +
    sectionGap +
    ownedLabelH + lineGap + nameH +
    (msgLines.length ? sectionGap + msgLines.length * msgLineHeight : 0) +
    (linkLines.length ? sectionGap + linkLines.length * 14 : 0)

  // Y de départ pour centrer verticalement le bloc
  let by = contentBottomMin + (contentAvailH - blockH) / 2

  // --- Timestamp (centré)
  const tsW = fontBold.widthOfTextAtSize(tsText, tsSize)
  page.drawText(tsText, { x: CENTER_X - tsW/2, y: by + blockH - tsH, size: tsSize, font: fontBold, color: cMain })

  // --- Owned by + Name
  let cursor = by + blockH - tsH - sectionGap
  const ownedW = font.widthOfTextAtSize('Owned by', labelSize)
  page.drawText('Owned by', { x: CENTER_X - ownedW/2, y: cursor - ownedLabelH, size: labelSize, font, color: cSub })
  cursor -= (ownedLabelH + lineGap)
  const nameW = fontBold.widthOfTextAtSize(display_name || 'Anonymous', nameSize)
  page.drawText(display_name || 'Anonymous', { x: CENTER_X - nameW/2, y: cursor - nameH + 4, size: nameSize, font: fontBold, color: cMain })
  cursor -= (nameH)

  // --- Message (centé, multi-lignes)
  if (msgLines.length) {
    cursor -= sectionGap
    const msgLabelW = font.widthOfTextAtSize('Message', labelSize)
    page.drawText('Message', { x: CENTER_X - msgLabelW/2, y: cursor - labelSize - 2, size: labelSize, font, color: cSub })
    cursor -= (labelSize + 6)
    for (const line of msgLines) {
      const w = font.widthOfTextAtSize(line, msgSize)
      page.drawText(line, { x: CENTER_X - w/2, y: cursor - msgLineHeight, size: msgSize, font, color: rgb(0.07,0.07,0.07) })
      cursor -= msgLineHeight
    }
  }

  // --- Lien (éventuel), centré aussi
  if (linkLines.length) {
    cursor -= sectionGap
    const linkLabelW = font.widthOfTextAtSize('Link', labelSize)
    page.drawText('Link', { x: CENTER_X - linkLabelW/2, y: cursor - labelSize - 2, size: labelSize, font, color: cSub })
    cursor -= (labelSize + 6)
    for (const line of linkLines) {
      const w = font.widthOfTextAtSize(line, linkSize)
      page.drawText(line, { x: CENTER_X - w/2, y: cursor - 14, size: linkSize, font, color: rgb(0.1,0.1,0.35) })
      cursor -= 14
    }
  }

  // 3) Pied de page : métadonnées (gauche) + QR (droite) — inchangé
  const metaTop = BOT_Y + 114
  page.drawText('Certificate ID', { x: LEFT, y: metaTop, size: 9.5, font, color: cSub })
  page.drawText(claim_id,         { x: LEFT, y: metaTop - 14, size: 10,  font: fontBold, color: cMain })
  page.drawText('Integrity (SHA-256)', { x: LEFT, y: metaTop - 34, size: 9.5, font, color: cSub })
  page.drawText(hash.slice(0, 64), { x: LEFT, y: metaTop - 48, size: 9.5, font, color: cMain })
  page.drawText(hash.slice(64),    { x: LEFT, y: metaTop - 60, size: 9.5, font, color: cMain })

  // QR à droite, collé à la safe area
  const qrSize = 132
  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  page.drawImage(png, { x: RIGHT - qrSize, y: BOT_Y, width: qrSize, height: qrSize })

  return await pdf.save()
}
