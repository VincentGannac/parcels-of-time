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

export type Locale = 'fr' | 'en'
export type TimeLabelMode = 'utc' | 'utc_plus_local' | 'local_plus_utc'

/** Libellés localisés (auto-contenu pour éviter une dépendance à des JSON externes) */
const TEXTS = {
  en: {
    brand: 'Parcels of Time',
    title: 'Certificate of Claim',
    ownedBy: 'Owned by',
    message: 'Message',
    link: 'Link',
    certId: 'Certificate ID',
    integrity: 'Integrity (SHA-256)',
    anon: 'Anonymous',
    local: (s: string) => `(local: ${s})`,
    utcParen: (s: string) => `(UTC: ${s})`,
  },
  fr: {
    brand: 'Parcels of Time',
    title: 'Certificat de Claim',
    ownedBy: 'Au nom de',
    message: 'Message',
    link: 'Lien',
    certId: 'ID du certificat',
    integrity: 'Intégrité (SHA-256)',
    anon: 'Anonyme',
    local: (s: string) => `(local : ${s})`,
    utcParen: (s: string) => `(UTC : ${s})`,
  },
} as const

async function loadBgFromPublic(
  style: CertStyle
): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' } | null> {
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

/** Safe area (marges internes) calibrée par style — en points (A4 @72dpi) */
function getSafeArea(style: CertStyle) {
  const base = { top: 140, right: 96, bottom: 156, left: 96 }
  switch (style) {
    case 'romantic':   return { top: 160, right: 116, bottom: 156, left: 116 }
    case 'birthday':   return { top: 144, right: 132, bottom: 156, left: 132 }
    case 'birth':      return { top: 150, right: 112, bottom: 156, left: 112 }
    case 'wedding':    return { top: 160, right: 124, bottom: 156, left: 124 }
    case 'christmas':  return { top: 150, right: 112, bottom: 156, left: 112 }
    case 'newyear':    return { top: 150, right: 112, bottom: 156, left: 112 }
    case 'graduation': return { top: 150, right: 112, bottom: 156, left: 112 }
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

/** Format UTC à la minute → "YYYY-MM-DD HH:MM UTC" */
function utcMinuteLabel(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  d.setUTCSeconds(0, 0)
  // 2025-08-16T12:34:00.000Z → 2025-08-16 12:34 UTC
  return d.toISOString().replace('T', ' ').replace(':00.000Z', ' UTC').replace('Z', ' UTC')
}

/** Format local (IANA optionnel) à la minute selon la locale */
function localMinuteLabel(iso: string, locale: Locale, timeZone?: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  d.setSeconds(0, 0)
  try {
    const fmt = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timeZone, // si non fourni → timezone de l’environnement
    })
    return fmt.format(d)
  } catch {
    // Fallback simple
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${hh}:${mm}`
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
  style?: CertStyle
  locale?: Locale
  timeLabelMode?: TimeLabelMode
  /** IANA TZ pour le rendu "local" (ex: "Europe/Paris"). Si omis → TZ du serveur. */
  localTimeZone?: string
}) {
  const {
    ts, display_name, message, link_url, claim_id, hash, public_url,
    localTimeZone,
  } = opts
  const style: CertStyle = opts.style || 'neutral'
  const locale: Locale = opts.locale || 'en'
  const timeLabelMode: TimeLabelMode = opts.timeLabelMode || 'utc'
  const L = TEXTS[locale]

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 portrait
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

  // --- Fonts/Couleurs ---
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const cMain = rgb(0.11, 0.13, 0.16) // lisible en dark mode preview
  const cSub  = rgb(0.36, 0.40, 0.47)
  const cLink = rgb(0.10, 0.20, 0.55)

  // --- Safe area ---
  const SA = getSafeArea(style)
  const LEFT = SA.left
  const RIGHT = width - SA.right
  const TOP_Y = height - SA.top
  const BOT_Y = SA.bottom
  const COLW = RIGHT - LEFT
  const CX = (LEFT + RIGHT) / 2

  // --- Header (un peu plus bas qu’au bord) ---
  const brandSize = 18
  const subSize = 12
  let yHeader = TOP_Y - 40 // ↓ descendu comme demandé
  const brandW = fontBold.widthOfTextAtSize(L.brand, brandSize)
  page.drawText(L.brand, { x: CX - brandW / 2, y: yHeader, size: brandSize, font: fontBold, color: cMain })

  yHeader -= 18
  const subW = font.widthOfTextAtSize(L.title, subSize)
  page.drawText(L.title, { x: CX - subW / 2, y: yHeader, size: subSize, font, color: cSub })

  // --- Mesures typographiques ---
  const tsSize = 26, labelSize = 11, nameSize = 15, msgSize = 12.5, linkSize = 10.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16, lineHLink = 14

  // Zone disponible entre fin du header et le bas de la safe area
  const contentTopMax = yHeader - 38
  const contentBottomMin = BOT_Y
  const availH = contentTopMax - contentBottomMin

  // --- Horodatages ---
  const utcLabel = utcMinuteLabel(ts)
  const localLabel = localMinuteLabel(ts, locale, localTimeZone)

  let mainTime = utcLabel
  let subTime = ''
  if (timeLabelMode === 'utc_plus_local') {
    mainTime = utcLabel
    subTime = L.local(localLabel)
  } else if (timeLabelMode === 'local_plus_utc') {
    mainTime = localLabel
    // on retire " UTC" pour l’annexe
    const utcPlain = utcLabel.replace(' UTC', '')
    subTime = L.utcParen(utcPlain)
  }

  // --- Blocs variables & wraps ---
  const fixedAboveMsg =
    (tsSize + 6) +                    // timestamp
    gapSection +
    (labelSize + 2) + gapSmall +      // "Owned by"
    (nameSize + 4)

  const qrSize = 120
  const afterTextToQR = 18
  const afterQRToMeta = 10
  const metaBlockH = 76

  const msgLinesAll = message ? wrapText('“' + message + '”', font, msgSize, COLW) : []
  const linkLinesAll = link_url ? wrapText(link_url, font, linkSize, COLW) : []

  const spaceForText = availH - (afterTextToQR + qrSize + afterQRToMeta + metaBlockH)
  const maxMsgLines = Math.max(0, Math.floor((spaceForText - fixedAboveMsg - gapSection /* label msg */) / lineHMsg))
  const msgLines = msgLinesAll.slice(0, maxMsgLines)

  const spaceAfterMsg = spaceForText - fixedAboveMsg - (msgLines.length ? gapSection + msgLines.length * lineHMsg : 0)
  const maxLinkLines = Math.min(2, Math.max(0, Math.floor((spaceAfterMsg - (link_url ? gapSection : 0)) / lineHLink)))
  const linkLines = linkLinesAll.slice(0, maxLinkLines)

  const blockH =
    fixedAboveMsg +
    (msgLines.length ? gapSection + msgLines.length * lineHMsg : 0) +
    (linkLines.length ? gapSection + linkLines.length * lineHLink : 0) +
    afterTextToQR + qrSize + afterQRToMeta + metaBlockH

  const biasUp = 10 // léger décalage vers le haut
  let by = contentBottomMin + (availH - blockH) / 2 + biasUp
  let cursor = by + blockH

  // ---------- Rendu centré ----------
  // Timestamp principal
  cursor -= (tsSize + 6)
  const tsW = fontBold.widthOfTextAtSize(mainTime, tsSize)
  page.drawText(mainTime, { x: CX - tsW / 2, y: cursor, size: tsSize, font: fontBold, color: cMain })

  // Petit sous-libellé de temps si présent
  if (subTime) {
    const subTW = font.widthOfTextAtSize(subTime, 11)
    page.drawText(subTime, { x: CX - subTW / 2, y: cursor - 16, size: 11, font, color: cSub })
    cursor -= 12
  }

  // Owned by
  cursor -= gapSection
  const ownedW = font.widthOfTextAtSize(L.ownedBy, labelSize)
  page.drawText(L.ownedBy, { x: CX - ownedW / 2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })

  cursor -= (labelSize + 2 + gapSmall)
  const name = display_name || L.anon
  const nameW = fontBold.widthOfTextAtSize(name, nameSize)
  page.drawText(name, { x: CX - nameW / 2, y: cursor - (nameSize + 4) + 4, size: nameSize, font: fontBold, color: cMain })

  // Message
  if (msgLines.length) {
    cursor -= (nameSize + 4)
    cursor -= gapSection
    const msgLabelW = font.widthOfTextAtSize(L.message, labelSize)
    page.drawText(L.message, { x: CX - msgLabelW / 2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
    cursor -= (labelSize + 6)
    for (const line of msgLines) {
      const w = font.widthOfTextAtSize(line, msgSize)
      page.drawText(line, { x: CX - w / 2, y: cursor - lineHMsg, size: msgSize, font, color: cMain })
      cursor -= lineHMsg
    }
  } else {
    cursor -= (nameSize + 4)
  }

  // Lien
  if (linkLines.length) {
    cursor -= gapSection
    const linkLabelW = font.widthOfTextAtSize(L.link, labelSize)
    page.drawText(L.link, { x: CX - linkLabelW / 2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
    cursor -= (labelSize + 6)
    for (const line of linkLines) {
      const w = font.widthOfTextAtSize(line, linkSize)
      page.drawText(line, { x: CX - w / 2, y: cursor - lineHLink, size: linkSize, font, color: cLink })
      cursor -= lineHLink
    }
  }

  // QR (centré sous le texte)
  cursor -= afterTextToQR
  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const png = await pdf.embedPng(pngBytes)
  const qrSizePx = 120
  page.drawImage(png, { x: CX - qrSizePx / 2, y: cursor - qrSizePx, width: qrSizePx, height: qrSizePx })
  cursor -= (qrSizePx + afterQRToMeta)

  // Métadonnées
  const idLabelW = font.widthOfTextAtSize(L.certId, labelSize)
  page.drawText(L.certId, { x: CX - idLabelW / 2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
  cursor -= (labelSize + 6)

  const idW = fontBold.widthOfTextAtSize(claim_id, 10.5)
  page.drawText(claim_id, { x: CX - idW / 2, y: cursor - 12, size: 10.5, font: fontBold, color: cMain })
  cursor -= 20

  const integW = font.widthOfTextAtSize(L.integrity, labelSize)
  page.drawText(L.integrity, { x: CX - integW / 2, y: cursor - (labelSize + 2), size: labelSize, font, color: cSub })
  cursor -= (labelSize + 6)

  const h1 = hash.slice(0, 64)
  const h2 = hash.slice(64)
  const h1W = font.widthOfTextAtSize(h1, 9.5)
  page.drawText(h1, { x: CX - h1W / 2, y: cursor - 12, size: 9.5, font, color: cMain })
  cursor -= 16
  const h2W = font.widthOfTextAtSize(h2, 9.5)
  page.drawText(h2, { x: CX - h2W / 2, y: cursor - 12, size: 9.5, font, color: cMain })

  return await pdf.save()
}
