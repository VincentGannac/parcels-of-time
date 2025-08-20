// lib/cert.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'node:fs/promises'
import path from 'node:path'

export type CertStyle =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation'
  | 'custom'

export type Locale = 'fr' | 'en'
export type TimeLabelMode = 'utc' | 'utc_plus_local' | 'local_plus_utc'

const TEXTS = {
  en: { brand:'Parcels of Time', title:'Certificate of Claim', ownedBy:'Owned by', titleLabel:'Title', message:'Message', link:'Link', certId:'Certificate ID', integrity:'Integrity (SHA-256)', anon:'Anonymous', local:(s:string)=>`(local: ${s})`, utcParen:(s:string)=>`(UTC: ${s})` },
  fr: { brand:'Parcels of Time', title:'Certificat de Claim',  ownedBy:'Au nom de', titleLabel:'Titre',  message:'Message', link:'Lien', certId:'ID du certificat', integrity:'Intégrité (SHA-256)', anon:'Anonyme',  local:(s:string)=>`(local : ${s})`, utcParen:(s:string)=>`(UTC : ${s})` },
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
function utcMinuteLabel(iso: string){
  const d = new Date(iso); if (isNaN(d.getTime())) return iso
  d.setUTCSeconds(0,0)
  return d.toISOString().replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC')
}
function localMinuteLabel(iso: string, locale: Locale, timeZone?: string){
  const d = new Date(iso); if (isNaN(d.getTime())) return iso; d.setSeconds(0,0)
  try {
    const fmt = new Intl.DateTimeFormat(locale==='fr'?'fr-FR':'en-GB', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', timeZone })
    return fmt.format(d)
  } catch {
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'), hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0')
    return `${y}-${m}-${day} ${hh}:${mm}`
  }
}
function localDayOnlyLabel(iso: string, locale: Locale, timeZone?: string){
  const d = new Date(iso); if (isNaN(d.getTime())) return iso; d.setSeconds(0,0)
  try {
    const fmt = new Intl.DateTimeFormat(locale==='fr'?'fr-FR':'en-GB', { year:'numeric', month:'2-digit', day:'2-digit', timeZone })
    return fmt.format(d)
  } catch {
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
  }
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
  timeLabelMode?: TimeLabelMode
  localTimeZone?: string
  customBgDataUrl?: string
  localDateOnly?: boolean                  // ✅ NEW
  textColorHex?: string                    // ✅ NEW
}) {
  const {
    ts, display_name, title, message, link_url, claim_id, hash, public_url, localTimeZone,
  } = opts
  const style: CertStyle = opts.style || 'neutral'
  const locale: Locale = opts.locale || 'en'
  const timeLabelMode: TimeLabelMode = opts.timeLabelMode || 'local_plus_utc' // default friendly
  const localDateOnly = !!opts.localDateOnly
  const L = TEXTS[locale]

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 portrait
  const { width, height } = page.getSize()

  // Background
  try {
    let embedded = false
    if (style === 'custom') {
      const parsed = parseDataImage(opts.customBgDataUrl)
      if (parsed) {
        const img = parsed.kind === 'png' ? await pdf.embedPng(parsed.bytes) : await pdf.embedJpg(parsed.bytes)
        page.drawImage(img, { x: 0, y: 0, width, height })
        embedded = true
      }
    }
    if (!embedded) {
      const bg = await loadBgFromPublic(style)
      if (bg) {
        const img = bg.kind === 'png' ? await pdf.embedPng(bg.bytes) : await pdf.embedJpg(bg.bytes)
        page.drawImage(img, { x: 0, y: 0, width, height })
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
  page.drawText(L.brand, { x: CX - fontBold.widthOfTextAtSize(L.brand, brandSize)/2, y: yHeader, size: brandSize, font: fontBold, color: cMain })
  yHeader -= 18
  page.drawText(L.title, { x: CX - font.widthOfTextAtSize(L.title, subSize)/2, y: yHeader, size: subSize, font, color: cSub })

  // Typo sizes
  const tsSize = 26, labelSize = 11, nameSize = 15, msgSize = 12.5, linkSize = 10.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16, lineHLink = 14

  // Time labels (avec localDateOnly)
  const utcLabel = utcMinuteLabel(ts)
  const localFull = localMinuteLabel(ts, locale, localTimeZone)
  const localDay  = localDayOnlyLabel(ts, locale, localTimeZone)
  const localLabel = localDateOnly ? localDay : localFull

  let mainTime = utcLabel, subTime = ''
  if (timeLabelMode === 'utc_plus_local') { mainTime = utcLabel; subTime = L.local(localLabel) }
  else if (timeLabelMode === 'local_plus_utc') { mainTime = localLabel; subTime = L.utcParen(utcLabel.replace(' UTC','')) }

  // Footer reserved
  const qrSizePx = 120
  const metaBlockH = 76
  const footerH = Math.max(qrSizePx, metaBlockH)
  const footerMarginTop = 18

  // Content box
  const contentTopMax = yHeader - 38
  const contentBottomMin = BOT_Y + footerH + footerMarginTop
  const availH = contentTopMax - contentBottomMin

  // Wraps
  const msgLinesAll = message ? wrapText('“' + message + '”', font, msgSize, COLW) : []
  const linkLinesAll = link_url ? wrapText(link_url, font, linkSize, COLW) : []

  // Sequence heights (Owned by → Title → Message)
  const fixedTop =
    (tsSize + 6) +               // main time
    (subTime ? 12 : 0) +
    gapSection +                 // before Owned by
    (labelSize + 2) + gapSmall + // owned label + gap
    (nameSize + 4)               // name

  // compute how many message+link lines fit
  const spaceForText = availH
  const spaceAfterOwned = spaceForText - fixedTop
  // tentative allocation: title up to 2 lines
  const titleText = (title || '').trim()
  const titleLines = titleText ? wrapText(titleText, fontBold, nameSize, COLW).slice(0, 2) : []
  const titleBlock = titleText ? ((labelSize + 2) + 6 + titleLines.length * (nameSize + 6)) : 0

  // now remaining for message/link
  const afterTitleSpace = spaceAfterOwned - (titleBlock ? (gapSection + titleBlock) : 0)
  const maxMsgLines = Math.max(0, Math.floor((afterTitleSpace - (link_url ? (gapSection + lineHLink) : 0)) / lineHMsg))
  const msgLines = msgLinesAll.slice(0, maxMsgLines)

  const afterMsgSpace = afterTitleSpace - (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
  const maxLinkLines = Math.min(2, Math.max(0, Math.floor(afterMsgSpace / lineHLink)))
  const linkLines = linkLinesAll.slice(0, maxLinkLines)

  const blockH = fixedTop
    + (titleBlock ? (gapSection + titleBlock) : 0)
    + (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
    + (linkLines.length ? (gapSection + linkLines.length * lineHLink) : 0)

  const biasUp = 10
  let by = contentBottomMin + (availH - blockH) / 2 + biasUp
  let y = by + blockH

  // Render
  // time
  y -= (tsSize + 6)
  page.drawText(mainTime, { x: CX - fontBold.widthOfTextAtSize(mainTime, tsSize)/2, y, size: tsSize, font: fontBold, color: cMain })
  if (subTime) {
    const ySub = y - 16
    page.drawText(subTime, { x: CX - font.widthOfTextAtSize(subTime, 11)/2, y: ySub, size: 11, font, color: cSub })
    y -= 12
  }

  // Owned by
  y -= gapSection
  page.drawText(L.ownedBy, { x: CX - font.widthOfTextAtSize(L.ownedBy, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
  y -= (labelSize + 2 + gapSmall)
  const name = display_name || L.anon
  page.drawText(name, { x: CX - fontBold.widthOfTextAtSize(name, nameSize)/2, y: y - (nameSize + 4) + 4, size: nameSize, font: fontBold, color: cMain })

  // Title (optionnel)
  if (titleText) {
    y -= (nameSize + 4)
    y -= gapSection
    page.drawText(L.titleLabel, { x: CX - font.widthOfTextAtSize(L.titleLabel, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
    y -= (labelSize + 6)
    for (const line of titleLines) {
      page.drawText(line, { x: CX - fontBold.widthOfTextAtSize(line, nameSize)/2, y: y - (nameSize + 2), size: nameSize, font: fontBold, color: cMain })
      y -= (nameSize + 6)
    }
  } else {
    y -= (nameSize + 4)
  }

  // Message
  if (msgLines.length) {
    y -= gapSection
    page.drawText(L.message, { x: CX - font.widthOfTextAtSize(L.message, labelSize)/2, y: y - (labelSize + 2), size: labelSize, font, color: cSub })
    y -= (labelSize + 6)
    for (const line of msgLines) {
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

  // Footer
  const EDGE = 16
  const qrDataUrl = await QRCode.toDataURL(public_url, { margin: 0, scale: 6 });
  const pngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const png = await pdf.embedPng(pngBytes);
  page.drawImage(png, { x: width - EDGE - qrSizePx, y: EDGE, width: qrSizePx, height: qrSizePx });

  let metaY = EDGE + 76;
  page.drawText(L.certId, { x: EDGE, y: metaY - (labelSize + 2), size: labelSize, font, color: cSub });
  metaY -= (labelSize + 6);
  page.drawText(claim_id, { x: EDGE, y: metaY - 12, size: 10.5, font: fontBold, color: cMain });
  metaY -= 20;
  page.drawText(L.integrity, { x: EDGE, y: metaY - (labelSize + 2), size: labelSize, font, color: cSub });
  metaY -= (labelSize + 6);
  const h1 = hash.slice(0, 64), h2 = hash.slice(64);
  page.drawText(h1, { x: EDGE, y: metaY - 12, size: 9.5, font, color: cMain });
  metaY -= 16;
  page.drawText(h2, { x: EDGE, y: metaY - 12, size: 9.5, font, color: cMain });

  return await pdf.save()
}
