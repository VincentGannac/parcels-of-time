// lib/cert.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export async function generateCertificatePDF(opts: {
  ts: string
  display_name: string
  message?: string | null
  link_url?: string | null
  claim_id: string
  hash: string
  public_url: string
}) {
  const { ts, display_name, message, link_url, claim_id, hash, public_url } = opts
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawText('Parcels of Time', { x: 64, y: height - 96, size: 18, font: fontBold, color: rgb(0.05,0.05,0.05) })
  page.drawText('Certificate of Claim', { x: 64, y: height - 120, size: 12, font })

  page.drawText(ts.replace('T',' ').replace('Z',' UTC'), { x: 64, y: height - 180, size: 22, font: fontBold })

  page.drawText('Owned by', { x: 64, y: height - 220, size: 11, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(display_name || 'Anonymous', { x: 64, y: height - 238, size: 14, font: fontBold })

  if (message) {
    page.drawText('Message', { x: 64, y: height - 270, size: 11, font, color: rgb(0.3,0.3,0.3) })
    page.drawText('“' + message + '”', { x: 64, y: height - 288, size: 12, font })
  }

  page.drawText('Certificate ID', { x: 64, y: 140, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(claim_id, { x: 64, y: 126, size: 10, font })
  page.drawText('Integrity (SHA-256)', { x: 64, y: 106, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(hash.slice(0, 64), { x: 64, y: 92, size: 9, font })
  page.drawText(hash.slice(64), { x: 64, y: 80, size: 9, font })

  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  const qrSize = 132
  page.drawImage(png, { x: width - qrSize - 64, y: 80, width: qrSize, height: qrSize })

  const bytes = await pdf.save()
  return bytes
}
