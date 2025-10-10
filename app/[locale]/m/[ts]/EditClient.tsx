// app/[locale]/m/[ts]/EditClient.tsx
'use client'

import type React from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type CertStyle =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation' | 'custom';

const STYLES: { id: CertStyle; label: string; hint?: string }[] = [
  { id: 'neutral',    label: 'Neutral',     hint: 'sobre & élégant' },
  { id: 'romantic',   label: 'Romantic',    hint: 'hearts & lace' },
  { id: 'birthday',   label: 'Birthday',    hint: 'balloons & confetti' },
  { id: 'wedding',    label: 'Wedding',     hint: 'rings & botanicals' },
  { id: 'birth',      label: 'Birth',       hint: 'pastel clouds & stars' },
  { id: 'christmas',  label: 'Christmas',   hint: 'pine & snow' },
  { id: 'newyear',    label: 'New Year',    hint: 'fireworks trails' },
  { id: 'graduation', label: 'Graduation',  hint: 'laurel & caps' },
  { id: 'custom',     label: 'Custom',      hint: 'A4 2480×3508 ou 1024×1536' },
] as const

/** ====== Constantes PDF (miroir) ====== */
const A4_W_PT = 595.28
const A4_H_PT = 841.89
const EDGE_PT = 16
const QR_SIZE_PT = 120
const META_H_PT = 76
const PT_PER_CM = 28.3465
const SHIFT_UP_PT = Math.round(2 * PT_PER_CM) // 2cm
const CERT_BG_HEX = '#F4F1EC'

function getSafeArea(style: CertStyle){
  const base = { top: 120, right: 96, bottom: 130, left: 96 }
  switch (style) {
    case 'romantic':   return { top: 120, right: 96, bottom: 130, left: 96 }
    case 'birthday':   return { top: 120, right: 96, bottom: 130, left: 96 }
    case 'birth':      return { top: 120, right: 96, bottom: 130, left: 96 }
    case 'wedding':    return { top: 120, right: 96, bottom: 130, left: 96 }
    case 'christmas':  return { top: 120, right: 96, bottom: 130, left: 96 }
    case 'newyear':    return { top: 120, right: 96, bottom: 130, left: 96 }
    case 'graduation': return { top: 120, right: 96, bottom: 130, left: 96 }
    case 'custom':     return { top: 120, right: 96, bottom: 130, left: 96 }
    default:           return base
  }
}

function isoDayString(d: Date) { const c = new Date(d.getTime()); c.setUTCHours(0,0,0,0); return ymdUTC(c)}
function parseToDateOrNull(input: string): Date | null { const s=(input||'').trim(); if(!s) return null; const d=new Date(s); if(isNaN(d.getTime())) return null; d.setUTCHours(0,0,0,0); return d }
function ymdUTC(d: Date){ const y=d.getUTCFullYear(); const m=String(d.getUTCMonth()+1).padStart(2,'0'); const day=String(d.getUTCDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
function daysInMonth(y:number, m:number) { return new Date(y, m, 0).getDate() }
const range = (a:number, b:number) => Array.from({length:b-a+1},(_,i)=>a+i)

function hexToRgb(hex:string){ const m=/^#?([0-9a-f]{6})$/i.exec(hex); if(!m) return {r:26,g:31,b:42}; const n=parseInt(m[1],16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 } }
function mix(a:number,b:number,t:number){ return Math.round(a*(1-t)+b*t)}
function lightenTowardWhite(hex:string, t=0.45){ const {r,g,b}=hexToRgb(hex); return `rgba(${mix(r,255,t)}, ${mix(g,255,t)}, ${mix(b,255,t)}, 0.9)` }
function relLum({r,g,b}:{r:number,g:number,b:number}){ const srgb=(c:number)=>{ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }; const R=srgb(r),G=srgb(g),B=srgb(b); return 0.2126*R+0.7152*G+0.0722*B }
function contrastRatio(fgHex:string, bgHex=CERT_BG_HEX){ const L1=relLum(hexToRgb(fgHex)), L2=relLum(hexToRgb(bgHex)); const light=Math.max(L1,L2), dark=Math.min(L1,L2); return (light+0.05)/(dark+0.05) }
function ratioLabel(r:number){ if(r>=7) return {label:'AAA', color:'#0BBF6A'}; if(r>=4.5) return {label:'AA', color:'#E4B73D'}; return {label:'⚠︎ Low', color:'#FF7A7A'} }

function makeMeasurer(scale:number){
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const setFont = (sizePt:number, bold=false) => { const px=sizePt*scale; ctx.font=`${bold?'700 ':''}${px}px Helvetica, Arial, sans-serif` }
  const widthPx = (text:string) => ctx.measureText(text).width
  const wrap = (text:string, sizePt:number, maxWidthPt:number, bold=false) => {
    const words=(text||'').trim().split(/\s+/).filter(Boolean); const lines:string[]=[]; let line=''
    setFont(sizePt, bold); const maxPx=maxWidthPt*scale
    for(const w of words){ const test=line?(line+' '+w):w; if(widthPx(test)<=maxPx) line=test; else { if(line) lines.push(line); line=w } }
    if(line) lines.push(line); return lines
  }
  return { wrap }
}

/** ====== Pipeline import / normalisation image ====== */
function looks(exts:string[], name:string, type:string){
  const low = (name || '').toLowerCase()
  const t   = (type || '').toLowerCase()
  return exts.some(ext => low.endsWith('.'+ext) || t.includes(ext))
}
async function heicToPngIfNeeded(original: File): Promise<{file: File, wasHeic:boolean}> {
  const type = (original.type || '').toLowerCase()
  const looksHeic = /^image\/(heic|heif|heic-sequence|heif-sequence)$/.test(type) || /\.(heic|heif)$/i.test(original.name)
  if (!looksHeic) return { file: original, wasHeic:false }
  const heic2any = (await import('heic2any')).default as (opts:any)=>Promise<Blob>
  const out = await heic2any({ blob: original, toType: 'image/png', quality: 0.92 })
  return { file: new File([out], original.name.replace(/\.(heic|heif)\b/i, '.png'), { type:'image/png' }), wasHeic:true }
}
async function getExifOrientation(file: File): Promise<number> {
  try {
    const { parse } = (await import('exifr')) as any;
    const meta = await parse(file, { pick: ['Orientation'] });
    return meta?.Orientation || 1;
  } catch { return 1 }
}
function drawNormalized(img: HTMLImageElement, orientation: number) {
  const w = img.naturalWidth, h = img.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const swap = (o:number) => o >= 5 && o <= 8
  canvas.width  = swap(orientation) ? h : w
  canvas.height = swap(orientation) ? w : h
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, canvas.width, 0); break
    case 3: ctx.transform(-1, 0, 0, -1, canvas.width, canvas.height); break
    case 4: ctx.transform(1, 0, 0, -1, 0, canvas.height); break
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break
    case 6: ctx.transform(0, 1, -1, 0, canvas.height, 0); break
    case 7: ctx.transform(0, -1, -1, 0, canvas.height, canvas.width); break
    case 8: ctx.transform(0, -1, 1, 0, 0, canvas.width); break
    default: break
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return { dataUrl: canvas.toDataURL('image/png', 0.92), w: canvas.width, h: canvas.height }
}
async function decodeTiffToPngDataUrl(file: File): Promise<{dataUrl:string; w:number; h:number}> {
  const mod: any = await import('utif')
  const UTIF = mod.default ?? mod
  const buf = new Uint8Array(await file.arrayBuffer())
  const ifds = UTIF.decode(buf)
  if (!ifds || !ifds.length) throw new Error('TIFF decode failed')
  UTIF.decodeImage(buf, ifds[0])
  const rgba = UTIF.toRGBA8(ifds[0])
  const w = ifds[0].width || ifds[0].t256 || ifds[0].tImageWidth
  const h = ifds[0].height || ifds[0].t257 || ifds[0].tImageLength
  if (!w || !h) throw new Error('TIFF size missing')
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  img.data.set(rgba)
  ctx.putImageData(img, 0, 0)
  return { dataUrl: c.toDataURL('image/png', 0.92), w, h }
}
async function rasterizeVectorOrBitmap(file: File, orientation = 1){
  const tmpUrl = URL.createObjectURL(file)
  try {
    const img = new Image()
    const done = new Promise<{dataUrl:string; w:number; h:number}>((resolve, reject) => {
      img.onload = () => resolve(drawNormalized(img, orientation || 1))
      img.onerror = reject
    })
    img.src = tmpUrl
    return await done
  } finally { URL.revokeObjectURL(tmpUrl) }
}
async function normalizeToPng(original: File) {
  const name = original.name || ''
  const type = (original.type || '')

  // 1) HEIC/HEIF → PNG (via lib) + orientation EXIF du fichier d'origine
  if (looks(['heic','heif'], name, type)) {
    const { file: afterHeic } = await heicToPngIfNeeded(original)
    const orientation = await getExifOrientation(original)
    return rasterizeVectorOrBitmap(afterHeic, orientation)
  }

  // 2) TIFF → PNG (via utif)
  if (looks(['tif','tiff'], name, type)) {
    return decodeTiffToPngDataUrl(original)
  }

  // 3) SVG (vectoriel) → canvas (pas d’EXIF)
  if (looks(['svg'], name, type)) {
    return rasterizeVectorOrBitmap(original, 1)
  }

  // 4) WEBP/AVIF/GIF/BMP/PNG/JPEG : navigateur décode → canvas + EXIF si JPEG
  const orientation = looks(['jpg','jpeg'], name, type) ? (await getExifOrientation(original)) : 1
  return rasterizeVectorOrBitmap(original, orientation)
}
function bytesFromDataURL(u: string) {
  const i = u.indexOf(',')
  const b64 = i >= 0 ? u.slice(i + 1) : u
  return Math.floor(b64.length * 0.75)
}
function coverToA4JPEG(dataUrl: string, srcW: number, srcH: number) {
  const TARGET_W = 2480, TARGET_H = 3508
  const MAX_BYTES = 3.5 * 1024 * 1024
  return new Promise<{ dataUrl: string; w: number; h: number }>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = TARGET_W; c.height = TARGET_H
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      const scale = Math.max(TARGET_W / srcW, TARGET_H / srcH)
      const dw = srcW * scale, dh = srcH * scale
      const dx = (TARGET_W - dw) / 2, dy = (TARGET_H - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
      let q = 0.82
      let out = c.toDataURL('image/jpeg', q)
      while (bytesFromDataURL(out) > MAX_BYTES && q > 0.5) {
        q -= 0.06
        out = c.toDataURL('image/jpeg', q)
      }
      resolve({ dataUrl: out, w: TARGET_W, h: TARGET_H })
    }
    img.src = dataUrl
  })
}

function stripAttestationText(input: string): string {
  if (!input) return ''
  return input
    .replace(/\s*Ce certificat atteste que[\s\S]+?Le présent document confirme[\s\S]+?cette acquisition\.\s*/gi, '')
    .trim()
}

type Initial = {
  email: string
  display_name: string
  title: string
  message: string
  link_url: string
  cert_style: CertStyle
  time_display: 'utc'|'utc+local'|'local+utc'
  local_date_only: boolean
  text_color: string
  title_public: boolean
  message_public: boolean
}

export default function EditClient({
  tsISO,
  locale,
  initial
}: {
  tsISO: string
  locale: string
  initial: Initial
}) {
  const isFR = useMemo(()=> locale.toLowerCase().startsWith('fr'), [locale])
  const L = useMemo(()=>({
    brand:'Parcels of Time',
    title:isFR?'Certificat d’acquisition':'Certificate of Claim',
    ownedBy:isFR?'Au nom de':'Owned by',
    giftedBy:isFR?'Offert par':'Gifted by',
    titleLabel:isFR?'Titre':'Title',
    message:isFR?'Message':'Message',
    attestationLabel: isFR ? 'Texte d’attestation' : 'Attestation text', 
    link:isFR?'Lien':'Link',
    anon:isFR?'Anonyme':'Anonymous',
    placeholders:{
      giftedName: isFR ? 'Votre nom' : 'Your name',
      title:      isFR ? 'Votre titre' : 'Your title',
      message:    isFR ? 'Votre message…' : 'Your message…',
      dateYMD:    'AAAA-MM-JJ',
    }
  }), [isFR])
  const giftLabel = L.giftedBy
  const ownedByLabel = L.ownedBy
  const titleLabel = L.titleLabel
  const messageLabel = L.message

  // ==== Date (verrouillée) ====
  const parsedDate = parseToDateOrNull(tsISO) || new Date()
  const Y0 = parsedDate.getUTCFullYear()
  const M0 = parsedDate.getUTCMonth()+1
  const D0 = parsedDate.getUTCDate()
  const [Y] = useState<number>(Y0)
  const [M] = useState<number>(M0)
  const [D] = useState<number>(D0)

  const MIN_GAP_HEADER_PT = 28

  const hideOwnedInitially =/\[\[\s*HIDE_OWNED_BY\s*\]\]/i.test(initial.message || '')
  const hadAttestationInitially =  /Ce certificat atteste que[\s\S]+?cette acquisition\./i.test(initial.message || '')
  const initialMessageClean = stripAttestationText(String(initial.message || '').replace(/\s*\[\[\s*HIDE_OWNED_BY\s*\]\]\s*/gi, '')).trim()

  // ==== Form ====
  const [isGift, setIsGift] = useState<boolean>(/^\s*Offert par:/mi.test(initial.message || ''))
  const [form, setForm] = useState({
    email: initial.email || '',
    display_name: initial.display_name || '',
    title: initial.title || '',
    message: initialMessageClean,
    gifted_by: '', // re-rempli si on détecte la mention
    link_url: initial.link_url || '',
    ts: isoDayString(parsedDate),
    cert_style: (initial.cert_style || 'neutral') as CertStyle,
    time_display: (initial.time_display || 'local+utc') as 'utc'|'utc+local'|'local+utc',
    local_date_only: !!initial.local_date_only,
    text_color: initial.text_color || '#1A1F2A',
    title_public: !!initial.title_public,
    message_public: !!initial.message_public,
    public_registry: false,
  })

  // Extraire “Offert par: xxx” si présent
  useEffect(() => {
    const m = /^(?:offert par|gifted by)\s*:\s*(.+)$/i.exec(form.message || '')
    if (m) setForm(f => ({ ...f, gifted_by: m[1].trim() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** ===== Custom background (édition) ===== */
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null)
  const [customBgLocal, setCustomBgLocal] = useState<{ dataUrl:string; w:number; h:number } | null>(null)
  const [imgLoading, setImgLoading] = useState(false)
  const [customErr, setCustomErr] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const openFileDialog = () => fileInputRef.current?.click()

  // Charger le fond déjà enregistré (sauf si on a une nouvelle image locale)
  useEffect(() => {
    let ignore = false
    let objectUrl: string | null = null

    if (form.cert_style === 'custom' && !customBgLocal) {
       const url = `/api/claim-bg/${encodeURIComponent(tsISO)}?v=${Date.now()}`
       fetch(url, { cache: 'no-store' })
        .then(r => r.ok ? r.blob() : Promise.reject(r.status))
        .then(b => {
          objectUrl = URL.createObjectURL(b)
          if (!ignore) setCustomBgUrl(objectUrl)
        })
        .catch(() => { if (!ignore) setCustomBgUrl(null) })

      return () => {
        ignore = true
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      }
    } else {
      setCustomBgUrl(null)
    }
  }, [tsISO, form.cert_style, customBgLocal])

  async function onPickCustomBg(file?: File | null) {
    try {
      setCustomErr('')
      if (!file) return
      setImgLoading(true)
      const { dataUrl: normalizedUrl, w, h } = await normalizeToPng(file)
      const { dataUrl: a4Url, w: tw, h: th } = await coverToA4JPEG(normalizedUrl, w, h)
      if (bytesFromDataURL(a4Url) > 4 * 1024 * 1024) {
        setCustomErr('Image trop lourde après préparation. Réessayez avec une photo plus légère.')
        return
      }
      setCustomBgLocal({ dataUrl: a4Url, w: tw, h: th })
      setForm(f => ({ ...f, cert_style: 'custom' }))
    } catch (e) {
      console.error('[Edit/CustomBG] onPickCustomBg', e)
      setCustomErr('Erreur de lecture ou de conversion de l’image.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setImgLoading(false)
    }
  }

  // Visibilité (mêmes toggles que ClientClaim)
  const [show, setShow] = useState({
    ownedBy: !hideOwnedInitially,
    title: !!(initial.title || '').trim(),
    message: !!initialMessageClean,
    attestation: hadAttestationInitially,
    giftedBy: isGift,
  })

  // 🔒 Auto-vidage de sécurité si décoché (y compris si ça change “indirectement”)
  useEffect(() => {
    if (!show.ownedBy && form.display_name) {
      setForm(f => ({ ...f, display_name: '' }))
    }
  }, [show.ownedBy]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show.title && form.title) {
      setForm(f => ({ ...f, title: '' }))
    }
  }, [show.title]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show.message && form.message) {
      setForm(f => ({ ...f, message: '' }))
    }
  }, [show.message]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show.giftedBy && form.gifted_by) {
      setForm(f => ({ ...f, gifted_by: '' }))
    }
  }, [show.giftedBy]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isGift && (show.giftedBy || form.gifted_by)) {
      setShow(s => ({ ...s, giftedBy: false }))
      setForm(f => ({ ...f, gifted_by: '' }))
    }
  }, [isGift]) // eslint-disable-line react-hooks/exhaustive-deps

  const ownerForText = (form.display_name || '').trim() || L.anon
  const chosenDateStr = ymdUTC(parsedDate)
  const attestationText = `Ce certificat atteste que ${ownerForText} est reconnu(e) comme propriétaire symbolique de la journée du ${chosenDateStr}. Le présent document confirme la validité et l'authenticité de cette acquisition.`

  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  // ==== Prévisualisation ====
  const previewWrapRef = useRef<HTMLDivElement|null>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(()=>{
    const el = previewWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(()=> {
      const w = el.clientWidth
      const s = w / A4_W_PT
      setScale(s || 1)
    })
    ro.observe(el)
    return ()=>ro.disconnect()
  }, [])

  const mainColor = form.text_color || '#1A1F2A'
  const subtleColor = lightenTowardWhite(mainColor, 0.45)
  const ratio = contrastRatio(mainColor)
  const ratioMeta = ratioLabel(ratio)

  const meas = useMemo(()=>makeMeasurer(scale), [scale])
  const SA = getSafeArea(form.cert_style)
  const LEFT = SA.left, RIGHT = A4_W_PT - SA.right, TOP_Y = A4_H_PT - SA.top, BOT_Y = SA.bottom
  const COLW = RIGHT - LEFT
  const tsSize = 26, labelSize = 11, nameSize = 15, msgSize = 12.5, linkSize = 10.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16, lineHLink = 14
  const brandSize = 18, subSize = 12
  let yHeader = TOP_Y - 40
  const yBrand = yHeader; yHeader -= 18; const yCert = yHeader
  const qrSizePx = QR_SIZE_PT, metaBlockH = META_H_PT
  const footerH = Math.max(qrSizePx, metaBlockH), footerMarginTop = 8
  const contentTopMax = yHeader - 38 + SHIFT_UP_PT
  const contentBottomMin = BOT_Y + footerH + footerMarginTop
  const availH = contentTopMax - contentBottomMin

  const showOwned = show.ownedBy
  const showGifted = isGift && show.giftedBy
  const showT = show.title
  const showM = show.message
  const showA = show.attestation

  const titleForPreview      = showT ? (form.title.trim() || L.placeholders.title) : ''
  const messageOnlyPreview   = showM ? (form.message.trim() || L.placeholders.message) : ''
  const attestationPreview   = showA ? attestationText : ''

  const nameForPreview = showOwned ? (form.display_name.trim() || L.anon) : ''
  const giftedByStr = showGifted ? (form.gifted_by.trim() || L.placeholders.giftedName) : ''
  
  const titleLines = titleForPreview ? meas.wrap(titleForPreview, nameSize, COLW, true).slice(0, 2) : []

  const ownedBlockH  = showOwned  ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0
  const giftedBlockH = showGifted ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0

  const fixedTop = (tsSize + 6) + ownedBlockH
  const spaceForText = availH
  const spaceAfterOwned = spaceForText - fixedTop

  const titleBlockNoGap = titleForPreview ? ((labelSize + 2) + 6 + titleLines.length * (nameSize + 6)) : 0
  const gapBeforeTitle = showGifted ? 8 : gapSection
  const beforeMsgConsumed = giftedBlockH + (titleBlockNoGap ? (gapBeforeTitle + titleBlockNoGap) : 0)

  const afterTitleSpace = spaceAfterOwned - beforeMsgConsumed

  const TOTAL_TEXT_LINES = Math.max(0, Math.floor(afterTitleSpace / lineHMsg))

  const attestLinesAll = (attestationPreview)
    ? meas.wrap(attestationPreview, msgSize, COLW, false)
    : []

  const LINES_FOR_USER = Math.max(0, TOTAL_TEXT_LINES - attestLinesAll.length)

  const msgLinesAll = messageOnlyPreview
    ? messageOnlyPreview.split(/\n+/).flatMap((p, i, arr) => {
        const lines = meas.wrap(p, msgSize, COLW, false)
        return i < arr.length - 1 ? [...lines, ''] : lines
      })
    : []

  const msgLines = msgLinesAll.slice(0, LINES_FOR_USER)

  const remainingForAttest = Math.max(0, TOTAL_TEXT_LINES - msgLines.length)
  const attestLines = attestLinesAll.slice(0, remainingForAttest)

  const linkLinesAll = form.link_url ? meas.wrap(form.link_url, linkSize, COLW, false) : []
  
  const maxMsgLines = Math.max(0, Math.floor((afterTitleSpace - (form.link_url ? (gapSection + lineHLink) : 0)) / lineHMsg))
  const NAME_MAX  = 40
  const GIFT_MAX  = 40
  const TITLE_MAX = 80

  const afterMsgSpace = afterTitleSpace - (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
  const maxLinkLines = Math.min(2, Math.max(0, Math.floor(afterMsgSpace / lineHLink)))
  const linkLines = linkLinesAll.slice(0, maxLinkLines)
  const blockH =
  fixedTop
  + (titleBlockNoGap ? (gapSection + titleBlockNoGap) : 0)
  + (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
  + (attestLines.length ? (gapSection + attestLines.length * lineHMsg) : 0)

  let y = contentTopMax
  const toTopPx = (baselineY:number, fontSizePt:number) => (A4_H_PT - baselineY) * scale - (fontSizePt * scale)
  const centerStyle: React.CSSProperties = {
      position:'absolute',
      left:'50%',
      transform:'translateX(-50%)',
      textAlign:'center',
      whiteSpace:'pre',
      wordBreak:'normal',
      color: form.text_color
    }

  const TOTAL_MSG_LINES = maxMsgLines
  const attestExtraBlank = (show.attestation ? 1 : 0)

  function capacityCharsForLines(linesBudget: number): number {
    if (linesBudget <= 0) return 0
    const fitsLines = (n: number) => {
      const fake = 'x '.repeat(Math.max(0, n)).trim()
      const lines = meas.wrap(fake, msgSize, COLW, false)
      return lines.length
    }
    let lo = 0, hi = 5000
    while (lo < hi) {
      const mid = Math.ceil((lo + hi + 1) / 2)
      if (fitsLines(mid) <= linesBudget) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  const userMsgMaxChars = useMemo(() => {
    return capacityCharsForLines(LINES_FOR_USER)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LINES_FOR_USER, scale, form.cert_style, show, isGift, chosenDateStr])
  
  y -= (tsSize + 6); const topMainTime = toTopPx(y, tsSize)

  let ownedLabelTop:number|null = null, ownedNameTop:number|null = null
  if (showOwned) {
    y -= gapSection
    ownedLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 2 + gapSmall)
    ownedNameTop = toTopPx(y - (nameSize + 4) + 4, nameSize)
    y -= (nameSize + 4)
  }

  let giftedLabelTop:number|null = null, giftedNameTop:number|null = null
  if (showGifted) {
    y -= gapSection
    giftedLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 2 + gapSmall)
    giftedNameTop = toTopPx(y - (nameSize + 4) + 4, nameSize)
    y -= (nameSize + 4)
  }

  let titleLabelTop:number|null = null; const titleLineTops:number[] = []
  if (titleForPreview) {
    y -= (nameSize + 4)
    y -= (showGifted ? 8 : gapSection)
    titleLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of titleLines) {
      titleLineTops.push(toTopPx(y - (nameSize + 2), nameSize))
      y -= (nameSize + 6)
    }
  }
  
  let msgLabelTop:number|null = null; const msgLineTops:number[] = []
  if (msgLines.length) {
    y -= gapSection
    msgLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of msgLines) { msgLineTops.push(toTopPx(y - lineHMsg, msgSize)); y -= lineHMsg }
  }

  let attestLabelTop:number|null = null
  const attestLineTops:number[] = []
  if (attestLines.length) {
    y -= gapSection
    attestLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of attestLines) {
      attestLineTops.push(toTopPx(y - lineHMsg, msgSize))
      y -= lineHMsg
    }
  }

  let linkLabelTop:number|null = null; const linkLineTops:number[] = []
  if (linkLines.length) {
    y -= gapSection
    linkLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of linkLines) { linkLineTops.push(toTopPx(y - lineHLink, linkSize)); y -= lineHLink }
  }

  const topBrand = toTopPx(yBrand, brandSize)
  const topCert  = toTopPx(yCert,  subSize)

  const isMsgOverflow = show.message && userMsgMaxChars>0 && (form.message?.length||0) > userMsgMaxChars

  // ====== Submit (Checkout édition) ======
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')

    const safeUserMsg = show.message ? (form.message || '') : ''
    const cappedUserMsg = userMsgMaxChars > 0 ? safeUserMsg.slice(0, userMsgMaxChars) : ''

    const msgParts: string[] = []
    if (show.message && cappedUserMsg.trim()) msgParts.push(cappedUserMsg.trim())
    if (show.attestation) msgParts.push(attestationText)
    if (isGift && show.giftedBy && form.gifted_by.trim()) {
      msgParts.push(`${giftLabel}: ${form.gifted_by.trim().slice(0, GIFT_MAX)}`) 
    }
    if (!show.ownedBy) msgParts.push('[[HIDE_OWNED_BY]]')

    const finalMessage = msgParts.length ? msgParts.join('\n') : undefined

    const payload:any = {
      mode: 'edit',
      ts: tsISO,
      email: form.email,
      display_name: show.ownedBy ? (form.display_name || '') : '',
      title: show.title ? (form.title || '') : '',
      message: finalMessage,
      link_url: form.link_url || '',
      cert_style: form.cert_style || 'neutral',
      time_display: form.time_display || 'local+utc',
      local_date_only: form.local_date_only ? '1' : '0',
      text_color: form.text_color || '#1A1F2A',
      title_public: form.title_public ? '1' : '0',
      message_public: form.message_public ? '1' : '0',
    }

    if (form.cert_style === 'custom' && customBgLocal?.dataUrl) {
      payload.custom_bg_data_url = customBgLocal.dataUrl
    }

    const res = await fetch('/api/checkout/edit', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      setStatus('error')
      try {
        const j = await res.json()
        const map: Record<string,string> = {
          rate_limited: 'Trop de tentatives. Réessaye dans ~1 minute.',
          invalid_ts: 'Horodatage invalide.',
          missing_fields: 'Merci de renseigner au minimum l’e-mail.',
          not_found: 'Aucun certificat trouvé pour cette date.',
          stripe_key_missing: 'Configuration Stripe absente côté serveur.',
          stripe_error: 'Erreur Stripe côté serveur.',
        }
        setError(map[j.error] || j.error || 'Unknown error')
      } catch { setError('Unknown error') }
      return
    }
    const data = await res.json()
    window.location.href = data.url
  }

  // UI palette
  const SWATCHES = [
    '#000000','#111111','#1A1F2A','#222831','#2E3440','#37474F','#3E3E3E','#4B5563',
    '#5E452A','#6D4C41','#795548','#8D6E63',
    '#0B3D2E','#1B5E20','#2E7D32','#004D40','#0D47A1','#1A237E','#283593',
    '#880E4F','#6A1B9A','#AD1457','#C2185B','#9C27B0',
    '#102A43','#0F2A2E','#14213D',
    '#FFFFFF','#E6EAF2',
  ]

  const minTimeTopPx = topCert + (MIN_GAP_HEADER_PT * scale)
  const contentOffsetPx = Math.max(0, minTimeTopPx - topMainTime)
  const push = (v:number|null) => (v==null ? v : v + contentOffsetPx)

  const finalDisplayName = show.ownedBy
  ? ((form.display_name || '').slice(0, NAME_MAX) || undefined)
  : undefined

  const finalTitle = show.title
  ? ((form.title || '').slice(0, TITLE_MAX) || undefined)
  : undefined

  const topMainTime2      = topMainTime + contentOffsetPx
  ownedLabelTop           = push(ownedLabelTop)
  ownedNameTop            = push(ownedNameTop)
  giftedLabelTop          = push(giftedLabelTop)
  giftedNameTop           = push(giftedNameTop)
  titleLabelTop           = push(titleLabelTop)
  for (let i=0;i<titleLineTops.length;i++) titleLineTops[i] = titleLineTops[i] + contentOffsetPx
  msgLabelTop             = push(msgLabelTop)
  attestLabelTop          = push(attestLabelTop)
  for (let i=0;i<attestLineTops.length;i++) attestLineTops[i] = attestLineTops[i] + contentOffsetPx
  for (let i=0;i<msgLineTops.length;i++) msgLineTops[i] = msgLineTops[i] + contentOffsetPx
  linkLabelTop            = push(linkLabelTop)
  for (let i=0;i<linkLineTops.length;i++) linkLineTops[i] = linkLineTops[i] + contentOffsetPx

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:18, alignItems:'start' }}>
      {/* input fichier caché (tous formats) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.tif,.tiff,.bmp,.svg,.webp,.avif"
        style={{display:'none'}}
        onChange={(e)=>onPickCustomBg(e.currentTarget.files?.[0] || null)}
      />

      {/* ---------- FORM EDIT ---------- */}
      <form onSubmit={onSubmit} style={{display:'grid', gap:14}}>
         
        {/* Date (verrouillée) */}
        <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
          <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>VOTRE JOUR (verrouillé)</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
            <label style={{display:'grid', gap:6}}>
              <span>Année</span>
              <select value={Y} disabled
                style={{padding:'12px 10px', border:'1px dashed var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                <option value={Y} style={{color:'#000'}}>{Y}</option>
              </select>
            </label>
            <label style={{display:'grid', gap:6}}>
              <span>Mois</span>
              <select value={M} disabled
                style={{padding:'12px 10px', border:'1px dashed var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                <option value={M} style={{color:'#000'}}>{String(M).padStart(2,'0')}</option>
              </select>
            </label>
            <label style={{display:'grid', gap:6}}>
              <span>Jour</span>
              <select value={D} disabled
                style={{padding:'12px 10px', border:'1px dashed var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                <option value={D} style={{color:'#000'}}>{String(D).padStart(2,'0')}</option>
              </select>
            </label>
          </div>
          <div style={{marginTop:8, fontSize:12, color:'var(--color-muted)'}}>
            La date ne peut pas être modifiée (unicité garantie). Vous pouvez changer le style, le texte, etc.
          </div>
        </div>
        
        {/* Infos */}
        <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
          <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
            Modifier les informations (9,99 €)
          </div>

          <label style={{display:'grid', gap:6, marginBottom:10}}>
            <span>{isFR ? 'E-mail de réception' : 'Receipt email'}</span>
            <input required type="email" value={form.email}
              onChange={e=>setForm(f=>({...f, email:e.target.value}))}
              placeholder="vous@exemple.com"
              style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
            />
          </label>

          {/* Nom affiché — masqué si décoché */}
          {show.ownedBy && (
            <label style={{display:'grid', gap:6}}>
              <span>{isFR ? 'Nom affiché' : 'Displayed name'}</span>
              <input type="text" value={form.display_name}
                onChange={e=>setForm(f=>({...f, display_name:e.target.value}))}
                maxLength={40}
                placeholder={isFR ? 'Ex. “Marie”' : 'e.g. “Marie”'}
                style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
              />
            </label>
          )}

          {/* 🎁 Offert par */}
          <div style={{marginTop:10}}>
            <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
              <input
                type="checkbox"
                checked={isGift}
                onChange={e=>{
                  const checked = e.target.checked
                  setIsGift(checked)
                  // si on désactive le mode "cadeau" → masquer aussi l'affichage + vider la valeur
                  if (!checked) {
                    setShow(s=>({...s, giftedBy:false}))
                    setForm(f=>({...f, gifted_by:''}))
                  } else {
                    // si on réactive, on ne force pas giftedBy à true ; l'utilisateur choisit via la section Affichage
                    setShow(s=>({...s}))
                  }
                }}
              />
              <span>🎁 {giftLabel}</span>
            </label>

            {/* Champ d'édition masqué si décoché dans Affichage */}
            {isGift && show.giftedBy && (
              <div style={{marginTop:8}}>
                <input
                  type="text"
                  value={form.gifted_by}
                  onChange={e=>setForm(f=>({...f, gifted_by:e.target.value}))}
                  maxLength={40}
                  placeholder={isFR ? 'Ex. “Offert par Vincent”' : 'e.g. “Gifted by Vincent”'}
                  style={{width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                />
              </div>
            )}
          </div>

          {/* Titre — masqué si décoché */}
          {show.title && (
            <div style={{display:'grid', gap:6, marginTop:10}}>
              <label>
                <span>{titleLabel}</span>
                <input type="text" value={form.title}
                  onChange={e=>setForm(f=>({...f, title:e.target.value}))}
                  maxLength={80}
                  placeholder="Ex. “Joyeux anniversaire !”"
                  style={{width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                />
              </label>
            </div>
          )}

          {/* Message — masqué si décoché */}
          {show.message && (
            <div style={{display:'grid', gap:6, marginTop:10}}>
              <label>
                <span>{messageLabel}</span>
                <textarea
                  value={form.message}
                  onChange={e=>setForm(f=>({...f, message:e.target.value}))}
                  maxLength={userMsgMaxChars || undefined}
                  placeholder={isGift ? '“Le jour de notre rencontre…”' : '“Le jour où tout a commencé.”'}
                  style={{
                    width:'100%',
                    padding:'12px 14px',
                    border:'1px solid ' + (isMsgOverflow ? '#ff6b6b' : 'var(--color-border)'),
                    borderRadius:10,
                    background:'transparent',
                    color:'var(--color-text)'
                  }}
                />
                <div style={{textAlign:'right', fontSize:12, marginTop:4, opacity:.65}}>
                  {(form.message?.length || 0)} / {userMsgMaxChars || '∞'}
                </div>
                {isMsgOverflow && (
                  <div role="alert" aria-live="polite" style={{marginTop:6, fontSize:12, color:'#ff6b6b'}}>
                    Votre message dépasse la limite autorisée
                  </div>
                )}
              </label>
            </div>
          )}

          {/* Affichage / Masquage */}
          <div style={{marginTop:12, paddingTop:10, borderTop:'1px dashed var(--color-border)'}}>
            <div style={{fontSize:13, color:'var(--color-muted)', marginBottom:8}}>
              Affichage sur le certificat
            </div>
            <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
              <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <input
                  type="checkbox"
                  checked={show.ownedBy}
                  onChange={e=>{
                    const checked = e.target.checked
                    setShow(s=>({...s, ownedBy: checked}))
                    if(!checked) setForm(f=>({...f, display_name: ''}))
                  }}
                />
                <span>{ownedByLabel}</span>
              </label>

              <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <input
                  type="checkbox"
                  checked={show.title}
                  onChange={e=>{
                    const checked = e.target.checked
                    setShow(s=>({...s, title: checked}))
                    if(!checked) setForm(f=>({...f, title: ''}))
                  }}
                />
                <span>{titleLabel}</span>
              </label>

              <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <input
                  type="checkbox"
                  checked={show.message}
                  onChange={e=>{
                    const checked = e.target.checked
                    setShow(s=>({...s, message: checked}))
                    if(!checked) setForm(f=>({...f, message: ''}))
                  }}
                />
                <span>{messageLabel}</span>
              </label>

              <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <input
                  type="checkbox"
                  checked={show.attestation}
                  onChange={e=>setShow(s=>({...s, attestation:e.target.checked}))}
                />
                <span>Texte d’attestation</span>
              </label>

              {isGift && (
                <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <input
                    type="checkbox"
                    checked={show.giftedBy}
                    onChange={e=>{
                      const checked = e.target.checked
                      setShow(s=>({...s, giftedBy: checked}))
                      if(!checked) setForm(f=>({...f, gifted_by: ''}))
                    }}
                  />
                  <span>{giftLabel}</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Couleur */}
        <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
            <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)'}}>COULEUR DE LA POLICE</div>
            <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
              <span style={{width:10, height:10, borderRadius:99, background:ratioMeta.color, display:'inline-block'}} />
              <span>Contraste : {ratio.toFixed(2)} — {ratioMeta.label}</span>
            </div>
          </div>

          <div aria-label="Aperçu de texte" style={{marginTop:10, display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:42, height:42, borderRadius:10, border:'1px solid var(--color-border)', display:'grid', placeItems:'center', background: CERT_BG_HEX, color: form.text_color, fontWeight:800}}>
              Aa
            </div>
            <div style={{flex:1, height:12, borderRadius:99, background: CERT_BG_HEX, position:'relative', border:'1px solid var(--color-border)'}}>
              <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', padding:'0 10px', color:form.text_color, fontSize:12}}>“Owned by — {chosenDateStr}”</div>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(34px, 1fr))', gap:8, marginTop:12}}>
            {SWATCHES.map(c => (
              <button key={c} type="button" onClick={()=>setForm(f=>({...f, text_color: c}))}
                aria-label={`Couleur ${c}`} title={c}
                style={{width:34, height:34, borderRadius:12, cursor:'pointer', background:c, border:'1px solid var(--color-border)', outline: form.text_color===c ? '3px solid rgba(228,183,61,.5)' : 'none'}}
              />
            ))}
          </div>

          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:12, flexWrap:'wrap'}}>
            <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
              <input type="color" value={form.text_color} onChange={e=>setForm(f=>({...f, text_color: e.target.value}))}/>
              <span style={{fontSize:12, opacity:.8}}>Sélecteur</span>
            </label>
            <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:12, opacity:.8}}>HEX</span>
              <input type="text" value={form.text_color}
                onChange={e=>{ const v=e.target.value.trim(); if(/^#[0-9a-fA-F]{6}$/.test(v)) setForm(f=>({...f, text_color:v})) }}
                style={{width:120, padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                placeholder="#1A1F2A"/>
            </label>
            <small style={{opacity:.7}}>Astuce : choisissez une couleur sombre pour la lisibilité sur fond clair.</small>
          </div>
        </div>

        {/* Style */}
        <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8}}>
            <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)'}}>STYLE</div>
            {form.cert_style === 'custom' && (
              <button type="button" onClick={openFileDialog}
                style={{padding:'8px 10px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)', cursor:'pointer'}}>
                {imgLoading ? (isFR ? 'Chargement…' : 'Loading…') : (isFR ? 'Importer une image' : 'Upload image')}
              </button>
            )}
          </div>

          {!!customErr && (
            <div style={{marginBottom:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ff8a8a', color:'#ffb2b2', background:'rgba(255,0,0,.06)'}}>
              {customErr}
            </div>
          )}

          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
            {STYLES.map(s => {
              const selected = form.cert_style === s.id
              const thumb = `/cert_bg/${s.id}_thumb.jpg`
              const full = `/cert_bg/${s.id}.png`
              const isCustom = s.id === 'custom'
              return (
                <div key={s.id} style={{position:'relative'}}>
                  <div
                    onClick={()=>setForm(f => ({...f, cert_style: s.id }))}
                    onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); setForm(f => ({...f, cert_style: s.id})) } }}
                    role="button" tabIndex={0} aria-label={`Style ${s.label}`}
                    style={{
                      cursor:'pointer',
                      border:selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius:16, background:'var(--color-surface)', padding:12, display:'grid', gap:8,
                      boxShadow: selected ? 'var(--shadow-elev1)' : undefined
                    }}
                  >
                    <div
                      style={{
                        height:110, borderRadius:12, border:'1px solid var(--color-border)',
                        backgroundImage:`url(${thumb}), url(${full})`, backgroundSize:'cover', backgroundPosition:'center', backgroundColor:'#0E1017'
                      }}
                      aria-hidden
                    />
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div>
                        <div style={{fontWeight:700}}>{s.label}</div>
                        {s.hint && <div style={{opacity:.6, fontSize:12}}>{s.hint}</div>}
                      </div>
                      <span aria-hidden="true" style={{width:10, height:10, borderRadius:99, background:selected ? 'var(--color-primary)' : 'var(--color-border)'}} />
                    </div>
                  </div>

                  {/* Actions spécifiques Custom */}
                  {isCustom && (
                    <>
                      {imgLoading && (
                        <div style={{position:'absolute', top:10, left:10, fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(255,255,255,.08)', border:'1px solid var(--color-border)'}}>Chargement…</div>
                      )}
                      {(customBgLocal || customBgUrl) && (
                        <div style={{position:'absolute', top:10, right:10, fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(228,183,61,.14)', border:'1px solid var(--color-primary)'}}>
                          Image chargée ✓ {customBgLocal?.w || 'A4'}×{customBgLocal?.h || 'A4'}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e)=>{ e.stopPropagation(); openFileDialog() }}
                        style={{
                          position:'absolute', bottom:12, right:12,
                          padding:'6px 10px', borderRadius:10, border:'1px solid var(--color-border)',
                          background:'var(--color-surface)', color:'var(--color-text)', cursor:'pointer', fontSize:12
                        }}
                      >
                        {isFR ? 'Importer une image' : 'Upload image'}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <p style={{margin:'10px 2px 0', fontSize:12, opacity:.7}}>
            Formats acceptés : JPG, PNG, WEBP, AVIF, GIF, BMP, SVG, HEIC/HEIF, TIFF. L’image est adaptée au format A4 (2480×3508).
          </p>
        </div>

        {/* Submit */}
        <div>
          <button disabled={status==='loading'} type="submit"
            style={{background:'var(--color-primary)', color:'var(--color-on-primary)', padding:'14px 18px', borderRadius:12, fontWeight:800, border:'none', boxShadow: status==='loading' ? '0 0 0 6px rgba(228,183,61,.12)' : 'none', cursor: status==='loading' ? 'progress' : 'pointer'}}>
            {status==='loading' ? 'Redirection…' : 'Payer 9,99 € & enregistrer'}
          </button>
          {status==='error' && error && <p style={{color:'#ff8a8a', marginTop:8}}>{error}</p>}
          <p style={{marginTop:8, fontSize:12, color:'var(--color-muted)'}}>
            Les modifications seront appliquées automatiquement après le paiement.
          </p>
        </div>
      </form>

      {/* ---------- PREVIEW ---------- */}
      <aside aria-label="Aperçu du certificat"
        style={{position:'sticky', top:24, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:12, boxShadow:'var(--shadow-elev1)'}}>
        <div ref={previewWrapRef} style={{position:'relative', width:'100%', aspectRatio: `${A4_W_PT}/${A4_H_PT}`, borderRadius:12, overflow:'hidden', border:'1px solid var(--color-border)'}}>
          {/* Fond */}
          <img
            key={
              form.cert_style === 'custom'
                ? (customBgLocal
                    ? `local-${customBgLocal.w}x${customBgLocal.h}`
                    : `server-${tsISO}-${!!customBgUrl}`)
                : form.cert_style
            }
            src={
              form.cert_style === 'custom'
                ? (customBgLocal?.dataUrl || customBgUrl || '/cert_bg/neutral.png')
                : `/cert_bg/${form.cert_style}.png`
            }
            alt={`Aperçu fond certificat — ${form.cert_style}`}
            style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', background:'#0E1017'}}
          />

          {/* Filigrane */}
          <div aria-hidden style={{position:'absolute', inset:0, pointerEvents:'none', display:'grid', placeItems:'center', transform:'rotate(-22deg)', opacity:.14, mixBlendMode:'multiply'}}>
            <div style={{fontWeight:900, fontSize:'min(18vw, 120px)', letterSpacing:2, color:'#1a1f2a'}}>PARCELS OF TIME — PREVIEW</div>
          </div>

          {/* Header */}
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: topBrand, fontWeight:800, fontSize: 18*scale, color: form.text_color }}>{L.brand}</div>
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: topCert,  fontWeight:400, fontSize: 12*scale, color: subtleColor }}>{L.title}</div>

          {/* Date */}
          <div style={{ ...centerStyle, top: topMainTime2, fontWeight:800, fontSize: tsSize*scale }}>
            {chosenDateStr}
          </div>

          {/* Owned by */}
          {showOwned && (
            <>
              <div style={{...centerStyle, top: ownedLabelTop!, fontWeight:400, fontSize: labelSize*scale, color: subtleColor}}>{ownedByLabel}</div>
              <div style={{...centerStyle, top: ownedNameTop!, fontWeight:800, fontSize: nameSize*scale}}>{nameForPreview}</div>
            </>
          )}

          {/* Gifted by */}
          {showGifted && (
            <>
              <div style={{...centerStyle, top: giftedLabelTop!, fontWeight:400, fontSize: labelSize*scale, color: subtleColor}}>{giftLabel}</div>
              <div style={{...centerStyle, top: giftedNameTop!, fontWeight:800, fontSize: nameSize*scale}}>{giftedByStr}</div>
            </>
          )}

          {/* Title */}
          {titleForPreview && (
            <>
              <div style={{...centerStyle, top: titleLabelTop!, fontWeight:400, fontSize: labelSize*scale, color: subtleColor}}>{titleLabel}</div>
              {titleLines.map((line, i)=>(
                <div key={i} style={{...centerStyle, top: (titleLineTops[i]), fontWeight:800, fontSize: nameSize*scale}}>
                  {line}
                </div>
              ))}
            </>
          )}

          {/* Message */}
          {msgLines.length>0 && (
            <>
              <div style={{...centerStyle, top: msgLabelTop!, fontWeight:400, fontSize: labelSize*scale, color: subtleColor}}>{messageLabel}</div>
              {msgLines.map((line, i)=>(
                <div key={i} style={{...centerStyle, top: (msgLineTops[i]), fontSize: msgSize*scale}}>
                  {line}
                </div>
              ))}
            </>
          )}

          {/* Attestation */}
          {attestLines.length>0 && (
            <>
              <div style={{ ...centerStyle, top: attestLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                {L.attestationLabel}
              </div>
              {attestLines.map((line, i)=>(
                <div key={i} style={{ ...centerStyle, top: attestLineTops[i], fontSize: 12.5*scale }}>
                  {line}
                </div>
              ))}
            </>
          )}

          {/* Lien */}
          {linkLines.length>0 && (
            <>
              <div style={{...centerStyle, top: linkLabelTop!, fontWeight:400, fontSize: labelSize*scale, color: subtleColor}}>{L.link}</div>
                {linkLines.map((line, i)=>(
                <div key={i} style={{ ...centerStyle, top: linkLineTops[i], fontSize: linkSize*scale }}>
                  {line}
                </div>
              ))}
            </>
          )}

          {/* Footer */}
          <div style={{position:'absolute', left: EDGE_PT*scale, bottom: EDGE_PT*scale, width: (A4_W_PT/2)*scale, height: META_H_PT*scale, color: subtleColor, fontSize: labelSize*scale, lineHeight: 1.2}}>
            <div style={{opacity:.9}}>{isFR?'ID du certificat':'Certificate ID'}</div>
            <div style={{marginTop:6, fontWeight:800, color: form.text_color, fontSize: 10.5*scale}}>••••••••••••••••••••••••••••••••••••••</div>
            <div style={{marginTop:8, opacity:.9}}>{isFR?'Intégrité (SHA-256)':'Integrity (SHA-256)'}</div>
            <div style={{marginTop:6, color: form.text_color, fontSize: 9.5*scale}}>••••••••••••••••••••••••••••••••••••••</div>
            <div style={{marginTop:4, color: form.text_color, fontSize: 9.5*scale}}>••••••••••••••••••••••••••••••••••••••</div>
          </div>

          <div
            style={{
              position:'absolute',
              right: EDGE_PT*scale,
              bottom: EDGE_PT*scale,
              width: QR_SIZE_PT*scale,
              height: QR_SIZE_PT*scale,
              border:'1px dashed rgba(26,31,42,.45)',
              borderRadius:8,
              display:'grid',
              placeItems:'center',
              fontSize: 12*scale,
              color: 'rgba(26,31,42,.85)',
              background:'rgba(255,255,255,.08)'
            }}
            aria-label="QR placeholder"
          >
            QR
          </div>
        </div>

        <div style={{marginTop:10, fontSize:12, color:'var(--color-muted)'}}>
          Le PDF final est régénéré après modification.
        </div>
      </aside>
    </div>
  )
}
