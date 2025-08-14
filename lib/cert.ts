import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
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

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function seededFromHash(hash: string) {
  const s = parseInt(hash.slice(0, 8), 16) || 123456789
  return mulberry32(s)
}

/** ------------- Primitives helpers ------------- **/
function drawDiamond(page: any, x: number, y: number, size: number, color: any, opacity = 1) {
  page.drawRectangle({ x, y, width: size, height: size, color, opacity, rotate: degrees(45) })
}
function drawLeafEllipse(page: any, x: number, y: number, scale: number, rot: number, color: any, opacity = 1) {
  page.drawEllipse({ x, y, xScale: 10 * scale, yScale: 16 * scale, color, opacity, rotate: degrees(rot) })
}
function drawHeartPrimitive(page: any, x: number, y: number, s: number, color: any, opacity = 1) {
  // Deux lobes + un diamant -> cœur stylisé
  page.drawEllipse({ x: x - 6 * s, y: y + 4 * s, xScale: 7 * s, yScale: 7 * s, color, opacity })
  page.drawEllipse({ x: x + 6 * s, y: y + 4 * s, xScale: 7 * s, yScale: 7 * s, color, opacity })
  drawDiamond(page, x - 6 * s, y - 2 * s, 12 * s, color, opacity) // base du cœur
}

/** ------------- Patterns ------------- **/
function patternRomantic(page: any, width: number, height: number, rnd: () => number) {
  const pink = rgb(1.0, 0.80, 0.88)
  const red = rgb(0.95, 0.35, 0.50)

  // Bande haute douce
  page.drawRectangle({ x: 24, y: height - 230, width: width - 48, height: 150, color: pink, opacity: 0.20 })

  for (let i = 0; i < 70; i++) {
    const cx = 40 + rnd() * (width - 80)
    const cy = 80 + rnd() * (height - 240)
    const s = 0.8 + rnd() * 1.4
    const c = i % 3 === 0 ? red : pink
    drawHeartPrimitive(page, cx, cy, s, c, 0.30)
  }
}

function patternBirthday(page: any, width: number, height: number, rnd: () => number) {
  const colors = [rgb(0.99, 0.86, 0.46), rgb(0.62, 0.79, 1.0), rgb(0.62, 0.93, 0.78), rgb(1.0, 0.62, 0.74)]
  // Ballons
  for (let i = 0; i < 22; i++) {
    const cx = 60 + rnd() * (width - 120)
    const cy = 140 + rnd() * (height - 260)
    const rx = 18 + rnd() * 16
    const ry = rx * (1.25 + rnd() * 0.2)
    const col = colors[i % colors.length]
    page.drawEllipse({ x: cx, y: cy, xScale: rx, yScale: ry, color: col, opacity: 0.30 })
    // nœud
    page.drawRectangle({ x: cx - 2, y: cy - ry - 3, width: 4, height: 4, color: col, opacity: 0.30, rotate: degrees(45) })
    // ficelle
    page.drawLine({
      start: { x: cx, y: cy - ry - 3 },
      end: { x: cx + (rnd() * 10 - 5), y: cy - ry - 50 - rnd() * 30 },
      thickness: 0.8, color: rgb(0.6, 0.6, 0.6), opacity: 0.6
    })
  }
  // Confettis
  for (let i = 0; i < 120; i++) {
    const w = 4 + rnd() * 8, h = 4 + rnd() * 8
    page.drawRectangle({
      x: 30 + rnd() * (width - 60),
      y: 50 + rnd() * (height - 140),
      width: w, height: h,
      color: colors[(i + 2) % colors.length], opacity: 0.35, rotate: degrees(rnd() * 90)
    })
  }
}

function patternWedding(page: any, width: number, height: number, rnd: () => number) {
  const gold = rgb(0.86, 0.72, 0.32)
  const cx = width - 150, cy = height - 160
  page.drawEllipse({ x: cx - 18, y: cy, xScale: 58, yScale: 58, borderColor: gold, borderWidth: 6, opacity: 0.75 })
  page.drawEllipse({ x: cx + 18, y: cy - 10, xScale: 58, yScale: 58, borderColor: gold, borderWidth: 6, opacity: 0.75 })

  // Guirlande de feuilles (ellipses inclinées)
  for (let i = 0; i < 40; i++) {
    const x = 40 + (i % 20) * ((width - 80) / 20)
    const y = i < 20 ? height - 70 - rnd() * 12 : 70 + rnd() * 12
    const rot = i < 20 ? (rnd() * 25 - 12) : (rnd() * 25 - 12 + 180)
    drawLeafEllipse(page, x, y, 0.7 + rnd() * 0.4, rot, rgb(0.92, 0.90, 0.88), 0.70)
  }
}

function patternBirth(page: any, width: number, height: number, rnd: () => number) {
  // Empreintes
  for (let i = 0; i < 10; i++) {
    const x = 70 + rnd() * (width - 140)
    const y = 120 + rnd() * (height - 280)
    const left = i % 2 === 0
    // talon
    page.drawEllipse({ x, y, xScale: 10, yScale: 14, color: rgb(0.88, 0.88, 0.88), opacity: 0.70 })
    // orteils
    const sign = left ? -1 : 1
    const toes = [ [8,16,3.4],[5,20,3.0],[2,22,2.8],[-1,21,2.6],[-4,18,2.4] ]
    toes.forEach(([dx,dy,r]) =>
      page.drawEllipse({ x: x + (dx as number)*sign, y: y + (dy as number), xScale: (r as number), yScale: (r as number), color: rgb(0.88,0.88,0.88), opacity: 0.70 })
    )
  }
  // étoiles pastels
  const pastel = [rgb(0.88, 0.95, 1), rgb(1, 0.93, 0.72), rgb(0.95, 0.88, 0.96)]
  for (let i = 0; i < 60; i++) {
    const x = 36 + rnd() * (width - 72)
    const y = 60 + rnd() * (height - 140)
    const r = 1.8 + rnd() * 1.8
    page.drawEllipse({ x, y, xScale: r, yScale: r, color: pastel[i % pastel.length], opacity: 0.85 })
  }
}

function patternChristmas(page: any, width: number, height: number, rnd: () => number) {
  const snow = rgb(0.88, 0.94, 1)
  const pine = rgb(0.74, 0.86, 0.74)
  // Branches
  for (let i = 0; i < 16; i++) {
    const x = 40 + i * ((width - 80) / 16)
    const y = height - 70 - rnd() * 20
    page.drawRectangle({ x, y, width: 1.3, height: 34, color: pine, opacity: 0.7, rotate: degrees(rnd() * 20 - 10) })
    for (let k = 0; k < 5; k++) {
      const angle = -60 + k * 12 + (rnd() * 6 - 3)
      page.drawRectangle({ x, y: y - 4, width: 18, height: 1.2, color: pine, opacity: 0.7, rotate: degrees(angle) })
    }
  }
  // Flocons
  for (let i = 0; i < 100; i++) {
    const cx = 36 + rnd() * (width - 72)
    const cy = 60 + rnd() * (height - 140)
    const arms = 6, R = 9 + rnd() * 12
    for (let a = 0; a < arms; a++) {
      const ang = (a * 360) / arms
      page.drawRectangle({
        x: cx, y: cy, width: R, height: 1,
        color: snow, opacity: 0.75, rotate: degrees(ang)
      })
    }
    page.drawEllipse({ x: cx, y: cy, xScale: 1.8, yScale: 1.8, color: snow, opacity: 0.85 })
  }
}

function patternNewYear(page: any, width: number, height: number, rnd: () => number) {
  for (let c = 0; c < 6; c++) {
    const cx = 120 + rnd() * (width - 240)
    const cy = 160 + rnd() * (height - 320)
    const bursts = 14 + Math.floor(rnd() * 8)
    const base = 18 + rnd() * 22
    for (let b = 0; b < bursts; b++) {
      const ang = (b * 360) / bursts + rnd() * 10
      const len = base + rnd() * 26
      page.drawRectangle({
        x: cx, y: cy, width: len, height: 1.6,
        color: rgb(0.55 + rnd() * 0.4, 0.55 + rnd() * 0.2, 0.95),
        opacity: 0.75, rotate: degrees(ang),
      })
      page.drawEllipse({
        x: cx + Math.cos((Math.PI / 180) * ang) * len,
        y: cy + Math.sin((Math.PI / 180) * ang) * len,
        xScale: 2.2, yScale: 2.2, color: rgb(1, 0.95, 0.75), opacity: 0.85,
      })
    }
  }
}

function patternGraduation(page: any, width: number, height: number, rnd: () => number) {
  // Laurier bas
  for (let i = 0; i < 24; i++) {
    const t = i / 23
    const x = 60 + t * (width - 120)
    const y = 70 + Math.sin(t * Math.PI) * 20
    const rot = -30 + t * 60
    drawLeafEllipse(page, x, y, 0.8, rot, rgb(0.88, 0.88, 0.88), 0.85)
  }
  // Petits mortiers
  for (let i = 0; i < 10; i++) {
    const x = 60 + rnd() * (width - 120)
    const y = 130 + rnd() * (height - 280)
    // plateau (losange)
    drawDiamond(page, x, y, 16, rgb(0.5, 0.5, 0.5), 0.7)
    // pendeloque
    page.drawLine({ start:{x,y:y+8}, end:{x,y:y+26}, thickness: 1, color: rgb(0.5,0.5,0.5), opacity: 0.7 })
  }
}

/** ------------- Background orchestrator ------------- **/
function drawBackground(opts: { page:any; width:number; height:number; style:CertStyle; hash:string }) {
  const { page, width, height, style, hash } = opts
  const rnd = seededFromHash(hash)

  // Papier de fond
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, color: rgb(1, 1, 1) })

  switch (style) {
    case 'romantic':   patternRomantic(page, width, height, rnd);   break
    case 'birthday':   patternBirthday(page, width, height, rnd);   break
    case 'wedding':    patternWedding(page, width, height, rnd);    break
    case 'birth':      patternBirth(page, width, height, rnd);      break
    case 'christmas':  patternChristmas(page, width, height, rnd);  break
    case 'newyear':    patternNewYear(page, width, height, rnd);    break
    case 'graduation': patternGraduation(page, width, height, rnd); break
    default:
      for (let i = 0; i < 140; i++) {
        page.drawEllipse({
          x: 36 + rnd() * (width - 72), y: 50 + rnd() * (height - 140),
          xScale: 1.2, yScale: 1.2, color: rgb(0.92, 0.9, 0.88), opacity: 0.45
        })
      }
  }

  // Safe area + cadre (opacité assouplie pour laisser voir le motif)
  page.drawRectangle({
    x: 48, y: 80, width: width - 96, height: height - 260, color: rgb(1,1,1), opacity: 0.88
  })
  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: rgb(0.88, 0.86, 0.83), borderWidth: 1
  })
}

/** ------------- Génération PDF ------------- **/
export async function generateCertificatePDF(opts: {
  ts: string; display_name: string; message?: string | null; link_url?: string | null;
  claim_id: string; hash: string; public_url: string; style?: CertStyle
}) {
  const { ts, display_name, message, link_url, claim_id, hash, public_url } = opts
  const style: CertStyle = opts.style || 'neutral'

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  drawBackground({ page, width, height, style, hash })

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

  if (link_url) {
    page.drawText('Link', { x: 64, y: height - 318, size: 11, font, color: rgb(0.3,0.3,0.3) })
    page.drawText(link_url, { x: 64, y: height - 336, size: 10, font, color: rgb(0.1,0.1,0.3) })
  }

  page.drawText('Certificate ID', { x: 64, y: 140, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(claim_id, { x: 64, y: 126, size: 10, font })
  page.drawText('Integrity (SHA-256)', { x: 64, y: 106, size: 9, font, color: rgb(0.3,0.3,0.3) })
  page.drawText(hash.slice(0, 64), { x: 64, y: 92, size: 9, font })
  page.drawText(hash.slice(64), { x: 64, y: 80, size: 9, font })

  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  page.drawImage(png, { x: width - 196, y: 80, width: 132, height: 132 })

  return await pdf.save()
}
