// app/[locale]/claim/ClientClaim.tsx
'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

declare module 'exifr' {
  export function parse(input: Blob | ArrayBuffer | string, options?: any): Promise<any>;
}

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

/** ====== Constantes PDF (miroir de app/lib/cert.ts) ====== */
const A4_W_PT = 595.28
const A4_H_PT = 841.89
const EDGE_PT = 16
const QR_SIZE_PT = 120
const META_H_PT = 76
const PT_PER_CM = 28.3465
const SHIFT_UP_PT = Math.round(2 * PT_PER_CM) // 2cm

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

const CERT_BG_HEX = '#F4F1EC'

/** ------- Utils ------- **/
const range = (a:number, b:number) => Array.from({length:b-a+1},(_,i)=>a+i)
function safeDecode(value: string): string {
  let out = value
  try { for (let i=0;i<3;i++){ const dec=decodeURIComponent(out); if(dec===out) break; out=dec } } catch {}
  return out
}
function isoDayString(d: Date) { const c = new Date(d.getTime()); c.setUTCHours(0,0,0,0); return ymdUTC(c) }
function parseToDateOrNull(input: string): Date | null {
  const s = (input || '').trim(); if (!s) return null
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0); return d
}
function daysInMonth(y:number, m:number) { return new Date(y, m, 0).getDate() }

// couleurs utils
function hexToRgb(hex:string){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if(!m) return {r:26,g:31,b:42}
  const n = parseInt(m[1],16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 }
}
function mix(a:number,b:number,t:number){ return Math.round(a*(1-t)+b*t)}
// ⚠️ t=0.45 pour matcher le PDF (cert.ts)
function lightenTowardWhite(hex:string, t=0.45){
  const {r,g,b} = hexToRgb(hex); return `rgba(${mix(r,255,t)}, ${mix(g,255,t)}, ${mix(b,255,t)}, 0.9)`
}
function relLum({r,g,b}:{r:number,g:number,b:number}){ const srgb=(c:number)=>{ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }; const R=srgb(r),G=srgb(g),B=srgb(b); return 0.2126*R+0.7152*G+0.0722*B }
function contrastRatio(fgHex:string, bgHex=CERT_BG_HEX){ const L1=relLum(hexToRgb(fgHex)), L2=relLum(hexToRgb(bgHex)); const light=Math.max(L1,L2), dark=Math.min(L1,L2); return (light+0.05)/(dark+0.05) }
function ratioLabel(r:number){ if(r>=7) return {label:'AAA', color:'#0BBF6A'}; if(r>=4.5) return {label:'AA', color:'#E4B73D'}; return {label:'⚠︎ Low', color:'#FF7A7A'} }

/** AAAA-MM-JJ (UTC jour) */
function ymdUTC(d: Date){
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth()+1).padStart(2,'0')
  const day = String(d.getUTCDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

/** ====== Mesure & wrap en pixels équivalents aux points PDF ====== */
function makeMeasurer(scale:number){
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const setFont = (sizePt:number, bold=false) => {
    const px = sizePt * scale
    ctx.font = `${bold ? '700 ' : ''}${px}px Helvetica, Arial, sans-serif`
  }
  const widthPx = (text:string) => ctx.measureText(text).width
  const wrap = (text:string, sizePt:number, maxWidthPt:number, bold=false) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean)
    const lines:string[] = []
    let line = ''
    setFont(sizePt, bold)
    const maxPx = maxWidthPt * scale
    for (const w of words) {
      const test = line ? (line + ' ' + w) : w
      if (widthPx(test) <= maxPx) line = test
      else { if (line) lines.push(line); line = w }
    }
    if (line) lines.push(line)
    return lines
  }
  return { wrap }
}

export default function ClientClaim({ prefillEmail }: { prefillEmail?: string }) {
  const params = useSearchParams()
  const prefillRaw = params.get('ts') || ''
  const prefillTs = prefillRaw ? safeDecode(prefillRaw) : ''
  const styleParam = (params.get('style') || '').toLowerCase()
  const giftParam = params.get('gift')
  const initialGift = giftParam === '1' || giftParam === 'true'

  const allowed = STYLES.map(s => s.id)
  const initialStyle: CertStyle = (allowed as readonly string[]).includes(styleParam as CertStyle)
    ? (styleParam as CertStyle) : 'neutral'

  const [isGift, setIsGift] = useState<boolean>(initialGift)

  // Date par défaut (aujourd’hui, arrondie à 00:00:00 UTC)
  const now = new Date()
  const prefillDate = parseToDateOrNull(prefillTs) || now

  // ✅ bornes : aujourd’hui UTC et max = +1 an
  const todayUtc = useMemo(() => {
    const t = new Date()
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
  }, [])
  const maxDateUtc = useMemo(() => {
    const t = new Date(todayUtc)
    t.setUTCFullYear(t.getUTCFullYear() + 1)
    return t
  }, [todayUtc])
  const MAX_Y = maxDateUtc.getUTCFullYear()
  const MAX_M = maxDateUtc.getUTCMonth() + 1
  const MAX_D = maxDateUtc.getUTCDate()

  const [Y, setY] = useState<number>(prefillDate.getFullYear())
  const [M, setM] = useState<number>(prefillDate.getMonth()+1)
  const [D, setD] = useState<number>(prefillDate.getDate())

  // Ajuste le jour si dépasse le nb de jours du mois
  useEffect(()=>{ const dim=daysInMonth(Y,M); if(D>dim) setD(dim) }, [Y,M])

  // Clamp à la borne max (J+1 an)
  useEffect(() => {
    let y = Y, m = M, d = D
    if (y > MAX_Y) y = MAX_Y
    if (y === MAX_Y && m > MAX_M) m = MAX_M
    const dim = daysInMonth(y, m)
    const maxDayThisMonth = (y === MAX_Y && m === MAX_M) ? Math.min(dim, MAX_D) : dim
    if (d > maxDayThisMonth) d = maxDayThisMonth
    if (y !== Y) setY(y)
    if (m !== M) setM(m)
    if (d !== D) setD(d)
  }, [Y, M, MAX_Y, MAX_M, MAX_D, D])

  // Langue (pour quelques libellés)
  const isFR = useMemo(()=>{
    try { return (navigator.language || '').toLowerCase().startsWith('fr') } catch { return false }
  }, [])
  const L = useMemo(()=>({
    brand:'Parcels of Time',
    title:isFR?'Certificat de Claim':'Certificate of Claim',
    ownedBy:isFR?'Au nom de':'Owned by',
    giftedBy:isFR?'Offert par':'Gifted by',
    titleLabel:isFR?'Titre':'Title',
    message:isFR?'Message':'Message',
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

  /** Form principal */
  const [form, setForm] = useState({
    email: prefillEmail || '',
    display_name: '',
    title: '',
    message: '',
    // cadeau
    gifted_by: '',
    // rendu
    link_url: '',
    ts: prefillTs, // recalculé plus bas
    cert_style: initialStyle as CertStyle,
    // compat serveur (non exposé)
    time_display: 'local+utc' as 'utc'|'utc+local'|'local+utc',
    local_date_only: true, // journée
    text_color: '#1A1F2A',
    // (anciens flags “public” conservés pour compat)
    title_public: false,
    message_public: false,
    public_registry: false,
  })

  // Visibilité des sections (par défaut : tout affiché)
  const [show, setShow] = useState({
    ownedBy: true,
    title: true,
    message: true,
    attestation: true,   // ✅ nouveau bloc non essentiel
    giftedBy: true, // seulement si isGift
  })

  

  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  // Jours indisponibles (du mois courant) — affichés en rouge et désactivés
  const [unavailableDays, setUnavailableDays] = useState<number[]>([])
  useEffect(() => {
    const ym = `${Y}-${String(M).padStart(2,'0')}`
    let ignore = false
    ;(async () => {
      try {
        const res = await fetch(`/api/unavailable?ym=${ym}`)
        if (!res.ok) { if (!ignore) setUnavailableDays([]); return }
        const data = await res.json()
        const raw: any[] = Array.isArray(data) ? data : (data?.days ?? data?.unavailable ?? [])
        const set = new Set<number>()
        for (const v of raw) {
          if (typeof v === 'number') {
            if (v >= 1 && v <= 31) set.add(v)
          } else if (typeof v === 'string') {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
            if (m && Number(m[1]) === Y && Number(m[2]) === M) set.add(Number(m[3]))
            else {
              const n = parseInt(v, 10)
              if (!Number.isNaN(n) && n >= 1 && n <= 31) set.add(n)
            }
          }
        }
        if (!ignore) setUnavailableDays(Array.from(set).sort((a,b)=>a-b))
      } catch {
        if (!ignore) setUnavailableDays([])
      }
    })()
    return () => { ignore = true }
  }, [Y, M])

  // Si le jour sélectionné devient indisponible, tente de choisir le 1er jour dispo
  useEffect(() => {
    const dim = daysInMonth(Y, M)
    const maxDayForThisMonth = (Y === MAX_Y && M === MAX_M) ? Math.min(dim, MAX_D) : dim
    const all = range(1, maxDayForThisMonth)
    const set = new Set(unavailableDays)
    if (set.has(D)) {
      const firstAvailable = all.find(d => !set.has(d))
      if (firstAvailable) setD(firstAvailable)
    }
  }, [unavailableDays, Y, M, MAX_Y, MAX_M, MAX_D, D])

  // Recalcule `ts` (minuit UTC) à chaque changement Y/M/D
  useEffect(()=>{
    const d = new Date(Date.UTC(Y, M-1, D, 0, 0, 0, 0))
    setForm(f=>({ ...f, ts: isoDayString(d) }))
  }, [Y, M, D])

  // Date choisie
  const parsedDate = useMemo(() => parseToDateOrNull(form.ts), [form.ts])
  const chosenDateStr = parsedDate ? ymdUTC(parsedDate) : L.placeholders.dateYMD

  /** --------- Custom background --------- */
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [customBg, setCustomBg] = useState<{ url:string; dataUrl:string; w:number; h:number } | null>(null)
  const [customErr, setCustomErr] = useState('')
  const [imgLoading, setImgLoading] = useState(false)

  function log(...args:any[]){ console.debug('[Claim/CustomBG]', ...args) }
  const openFileDialog = () => { fileInputRef.current?.click() }

  const onSelectStyle = (id: CertStyle) => {
    setForm(f => ({ ...f, cert_style: id }))
    if (id === 'custom') openFileDialog()
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
  
  function looks(exts:string[], name:string, type:string){
      const low = name.toLowerCase()
      const t   = type.toLowerCase()
      return exts.some(ext => low.endsWith('.'+ext) || t.includes(ext))
    }
  
    async function decodeTiffToPngDataUrl(file: File): Promise<{dataUrl:string; w:number; h:number}> {
      const mod: any = await import('utif')        // <= ne tape plus sur .default directement
      const UTIF = mod.default ?? mod               // <= compat CJS/ESM
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
  
      // 1) HEIC/HEIF → PNG (via lib)
      if (looks(['heic','heif'], name, type)) {
        const { file: afterHeic } = await heicToPngIfNeeded(original)
        const orientation = await getExifOrientation(original)
        return rasterizeVectorOrBitmap(afterHeic, orientation)
      }
  
      // 2) TIFF → PNG (via utif)
      if (looks(['tif','tiff'], name, type)) {
        return decodeTiffToPngDataUrl(original)
      }
  
      // 3) SVG (vectoriel) → canvas
      if (looks(['svg'], name, type)) {
        // Pas d’EXIF; on dessine tel quel
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
  async function onPickCustomBg(file?: File | null) {
    try {
      setCustomErr('')
      if (!file) { log('Aucun fichier sélectionné'); return }
      setImgLoading(true)
      const { dataUrl: normalizedUrl, w, h } = await normalizeToPng(file)
      const { dataUrl: a4Url, w: tw, h: th } = await coverToA4JPEG(normalizedUrl, w, h)
      if (bytesFromDataURL(a4Url) > 4 * 1024 * 1024) {
        setCustomErr('Image trop lourde après préparation. Réessayez avec une photo plus légère.')
        return
      }
      setCustomBg({ url: a4Url, dataUrl: a4Url, w: tw, h: th })
      setForm(f => ({ ...f, cert_style: 'custom' }))
      log('CustomBG prêt (A4 JPEG)', { w: tw, h: th, approxKB: Math.round(bytesFromDataURL(a4Url) / 1024) })
    } catch (e) {
      console.error('[Claim/CustomBG] onPickCustomBg', e)
      setCustomErr('Erreur de lecture ou de conversion de l’image.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setImgLoading(false)
    }
  }
  useEffect(() => () => {}, [])

  // Étiquettes contraste
  const mainColor = form.text_color || '#1A1F2A'
  const subtleColor = lightenTowardWhite(mainColor, 0.45)
  const ratio = contrastRatio(mainColor)
  const ratioMeta = ratioLabel(ratio)

  // “édition” (jour bissextile = premium)
  const edition = useMemo(() => {
    if (!parsedDate) return null
    const y = parsedDate.getUTCFullYear(), mm = parsedDate.getUTCMonth(), dd = parsedDate.getUTCDate()
    const isLeap = ((y%4===0 && y%100!==0) || y%400===0) && mm===1 && dd===29
    return isLeap ? 'premium' : 'standard'
  }, [parsedDate])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')
    const d = parseToDateOrNull(form.ts)
    if (!d) { setStatus('error'); setError('Merci de saisir une date valide.'); return }
    // Borne max
    if (d.getTime() > maxDateUtc.getTime()) {
      setStatus('error'); setError(`La date choisie dépasse la limite autorisée (${ymdUTC(maxDateUtc)}).`); return
    }
    // Interdit les jours indisponibles
    if (unavailableDays.includes(D)) {
      setStatus('error'); setError('Ce jour est indisponible. Merci d’en choisir un autre.'); return
    }

    // 🔧 Prépare les champs selon la visibilité choisie
    const finalDisplayName = show.ownedBy ? (form.display_name || undefined) : undefined
    const finalTitle = show.title ? (form.title || undefined) : undefined

    // “Offert par” : injecté dans le message (pour compat PDF)
    const msgParts: string[] = []
    if (show.message && form.message.trim()) msgParts.push(form.message.trim())
    if (show.message && show.attestation) msgParts.push(attestationText)
    if (isGift && show.giftedBy && form.gifted_by.trim()) {
      msgParts.push(`${giftLabel}: ${form.gifted_by.trim()}`)
    }
    // Masque "Owned by" si décoché
    if (!show.ownedBy) msgParts.push('[[HIDE_OWNED_BY]]')
    const finalMessage = msgParts.length ? msgParts.join('\n') : undefined

    const payload:any = {
      ts: d.toISOString(),
      email: form.email,
      display_name: finalDisplayName,
      title: finalTitle,
      message: finalMessage,
      link_url: undefined,
      cert_style: form.cert_style || 'neutral',
      time_display: 'local+utc',
      local_date_only: '1',
      text_color: form.text_color || '#1A1F2A',
      title_public: '0',
      message_public: '0',
      public_registry: form.public_registry ? '1' : '0',
    }
    if (form.cert_style === 'custom' && customBg?.dataUrl) {
      payload.custom_bg_data_url = customBg.dataUrl
    }

    const res = await fetch('/api/checkout', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) {
      setStatus('error')
      try {
        const j = await res.json()
        const map: Record<string,string> = {
          rate_limited: 'Trop de tentatives. Réessaye dans ~1 minute.',
          invalid_ts: 'Horodatage invalide. Utilise un ISO comme 2100-01-01.',
          missing_fields: 'Merci de renseigner au minimum l’e-mail et la date.',
          custom_bg_invalid: 'Image personnalisée invalide (doit être PNG/JPG en data URL).',
          stripe_key_missing: 'Configuration Stripe absente côté serveur.',
          bad_price: 'Prix invalide pour cette journée.',
          stripe_error: 'Erreur Stripe côté serveur.',
          date_unavailable: 'Ce jour vient d’être vendu. Merci d’en choisir un autre.',
        }
        setError(map[j.error] || j.error || 'Unknown error')
        console.error('[Checkout] Erreur côté serveur', j)
      } catch (err) {
        console.error('[Checkout] Échec parsing erreur', err)
        setError('Unknown error')
      }
      return
    }
    const data = await res.json()
    window.location.href = data.url
  }

  /** Styles globaux */
  const containerStyle: React.CSSProperties = {
    ['--color-bg' as any]: '#0B0E14',
    ['--color-surface' as any]: '#111726',
    ['--color-text' as any]: '#E6EAF2',
    ['--color-muted' as any]: '#A7B0C0',
    ['--color-primary' as any]: '#E4B73D',
    ['--color-on-primary' as any]: '#0B0E14',
    ['--color-border' as any]: '#1E2A3C',
    ['--shadow-elev1' as any]: '0 6px 20px rgba(0,0,0,.35)',
    ['--shadow-elev2' as any]: '0 12px 36px rgba(0,0,0,.45)',
    background:'var(--color-bg)', color:'var(--color-text)', minHeight:'100vh'
  }

  // palette
  const SWATCHES = [
    '#000000','#111111','#1A1F2A','#222831','#2E3440','#37474F','#3E3E3E','#4B5563',
    '#5E452A','#6D4C41','#795548','#8D6E63',
    '#0B3D2E','#1B5E20','#2E7D32','#004D40','#0D47A1','#1A237E','#283593',
    '#880E4F','#6A1B9A','#AD1457','#C2185B','#9C27B0',
    '#102A43','#0F2A2E','#14213D',
    '#FFFFFF','#E6EAF2',
  ]

  /** ====== PREVIEW (mêmes calculs que le PDF) ====== */
  const previewWrapRef = useRef<HTMLDivElement|null>(null)
  const [scale, setScale] = useState(1) // px per pt
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

  const ownerForText = (form.display_name || '').trim() || L.anon
  const attestationText = `Ce certificat atteste que ${ownerForText} est reconnu(e) comme propriétaire symbolique de la journée du ${chosenDateStr}. Cette date est officiellement inscrite comme faisant partie de sa collection personnelle de journées de l'Histoire. Le présent document confirme la validité et l'authenticité de cette acquisition.`

  // données d'entrée pour la préview
  const showOwned = show.ownedBy
  const showGifted = isGift && show.giftedBy
  const showT = show.title
  const showM = show.message

  const nameForPreview = showOwned
  ? (form.display_name.trim() || L.anon)

    : ''

  const giftedByStr = showGifted
    ? (form.gifted_by.trim() || L.placeholders.giftedName)
    : ''

  const titleForPreview = showT
    ? (form.title.trim() || L.placeholders.title)
    : ''

  const messageForPreview = showM
    ? [
        (form.message.trim() || L.placeholders.message),
        ...(show.attestation ? [attestationText] : []),
      ].filter(Boolean).join('\n\n')
    : ''

  const mainTime = chosenDateStr // toujours AAAA-MM-JJ

  // tailles PDF
  const tsSize = 26, labelSize = 11, nameSize = 15, msgSize = 12.5, linkSize = 10.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16, lineHLink = 14

  // safe area & colonnes en points
  const SA = getSafeArea(form.cert_style)
  const LEFT = SA.left, RIGHT = A4_W_PT - SA.right, TOP_Y = A4_H_PT - SA.top, BOT_Y = SA.bottom
  const COLW = RIGHT - LEFT
  const CX = (LEFT + RIGHT) / 2

  // header positions (y en points depuis le bas)
  const brandSize = 18, subSize = 12
  let yHeader = TOP_Y - 40
  const yBrand = yHeader
  yHeader -= 18
  const yCert = yHeader

  // footer réservations
  const qrSizePx = QR_SIZE_PT
  const metaBlockH = META_H_PT
  const footerH = Math.max(qrSizePx, metaBlockH)
  const footerMarginTop = 8

  const contentTopMax = yHeader - 38 + SHIFT_UP_PT
  const contentBottomMin = BOT_Y + footerH + footerMarginTop
  const availH = contentTopMax - contentBottomMin

  // wrapping (identique au PDF)
  const meas = useMemo(()=>makeMeasurer(scale), [scale])

  const titleLines = titleForPreview ? meas.wrap(titleForPreview, nameSize, COLW, true).slice(0, 2) : []
  
  const msgLinesAll = messageForPreview
  ? messageForPreview.split(/\n+/).flatMap((p, i, arr) => {
      const lines = meas.wrap(p, msgSize, COLW, false)
      return i < arr.length - 1 ? [...lines, ''] : lines
    })
  : []

  const linkLinesAll = form.link_url ? meas.wrap(form.link_url, linkSize, COLW, false) : []

  // Hauteurs des blocs optionnels — mêmes formules que le PDF
  const ownedBlockH = showOwned ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0
  const giftedBlockH = showGifted ? (gapSection + (labelSize + 2) + gapSmall + (nameSize + 4)) : 0

  const fixedTop =
    (tsSize + 6) + // uniquement la date
    ownedBlockH

  const spaceForText = availH
  const spaceAfterOwned = spaceForText - fixedTop

  // ⚠️ titleBlock SANS gapSection (comme cert.ts)
  const titleBlockNoGap = titleForPreview
    ? ((labelSize + 2) + 6 + titleLines.length * (nameSize + 6))
    : 0

  const beforeMsgConsumed = giftedBlockH + (titleBlockNoGap ? (gapSection + titleBlockNoGap) : 0)
  const afterTitleSpace = spaceAfterOwned - beforeMsgConsumed

  const maxMsgLines = Math.max(0, Math.floor((afterTitleSpace - (form.link_url ? (gapSection + lineHLink) : 0)) / lineHMsg))
  const msgLines = msgLinesAll.slice(0, maxMsgLines)

  const afterMsgSpace = afterTitleSpace - (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
  const maxLinkLines = Math.min(2, Math.max(0, Math.floor(afterMsgSpace / lineHLink)))
  const linkLines = linkLinesAll.slice(0, maxLinkLines)

  const blockH =
    fixedTop
    + (titleBlockNoGap ? (gapSection + titleBlockNoGap) : 0)
    + (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
    + (linkLines.length ? (gapSection + linkLines.length * lineHLink) : 0)

  const biasUp = 22
  const by = contentBottomMin + (availH - blockH) / 2 + biasUp
  let y = by + blockH

  // Helpers: convertir baseline PDF -> CSS top px
  const toTopPx = (baselineY:number, fontSizePt:number) => (A4_H_PT - baselineY) * scale - (fontSizePt * scale)
  const centerStyle: React.CSSProperties = {
      position:'absolute',
      left:'50%',
      transform:'translateX(-50%)',
      textAlign:'center',
      whiteSpace:'pre',      // ⚠️ empêcher un second wrapping
      wordBreak:'normal',
      color: form.text_color
    }

  // === CALCUL des y (séquence STRICTEMENT identique au PDF) ===
  // 1) Date principale
  y -= (tsSize + 6)
  const topMainTime = toTopPx(y, tsSize)

  // 2) Owned by (si affiché)
  let ownedLabelTop:number|null = null
  let ownedNameTop:number|null = null
  if (showOwned) {
    y -= gapSection
    ownedLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 2 + gapSmall)
    ownedNameTop = toTopPx(y - (nameSize + 4) + 4, nameSize)
    y -= (nameSize + 4)
  }

  // 3) Gifted by (si affiché)
  let giftedLabelTop:number|null = null
  let giftedNameTop:number|null = null
  if (showGifted) {
    y -= gapSection
    giftedLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 2 + gapSmall)
    giftedNameTop = toTopPx(y - (nameSize + 4) + 4, nameSize)
    y -= (nameSize + 4)
  }

  // 4) Title
  let titleLabelTop:number|null = null
  const titleLineTops:number[] = []
  if (titleForPreview) {
    y -= (nameSize + 4)
    y -= gapSection
    titleLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of titleLines) {
      titleLineTops.push(toTopPx(y - (nameSize + 2), nameSize))
      y -= (nameSize + 6)
    }
  }

  // 5) Message
  let msgLabelTop:number|null = null
  const msgLineTops:number[] = []
  if (msgLines.length) {
    y -= gapSection
    msgLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of msgLines) {
      msgLineTops.push(toTopPx(y - lineHMsg, msgSize))
      y -= lineHMsg
    }
  }

  // 6) Link
  let linkLabelTop:number|null = null
  const linkLineTops:number[] = []
  if (linkLines.length) {
    y -= gapSection
    linkLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of linkLines) {
      linkLineTops.push(toTopPx(y - lineHLink, linkSize))
      y -= lineHLink
    }
  }

  // header CSS tops
  const topBrand = toTopPx(yBrand, brandSize)
  const topCert  = toTopPx(yCert,  subSize)

  return (
    <main style={containerStyle}>
      {/* input fichier global */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.tif,.tiff,.bmp,.svg,.webp,.avif"
        style={{display:'none'}}
        onChange={(e)=>onPickCustomBg(e.currentTarget.files?.[0] || null)}
      />

      <section style={{maxWidth:1200, margin:'0 auto', padding:'48px 24px'}}>
        {/* header */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
          <a href="/" style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; Parcels of Time</a>
          <div style={{fontSize:12, color:'var(--color-muted)'}}>Paiement sécurisé <strong>Stripe</strong></div>
        </div>

        <header style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:16, marginBottom:14}}>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:0}}>
            {isGift ? 'Offrir une journée' : 'Réserver votre journée'}
          </h1>
          <button onClick={()=>setIsGift(v=>!v)} style={{background:'var(--color-surface)', color:'var(--color-text)', border:'1px solid var(--color-border)', padding:'8px 12px', borderRadius:10, cursor:'pointer'}} aria-pressed={isGift}>
            {isGift ? '🎁 Mode cadeau activé' : '🎁 Activer le mode cadeau'}
          </button>
        </header>

        <div style={{display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:18, alignItems:'start'}}>
          {/* ---------- FORM COLUMN ---------- */}
          <form onSubmit={onSubmit} style={{display:'grid', gap:14}}>
            {/* Step 1 — Infos */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>ÉTAPE 1 — INFORMATIONS</div>

              <label style={{display:'grid', gap:6, marginBottom:10}}>
                <span>{isGift ? 'Votre e-mail (reçu & certificat)' : 'E-mail (reçu & certificat)'}</span>
                <input required type="email" value={form.email}
                  onChange={e=>setForm(f=>({...f, email:e.target.value}))}
                  placeholder="vous@exemple.com"
                  style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                />
              </label>

              <label style={{display:'grid', gap:6}}>
                <span>{isGift ? 'Nom du·de la destinataire (sur le certificat)' : 'Nom sur le certificat'}</span>
                <input type="text" value={form.display_name}
                  onChange={e=>setForm(f=>({...f, display_name:e.target.value}))}
                  placeholder={isGift ? 'Ex. “Camille & Jonas”' : 'Ex. “Camille D.”'}
                   style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                 />
               </label>


              {/* 🎁 Offert par / Gifted by */}
              {isGift && (
                <label style={{display:'grid', gap:6, marginTop:10}}>
                  <span>{giftLabel}</span>
                  <input
                    type="text"
                    value={form.gifted_by}
                    onChange={e=>setForm(f=>({...f, gifted_by:e.target.value}))}
                    placeholder={isFR ? 'Ex. “Offert par Élodie & Marc”' : 'e.g. “Gifted by Elodie & Marc”'}
                    style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                  />
                </label>
              )}

              <div style={{display:'grid', gap:6, marginTop:10}}>
                <label>
                  <span>{titleLabel}</span>
                  <input type="text" value={form.title}
                    onChange={e=>setForm(f=>({...f, title:e.target.value}))}
                    placeholder="Ex. “Notre journée sous la pluie”"
                    style={{width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                  />
                </label>
              </div>

              <div style={{display:'grid', gap:6, marginTop:10}}>
                <label>
                  <span>{messageLabel}</span>
                  <textarea value={form.message} onChange={e=>setForm(f=>({...f, message:e.target.value}))} rows={3}
                    placeholder={isGift ? '“Le jour de notre rencontre…”' : '“Le jour où tout a commencé.”'}
                    style={{width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                  />
                </label>
              </div>

              {/* Affichage / Masquage des sections */}
              <div style={{marginTop:12, paddingTop:10, borderTop:'1px dashed var(--color-border)'}}>
                <div style={{fontSize:13, color:'var(--color-muted)', marginBottom:8}}>
                  Affichage sur le certificat (vous pouvez retirer les éléments non essentiels)
                </div>
                <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                  <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <input
                      type="checkbox"
                      checked={show.ownedBy}
                      onChange={e=>setShow(s=>({...s, ownedBy:e.target.checked}))}
                    />
                    <span>{ownedByLabel}</span>
                  </label>
                  <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <input
                      type="checkbox"
                      checked={show.title}
                      onChange={e=>setShow(s=>({...s, title:e.target.checked}))}
                    />
                    <span>{titleLabel}</span>
                  </label>
                  <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <input
                      type="checkbox"
                      checked={show.message}
                      onChange={e=>setShow(s=>({...s, message:e.target.checked}))}
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
                        onChange={e=>setShow(s=>({...s, giftedBy:e.target.checked}))}
                      />
                      <span>{giftLabel}</span>
                    </label>
                  )}
                </div>
                <small style={{display:'block', marginTop:8, opacity:.7}}>
                  <strong>Imposés :</strong> Parcels of Time, Certificate of Claim, la date.
                </small>
              </div>
            </div>

            {/* Couleur de la police */}
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
                  <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', padding:'0 10px', color:form.text_color, fontSize:12}}>“Owned by — 2024-12-31”</div>
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

            {/* Step 2 — Journée */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>ÉTAPE 2 — VOTRE JOUR</div>

              {/* Sélecteurs date (jour complet) */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
                {/* Année (1900 -> MAX_Y) */}
                <label style={{display:'grid', gap:6}}>
                  <span>Année</span>
                  <select value={Y} onChange={e=>setY(parseInt(e.target.value))}
                    style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                    {range(1900, MAX_Y).map(y=> <option key={y} value={y} style={{color:'#000'}}>{y}</option>)}
                  </select>
                </label>

                {/* Mois (borné si année max) */}
                <label style={{display:'grid', gap:6}}>
                  <span>Mois</span>
                  {(() => {
                    const maxMonthForYear = (Y === MAX_Y) ? MAX_M : 12
                    return (
                      <select value={M} onChange={e=>setM(parseInt(e.target.value))}
                        style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                        {Array.from({length:maxMonthForYear},(_,i)=>i+1).map(v=>(
                          <option key={v} value={v} style={{color:'#000'}}>{String(v).padStart(2,'0')}</option>
                        ))}
                      </select>
                    )
                  })()}
                </label>

                {/* Jour (borné si année/mois max) + indisponibles en rouge & désactivés */}
                <label style={{display:'grid', gap:6}}>
                  <span>Jour</span>
                  {(() => {
                    const dim = daysInMonth(Y, M)
                    const maxDayForThisMonth = (Y === MAX_Y && M === MAX_M) ? Math.min(dim, MAX_D) : dim
                    const days = Array.from({length: maxDayForThisMonth}, (_,i)=>i+1)
                    const set = new Set(unavailableDays)
                    return (
                      <select
                        value={D}
                        onChange={e=>setD(parseInt(e.target.value))}
                        style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                      >
                        {days.map(d=>{
                          const unavailable = set.has(d)
                          const label = d.toString().padStart(2,'0') + (unavailable ? ' — indisponible' : '')
                          return (
                            <option
                              key={d}
                              value={d}
                              disabled={unavailable}
                              aria-disabled={unavailable}
                              // certaines plateformes grisent les options désactivées — on laisse aussi un indicateur ⛔
                              style={{color: unavailable ? '#ff4d4d' : '#000'}}
                            >
                              {unavailable ? `⛔ ${label}` : label}
                            </option>
                          )
                        })}
                      </select>
                    )
                  })()}
                </label>
              </div>

              <div style={{display:'flex', gap:14, flexWrap:'wrap', marginTop:12, fontSize:14}}>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}>
                  <strong>Affichage&nbsp;:</strong> {chosenDateStr || '—'}
                </div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}>
                  <strong>Édition&nbsp;:</strong> {edition ? (edition === 'premium' ? 'Premium' : 'Standard') : '—'}
                </div>
              </div>
              <div style={{marginTop:8, fontSize:12, color:'#ff8a8a'}}>
                Les jours en rouge sont indisponibles.
              </div>
            </div>

            {/* Step 3 — Style */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>ÉTAPE 3 — STYLE</div>

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
                        onClick={()=>onSelectStyle(s.id)}
                        onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); onSelectStyle(s.id) } }}
                        role="button" tabIndex={0} aria-label={`Style ${s.label}`}
                        style={{
                          cursor:'pointer',
                          border:selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          borderRadius:16, background:'var(--color-surface)', padding:12, display:'grid', gap:8,
                          boxShadow: selected ? 'var(--shadow-elev1)' : undefined
                        }}
                      >
                        <div style={{height:110, borderRadius:12, border:'1px solid var(--color-border)', backgroundImage:`url(${thumb}), url(${full})`, backgroundSize:'cover', backgroundPosition:'center', backgroundColor:'#0E1017'}} aria-hidden />
                        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                          <div>
                            <div style={{fontWeight:700}}>{s.label}</div>
                            {s.hint && <div style={{opacity:.6, fontSize:12}}>{s.hint}</div>}
                          </div>
                          <span aria-hidden="true" style={{width:10, height:10, borderRadius:99, background:selected ? 'var(--color-primary)' : 'var(--color-border)'}} />
                        </div>
                      </div>

                      {isCustom && imgLoading && (
                        <div style={{position:'absolute', top:10, left:10, fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(255,255,255,.08)', border:'1px solid var(--color-border)'}}>Chargement…</div>
                      )}
                      {isCustom && customBg && (
                        <div style={{position:'absolute', top:10, right:10, fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(228,183,61,.14)', border:'1px solid var(--color-primary)'}}>Image chargée ✓ {customBg.w}×{customBg.h}</div>
                      )}
                    </div>
                  )
                })}
              </div>

              <p style={{margin:'10px 2px 0', fontSize:12, opacity:.7}}>
                Les vignettes utilisent <code>/public/cert_bg/&lt;style&gt;_thumb.jpg</code> (fallback <code>&lt;style&gt;.png</code>).
              </p>
            </div>

            {/* Publication dans le registre — PDF complet */}
            <div style={{marginBottom:10, padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:12}}>
              <label htmlFor="publish-registry" style={{display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer'}}>
                <input
                  id="publish-registry"
                  type="checkbox"
                  checked={form.public_registry}
                  onChange={e=>setForm(f=>({...f, public_registry: e.target.checked}))}
                  style={{marginTop:2}}
                />
                <div>
                  <div><strong>Publier ce certificat (PDF complet) dans le registre public</strong></div>
                  <div style={{fontSize:12, color:'var(--color-muted)'}}>
                    Vous pourrez publier/supprimer plus tard depuis votre QR Code
                  </div>
                </div>
              </label>
            </div>

            {/* Submit */}
            <div>
              <button disabled={status==='loading'} type="submit"
                style={{background:'var(--color-primary)', color:'var(--color-on-primary)', padding:'14px 18px', borderRadius:12, fontWeight:800, border:'none', boxShadow: status==='loading' ? '0 0 0 6px rgba(228,183,61,.12)' : 'none', cursor: status==='loading' ? 'progress' : 'pointer'}}>
                {status==='loading' ? 'Redirection…' : (isGift ? 'Offrir cette journée' : 'Payer & réserver cette journée')}
              </button>
              {status==='error' && error && <p style={{color:'#ff8a8a', marginTop:8}}>{error}</p>}
              <p style={{marginTop:8, fontSize:12, color:'var(--color-muted)'}}>
                Contenu numérique livré immédiatement : vous demandez l’exécution immédiate et <strong>renoncez</strong> au droit de rétractation (UE).
              </p>
            </div>
          </form>

          {/* ---------- PREVIEW COLUMN ---------- */}
          <aside aria-label="Aperçu du certificat"
            style={{position:'sticky', top:24, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:12, boxShadow:'var(--shadow-elev1)'}}>
            <div ref={previewWrapRef} style={{position:'relative', width:'100%', aspectRatio: `${A4_W_PT}/${A4_H_PT}`, borderRadius:12, overflow:'hidden', border:'1px solid var(--color-border)'}}>
              <img
                key={(form.cert_style==='custom' ? customBg?.url : form.cert_style) || 'none'}
                src={form.cert_style==='custom' ? (customBg?.url || '/cert_bg/neutral.png') : `/cert_bg/${form.cert_style}.png`}
                alt={`Aperçu fond certificat — ${form.cert_style}`}
                style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', background:'#0E1017'}}
              />

              {/* Filigrane */}
              <div aria-hidden style={{position:'absolute', inset:0, pointerEvents:'none', display:'grid', placeItems:'center', transform:'rotate(-22deg)', opacity:.14, mixBlendMode:'multiply'}}>
                <div style={{fontWeight:900, fontSize:'min(18vw, 120px)', letterSpacing:2, color:'#1a1f2a'}}>PARCELS OF TIME — PREVIEW</div>
              </div>

              {/* Header (brand + title) */}
              <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: toTopPx(yBrand, 18), fontWeight:800, fontSize: 18*scale, color: form.text_color }}>{L.brand}</div>
              <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: toTopPx(yCert, 12), fontWeight:400, fontSize: 12*scale, color: subtleColor }}>{L.title}</div>

              {/* Date principale (AAAA-MM-JJ) */}
              <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: topMainTime, fontWeight:800, fontSize: tsSize*scale, color: form.text_color }}>
                {mainTime}
              </div>

              {/* Owned by */}
              {showOwned && (
                <>
                  <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: ownedLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                    {ownedByLabel}
                  </div>
                  <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: ownedNameTop!, fontWeight:800, fontSize: 15*scale, color: form.text_color }}>
                    {nameForPreview}
                  </div>
                </>
              )}

              {/* Gifted by */}
              {showGifted && (
                <>
                  <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: giftedLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                    {giftLabel}
                  </div>
                  <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: giftedNameTop!, fontWeight:800, fontSize: 15*scale, color: form.text_color }}>
                    {giftedByStr}
                  </div>
                </>
              )}

              {/* Title */}
                   {titleForPreview && (
                <>
                <div style={{ ...centerStyle, top: titleLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                    {titleLabel}
                  </div>
                  {titleLines.map((line, i)=>(
                     <div key={i} style={{ ...centerStyle, top: titleLineTops[i], fontWeight:800, fontSize: 15*scale }}>
                      {line}
                    </div>
                  ))}
                </>
              )}

              {/* Message (Regular, pas d’italique pour coller au PDF) */}
              {msgLines.length>0 && (
                <>
                  <div style={{ ...centerStyle, top: msgLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                    {messageLabel}
                  </div>
                  {msgLines.map((line, i)=>(
                    <div key={i} style={{ ...centerStyle, top: msgLineTops[i], fontSize: 12.5*scale }}>
                      {line}
                    </div>
                  ))}
                </>
              )}

              {/* Lien (si présent) */}
              {linkLines.length>0 && (
                <>
                  <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center', top: linkLabelTop!, fontWeight:400, fontSize: 11*scale, color: subtleColor }}>
                    {L.link}
                  </div>
                    {linkLines.map((line, i)=>(
                  <div
                    key={i}
                    style={{ ...centerStyle, top: linkLineTops[i], fontSize: 10.5*scale, color: mixColorForLink(form.text_color) }}
                  >
                    {line}
                  </div>
                ))}
                </>
              )}

              {/* Footer: meta à gauche & QR à droite comme le PDF (placeholder) */}
              <div style={{position:'absolute', left: EDGE_PT*scale, bottom: EDGE_PT*scale, width: (A4_W_PT/2)*scale, height: META_H_PT*scale, color: subtleColor, fontSize: 11*scale, lineHeight: 1.2}}>
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
              Le PDF final est généré côté serveur : texte net, QR code réel, métadonnées signées.  
              Astuce : pour un <em>certificat minimaliste</em>, décochez “{ownedByLabel}”, “{titleLabel}”, “{messageLabel}”.
            </div>
          </aside>
        </div>
      </section>
    </main>
  )

  function mixColorForLink(hex:string){
    // même logique que le PDF (mélange vers un bleu profond)
    const {r,g,b} = hexToRgb(hex)
    const mixc = (a:number,b:number,t:number)=> Math.round(a*(1-t)+b*t)
    const rr = mixc(r, 51, 0.3), gg = mixc(g, 51, 0.3), bb = mixc(b, 179, 0.3)
    return `rgb(${rr},${gg},${bb})`
  }
}
