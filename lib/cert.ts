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

/** Safe area par style (insets depuis les bords), en points PDF (72 dpi) */
function getSafeArea(style: CertStyle, width: number, height: number) {
  // Par défaut : zone centrale généreuse
  const base = { top: 120, right: 82, bottom: 170, left: 82 }

  // Ajustements fins selon tes fonds A4
  switch (style) {
    case 'romantic':
      // Motifs floraux dans les coins → marge supérieure & latérales un peu plus grandes
      return { top: 140, right: 96, bottom: 170, left: 96 }
    case 'birthday':
      // Ballons & confettis sur les côtés → marge latérale plus large
      return { top: 110, right: 120, bottom: 170, left: 120 }
    case 'birth':
      // Nuages/étoiles autour, centre très clair
      return { top: 130, right: 96, bottom: 170, left: 96 }
    case 'wedding':
      // Anneaux/botanique dans les coins
      return { top: 140, right: 110, bottom: 170, left: 110 }
    case 'christmas':
      return { top: 130, right: 96, bottom: 170, left: 96 }
    case 'newyear':
      return { top: 120, right: 96, bottom: 170, left: 96 }
    case 'graduation':
      return { top: 120, right: 96, bottom: 170, left: 96 }
    default:
      return base
  }
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    const width = font.widthOfTextAtSize(test, size)
    if (width <= maxWidth) line = test
    else {
      if (line) lines.push(line)
      line = w
    }
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
  const {
    ts, display_name, message, link_url, claim_id, hash, public_url,
  } = opts
  const style: CertStyle = (opts.style || 'neutral')

  const pdf = await PDFDocument.create()
  // A4 portrait (points)
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  // 1) Fond image pleine page
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

  // 2) Cadre fin (aucune “safe area” blanche)
  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: rgb(0.88, 0.86, 0.83), borderWidth: 1
  })

  // 3) Typo
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const dark = rgb(0.05, 0.05, 0.05)
  const sub = rgb(0.35, 0.35, 0.35)

  // 4) Mise en page dans la safe area centrale
  const SA = getSafeArea(style, width, height)
  const LEFT = SA.left
  const RIGHT = width - SA.right
  const TOP = height - SA.top
  const BOTTOM = SA.bottom
  const COLW = RIGHT - LEFT

  let y = TOP

  // En-tête (brand + sous-titre)
  page.drawText('Parcels of Time', { x: LEFT, y, size: 18, font: fontBold, color: dark })
  y -= 22
  page.drawText('Certificate of Claim', { x: LEFT, y, size: 12, font, color: rgb(0.18,0.18,0.18) })

  // Timestamp (titre)
  y -= 42
  page.drawText(ts.replace('T',' ').replace('Z',' UTC'), { x: LEFT, y, size: 26, font: fontBold, color: dark })

  // Owned by
  y -= 36
  page.drawText('Owned by', { x: LEFT, y, size: 10.5, font, color: sub })
  y -= 18
  page.drawText(display_name || 'Anonymous', { x: LEFT, y, size: 14.5, font: fontBold, color: dark })

  // Message
  if (message) {
    y -= 28
    page.drawText('Message', { x: LEFT, y, size: 10.5, font, color: sub })
    y -= 18
    const body = '“' + message + '”'
    const lines = wrapText(body, font, 12.5, COLW)
    const LH = 16
    for (const line of lines) {
      // On s’arrête si on s’approche trop du pied (QR & meta)
      if (y - LH < BOTTOM + 86) break
      page.drawText(line, { x: LEFT, y, size: 12.5, font, color: rgb(0.07,0.07,0.07) })
      y -= LH
    }
  }

  // Lien optionnel (2 lignes max)
  if (link_url) {
    y -= 14
    page.drawText('Link', { x: LEFT, y, size: 10.5, font, color: sub })
    y -= 16
    const urlLines = wrapText(link_url, font, 10.5, COLW).slice(0, 2)
    for (const line of urlLines) {
      if (y - 14 < BOTTOM + 86) break
      page.drawText(line, { x: LEFT, y, size: 10.5, font, color: rgb(0.1,0.1,0.35) })
      y -= 14
    }
  }

  // 5) Pied de page : métadonnées à gauche, QR à droite (ancrés dans la même ligne de base)
  const metaTop = BOTTOM + 114 // hauteur “utile” pour meta
  page.drawText('Certificate ID', { x: LEFT, y: metaTop, size: 9.5, font, color: sub })
  page.drawText(claim_id, { x: LEFT, y: metaTop - 14, size: 10, font, color: dark })
  page.drawText('Integrity (SHA-256)', { x: LEFT, y: metaTop - 34, size: 9.5, font, color: sub })
  page.drawText(hash.slice(0, 64), { x: LEFT, y: metaTop - 48, size: 9.5, font, color: dark })
  page.drawText(hash.slice(64), { x: LEFT, y: metaTop - 60, size: 9.5, font, color: dark })

  // QR (collé au bord droit de la safe area, posé au bas)
  const qrSize = 132
  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  page.drawImage(png, {
    x: RIGHT - qrSize,      // bord droit de la safe area
    y: BOTTOM - 2 + 2,      // juste au-dessus du bas (même “ancrage visuel” que les meta)
    width: qrSize,
    height: qrSize
  })

  return await pdf.save()
}
