import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import QRCode from 'qrcode'

type CertStyle =
  | 'neutral'
  | 'romantic'
  | 'birthday'
  | 'wedding'
  | 'birth'
  | 'christmas'
  | 'newyear'
  | 'graduation'

function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededFromHash(hash: string) {
  const s = parseInt(hash.slice(0, 8), 16) || 123456789
  return mulberry32(s)
}

function drawBackground(opts: {
  page: any; width: number; height: number; style: CertStyle; hash: string
}) {
  const { page, width, height, style, hash } = opts
  const rnd = seededFromHash(hash)

  // neutral baseline
  if (style === 'neutral') {
    page.drawRectangle({ x: 32, y: 32, width: width-64, height: height-64, borderColor: rgb(0.9,0.88,0.85), borderWidth: 1 })
    return
  }

  // color helpers
  const gold = rgb(0.86, 0.72, 0.32)
  const softPink = rgb(1.00, 0.90, 0.94)
  const softRed = rgb(0.98, 0.62, 0.70)
  const pastelBlue = rgb(0.85, 0.94, 1.00)
  const pastelYellow = rgb(0.99, 0.90, 0.60)
  const pastelGreen = rgb(0.82, 0.95, 0.88)
  const gray = rgb(0.92, 0.90, 0.88)

  // subtle paper inset
  page.drawRectangle({ x: 24, y: 24, width: width-48, height: height-48, color: rgb(1,1,1) })

  switch(style) {
    case 'romantic': {
      // soft pink wash
      page.drawRectangle({ x: 24, y: height-240, width: width-48, height: 180, color: softPink })
      // scattered "petals" (ellipses)
      for (let i=0;i<28;i++){
        const w = 10 + rnd()*18
        const h = w * (0.5 + rnd()*0.4)
        page.drawEllipse({
          x: 40 + rnd()*(width-80),
          y: 80 + rnd()*(height-200),
          xScale: w, yScale: h,
          color: softRed, opacity: 0.12
        })
      }
      break
    }

    case 'birthday': {
      // confetti rectangles
      const colors = [pastelYellow, pastelBlue, pastelGreen, softRed]
      for (let i=0;i<60;i++){
        const w = 6 + rnd()*10
        const h = 6 + rnd()*10
        const rot = (rnd()*60 - 30)
        page.drawRectangle({
          x: 30 + rnd()*(width-60),
          y: 40 + rnd()*(height-120),
          width: w, height: h, color: colors[i % colors.length],
          opacity: 0.25, rotate: degrees(rot)
        })
      }
      break
    }

    case 'wedding': {
      // intertwined rings
      const cx = width - 160, cy = height - 170
      page.drawEllipse({ x: cx-20, y: cy, xScale: 60, yScale: 60, borderColor: gold, borderWidth: 6, opacity: 0.6 })
      page.drawEllipse({ x: cx+20, y: cy-10, xScale: 60, yScale: 60, borderColor: gold, borderWidth: 6, opacity: 0.6 })
      // delicate dots
      for (let i=0;i<40;i++){
        page.drawEllipse({
          x: 40 + rnd()*(width-80),
          y: 60 + rnd()*(height-140),
          xScale: 2.5, yScale: 2.5,
          color: gray, opacity: 0.25
        })
      }
      break
    }

    case 'birth': {
      // soft pastel band
      page.drawRectangle({ x: 24, y: height-220, width: width-48, height: 140, color: pastelBlue })
      // dotted pattern
      for (let i=0;i<70;i++){
        const c = i%3===0? pastelYellow : (i%3===1? pastelGreen : pastelBlue)
        page.drawEllipse({
          x: 36 + rnd()*(width-72),
          y: 60 + rnd()*(height-140),
          xScale: 3.2, yScale: 3.2, color: c, opacity: 0.35
        })
      }
      break
    }

    case 'christmas': {
      // snowy field
      page.drawRectangle({ x: 24, y: 24, width: width-48, height: height-48, color: rgb(0.98,1,0.98) })
      for (let i=0;i<90;i++){
        const r = 1.8 + rnd()*2.4
        page.drawEllipse({
          x: 36 + rnd()*(width-72),
          y: 50 + rnd()*(height-140),
          xScale: r, yScale: r, color: rgb(0.9,0.95,1), opacity: 0.45
        })
      }
      break
    }

    case 'newyear': {
      // fireworks rings (concentric ellipses)
      const centers = 3 + Math.floor(rnd()*3)
      for (let c=0;c<centers;c++){
        const cx = 100 + rnd()*(width-200)
        const cy = 140 + rnd()*(height-260)
        const base = 20 + rnd()*40
        for (let k=0;k<4;k++){
          const r = base + k*8
          page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r*0.84, borderColor: rgb(0.6+0.4*rnd(),0.6,0.9), borderWidth: 1.5, opacity: 0.5 })
        }
      }
      break
    }

    case 'graduation': {
      // laurel-ish ticks + confetti mono
      for (let i=0;i<60;i++){
        const w = 14 + rnd()*10
        const h = 2.5 + rnd()*1.5
        page.drawRectangle({
          x: 36 + rnd()*(width-72),
          y: 50 + rnd()*(height-140),
          width: w, height: h,
          color: rgb(0.85,0.85,0.85),
          opacity: 0.35,
          rotate: degrees(rnd()*40-20)
        })
      }
      break
    }
  }
}

export async function generateCertificatePDF(opts: {
  ts: string
  display_name: string
  message?: string | null
  link_url?: string | null
  claim_id: string
  hash: string
  public_url: string
  style?: CertStyle // 👈 NEW
}) {
  const { ts, display_name, message, link_url, claim_id, hash, public_url } = opts
  const style: CertStyle = (opts.style || 'neutral')

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  // Background & frame
  drawBackground({ page, width, height, style, hash })

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Header
  page.drawText('Parcels of Time', { x: 64, y: height - 96, size: 18, font: fontBold, color: rgb(0.05,0.05,0.05) })
  page.drawText('Certificate of Claim', { x: 64, y: height - 120, size: 12, font })

  // Timestamp
  page.drawText(ts.replace('T',' ').replace('Z',' UTC'), { x: 64, y: height - 180, size: 22, font: fontBold })

  // Owner
  page.drawText('Owned by', { x: 64, y: height - 220, size: 11, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(display_name || 'Anonymous', { x: 64, y: height - 238, size: 14, font: fontBold })

  // Message
  if (message) {
    page.drawText('Message', { x: 64, y: height - 270, size: 11, font, color: rgb(0.3,0.3,0.3) })
    page.drawText('“' + message + '”', { x: 64, y: height - 288, size: 12, font })
  }

  // Link
  if (link_url) {
    page.drawText('Link', { x: 64, y: height - 318, size: 11, font, color: rgb(0.3,0.3,0.3) })
    page.drawText(link_url, { x: 64, y: height - 336, size: 10, font, color: rgb(0.1,0.1,0.3) })
  }

  // Footer meta
  page.drawText('Certificate ID', { x: 64, y: 140, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(claim_id, { x: 64, y: 126, size: 10, font })
  page.drawText('Integrity (SHA-256)', { x: 64, y: 106, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(hash.slice(0, 64), { x: 64, y: 92, size: 9, font })
  page.drawText(hash.slice(64), { x: 64, y: 80, size: 9, font })

  // QR
  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  const qrSize = 132
  page.drawImage(png, { x: width - qrSize - 64, y: 80, width: qrSize, height: qrSize })

  const bytes = await pdf.save()
  return bytes
}
