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

  // 1) Fond image pleine page (depuis /public/cert_bg)
  try {
    const bg = await loadBgFromPublic(style)
    if (bg) {
      const img = bg.kind === 'png' ? await pdf.embedPng(bg.bytes) : await pdf.embedJpg(bg.bytes)
      page.drawImage(img, { x: 0, y: 0, width, height })
    } else {
      // Fallback : papier ivoire léger
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.98, 0.96) })
    }
  } catch {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) })
  }

  // 2) Cadre discret (pas de voile/safe-area)
  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: rgb(0.88, 0.86, 0.83), borderWidth: 1
  })

  // 3) Typo (directement sur le fond)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Header
  page.drawText('Parcels of Time', { x: 64, y: height - 96, size: 18, font: fontBold, color: rgb(0.05, 0.05, 0.05) })
  page.drawText('Certificate of Claim', { x: 64, y: height - 120, size: 12, font, color: rgb(0.1, 0.1, 0.1) })

  // Timestamp
  page.drawText(ts.replace('T', ' ').replace('Z', ' UTC'), { x: 64, y: height - 180, size: 22, font: fontBold, color: rgb(0.05,0.05,0.05) })

  // Owner
  page.drawText('Owned by', { x: 64, y: height - 220, size: 11, font, color: rgb(0.28, 0.28, 0.28) })
  page.drawText(display_name || 'Anonymous', { x: 64, y: height - 238, size: 14, font: fontBold, color: rgb(0.05,0.05,0.05) })

  // Message
  if (message) {
    page.drawText('Message', { x: 64, y: height - 270, size: 11, font, color: rgb(0.28, 0.28, 0.28) })
    page.drawText('“' + message + '”', { x: 64, y: height - 288, size: 12, font, color: rgb(0.05,0.05,0.05) })
  }

  // Link
  if (link_url) {
    page.drawText('Link', { x: 64, y: height - 318, size: 11, font, color: rgb(0.28, 0.28, 0.28) })
    page.drawText(link_url, { x: 64, y: height - 336, size: 10, font, color: rgb(0.1,0.1,0.3) })
  }

  // Footer meta
  page.drawText('Certificate ID', { x: 64, y: 140, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(claim_id, { x: 64, y: 126, size: 10, font, color: rgb(0.08,0.08,0.08) })
  page.drawText('Integrity (SHA-256)', { x: 64, y: 106, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(hash.slice(0, 64), { x: 64, y: 92, size: 9, font, color: rgb(0.08,0.08,0.08) })
  page.drawText(hash.slice(64), { x: 64, y: 80, size: 9, font, color: rgb(0.08,0.08,0.08) })

  // 4) QR direct sur le fond
  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  page.drawImage(png, { x: width - 196, y: 80, width: 132, height: 132 })

  return await pdf.save()
}
