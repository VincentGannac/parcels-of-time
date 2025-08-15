// lib/cert.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export type CertStyle =
  | 'neutral'
  | 'romantic'
  | 'birthday'
  | 'wedding'
  | 'birth'
  | 'christmas'
  | 'newyear'
  | 'graduation'

type BgAsset = { bytes: Uint8Array; kind: 'png' | 'jpg' }

async function fetchAsset(assetBaseUrl: string, style: CertStyle): Promise<BgAsset | null> {
  const candidates = [
    `${assetBaseUrl}/cert_bg/${style}.png`,
    `${assetBaseUrl}/cert_bg/${style}.jpg`,
    `${assetBaseUrl}/cert_bg/${style}.jpeg`,
    `${assetBaseUrl}/cert_bg/${style}.webp`, // fallback (sera converti via embedJpg si webp non supporté)
  ]
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const ab = await res.arrayBuffer()
        const u8 = new Uint8Array(ab)
        const lower = url.toLowerCase()
        if (lower.endsWith('.png')) return { bytes: u8, kind: 'png' }
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { bytes: u8, kind: 'jpg' }
        // webp → on tente embedJpg après conversion côté CDN (si non, ignorer)
        return { bytes: u8, kind: 'jpg' }
      }
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
  asset_base_url?: string // 👈 base pour /public
}) {
  const {
    ts, display_name, message, link_url, claim_id, hash, public_url,
    asset_base_url,
  } = opts
  const style: CertStyle = (opts.style || 'neutral')

  const pdf = await PDFDocument.create()
  // A4 portrait en points (72 dpi)
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  // 1) Fond image pleine page
  const assetBase = asset_base_url || process.env.NEXT_PUBLIC_BASE_URL || ''
  try {
    const bg = await fetchAsset(assetBase, style)
    if (bg) {
      const img = bg.kind === 'png' ? await pdf.embedPng(bg.bytes) : await pdf.embedJpg(bg.bytes)
      page.drawImage(img, { x: 0, y: 0, width, height })
    } else {
      // fallback papier neutre
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) })
    }
  } catch {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) })
  }

  // 2) (Option lisibilité) léger voile blanc au centre
  page.drawRectangle({
    x: 48, y: 90, width: width - 96, height: height - 270,
    color: rgb(1, 1, 1), opacity: 0.90
  })

  // 3) Cadre fin
  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: rgb(0.88, 0.86, 0.83), borderWidth: 1
  })

  // 4) Typo
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawText('Parcels of Time', { x: 64, y: height - 96, size: 18, font: fontBold, color: rgb(0.05, 0.05, 0.05) })
  page.drawText('Certificate of Claim', { x: 64, y: height - 120, size: 12, font })

  page.drawText(ts.replace('T', ' ').replace('Z', ' UTC'), { x: 64, y: height - 180, size: 22, font: fontBold })

  page.drawText('Owned by', { x: 64, y: height - 220, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(display_name || 'Anonymous', { x: 64, y: height - 238, size: 14, font: fontBold })

  if (message) {
    page.drawText('Message', { x: 64, y: height - 270, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('“' + message + '”', { x: 64, y: height - 288, size: 12, font })
  }

  if (link_url) {
    page.drawText('Link', { x: 64, y: height - 318, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(link_url, { x: 64, y: height - 336, size: 10, font, color: rgb(0.1, 0.1, 0.3) })
  }

  page.drawText('Certificate ID', { x: 64, y: 140, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(claim_id, { x: 64, y: 126, size: 10, font })
  page.drawText('Integrity (SHA-256)', { x: 64, y: 106, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(hash.slice(0, 64), { x: 64, y: 92, size: 9, font })
  page.drawText(hash.slice(64), { x: 64, y: 80, size: 9, font })

  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  page.drawImage(png, { x: width - 196, y: 80, width: 132, height: 132 })

  return await pdf.save()
}
