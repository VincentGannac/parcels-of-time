// app/[locale]/claim/ClientClaim.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

const SAFE_INSETS_PCT: Record<CertStyle, {top:number;right:number;bottom:number;left:number}> = {
  neutral:    { top:16.6, right:16.1, bottom:18.5, left:16.1 },
  romantic:   { top:19.0, right:19.5, bottom:18.5, left:19.5 },
  birthday:   { top:17.1, right:22.2, bottom:18.5, left:22.2 },
  birth:      { top:17.8, right:18.8, bottom:18.5, left:18.8 },
  wedding:    { top:19.0, right:20.8, bottom:18.5, left:20.8 },
  christmas:  { top:17.8, right:18.8, bottom:18.5, left:18.8 },
  newyear:    { top:17.8, right:18.8, bottom:18.5, left:18.8 },
  graduation: { top:17.8, right:18.8, bottom:18.5, left:18.8 },
  custom:     { top:16.6, right:16.1, bottom:18.5, left:16.1 },
}

const CERT_BG_HEX = '#F4F1EC'

/** ------- Utils ------- **/
const range = (a:number, b:number) => Array.from({length:b-a+1},(_,i)=>a+i)
function safeDecode(value: string): string {
  let out = value
  try { for (let i=0;i<3;i++){ const dec=decodeURIComponent(out); if(dec===out) break; out=dec } } catch {}
  return out
}
function isoDayString(d: Date) { const c = new Date(d.getTime()); c.setUTCHours(0,0,0,0); return c.toISOString() }
function parseToDateOrNull(input: string): Date | null {
  const s = (input || '').trim(); if (!s) return null
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCHours(0,0,0,0); return d
}
function localDayOnly(d: Date | null) {
  if (!d) return ''
  try { return d.toLocaleDateString(undefined, { year:'numeric', month:'2-digit', day:'2-digit' }) } catch { return '' }
}
function daysInMonth(y:number, m:number) { return new Date(y, m, 0).getDate() }
const MONTHS_FR = ['01 — Jan','02 — Fév','03 — Mar','04 — Avr','05 — Mai','06 — Juin','07 — Juil','08 — Août','09 — Sep','10 — Oct','11 — Nov','12 — Déc']

// couleurs utils
function hexToRgb(hex:string){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if(!m) return {r:26,g:31,b:42}
  const n = parseInt(m[1],16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 }
}
function mix(a:number,b:number,t:number){ return Math.round(a*(1-t)+b*t)}
function lighten(hex:string, t=0.55){ const {r,g,b} = hexToRgb(hex); return `rgba(${mix(r,255,t)}, ${mix(g,255,t)}, ${mix(b,255,t)}, 0.9)` }
function relLum({r,g,b}:{r:number,g:number,b:number}){ const srgb=(c:number)=>{ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }; const R=srgb(r),G=srgb(g),B=srgb(b); return 0.2126*R+0.7152*G+0.0722*B }
function contrastRatio(fgHex:string, bgHex=CERT_BG_HEX){ const L1=relLum(hexToRgb(fgHex)), L2=relLum(hexToRgb(bgHex)); const light=Math.max(L1,L2), dark=Math.min(L1,L2); return (light+0.05)/(dark+0.05) }
function ratioLabel(r:number){ if(r>=7) return {label:'AAA', color:'#0BBF6A'}; if(r>=4.5) return {label:'AA', color:'#E4B73D'}; return {label:'⚠︎ Low', color:'#FF7A7A'} }

// format d’affichage choisi par l’utilisateur
type DateFormat = 'DMY' | 'MDY'
function fmtDate(d: Date, fmt: DateFormat){
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth()+1).padStart(2,'0')
  const day = String(d.getUTCDate()).padStart(2,'0')
  return fmt==='DMY' ? `${day}/${m}/${y}` : `${m}/${day}/${y}`
}

export default function ClientClaim() {
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
  const [Y, setY] = useState<number>(prefillDate.getFullYear())
  const [M, setM] = useState<number>(prefillDate.getMonth()+1)
  const [D, setD] = useState<number>(prefillDate.getDate())
  useEffect(()=>{ const dim=daysInMonth(Y,M); if(D>dim) setD(dim) }, [Y,M])

  // Langue pour labels (fr vs en très simple)
  const isFR = useMemo(()=>{
    try { return (navigator.language || '').toLowerCase().startsWith('fr') } catch { return false }
  }, [])
  const giftLabel = isFR ? 'Offert par' : 'Gifted by'
  const ownedByLabel = isFR ? 'Au nom de' : 'Owned by'
  const titleLabel = isFR ? 'Titre' : 'Title'
  const messageLabel = isFR ? 'Message' : 'Message'

  // Sélecteur de format (par défaut : FR → DMY, sinon → MDY)
  const defaultFmt: DateFormat = isFR ? 'DMY' : 'MDY'
  const [dateFormat, setDateFormat] = useState<DateFormat>(defaultFmt)

  /** Form principal */
  const [form, setForm] = useState({
    email: '',
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
    local_date_only: true, // journée => toujours true
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
    giftedBy: true, // seulement si isGift
  })

  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  // Recalcule `ts` (minuit UTC) à chaque changement Y/M/D
  useEffect(()=>{
    const d = new Date(Date.UTC(Y, M-1, D, 0, 0, 0, 0))
    setForm(f=>({ ...f, ts: isoDayString(d) }))
  }, [Y, M, D])

  // readouts
  const parsedDate = useMemo(() => parseToDateOrNull(form.ts), [form.ts])

  const utcReadable = useMemo(() => {
    if (!parsedDate) return ''
    const y = parsedDate.getUTCFullYear()
    const m = String(parsedDate.getUTCMonth()+1).padStart(2,'0')
    const d = String(parsedDate.getUTCDate()).padStart(2,'0')
    return `${y}-${m}-${d} UTC`
  }, [parsedDate])

  const localReadableStr = useMemo(() => parsedDate ? localDayOnly(parsedDate) : '', [parsedDate])

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
  async function normalizeToPng(original: File) {
    const { file: afterHeic } = await heicToPngIfNeeded(original)
    const orientation = await getExifOrientation(original)
    const tmpUrl = URL.createObjectURL(afterHeic)
    try {
      const img = new Image()
      const done = new Promise<{dataUrl:string; w:number; h:number}>((resolve, reject) => {
        img.onload = () => resolve(drawNormalized(img, orientation || 1))
        img.onerror = reject
      })
      img.src = tmpUrl
      const out = await done
      return out
    } finally { URL.revokeObjectURL(tmpUrl) }
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
  const subtleColor = lighten(mainColor, 0.55)
  const ratio = contrastRatio(mainColor)
  const ratioMeta = ratioLabel(ratio)

  // “édition” (jour bissextile = premium)
  const edition = useMemo(() => {
    if (!parsedDate) return null
    const y = parsedDate.getUTCFullYear(), mm = parsedDate.getUTCMonth(), dd = parsedDate.getUTCDate()
    const isLeap = ((y%4===0 && y%100!==0) || y%400===0) && mm===1 && dd===29
    return isLeap ? 'premium' : 'standard'
  }, [parsedDate])

  const chosenDateStr = parsedDate ? fmtDate(parsedDate, dateFormat) : ''

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')
    const d = parseToDateOrNull(form.ts)
    if (!d) { setStatus('error'); setError('Merci de saisir une date valide.'); return }

    // 🔧 Prépare les champs selon la visibilité choisie
    const finalDisplayName = show.ownedBy ? (form.display_name || undefined) : undefined
    const finalTitle = show.title ? (form.title || undefined) : undefined

    // “Offert par” : injecté dans le message (pour rester 100% compatible serveur/PDF)
    const msgParts: string[] = []
    if (show.message && form.message.trim()) msgParts.push(form.message.trim())
    if (isGift && show.giftedBy && form.gifted_by.trim()) {
      msgParts.push(`${giftLabel}: ${form.gifted_by.trim()}`)
    }
    const finalMessage = msgParts.length ? msgParts.join('\n') : undefined

    const payload:any = {
      ts: d.toISOString(),
      email: form.email,
      display_name: finalDisplayName,
      title: finalTitle,
      message: finalMessage,
      link_url: undefined, // non utilisé ici
      cert_style: form.cert_style || 'neutral',
      time_display: 'local+utc',      // compat
      local_date_only: '1',           // journée
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

  return (
    <main style={containerStyle}>
      {/* input fichier global */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,.heic,.heif"
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
                <span>{isGift ? 'Nom du·de la destinataire (public sur le certificat)' : 'Nom affiché (public sur le certificat)'}</span>
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
                <div style={{width:42, height:42, borderRadius:10, border:'1px solid var(--color-border)', display:'grid', placeItems:'center', background: CERT_BG_HEX, color: mainColor, fontWeight:800}}>
                  Aa
                </div>
                <div style={{flex:1, height:12, borderRadius:99, background: CERT_BG_HEX, position:'relative', border:'1px solid var(--color-border)'}}>
                  <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', padding:'0 10px', color:mainColor, fontSize:12}}>“Owned by — 2024-12-31 UTC”</div>
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

              {/* Format d’affichage de la date */}
              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
                <label style={{padding:'8px 10px', borderRadius:10, cursor:'pointer', border: dateFormat==='DMY' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)'}}>
                  <input type="radio" name="date_fmt" value="DMY" checked={dateFormat==='DMY'} onChange={()=>setDateFormat('DMY')} style={{display:'none'}}/>
                  Format JJ/MM/AAAA
                </label>
                <label style={{padding:'8px 10px', borderRadius:10, cursor:'pointer', border: dateFormat==='MDY' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)'}}>
                  <input type="radio" name="date_fmt" value="MDY" checked={dateFormat==='MDY'} onChange={()=>setDateFormat('MDY')} style={{display:'none'}}/>
                  Format MM/JJ/AAAA
                </label>
              </div>

              {/* Sélecteurs date (jour complet) */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
                <label style={{display:'grid', gap:6}}>
                  <span>Année</span>
                  <select value={Y} onChange={e=>setY(parseInt(e.target.value))}
                    style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                    {range(1900, 2100).map(y=> <option key={y} value={y} style={{color:'#000'}}>{y}</option>)}
                  </select>
                </label>
                <label style={{display:'grid', gap:6}}>
                  <span>Mois</span>
                  <select value={M} onChange={e=>setM(parseInt(e.target.value))}
                    style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                    {MONTHS_FR.map((txt,idx)=> <option key={idx} value={idx+1} style={{color:'#000'}}>{txt}</option>)}
                  </select>
                </label>
                <label style={{display:'grid', gap:6}}>
                  <span>Jour</span>
                  <select value={D} onChange={e=>setD(parseInt(e.target.value))}
                    style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                    {range(1, daysInMonth(Y,M)).map(d=> <option key={d} value={d} style={{color:'#000'}}>{d.toString().padStart(2,'0')}</option>)}
                  </select>
                </label>
              </div>

              <div style={{display:'flex', gap:14, flexWrap:'wrap', marginTop:12, fontSize:14}}>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}><strong>Affichage choisi&nbsp;:</strong> {chosenDateStr || '—'}</div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}><strong>UTC&nbsp;:</strong> {utcReadable || '—'}</div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}><strong>Date locale&nbsp;:</strong> {localReadableStr || '—'}</div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}><strong>Édition&nbsp;:</strong> {edition ? (edition === 'premium' ? 'Premium' : 'Standard') : '—'}</div>
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
            <div style={{position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid var(--color-border)'}}>
              <img
                key={(form.cert_style==='custom' ? customBg?.url : form.cert_style) || 'none'}
                src={form.cert_style==='custom' ? (customBg?.url || '/cert_bg/neutral.png') : `/cert_bg/${form.cert_style}.png`}
                alt={`Aperçu fond certificat — ${form.cert_style}`}
                width={840} height={1188}
                style={{width:'100%', height:'auto', display:'block', background:'#0E1017'}}
              />

              {/* Filigrane */}
              <div aria-hidden style={{position:'absolute', inset:0, pointerEvents:'none', display:'grid', placeItems:'center', transform:'rotate(-22deg)', opacity:.14, mixBlendMode:'multiply'}}>
                <div style={{fontWeight:900, fontSize:'min(18vw, 120px)', letterSpacing:2, color:'#1a1f2a'}}>PARCELS OF TIME — PREVIEW</div>
              </div>

              {/* Overlay */}
              {(() => {
                const ins = SAFE_INSETS_PCT[form.cert_style]
                const EDGE_PX = 12
                const nameForPreview = form.display_name || (isGift ? 'Nom du·de la destinataire' : 'Votre nom')
                const giftedByStr = form.gifted_by || (isGift ? (isFR ? 'Votre nom' : 'Your name') : '')
                const showOwned = show.ownedBy && !!nameForPreview
                const showT = show.title && !!form.title
                const showM = show.message && !!form.message
                const showG = isGift && show.giftedBy && !!form.gifted_by

                return (
                  <div aria-hidden style={{ position:'absolute', inset:0 }}>
                    {/* zone sûre + contenu */}
                    <div
                      style={{
                        position:'absolute',
                        top:`${ins.top}%`,
                        right:`${ins.right}%`,
                        bottom:`${ins.bottom}%`,
                        left:`${ins.left}%`,
                        display:'grid',
                        gridTemplateRows:'auto 1fr',
                        color:mainColor,
                        textAlign:'center'
                      }}
                    >
                      <div style={{ textAlign:'left', color:subtleColor }}>
                        <div style={{ fontWeight:900, fontSize:'min(3.8vw, 20px)' }}>Parcels of Time</div>
                        <div style={{ opacity:.9, fontSize:'min(3.2vw, 14px)' }}>Certificate of Claim</div>
                      </div>

                      <div
                        style={{
                          display:'grid',
                          alignItems:'start',
                          justifyItems:'center',
                          rowGap:8,
                          paddingTop:8
                        }}
                      >
                        {/* Date principale */}
                        <div style={{ fontWeight:800, fontSize:'min(9vw, 26px)', marginBottom:6 }}>
                          {chosenDateStr || (dateFormat==='DMY' ? 'JJ/MM/AAAA' : 'MM/JJ/AAAA')}
                        </div>

                        {/* Ligne secondaire = UTC ISO jour */}
                        {utcReadable && (
                          <div style={{ color:subtleColor, fontSize:'min(3.6vw, 13px)' }}>
                            {utcReadable}
                          </div>
                        )}

                        {/* Owned by */}
                        {showOwned && (
                          <>
                            <div style={{ opacity:.7, color:subtleColor, fontSize:'min(3.4vw, 13px)', marginTop:10 }}>
                              {ownedByLabel}
                            </div>
                            <div style={{ fontWeight:800, fontSize:'min(6.4vw, 18px)' }}>
                              {nameForPreview}
                            </div>
                          </>
                        )}

                        {/* Gifted by (section dédiée en preview ; dans le PDF on l’injecte dans Message pour compat) */}
                        {showG && (
                          <>
                            <div style={{ opacity:.7, color:subtleColor, fontSize:'min(3.4vw, 13px)', marginTop:10 }}>
                              {giftLabel}
                            </div>
                            <div style={{ fontWeight:800, fontSize:'min(6.0vw, 17px)' }}>
                              {giftedByStr}
                            </div>
                          </>
                        )}

                        {/* Title */}
                        {showT && (
                          <>
                            <div style={{ opacity:.7, color:subtleColor, fontSize:'min(3.4vw, 13px)', marginTop:10 }}>
                              {titleLabel}
                            </div>
                            <div style={{ fontWeight:800, fontSize:'min(6.0vw, 17px)' }}>{form.title}</div>
                          </>
                        )}

                        {/* Message */}
                        {showM && (
                          <>
                            <div style={{ opacity:.7, color:subtleColor, fontSize:'min(3.4vw, 13px)', marginTop:10 }}>
                              {messageLabel}
                            </div>
                            <div style={{ marginTop:6, fontStyle:'italic', lineHeight:1.3, fontSize:'min(3.8vw, 13px)' }}>
                              “{form.message || (isFR ? 'Votre message…' : 'Your message…')}”
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* éléments bas gauche / bas droite */}
                    <div
                      style={{
                        position:'absolute',
                        left:EDGE_PX,
                        bottom:EDGE_PX,
                        fontSize:'min(3.2vw,12px)',
                        color:subtleColor,
                        textAlign:'left',
                        pointerEvents:'none'
                      }}
                    >
                      Certificate ID • Integrity hash (aperçu)
                    </div>
                    <div
                      style={{
                        position:'absolute',
                        right:EDGE_PX,
                        bottom:EDGE_PX,
                        width:'min(18vw,110px)',
                        height:'min(18vw,110px)',
                        border:'1px dashed rgba(26,31,42,.45)',
                        borderRadius:8,
                        display:'grid',
                        placeItems:'center',
                        fontSize:'min(6vw,12px)',
                        opacity:.85,
                        pointerEvents:'none'
                      }}
                    >
                      QR
                    </div>
                  </div>
                )
              })()}

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
}
