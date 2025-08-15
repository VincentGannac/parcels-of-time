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

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    const width = font.widthOfTextAtSize(test, size)
    if (width <= maxWidth) {
      line = test
    } else {
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
  // A4 portrait (pt)
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  // Background image full
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

  // Thin frame (no overlay)
  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: rgb(0.88, 0.86, 0.83), borderWidth: 1
  })

  // Typography
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // ---- Central layout grid ----
  const LEFT = 82 // généreux pour laisser respirer les bordures décorées
  const RIGHT = width - 82
  const COLW = RIGHT - LEFT

  let cursorY = height - 120

  // Brand / subtitle
  page.drawText('Parcels of Time', { x: LEFT, y: cursorY, size: 18, font: fontBold, color: rgb(0.06,0.06,0.06) })
  cursorY -= 22
  page.drawText('Certificate of Claim', { x: LEFT, y: cursorY, size: 12, font, color: rgb(0.18,0.18,0.18) })

  // Timestamp as title
  cursorY -= 42
  page.drawText(ts.replace('T',' ').replace('Z',' UTC'), { x: LEFT, y: cursorY, size: 26, font: fontBold, color: rgb(0.05,0.05,0.05) })

  // Owner block
  cursorY -= 36
  page.drawText('Owned by', { x: LEFT, y: cursorY, size: 10.5, font, color: rgb(0.35,0.35,0.35) })
  cursorY -= 18
  page.drawText(display_name || 'Anonymous', { x: LEFT, y: cursorY, size: 14.5, font: fontBold, color: rgb(0.05,0.05,0.05) })

  // Message block
  if (message) {
    cursorY -= 28
    page.drawText('Message', { x: LEFT, y: cursorY, size: 10.5, font, color: rgb(0.35,0.35,0.35) })
    cursorY -= 18
    const body = '“' + message + '”'
    const lines = wrapText(body, font, 12.5, COLW)
    const LH = 16
    for (const line of lines) {
      page.drawText(line, { x: LEFT, y: cursorY, size: 12.5, font, color: rgb(0.07,0.07,0.07) })
      cursorY -= LH
      if (cursorY < 190) break // on garde de l'air pour le pied
    }
  }

  // Optional link
  if (link_url) {
    cursorY -= 14
    page.drawText('Link', { x: LEFT, y: cursorY, size: 10.5, font, color: rgb(0.35,0.35,0.35) })
    cursorY -= 16
    const urlLines = wrapText(link_url, font, 10.5, COLW)
    for (const line of urlLines.slice(0, 2)) {
      page.drawText(line, { x: LEFT, y: cursorY, size: 10.5, font, color: rgb(0.1,0.1,0.35) })
      cursorY -= 14
    }
  }

  // Footer meta (left) + QR (right)
  // Meta
  const metaYTop = 138
  page.drawText('Certificate ID', { x: LEFT, y: metaYTop, size: 9.5, font, color: rgb(0.35,0.35,0.35) })
  page.drawText(opts.claim_id, { x: LEFT, y: metaYTop - 14, size: 10, font, color: rgb(0.08,0.08,0.08) })
  page.drawText('Integrity (SHA-256)', { x: LEFT, y: metaYTop - 34, size: 9.5, font, color: rgb(0.35,0.35,0.35) })
  page.drawText(opts.hash.slice(0, 64), { x: LEFT, y: metaYTop - 48, size: 9.5, font, color: rgb(0.08,0.08,0.08) })
  page.drawText(opts.hash.slice(64), { x: LEFT, y: metaYTop - 60, size: 9.5, font, color: rgb(0.08,0.08,0.08) })

  // QR
  const qrDataUrl = await QRCode.toDataURL(opts.public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  const qrSize = 132
  page.drawImage(png, { x: width - qrSize - 64, y: 78, width: qrSize, height: qrSize })

  return await pdf.save()
}
