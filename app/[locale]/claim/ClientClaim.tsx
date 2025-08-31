// app/claim/ClientClaim.tsx
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

const A4_RATIO = 2480 / 3508
const RATIO_2x3 = 1024 / 1536
const RATIO_TOL = 0.01
const ALLOWED_EXACT_SIZES = [
  { w: 2480, h: 3508, label: 'A4' },
  { w: 1024, h: 1536, label: '1024×1536' },
]

/** ------- Utils ------- **/
const range = (a:number, b:number) => Array.from({length:b-a+1},(_,i)=>a+i)
function safeDecode(value: string): string {
  let out = value
  try { for (let i=0;i<3;i++){ const dec=decodeURIComponent(out); if(dec===out) break; out=dec } } catch {}
  return out
}
function isoMinuteString(d: Date) { const c = new Date(d.getTime()); c.setUTCSeconds(0,0); return c.toISOString() }
function parseToDateOrNull(input: string): Date | null {
  const s = (input || '').trim(); if (!s) return null
  const d = new Date(s); if (isNaN(d.getTime())) return null
  d.setUTCSeconds(0,0); return d
}
function localReadable(d: Date | null) {
  if (!d) return ''
  try {
    return d.toLocaleString(undefined, {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hour12:false
    })
  } catch { return '' }
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
const CERT_BG_HEX = '#F4F1EC'
function relLum({r,g,b}:{r:number,g:number,b:number}){ const srgb=(c:number)=>{ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }; const R=srgb(r),G=srgb(g),B=srgb(b); return 0.2126*R+0.7152*G+0.0722*B }
function contrastRatio(fgHex:string, bgHex=CERT_BG_HEX){ const L1=relLum(hexToRgb(fgHex)), L2=relLum(hexToRgb(bgHex)); const light=Math.max(L1,L2), dark=Math.min(L1,L2); return (light+0.05)/(dark+0.05) }
function ratioLabel(r:number){ if(r>=7) return {label:'AAA', color:'#0BBF6A'}; if(r>=4.5) return {label:'AA', color:'#E4B73D'}; return {label:'⚠︎ Low', color:'#FF7A7A'} }

export default function ClientClaim() {
  const params = useSearchParams()
  const prefillRaw = params.get('ts') || ''
  const prefillTs = prefillRaw ? safeDecode(prefillRaw) : ''
  const styleParam = (params.get('style') || '').toLowerCase()
  const giftParam = params.get('gift')
  const initialGift = giftParam === '1' || giftParam === 'true'

  const allowed = STYLES.map(s => s.id)
  const initialStyle: CertStyle = (allowed as readonly string[]).includes(styleParam as CertStyle)
    ? (styleParam as CertStyle) : 'neutral' // Neutral par défaut

  const [isGift, setIsGift] = useState<boolean>(initialGift)

  // Sélecteur local/UTC
  const now = new Date()
  const prefillDate = parseToDateOrNull(prefillTs) || now
  const [pickMode, setPickMode] = useState<'local'|'utc'>(prefillTs ? 'utc' : 'local')
  const [Y, setY]   = useState<number>(prefillDate.getFullYear())
  const [M, setM]   = useState<number>(prefillDate.getMonth()+1)
  const [D, setD]   = useState<number>(prefillDate.getDate())
  const [h, setH]   = useState<number>(prefillDate.getHours())
  const [m, setMin] = useState<number>(prefillDate.getMinutes())

  useEffect(()=>{ const dim=daysInMonth(Y,M); if(D>dim) setD(dim) }, [Y,M]) // clamp

  /** Form principal */
  const [form, setForm] = useState({
    email: '',
    display_name: '',
    title: '',
    message: '',
    link_url: '',
    ts: prefillTs,
    cert_style: initialStyle as CertStyle,
    time_display: 'local+utc' as 'utc'|'utc+local'|'local+utc',
    local_date_only: false,
    text_color: '#1A1F2A',
    title_public: false,
    message_public: false,
    public_registry: false,
  })
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  // resync quand on bascule local/utc
  const parsedDate = useMemo(() => parseToDateOrNull(form.ts), [form.ts])
  useEffect(()=>{
    if(!parsedDate) return
    if(pickMode==='utc'){
      setY(parsedDate.getUTCFullYear()); setM(parsedDate.getUTCMonth()+1); setD(parsedDate.getUTCDate())
      setH(parsedDate.getUTCHours()); setMin(parsedDate.getUTCMinutes())
    } else {
      setY(parsedDate.getFullYear()); setM(parsedDate.getMonth()+1); setD(parsedDate.getDate())
      setH(parsedDate.getHours()); setMin(parsedDate.getMinutes())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickMode])

  // recalcule ts quand on modifie le sélecteur local/utc
  useEffect(()=>{
    let d: Date
    if (pickMode==='local') d = new Date(Y, M-1, D, h, m, 0, 0)
    else d = new Date(Date.UTC(Y, M-1, D, h, m, 0, 0))
    setForm(f=>({ ...f, ts: isoMinuteString(d) }))
  }, [pickMode, Y, M, D, h, m])

  // readouts
  const utcReadable = useMemo(
    () => parsedDate ? parsedDate.toISOString().replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC') : '',
    [parsedDate]
  )
  const localReadableStr = useMemo(
    () => parsedDate ? (form.local_date_only ? localDayOnly(parsedDate) : localReadable(parsedDate)) : '',
    [parsedDate, form.local_date_only]
  )
  const tzLabel = useMemo(()=> { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local' } catch { return 'Local' } }, [])

  // hint édition
  const edition = useMemo(() => {
    if (!parsedDate) return null
    const y = parsedDate.getUTCFullYear(), mm = parsedDate.getUTCMonth(), dd = parsedDate.getUTCDate()
    const H = parsedDate.getUTCHours().toString().padStart(2,'0'), Mi = parsedDate.getUTCMinutes().toString().padStart(2,'0')
    const t = `${H}:${Mi}`
    const isLeap = ((y%4===0 && y%100!==0) || y%400===0) && mm===1 && dd===29
    const pretty = (t==='11:11' || t==='12:34' || t==='22:22' || (/^([0-9])\1:([0-9])\2$/).test(t))
    return (isLeap || pretty) ? 'premium' : 'standard'
  }, [parsedDate])

  useEffect(()=>{ if (prefillTs) setForm(f=>({...f, ts: prefillTs})) }, []) // pré-remplissage


/** --------- Custom background --------- */
const fileInputRef = useRef<HTMLInputElement | null>(null)
const [customBg, setCustomBg] = useState<{ url:string; dataUrl:string; w:number; h:number } | null>(null)
const [customErr, setCustomErr] = useState('')
const [imgLoading, setImgLoading] = useState(false)

function log(...args:any[]){ console.debug('[Claim/CustomBG]', ...args) }
const openFileDialog = () => { fileInputRef.current?.click() }

const onSelectStyle = (id: CertStyle) => {
  setForm(f => ({ ...f, cert_style: id }));
  if (id === 'custom') openFileDialog();
};

// util
async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })
}

// HEIC/HEIF -> PNG si besoin
async function heicToPngIfNeeded(original: File): Promise<{file: File, wasHeic:boolean}> {
  const type = (original.type || '').toLowerCase()
  const looksHeic = /^image\/(heic|heif|heic-sequence|heif-sequence)$/.test(type) || /\.(heic|heif)$/i.test(original.name)
  if (!looksHeic) return { file: original, wasHeic:false }
  const heic2any = (await import('heic2any')).default as (opts:any)=>Promise<Blob>
  const out = await heic2any({ blob: original, toType: 'image/png', quality: 0.92 })
  return { file: new File([out], original.name.replace(/\.(heic|heif)\b/i, '.png'), { type:'image/png' }), wasHeic:true }
}

// EXIF Orientation (1..8). Si indispo → 1
async function getExifOrientation(file: File): Promise<number> {
  try {
    const { parse } = (await import('exifr')) as any;
    const meta = await parse(file, { pick: ['Orientation'] });
    return meta?.Orientation || 1;
  } catch {
    return 1;
  }
}


// Dessin sur canvas avec orientation EXIF appliquée
function drawNormalized(img: HTMLImageElement, orientation: number) {
  const w = img.naturalWidth, h = img.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const swap = (o:number) => o >= 5 && o <= 8

  canvas.width  = swap(orientation) ? h : w
  canvas.height = swap(orientation) ? w : h

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, canvas.width, 0); break;                       // miroir H
    case 3: ctx.transform(-1, 0, 0, -1, canvas.width, canvas.height); break;          // 180°
    case 4: ctx.transform(1, 0, 0, -1, 0, canvas.height); break;                      // miroir V
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;                                   // transpose
    case 6: ctx.transform(0, 1, -1, 0, canvas.height, 0); break;                      // 90° CW
    case 7: ctx.transform(0, -1, -1, 0, canvas.height, canvas.width); break;          // transverse
    case 8: ctx.transform(0, -1, 1, 0, 0, canvas.width); break;                       // 90° CCW
    default: /* 1 */ break;
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return { dataUrl: canvas.toDataURL('image/png', 0.92), w: canvas.width, h: canvas.height }
}

// Pipeline complet : conversion éventuelle + orientation normalisée
async function normalizeToPng(original: File) {
  const { file: afterHeic, wasHeic } = await heicToPngIfNeeded(original)
  const orientation = await getExifOrientation(original) // lire l'EXIF du fichier d'origine
  const tmpUrl = URL.createObjectURL(afterHeic)
  try {
    const img = new Image()
    const done = new Promise<{dataUrl:string; w:number; h:number}>((resolve, reject) => {
      img.onload = () => resolve(drawNormalized(img, orientation || 1))
      img.onerror = reject
    })
    img.src = tmpUrl
    const out = await done
    return { ...out, wasHeic }
  } finally { URL.revokeObjectURL(tmpUrl) }
}

function bytesFromDataURL(u: string) {
  const i = u.indexOf(',');
  const b64 = i >= 0 ? u.slice(i + 1) : u;
  return Math.floor(b64.length * 0.75); // approx bytes
}

function coverToA4JPEG(dataUrl: string, srcW: number, srcH: number) {
  const TARGET_W = 2480, TARGET_H = 3508;           // A4@300dpi
  const MAX_BYTES = 3.5 * 1024 * 1024;              // < 3.5 MB pour passer le POST

  return new Promise<{ dataUrl: string; w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = TARGET_W; c.height = TARGET_H;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';

      // cover (centré, recadré) pour respecter le ratio A4
      const scale = Math.max(TARGET_W / srcW, TARGET_H / srcH);
      const dw = srcW * scale, dh = srcH * scale;
      const dx = (TARGET_W - dw) / 2, dy = (TARGET_H - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);

      // export en JPEG et réduit la qualité si > MAX_BYTES
      let q = 0.82;
      let out = c.toDataURL('image/jpeg', q);
      while (bytesFromDataURL(out) > MAX_BYTES && q > 0.5) {
        q -= 0.06;
        out = c.toDataURL('image/jpeg', q);
      }
      resolve({ dataUrl: out, w: TARGET_W, h: TARGET_H });
    };
    img.src = dataUrl;
  });
}


async function onPickCustomBg(file?: File | null) {
  try {
    setCustomErr('');
    if (!file) { log('Aucun fichier sélectionné'); return; }
    setImgLoading(true);

    // 1) Normalise (HEIC->PNG si besoin + orientation EXIF corrigée)
    const { dataUrl: normalizedUrl, w, h } = await normalizeToPng(file);

    // Helpers locaux
    const bytesFromDataURL = (u: string) => {
      const i = u.indexOf(',');
      const b64 = i >= 0 ? u.slice(i + 1) : u;
      return Math.floor(b64.length * 0.75); // ~octets
    };

    const coverToA4JPEG = (srcDataUrl: string, srcW: number, srcH: number) =>
      new Promise<{ dataUrl: string; w: number; h: number }>((resolve) => {
        const TARGET_W = 2480, TARGET_H = 3508;
        const MAX_BYTES = 3.5 * 1024 * 1024; // borne pour le POST
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = TARGET_W; c.height = TARGET_H;
          const ctx = c.getContext('2d')!;
          ctx.imageSmoothingQuality = 'high';

          // cover centré pour respecter le ratio A4
          const scale = Math.max(TARGET_W / srcW, TARGET_H / srcH);
          const dw = srcW * scale, dh = srcH * scale;
          const dx = (TARGET_W - dw) / 2, dy = (TARGET_H - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);

          // export JPEG et compression adaptative
          let q = 0.82;
          let out = c.toDataURL('image/jpeg', q);
          while (bytesFromDataURL(out) > MAX_BYTES && q > 0.5) {
            q -= 0.06;
            out = c.toDataURL('image/jpeg', q);
          }
          resolve({ dataUrl: out, w: TARGET_W, h: TARGET_H });
        };
        img.src = srcDataUrl;
      });

    // 2) Recadre/scale vers A4 et compresse
    const { dataUrl: a4Url, w: tw, h: th } = await coverToA4JPEG(normalizedUrl, w, h);

    // 3) Sécurité taille finale
    if (bytesFromDataURL(a4Url) > 4 * 1024 * 1024) {
      setCustomErr('Image trop lourde après préparation. Réessayez avec une photo plus légère.');
      return;
    }

    // 4) Aperçu = exactement ce qui sera envoyé au serveur
    setCustomBg({ url: a4Url, dataUrl: a4Url, w: tw, h: th });
    setForm(f => ({ ...f, cert_style: 'custom' }));
    log('CustomBG prêt (A4 JPEG)', { w: tw, h: th, approxKB: Math.round(bytesFromDataURL(a4Url) / 1024) });
  } catch (e) {
    console.error('[Claim/CustomBG] onPickCustomBg', e);
    setCustomErr('Erreur de lecture ou de conversion de l’image.');
  } finally {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImgLoading(false);
  }
}

// clean: plus besoin d’ObjectURL persistant
useEffect(() => () => {}, [])


  // Couleurs
  const mainColor = form.text_color || '#1A1F2A'
  const subtleColor = lighten(mainColor, 0.55)
  const ratio = contrastRatio(mainColor)
  const ratioMeta = ratioLabel(ratio)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')

    const d = parseToDateOrNull(form.ts)
    if (!d) { setStatus('error'); setError('Merci de saisir une minute valide.'); return }

    const payload:any = {
      ts: d.toISOString(),
      email: form.email,
      display_name: form.display_name || undefined,
      title: form.title || undefined,
      message: form.message || undefined,
      link_url: form.link_url || undefined,
      cert_style: form.cert_style || 'neutral',
      time_display: form.time_display,
      local_date_only: form.local_date_only ? '1' : '0',
      text_color: mainColor,
      title_public: form.title_public ? '1' : '0',
      message_public: form.message_public ? '1' : '0',
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
          invalid_ts: 'Horodatage invalide. Utilise un ISO comme 2100-01-01T00:00Z.',
          missing_fields: 'Merci de renseigner au minimum l’e-mail et la minute.',
          custom_bg_invalid: 'Image personnalisée invalide (doit être PNG/JPG en data URL).',
          stripe_key_missing: 'Configuration Stripe absente côté serveur.',
          bad_price: 'Prix invalide pour cette minute.',
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
      {/* input fichier global, persistant dans le DOM (évite unmount/remount) */}
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
            {isGift ? 'Offrir une minute' : 'Réserver votre minute'}
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

              <div style={{display:'grid', gap:6, marginTop:10}}>
                <label>
                  <span>Titre</span>
                  <input type="text" value={form.title}
                    onChange={e=>setForm(f=>({...f, title:e.target.value}))}
                    placeholder="Ex. “Premier baiser sous la pluie”"
                    style={{width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                  />
                </label>
              </div>

              <div style={{display:'grid', gap:6, marginTop:10}}>
                <label>
                  <span>Message</span>
                  <textarea value={form.message} onChange={e=>setForm(f=>({...f, message:e.target.value}))} rows={3}
                    placeholder={isGift ? '“Pour la minute de notre rencontre…”' : '“La minute où tout a commencé.”'}
                    style={{width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                  />
                </label>
              </div>

            </div>

            {/* ✅ Couleur de la police */}
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
                  <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', padding:'0 10px', color:mainColor, fontSize:12}}>“Owned by — 11:11 — 2024-12-31 UTC”</div>
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

            {/* Step 2 — Minute */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>ÉTAPE 2 — VOTRE MINUTE</div>

              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
                <button type="button" onClick={()=>setPickMode('local')} aria-pressed={pickMode==='local'}
                  style={{padding:'8px 10px', borderRadius:10, cursor:'pointer', border: pickMode==='local' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', background:'transparent', color:'var(--color-text)'}}>Sélection locale (recommandé)</button>
                <button type="button" onClick={()=>setPickMode('utc')} aria-pressed={pickMode==='utc'}
                  style={{padding:'8px 10px', borderRadius:10, cursor:'pointer', border: pickMode==='utc' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', background:'transparent', color:'var(--color-text)'}}>Saisie UTC</button>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8}}>
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
                <label style={{display:'grid', gap:6}}>
                  <span>Heure</span>
                  <select value={h} onChange={e=>setH(parseInt(e.target.value))}
                    style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                    {range(0,23).map(H=> <option key={H} value={H} style={{color:'#000'}}>{H.toString().padStart(2,'0')}</option>)}
                  </select>
                </label>
                <label style={{display:'grid', gap:6}}>
                  <span>Minute</span>
                  <select value={m} onChange={e=>setMin(parseInt(e.target.value))}
                    style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                    {range(0,59).map(Mi=> <option key={Mi} value={Mi} style={{color:'#000'}}>{Mi.toString().padStart(2,'0')}</option>)}
                  </select>
                </label>
              </div>

              <small style={{opacity:.7, display:'block', marginTop:8}}>
                {pickMode==='local'
                  ? <>Fuseau local détecté : <strong>{tzLabel}</strong>. L’horodatage final est enregistré en <strong>UTC</strong>.</>
                  : <>Mode <strong>UTC</strong> : vos sélections sont interprétées directement en UTC.</>}
              </small>

              <div style={{display:'flex', gap:14, flexWrap:'wrap', marginTop:12, fontSize:14}}>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}><strong>UTC&nbsp;:</strong> {utcReadable || '—'}</div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}><strong>Heure locale&nbsp;:</strong> {localReadableStr || '—'}</div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}><strong>Édition&nbsp;:</strong> {edition ? (edition === 'premium' ? 'Premium' : 'Standard') : '—'}</div>
              </div>

              <div style={{marginTop:12}}>
                <div style={{fontSize:14, color:'var(--color-muted)', marginBottom:8}}>Affichage sur le certificat</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
                  {(['utc','utc+local','local+utc'] as const).map(option => (
                    <label key={option} style={{padding:'8px 10px', borderRadius:10, cursor:'pointer', border: form.time_display===option ? '2px solid var(--color-primary)' : '1px solid var(--color-border)'}}>
                      <input type="radio" name="time_display" value={option}
                        checked={form.time_display===option}
                        onChange={()=>setForm(f=>({...f, time_display: option}))}
                        style={{display:'none'}}/>
                      {{ 'utc':'UTC seulement', 'utc+local':'UTC + local discret', 'local+utc':'Local + UTC discret' }[option]}
                    </label>
                  ))}

                  {(form.time_display==='local+utc' || form.time_display==='utc+local') && (
                    <label style={{marginLeft:6, display:'inline-flex', alignItems:'center', gap:8, fontSize:14}}>
                      <input type="checkbox" checked={form.local_date_only}
                        onChange={e=>setForm(f=>({...f, local_date_only: e.target.checked}))}/>
                      Afficher <em>la date locale seulement</em> (JJ/MM/AAAA)
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3 — Style (Custom ouvre directement le picker, pas de bloc “Importer…”) */}
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
                {status==='loading' ? 'Redirection…' : (isGift ? 'Offrir cette minute' : 'Payer & réserver cette minute')}
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
                key={(form.cert_style==='custom' ? customBg?.url : form.cert_style) || 'none'} // force refresh
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
                const localStr = localReadableStr
                const showLocalFirst = form.time_display === 'local+utc'

                return (
                  <div aria-hidden style={{ position:'absolute', inset:0 }}>
                    {/* zone sûre + contenu remonté */}
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
                        {/* Timestamp principal */}
                        <div style={{ fontWeight:800, fontSize:'min(9vw, 26px)', marginBottom:6 }}>
                          {showLocalFirst
                            ? (localStr ? `${localStr} (${tzLabel})` : 'JJ/MM/AAAA HH:MM (Local)')
                            : (utcReadable || 'YYYY-MM-DD HH:MM UTC')}
                        </div>

                        {form.time_display !== 'utc' && (
                          <div style={{ color:subtleColor, fontSize:'min(3.6vw, 13px)' }}>
                            {showLocalFirst
                              ? (utcReadable || 'YYYY-MM-DD HH:MM UTC')
                              : (localStr ? `${localStr} (${tzLabel})` : '')}
                          </div>
                        )}

                        <div style={{ opacity:.7, color:subtleColor, fontSize:'min(3.4vw, 13px)', marginTop:10 }}>
                          Owned by
                        </div>
                        <div style={{ fontWeight:800, fontSize:'min(6.4vw, 18px)' }}>
                          {form.display_name || (isGift ? 'Nom du·de la destinataire' : 'Votre nom')}
                        </div>

                        {form.title && (
                          <>
                            <div style={{ opacity:.7, color:subtleColor, fontSize:'min(3.4vw, 13px)', marginTop:10 }}>
                              Title
                            </div>
                            <div style={{ fontWeight:800, fontSize:'min(6.0vw, 17px)' }}>{form.title}</div>
                          </>
                        )}

                        {form.message && (
                          <>
                            <div style={{ opacity:.7, color:subtleColor, fontSize:'min(3.4vw, 13px)', marginTop:10 }}>
                              Message
                            </div>
                            <div style={{ marginTop:6, fontStyle:'italic', lineHeight:1.3, fontSize:'min(3.8vw, 13px)' }}>
                              “{form.message}”
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
              Le PDF final est généré côté serveur : texte net, QR code réel, métadonnées signées. Cet aperçu est indicatif (filigrane ajouté).
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
