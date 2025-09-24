// app/lib/cert.ts
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'node:fs/promises'
import path from 'node:path'

export type CertStyle =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation'
  | 'custom'

export type Locale = 'fr' | 'en'
export type TimeLabelMode = 'utc' | 'utc_plus_local' | 'local_plus_utc' // conservé pour compat, mais non utilisé

const TEXTS = {
  en: { brand:'Parcels of Time', title:'Certificate of Claim', ownedBy:'Owned by', giftedBy:'Gifted by', titleLabel:'Title', message:'Message', link:'Link', certId:'Certificate ID', integrity:'Integrity (SHA-256)', anon:'Anonymous' },
  fr: { brand:'Parcels of Time', title:'Certificat de Claim',  ownedBy:'Au nom de', giftedBy:'Offert par', titleLabel:'Titre',  message:'Message', link:'Lien', certId:'ID du certificat', integrity:'Intégrité (SHA-256)', anon:'Anonyme' },
} as const

async function loadBgFromPublic(style: CertStyle){
  const base = path.join(process.cwd(), 'public', 'cert_bg')
  for (const ext of ['png','jpg','jpeg']) {
    const p = path.join(base, `${style}.${ext}`)
    try {
      const buf = await fs.readFile(p)
      return { bytes: new Uint8Array(buf), kind: (ext==='png'?'png':'jpg') as 'png'|'jpg' }
    } catch {}
  }
  return null
}

function drawBgPortraitAware(page: any, img: any) {
  const { width: pw, height: ph } = page.getSize()
  const iw = (img.width  ?? img.scale(1).width)
  const ih = (img.height ?? img.scale(1).height)

  if (iw > ih) {
    page.drawImage(img, {
      x: pw,
      y: 0,
      width: ph,
      height: pw,
      rotate: degrees(90),
    })
  } else {
    page.drawImage(img, { x: 0, y: 0, width: pw, height: ph })
  }
}
const PT_PER_CM = 28.3465
const SHIFT_UP_PT = Math.round(2 * PT_PER_CM)

function getSafeArea(style: CertStyle){
  const base = { top: 140, right: 96, bottom: 156, left: 96 }
  switch (style) {
    case 'romantic':   return { top:160, right:116, bottom:156, left:116 }
    case 'birthday':   return { top:144, right:132, bottom:156, left:132 }
    case 'birth':      return { top:150, right:112, bottom:156, left:112 }
    case 'wedding':    return { top:160, right:124, bottom:156, left:124 }
    case 'christmas':  return { top:150, right:112, bottom:156, left:112 }
    case 'newyear':    return { top:150, right:112, bottom:156, left:112 }
    case 'graduation': return { top:150, right:112, bottom:156, left:112 }
    case 'custom':     return { top:150, right:112, bottom:156, left:112 }
    default:           return base
  }
}

function parseDataImage(dataUrl?: string){
  if (!dataUrl) return null
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl)
  if (!m) return null
  const kind = m[1].toLowerCase() === 'png' ? 'png' : 'jpg'
  const bytes = Uint8Array.from(Buffer.from(m[2], 'base64'))
  return { bytes, kind } as const
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []; let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    const wpx = font.widthOfTextAtSize(test, size)
    if (wpx <= maxWidth) line = test
    else { if (line) lines.push(line); line = w }
  }
  if (line) lines.push(line)
  return lines
}

// AAAA-MM-JJ (UTC) pour l’affichage principal
function ymdFromUTC(iso: string){
  const d = new Date(iso); if (isNaN(d.getTime())) return iso
  d.setUTCHours(0,0,0,0)
  return d.toISOString().slice(0,10)
}

// couleurs
function hexToRgb01(hex:string){ const m=/^#?([0-9a-f]{6})$/i.exec(hex); if(!m) return {r:0.1,g:0.12,b:0.15}; const n=parseInt(m[1],16); return { r:((n>>16)&255)/255, g:((n>>8)&255)/255, b:(n&255)/255 } }
function mix01(a:number,b:number,t:number){ return a*(1-t)+b*t }

export async function generateCertificatePDF(opts: {
  ts: string
  display_name: string
  title?: string | null
  message?: string | null
  link_url?: string | null
  claim_id: string
  hash: string
  public_url: string
  style?: CertStyle
  locale?: Locale
  timeLabelMode?: TimeLabelMode // ignoré, conservé pour compat
  localTimeZone?: string
  customBgDataUrl?: string
  localDateOnly?: boolean
  textColorHex?: string
  /** ✅ masque le QR quand true (registre public) */
  hideQr?: boolean,
  hideMeta?: boolean,
}) {
  const {
    ts, display_name, title, message, link_url, claim_id, hash, public_url,
  } = opts
  const style: CertStyle = opts.style || 'neutral'
  const locale: Locale = opts.locale || 'en'
  const L = TEXTS[locale]

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 portrait
  const { width, height } = page.getSize()

  const MIN_GAP_HEADER_PT = 28
  // Background
  try {
    let embedded = false
    if (style === 'custom') {
      const parsed = parseDataImage(opts.customBgDataUrl)
      if (parsed) {
        const img = parsed.kind === 'png' ? await pdf.embedPng(parsed.bytes) : await pdf.embedJpg(parsed.bytes)
        drawBgPortraitAware(page, img)
        embedded = true
      }
    }
    if (!embedded) {
      const bg = await loadBgFromPublic(style)
      if (bg) {
        const img = bg.kind === 'png' ? await pdf.embedPng(bg.bytes) : await pdf.embedJpg(bg.bytes)
        drawBgPortraitAware(page, img)
      } else {
        page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.98, 0.96) })
      }
    }
  } catch {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) })
  }

  // Fonts & couleurs
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const mainHex = /^#[0-9a-f]{6}$/i.test(opts.textColorHex || '') ? String(opts.textColorHex) : '#1a1f2a'
  const m = hexToRgb01(mainHex)
  const cMain = rgb(m.r, m.g, m.b)
  const cSub  = rgb(mix01(m.r,1,0.45), mix01(m.g,1,0.45), mix01(m.b,1,0.45))
  const cLink = rgb(mix01(m.r,0.2,0.3), mix01(m.g,0.2,0.3), mix01(m.b,0.7,0.3))

  // Safe area
  const SA = getSafeArea(style)
  const LEFT = SA.left, RIGHT = width - SA.right, TOP_Y = height - SA.top, BOT_Y = SA.bottom
  const COLW = RIGHT - LEFT
  const CX = (LEFT + RIGHT) / 2

  // Header
  const brandSize = 18, subSize = 12
  let yHeader = TOP_Y - 40
  const yBrand = yHeader

  page.drawText(L.brand, {
  x: CX - fontBold.widthOfTextAtSize(L.brand, brandSize)/2,
  y: yHeader, size: brandSize, font: fontBold, color: cMain
  })
  yHeader -= 18

  const yCert = yHeader

  page.drawText(L.title, {
  x: CX - font.widthOfTextAtSize(L.title, subSize)/2,
  y: yHeader, size: subSize, font, color: cSub
})

  // Typo sizes
  const tsSize = 26, labelSize = 11, nameSize = 15, msgSize = 12.5, linkSize = 10.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16, lineHLink = 14

  
  // Date label — AAAA-MM-JJ
  const mainTime = ymdFromUTC(ts)

  // Footer reserved (réduction si QR ou méta masqués)
  const qrSizePx = opts.hideQr ? 0 : 120
  const metaBlockH = opts.hideMeta ? 0 : 76
  const footerH = Math.max(qrSizePx, metaBlockH)
  const footerMarginTop = 8

  // Content box

  const contentTopMaxNatural = yHeader - 38 + SHIFT_UP_PT
  const contentTopMaxSafe    = (yCert - MIN_GAP_HEADER_PT) - (tsSize + 6) // 6 = breathing au-dessus de la date
  const contentTopMax        = Math.min(contentTopMaxNatural, contentTopMaxSafe)

  const contentBottomMin = BOT_Y + footerH + footerMarginTop
  const availH = contentTopMax - contentBottomMin

  // --------- Contenu dynamique (Owned by / Gifted by / Message) ---------
  // On retire le marqueur [[HIDE_OWNED_BY]] et on capture Gifted by / Offert par
  let giftedName = ''
  let forceHideOwned = false
  let messageClean = (message || '').trim()
  if (messageClean) {
    const raw = messageClean.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const kept: string[] = []
    for (const l of raw) {
      if (/^\[\[\s*HIDE_OWNED_BY\s*\]\]$/i.test(l)) { forceHideOwned = true; continue }
      const mGift = /^(offert\s*par|gifted\s*by)\s*:\s*(.+)$/i.exec(l)
      if (mGift) { giftedName = mGift[2].trim(); continue }
      kept.push(l)
    }
    messageClean = kept.join('\n')  // ← on conserve les paragraphes
  }
  const hasName = !forceHideOwned && !!(display_name && String(display_name).trim())

  // Wraps
  let msgLinesAll: string[] = []
  if (messageClean) {
    const paras = messageClean.split(/\n+/)
    paras.forEach((p, i) => {
      const lines = wrapText(p, font, msgSize, COLW)
      msgLinesAll.push(...lines)
      if (i < paras.length - 1) msgLinesAll.push('') // ligne vide entre paragraphes
    })
  }


  const linkLinesAll = link_url ? wrapText(link_url, font, linkSize, COLW) : []

  // Hauteurs des blocs optionnels
  const ownedBlockH = hasName ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0
  const giftedBlockH = giftedName ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0

  const fixedTop =
    (tsSize + 6) + // uniquement la date (plus de sous-ligne)
    ownedBlockH

  const spaceForText = availH
  const spaceAfterOwned = spaceForText - fixedTop
  const titleText = (title || '').trim()
  const titleLines = titleText ? wrapText(titleText, fontBold, nameSize, COLW).slice(0, 2) : []
  const titleBlock = titleText ? ((labelSize + 2) + 6 + titleLines.length * (nameSize + 6)) : 0

  // Consommation avant le message : GiftedBy + Title

  const gapBeforeTitle = giftedName ? 8 : gapSection
  const beforeMsgConsumed = giftedBlockH + (titleBlock ? (gapBeforeTitle + titleBlock) : 0)
  const afterTitleSpace = spaceAfterOwned - beforeMsgConsumed
  const maxMsgLines = Math.max(0, Math.floor((afterTitleSpace - (link_url ? (gapSection + lineHLink) : 0)) / lineHMsg))
  const msgLines = msgLinesAll.slice(0, maxMsgLines)

  const afterMsgSpace = afterTitleSpace - (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
  const maxLinkLines = Math.min(2, Math.max(0, Math.floor(afterMsgSpace / lineHLink)))
  const linkLines = linkLinesAll.slice(0, maxLinkLines)

  const blockH = fixedTop
    + (titleBlock ? (gapSection + titleBlock) : 0)
    + (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
    + (linkLines.length ? (gapSection + linkLines.length * lineHLink) : 0)

  /*

  const biasUp = 22
  let by = contentBottomMin + (availH - blockH) / 2 + biasUp
  let y = by + blockH
  
  */
  // ancrage haut
  let y = contentTopMax
  // Render — time
  y -= (tsSize + 6)
  page.drawText(mainTime, { x: CX - fontBold.widthOfTextAtSize(mainTime, tsSize)/2, y, size: tsSize, font: fontBold, color: cMain })

  // Owned by (uniquement si autorisé)
  if (hasName) {
    y -= gapSection
    page.drawText(L.ownedBy, { x: CX - font.widthOfTextAtSize(L.ownedBy, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
    y -= (labelSize + 2 + gapSmall)
    const name = String(display_name).trim()
    page.drawText(name, { x: CX - fontBold.widthOfTextAtSize(name, nameSize)/2, y: y - (nameSize + 4) + 4, size: nameSize, font: fontBold, color: cMain })
    y -= (nameSize + 4)
  }

  // Gifted by (si détecté)
  if (giftedName) {
    y -= gapSection
    page.drawText(L.giftedBy, { x: CX - font.widthOfTextAtSize(L.giftedBy, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
    y -= (labelSize + 2 + gapSmall)
    page.drawText(giftedName, { x: CX - fontBold.widthOfTextAtSize(giftedName, nameSize)/2, y: y - (nameSize + 4) + 4, size: nameSize, font: fontBold, color: cMain })
    y -= (nameSize + 4)
  }

  // Title
  if (titleText) {
    y -= (nameSize + 4)
    y -= (giftedName ? 8 : gapSection)
    y -= gapSection
    page.drawText(L.titleLabel, { x: CX - font.widthOfTextAtSize(L.titleLabel, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
    y -= (labelSize + 6)
    for (const line of titleLines) {
      page.drawText(line, { x: CX - fontBold.widthOfTextAtSize(line, nameSize)/2, y: y - (nameSize + 2), size: nameSize, font: fontBold, color: cMain })
      y -= (nameSize + 6)
    }
  }

  // Message
  if (msgLines.length) {
    y -= gapSection
    page.drawText(L.message, { x: CX - font.widthOfTextAtSize(L.message, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
    y -= (labelSize + 6)
    for (const line of msgLines) {
        if (line === '') { y -= lineHMsg; continue } // saute une ligne pour l’espace
        page.drawText(line, { x: CX - font.widthOfTextAtSize(line, msgSize)/2, y: y - lineHMsg, size: msgSize, font, color: cMain })
        y -= lineHMsg
      }
  }

  // Lien
  if (linkLines.length) {
    y -= gapSection
    page.drawText(L.link, { x: CX - font.widthOfTextAtSize(L.link, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
    y -= (labelSize + 6)
    for (const line of linkLines) {
      page.drawText(line, { x: CX - font.widthOfTextAtSize(line, linkSize)/2, y: y - lineHLink, size: linkSize, font, color: cLink })
      y -= lineHLink
    }
  }

  // Footer (QR optionnel)
  const EDGE = 16
  if (!opts.hideQr) {
    const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 })
    const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
    const png = await pdf.embedPng(pngBytes)
    const qrSize = 120
    page.drawImage(png, { x: width - EDGE - qrSize, y: EDGE, width: qrSize, height: qrSize })
  }

  if (!opts.hideMeta) {
    let metaY = EDGE + 76
    page.drawText(L.certId, { x: EDGE, y: metaY - (labelSize + 2), size: labelSize, font, color: cSub })
    metaY -= (labelSize + 6)
    page.drawText(claim_id, { x: EDGE, y: metaY - 12, size: 10.5, font: fontBold, color: cMain })
    metaY -= 20
    page.drawText(L.integrity, { x: EDGE, y: metaY - (labelSize + 2), size: labelSize, font, color: cSub })
    metaY -= (labelSize + 6)
    const h1 = hash.slice(0, 64), h2 = hash.slice(64)
    page.drawText(h1, { x: EDGE, y: metaY - 12, size: 9.5, font, color: cMain })
    metaY -= 16
    page.drawText(h2, { x: EDGE, y: metaY - 12, size: 9.5, font, color: cMain })
  }

  return await pdf.save()
}
