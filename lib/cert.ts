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

/** Safe area (marges depuis les bords) en points (A4 @72dpi) — calibrée par style */
function getSafeArea(style: CertStyle) {
  // Base confortable
  const base = { top: 140, right: 96, bottom: 160, left: 96 }
  switch (style) {
    case 'romantic':   return { top: 160, right: 116, bottom: 160, left: 116 }
    case 'birthday':   return { top: 140, right: 136, bottom: 160, left: 136 }
    case 'birth':      return { top: 150, right: 112, bottom: 160, left: 112 }
    case 'wedding':    return { top: 160, right: 124, bottom: 160, left: 124 }
    case 'christmas':  return { top: 150, right: 112, bottom: 160, left: 112 }
    case 'newyear':    return { top: 150, right: 112, bottom: 160, left: 112 }
    case 'graduation': return { top: 150, right: 112, bottom: 160, left: 112 }
    default:           return base
  }
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
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
  const page = pdf.addPage([595.28, 841.89]) // A4 portrait (pt)
  const { width, height } = page.getSize()

  // --- Background ---
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

  // Fin cadre discret
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: rgb(0.88,0.86,0.83), borderWidth: 1 })

  // --- Fonts/Couleurs ---
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const cMain = rgb(0.05,0.05,0.05)
  const cSub  = rgb(0.35,0.35,0.35)
  const CENTER = (x: number) => x // helper for clarity

  // --- Safe area ---
  const SA = getSafeArea(style)
  const LEFT = SA.left
  const RIGHT = width - SA.right
  const TOP_Y = height - SA.top
  const BOT_Y = SA.bottom
  const COLW = RIGHT - LEFT
  const CX = (LEFT + RIGHT) / 2

  // --- Header (un peu plus bas) ---
  let yHeader = TOP_Y - 18
  const brand = 'Parcels of Time'
  const brandSize = 18
  const brandW = fontBold.widthOfTextAtSize(brand, brandSize)
  page.drawText(brand, { x: CX - brandW/2, y: yHeader, size: brandSize, font: fontBold, color: cMain })

  yHeader -= 22
  const sub = 'Certificate of Claim'
  const subSize = 12
  const subW = font.widthOfTextAtSize(sub, subSize)
  page.drawText(sub, { x: CX - subW/2, y: yHeader, size: subSize, font, color: rgb(0.18,0.18,0.18) })

  // --- Mesures typographiques ---
  const tsSize = 26, labelSize = 10.5, nameSize = 15, msgSize = 12.5, linkSize = 10.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16, lineHLink = 14

  // Zone dispo entre la fin du header et le bas de la safe area
  const contentTopMax = yHeader - 40
  const contentBottomMin = BOT_Y
  const availH = contentTopMax - contentBottomMin

  // Contenu (centré et légèrement remonté)
  const tsText = ts.replace('T',' ').replace('Z',' UTC')
  const fixedAboveMsg =
    (tsSize + 6) +                    // timestamp approx height
    gapSection +
    (labelSize + 2) + gapSmall +      // "Owned by"
    (nameSize + 4)

  // QR + meta bloc
  const qrSize = 120
  const afterTextToQR = 18
  const afterQRToMeta = 10
  const metaBlockH = 76 // label + id + label + hash(2l) + marges

  // Wraps
  const msgLinesAll = message ? wrapText('“' + message + '”', font, msgSize, COLW) : []
  const linkLinesAll = link_url ? wrapText(link_url, font, linkSize, COLW) : []

  // Nombre de lignes permis pour tout faire tenir + marge
  const spaceForText = availH - (afterTextToQR + qrSize + afterQRToMeta + metaBlockH)
  const maxMsgLines = Math.max(0, Math.floor((spaceForText - fixedAboveMsg - gapSection /* label msg */) / lineHMsg))
  const msgLines = msgLinesAll.slice(0, maxMsgLines)

  const spaceAfterMsg = spaceForText - fixedAboveMsg - (msgLines.length ? gapSection + msgLines.length*lineHMsg : 0)
  const maxLinkLines = Math.min(2, Math.max(0, Math.floor((spaceAfterMsg - (link_url ? gapSection : 0)) / lineHLink)))
  const linkLines = linkLinesAll.slice(0, maxLinkLines)

  // Hauteur totale du bloc central (texte + QR + meta)
  const blockH =
    fixedAboveMsg +
    (msgLines.length ? gapSection + msgLines.length*lineHMsg : 0) +
    (linkLines.length ? gapSection + linkLines.length*lineHLink : 0) +
    afterTextToQR + qrSize + afterQRToMeta + metaBlockH

  // Point de départ pour centrer verticalement + léger décalage vers le haut
  const biasUp = 12 // "remonte légèrement"
  let by = contentBottomMin + (availH - blockH)/2 + biasUp

  // ---------- Rendu centré ----------
  let cursor = by + blockH

  // Timestamp
  cursor -= (tsSize + 6)
  const tsW = fontBold.widthOfTextAtSize(tsText, tsSize)
  page.drawText(tsText, { x: CX - tsW/2, y: cursor, size: tsSize, font: fontBold, color: cMain })

  // Owned by
  cursor -= gapSection
  const ownedLabel = 'Owned by'
  const ownedW = font.widthOfTextAtSize(ownedLabel, labelSize)
  page.drawText(ownedLabel, { x: CX - ownedW/2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })

  cursor -= (labelSize + 2 + gapSmall)
  const name = display_name || 'Anonymous'
  const nameW = fontBold.widthOfTextAtSize(name, nameSize)
  page.drawText(name, { x: CX - nameW/2, y: cursor - (nameSize + 4) + 4, size: nameSize, font: fontBold, color: cMain })

  // Message
  if (msgLines.length) {
    cursor -= (nameSize + 4)
    cursor -= gapSection
    const msgLabel = 'Message'
    const msgLabelW = font.widthOfTextAtSize(msgLabel, labelSize)
    page.drawText(msgLabel, { x: CX - msgLabelW/2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
    cursor -= (labelSize + 6)
    for (const line of msgLines) {
      const w = font.widthOfTextAtSize(line, msgSize)
      page.drawText(line, { x: CX - w/2, y: cursor - lineHMsg, size: msgSize, font, color: rgb(0.07,0.07,0.07) })
      cursor -= lineHMsg
    }
  } else {
    cursor -= (nameSize + 4)
  }

  // Link
  if (linkLines.length) {
    cursor -= gapSection
    const linkLabel = 'Link'
    const linkLabelW = font.widthOfTextAtSize(linkLabel, labelSize)
    page.drawText(linkLabel, { x: CX - linkLabelW/2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
    cursor -= (labelSize + 6)
    for (const line of linkLines) {
      const w = font.widthOfTextAtSize(line, linkSize)
      page.drawText(line, { x: CX - w/2, y: cursor - lineHLink, size: linkSize, font, color: rgb(0.1,0.1,0.35) })
      cursor -= lineHLink
    }
  }

  // QR (centré sous le texte)
  cursor -= afterTextToQR
  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  page.drawImage(png, { x: CX - qrSize/2, y: cursor - qrSize, width: qrSize, height: qrSize })
  cursor -= (qrSize + afterQRToMeta)

  // Métadonnées (centrées, sous le QR)
  const idLabel = 'Certificate ID'
  const idLabelW = font.widthOfTextAtSize(idLabel, labelSize)
  page.drawText(idLabel, { x: CX - idLabelW/2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
  cursor -= (labelSize + 6)

  const idW = fontBold.widthOfTextAtSize(claim_id, 10.5)
  page.drawText(claim_id, { x: CX - idW/2, y: cursor - 12, size: 10.5, font: fontBold, color: cMain })
  cursor -= 20

  const integ = 'Integrity (SHA-256)'
  const integW = font.widthOfTextAtSize(integ, labelSize)
  page.drawText(integ, { x: CX - integW/2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
  cursor -= (labelSize + 6)

  const h1 = hash.slice(0, 64)
  const h2 = hash.slice(64)
  const h1W = font.widthOfTextAtSize(h1, 9.5)
  page.drawText(h1, { x: CX - h1W/2, y: cursor - 12, size: 9.5, font, color: cMain })
  cursor -= 16
  const h2W = font.widthOfTextAtSize(h2, 9.5)
  page.drawText(h2, { x: CX - h2W/2, y: cursor - 12, size: 9.5, font, color: cMain })

  return await pdf.save()
}
