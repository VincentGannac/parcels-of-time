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

/** ---------- Motif helpers (SVG/Primitives) ---------- **/

// Petit cœur centré autour de (0,0) — chemin SVG fermé
const HEART_PATH =
  'M 0 -28 C 0 -44 22 -44 22 -28 C 22 -16 12 -6 0 6 C -12 -6 -22 -16 -22 -28 C -22 -44 0 -44 0 -28 Z'

// Feuille simple (pour couronne/laurier), centrée env. (0,0)
const LEAF_PATH =
  'M 0 -16 C 10 -16 16 -8 16 0 C 16 8 10 16 0 16 C -10 16 -16 8 -16 0 C -16 -8 -10 -16 0 -16 Z'

// Petit triangle (noeud ballon)
const TRIANGLE_PATH = 'M -3 0 L 3 0 L 0 5 Z'

// Mortier (chapeau de diplômé) stylisé
const CAP_PATH =
  'M -24 0 L 0 -12 L 24 0 L 0 12 Z M 0 12 L 0 28 M 0 28 L 8 20'

// Anneau (wedding) via ellipses borderWidth — géré plus bas

function drawSvg(
  page: any,
  path: string,
  opts: { x: number; y: number; scale?: number; color?: any; opacity?: number; borderColor?: any; borderWidth?: number; rotate?: number }
) {
  page.drawSvgPath(path, {
    x: opts.x,
    y: opts.y,
    scale: opts.scale ?? 1,
    color: opts.color,
    opacity: opts.opacity ?? 1,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth,
    rotate: opts.rotate ? degrees(opts.rotate) : undefined,
  })
}

function drawSafeArea(page: any, width: number, height: number) {
  // Zone de lecture (évite que le motif ne gêne le texte)
  // Laisse l’en-tête respirer, protège le bloc central du contenu
  const marginX = 48
  const safeTop = height - 200
  const safeBottom = 70
  page.drawRectangle({
    x: marginX,
    y: safeBottom,
    width: width - marginX * 2,
    height: safeTop - safeBottom,
    color: rgb(1, 1, 1),
    opacity: 0.9,
  })
}

function drawFrame(page: any, width: number, height: number) {
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.88, 0.86, 0.83),
    borderWidth: 1,
  })
}

/** ---------- Motifs par style ---------- **/

function patternRomantic(page: any, width: number, height: number, rnd: () => number) {
  // Cœurs répétés, tailles variées, rotation légère
  const pink = rgb(1.0, 0.80, 0.88)
  const red = rgb(0.95, 0.35, 0.50)

  // Bande douce en haut
  page.drawRectangle({ x: 24, y: height - 220, width: width - 48, height: 140, color: pink, opacity: 0.15 })

  const count = 70
  for (let i = 0; i < count; i++) {
    const cx = 40 + rnd() * (width - 80)
    const cy = 80 + rnd() * (height - 240)
    const s = 0.6 + rnd() * 1.4
    const rot = rnd() * 40 - 20
    const color = i % 3 === 0 ? red : pink
    drawSvg(page, HEART_PATH, { x: cx, y: cy, scale: s, color, opacity: 0.18, rotate: rot })
  }
}

function patternBirthday(page: any, width: number, height: number, rnd: () => number) {
  // Ballons + confettis
  const colors = [rgb(0.99, 0.86, 0.46), rgb(0.62, 0.79, 1.0), rgb(0.62, 0.93, 0.78), rgb(1.0, 0.62, 0.74)]
  // Ballons
  for (let i = 0; i < 18; i++) {
    const cx = 60 + rnd() * (width - 120)
    const cy = 140 + rnd() * (height - 260)
    const rx = 18 + rnd() * 16
    const ry = rx * (1.25 + rnd() * 0.2)
    page.drawEllipse({ x: cx, y: cy, xScale: rx, yScale: ry, color: colors[i % colors.length], opacity: 0.22 })
    // Noeud
    drawSvg(page, TRIANGLE_PATH, { x: cx, y: cy - ry - 3, scale: 1, color: colors[i % colors.length], opacity: 0.22 })
    // Ficelle
    page.drawLine({
      start: { x: cx, y: cy - ry - 3 },
      end: { x: cx + (rnd() * 10 - 5), y: cy - ry - 50 - rnd() * 30 },
      thickness: 0.6,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.5,
    })
  }
  // Confettis
  for (let i = 0; i < 90; i++) {
    const w = 4 + rnd() * 8
    const h = 4 + rnd() * 8
    page.drawRectangle({
      x: 30 + rnd() * (width - 60),
      y: 50 + rnd() * (height - 140),
      width: w,
      height: h,
      color: colors[(i + 2) % colors.length],
      opacity: 0.25,
      rotate: degrees(rnd() * 90),
    })
  }
}

function patternWedding(page: any, width: number, height: number, rnd: () => number) {
  // Anneaux entrelacés + feuillage discret
  const gold = rgb(0.86, 0.72, 0.32)

  const cx = width - 150,
    cy = height - 160
  page.drawEllipse({ x: cx - 18, y: cy, xScale: 58, yScale: 58, borderColor: gold, borderWidth: 6, opacity: 0.6 })
  page.drawEllipse({ x: cx + 18, y: cy - 10, xScale: 58, yScale: 58, borderColor: gold, borderWidth: 6, opacity: 0.6 })

  // Guirlande de feuilles en bordure
  for (let i = 0; i < 36; i++) {
    const x = 40 + (i % 18) * ((width - 80) / 18)
    const y = i < 18 ? height - 70 - rnd() * 12 : 70 + rnd() * 12
    const rot = i < 18 ? (rnd() * 20 - 10) : (rnd() * 20 - 10 + 180)
    drawSvg(page, LEAF_PATH, { x, y, scale: 0.6 + rnd() * 0.5, color: rgb(0.92, 0.90, 0.88), opacity: 0.55, rotate: rot })
  }
}

function patternBirth(page: any, width: number, height: number, rnd: () => number) {
  // Empreintes de bébé + étoiles douces
  const pastel = [rgb(0.88, 0.95, 1), rgb(1, 0.93, 0.72), rgb(0.95, 0.88, 0.96)]

  function footprint(x: number, y: number, scale = 1, left = true) {
    const sign = left ? -1 : 1
    // Talon
    page.drawEllipse({ x, y, xScale: 9 * scale, yScale: 12 * scale, color: rgb(0.92, 0.92, 0.92), opacity: 0.55 })
    // Orteils
    const toes = [
      { dx: 8 * sign, dy: 16, r: 3.4 },
      { dx: 5 * sign, dy: 20, r: 3.0 },
      { dx: 2 * sign, dy: 22, r: 2.8 },
      { dx: -1 * sign, dy: 21, r: 2.6 },
      { dx: -4 * sign, dy: 18, r: 2.4 },
    ]
    toes.forEach(t =>
      page.drawEllipse({
        x: x + t.dx * scale,
        y: y + t.dy * scale,
        xScale: t.r * scale,
        yScale: t.r * scale,
        color: rgb(0.92, 0.92, 0.92),
        opacity: 0.55,
      })
    )
  }

  for (let i = 0; i < 8; i++) {
    const x = 70 + rnd() * (width - 140)
    const y = 120 + rnd() * (height - 280)
    footprint(x, y, 1 + rnd() * 0.3, i % 2 === 0)
  }

  // Petites étoiles pastels
  for (let i = 0; i < 50; i++) {
    const x = 36 + rnd() * (width - 72)
    const y = 60 + rnd() * (height - 140)
    const r = 1.8 + rnd() * 1.8
    page.drawEllipse({ x, y, xScale: r, yScale: r, color: pastel[i % pastel.length], opacity: 0.7 })
  }
}

function patternChristmas(page: any, width: number, height: number, rnd: () => number) {
  // Flocons + branches de pin en tête
  const snow = rgb(0.88, 0.94, 1)
  const pine = rgb(0.74, 0.86, 0.74)

  // Branches en haut
  for (let i = 0; i < 14; i++) {
    const x = 40 + i * ((width - 80) / 14)
    const y = height - 70 - rnd() * 20
    // Tige
    page.drawRectangle({ x, y, width: 1.2, height: 32, color: pine, opacity: 0.6, rotate: degrees(rnd() * 20 - 10) })
    // Aiguilles
    for (let k = 0; k < 5; k++) {
      const angle = -60 + k * 12 + (rnd() * 6 - 3)
      page.drawRectangle({
        x,
        y: y - 4,
        width: 18,
        height: 1.1,
        color: pine,
        opacity: 0.6,
        rotate: degrees(angle),
      })
    }
  }

  // Flocons
  for (let i = 0; i < 80; i++) {
    const cx = 36 + rnd() * (width - 72)
    const cy = 60 + rnd() * (height - 140)
    const arms = 6
    const R = 8 + rnd() * 10
    for (let a = 0; a < arms; a++) {
      const ang = (a * 360) / arms
      page.drawLine({
        start: { x: cx, y: cy },
        end: { x: cx + Math.cos((Math.PI / 180) * ang) * R, y: cy + Math.sin((Math.PI / 180) * ang) * R },
        thickness: 0.8,
        color: snow,
        opacity: 0.55,
      })
    }
    page.drawEllipse({ x: cx, y: cy, xScale: 1.6, yScale: 1.6, color: snow, opacity: 0.55 })
  }
}

function patternNewYear(page: any, width: number, height: number, rnd: () => number) {
  // Feux d'artifice (traînées + étincelles)
  for (let c = 0; c < 5; c++) {
    const cx = 120 + rnd() * (width - 240)
    const cy = 160 + rnd() * (height - 320)
    const bursts = 12 + Math.floor(rnd() * 8)
    const base = 16 + rnd() * 20
    for (let b = 0; b < bursts; b++) {
      const ang = (b * 360) / bursts + rnd() * 10
      const len = base + rnd() * 22
      page.drawRectangle({
        x: cx,
        y: cy,
        width: len,
        height: 1.3,
        color: rgb(0.55 + rnd() * 0.4, 0.55 + rnd() * 0.2, 0.95),
        opacity: 0.6,
        rotate: degrees(ang),
      })
      // Etincelles en bout
      page.drawEllipse({
        x: cx + Math.cos((Math.PI / 180) * ang) * len,
        y: cy + Math.sin((Math.PI / 180) * ang) * len,
        xScale: 1.8,
        yScale: 1.8,
        color: rgb(1, 0.95, 0.75),
        opacity: 0.7,
      })
    }
  }
}

function patternGraduation(page: any, width: number, height: number, rnd: () => number) {
  // Couronne de laurier + petits mortiers (graduation caps)
  // Laurier bas
  for (let i = 0; i < 22; i++) {
    const t = i / 21
    const x = 60 + t * (width - 120)
    const y = 70 + Math.sin(t * Math.PI) * 18
    const rot = -30 + t * 60
    drawSvg(page, LEAF_PATH, { x, y, scale: 0.7, color: rgb(0.9, 0.9, 0.9), opacity: 0.65, rotate: rot })
  }

  // Petits mortiers épars
  for (let i = 0; i < 8; i++) {
    const x = 60 + rnd() * (width - 120)
    const y = 130 + rnd() * (height - 280)
    drawSvg(page, CAP_PATH, {
      x,
      y,
      scale: 0.8 + rnd() * 0.5,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 1.2,
      opacity: 0.55,
      rotate: rnd() * 30 - 15,
    })
  }
}

/** ---------- Background orchestrator ---------- **/

function drawBackground(opts: {
  page: any
  width: number
  height: number
  style: CertStyle
  hash: string
}) {
  const { page, width, height, style, hash } = opts
  const rnd = seededFromHash(hash)

  // Papier de fond
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, color: rgb(1, 1, 1) })

  // Motif par style
  switch (style) {
    case 'romantic':
      patternRomantic(page, width, height, rnd)
      break
    case 'birthday':
      patternBirthday(page, width, height, rnd)
      break
    case 'wedding':
      patternWedding(page, width, height, rnd)
      break
    case 'birth':
      patternBirth(page, width, height, rnd)
      break
    case 'christmas':
      patternChristmas(page, width, height, rnd)
      break
    case 'newyear':
      patternNewYear(page, width, height, rnd)
      break
    case 'graduation':
      patternGraduation(page, width, height, rnd)
      break
    default:
      // neutral : texture très légère (points)
      for (let i = 0; i < 120; i++) {
        page.drawEllipse({
          x: 36 + rnd() * (width - 72),
          y: 50 + rnd() * (height - 140),
          xScale: 1.1,
          yScale: 1.1,
          color: rgb(0.92, 0.9, 0.88),
          opacity: 0.35,
        })
      }
  }

  // Zone de sûreté pour la lisibilité du contenu
  drawSafeArea(page, width, height)
  // Cadre fin
  drawFrame(page, width, height)
}

/** ---------- Génération PDF ---------- **/

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
  const style: CertStyle = opts.style || 'neutral'

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 portrait
  const { width, height } = page.getSize()

  // Fond expressif
  drawBackground({ page, width, height, style, hash })

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Header
  page.drawText('Parcels of Time', { x: 64, y: height - 96, size: 18, font: fontBold, color: rgb(0.05, 0.05, 0.05) })
  page.drawText('Certificate of Claim', { x: 64, y: height - 120, size: 12, font })

  // Timestamp
  page.drawText(ts.replace('T', ' ').replace('Z', ' UTC'), { x: 64, y: height - 180, size: 22, font: fontBold })

  // Owner
  page.drawText('Owned by', { x: 64, y: height - 220, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(display_name || 'Anonymous', { x: 64, y: height - 238, size: 14, font: fontBold })

  // Message
  if (message) {
    page.drawText('Message', { x: 64, y: height - 270, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    // Wrap simple (ligne unique longue ok pour MVP)
    page.drawText('“' + message + '”', { x: 64, y: height - 288, size: 12, font })
  }

  // Link
  if (link_url) {
    page.drawText('Link', { x: 64, y: height - 318, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(link_url, { x: 64, y: height - 336, size: 10, font, color: rgb(0.1, 0.1, 0.3) })
  }

  // Footer meta
  page.drawText('Certificate ID', { x: 64, y: 140, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(claim_id, { x: 64, y: 126, size: 10, font })
  page.drawText('Integrity (SHA-256)', { x: 64, y: 106, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
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
