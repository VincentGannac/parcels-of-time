// app/claim/ClientClaim.tsx — V2 Ultimate (minute-first, gift-friendly, local picker, watermark)
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
  { id: 'custom',     label: 'Custom',      hint: 'Importer image 2480×3508 (A4) ou 1024×1536' },
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
  custom:{ top:16.6, right:16.1, bottom:18.5, left:16.1 }
}
const A4_RATIO = 2480 / 3508;        // ≈ 0.707
const RATIO_2x3 = 1024 / 1536;       // ≈ 0.666 (a.k.a. 3:2 portrait / 2:3)
const RATIO_TOL = 0.01;              // 1% de tolérance
const ALLOWED_EXACT_SIZES = [
  { w: 2480, h: 3508, label: 'A4' },
  { w: 1024, h: 1536, label: '1024×1536' },
];

/** ------- Utils ------- **/
function safeDecode(value: string): string {
  let out = value
  try { for (let i=0;i<3;i++){ const dec=decodeURIComponent(out); if(dec===out) break; out=dec } } catch {}
  return out
}

function isoMinuteString(d: Date) {
  const copy = new Date(d.getTime())
  copy.setUTCSeconds(0,0)
  return copy.toISOString()
}

function parseToDateOrNull(input: string): Date | null {
  const s = (input || '').trim()
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  d.setUTCSeconds(0,0)
  return d
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

function daysInMonth(y:number, m:number) {
  return new Date(y, m, 0).getDate() // m: 1..12
}

const MONTHS_FR = ['01 — Jan','02 — Fév','03 — Mar','04 — Avr','05 — Mai','06 — Juin','07 — Juil','08 — Août','09 — Sep','10 — Oct','11 — Nov','12 — Déc']

/** Build range helpers */
const range = (a:number, b:number) => Array.from({length:b-a+1},(_,i)=>a+i)

export default function ClientClaim() {
  const params = useSearchParams()
  const prefillRaw = params.get('ts') || ''
  const prefillTs = prefillRaw ? safeDecode(prefillRaw) : ''
  const styleParam = (params.get('style') || '').toLowerCase()
  const giftParam = params.get('gift')
  const initialGift = giftParam === '1' || giftParam === 'true'

  const allowed = STYLES.map(s => s.id)
  const initialStyle: CertStyle = (allowed as readonly string[]).includes(styleParam as CertStyle)
    ? (styleParam as CertStyle)
    : 'neutral'

  const [isGift, setIsGift] = useState<boolean>(initialGift)

  /** Sélecteur de date “local” (ergonomique) */
  // valeurs initiales = maintenant, ou préremplissage
  const now = new Date()
  const prefillDate = parseToDateOrNull(prefillTs) || now
  const [pickMode, setPickMode] = useState<'local'|'iso'>(prefillTs ? 'iso' : 'local')
  const [Y, setY]   = useState<number>(prefillDate.getFullYear())
  const [M, setM]   = useState<number>(prefillDate.getMonth()+1) // 1-12
  const [D, setD]   = useState<number>(prefillDate.getDate())    // 1-31
  const [h, setH]   = useState<number>(prefillDate.getHours())
  const [m, setMin] = useState<number>(prefillDate.getMinutes())

  // clamp day when month/year changes
  useEffect(()=>{
    const dim = daysInMonth(Y,M)
    if (D>dim) setD(dim)
  }, [Y,M]) // eslint-disable-line

  // maj form.ts quand on change le sélecteur local
  useEffect(()=>{
    if (pickMode!=='local') return
    const local = new Date(Y, M-1, D, h, m, 0, 0) // local time
    setForm(f=>({ ...f, ts: isoMinuteString(local) }))
  }, [pickMode, Y,M,D,h,m]) // eslint-disable-line

  /** Form principal */
  const [form, setForm] = useState({
    email: '',
    display_name: '',
    title: '',            
    message: '',
    link_url: '',
    ts: prefillTs,
    cert_style: initialStyle as CertStyle,
    time_display: 'utc' as 'utc'|'utc+local'|'local+utc', // nouvel affichage
  })
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  /** Derived date & strings */
  const parsedDate = useMemo(() => parseToDateOrNull(form.ts), [form.ts])
  const tsISO = useMemo(() => parsedDate ? isoMinuteString(parsedDate) : '', [parsedDate])
  const utcReadable = useMemo(() => parsedDate ? parsedDate.toISOString().replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC') : '', [parsedDate])
  const localReadableStr = useMemo(() => localReadable(parsedDate), [parsedDate])
  const tzLabel = useMemo(()=> {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local' } catch { return 'Local' }
  }, [])

  /** Edition hint (UX only) */
  const edition = useMemo(() => {
    if (!parsedDate) return null
    const y = parsedDate.getUTCFullYear()
    const mm = parsedDate.getUTCMonth()
    const dd = parsedDate.getUTCDate()
    const H = parsedDate.getUTCHours().toString().padStart(2,'0')
    const Mi = parsedDate.getUTCMinutes().toString().padStart(2,'0')
    const t = `${H}:${Mi}`
    const isLeap = ((y%4===0 && y%100!==0) || y%400===0) && mm===1 && dd===29
    const pretty = (t==='11:11' || t==='12:34' || t==='22:22' || (/^([0-9])\1:([0-9])\2$/).test(t))
    return (isLeap || pretty) ? 'premium' : 'standard'
  }, [parsedDate])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')

    const d = parseToDateOrNull(form.ts)
    if (!d) {
      setStatus('error'); setError('Merci de saisir une minute valide (ISO ex. 2100-01-01T00:00Z).'); return
    }

    const payload:any = {
      ts: d.toISOString(),
      email: form.email,
      display_name: form.display_name || undefined,
      title: form.title || undefined,
      message: form.message || undefined,
      link_url: form.link_url || undefined,
      cert_style: form.cert_style || 'neutral',
      time_display: form.time_display,
      gift: isGift ? '1' : '0',
    }
    if (form.cert_style === 'custom' && customBg?.dataUrl) {
      payload.custom_bg_data_url = customBg.dataUrl
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ts: d.toISOString(),
        email: form.email,
        display_name: form.display_name || undefined,
        title: form.title || undefined,    
        message: form.message || undefined,
        link_url: form.link_url || undefined,
        cert_style: form.cert_style || 'neutral',
        time_display: form.time_display,         // pass-through (coté back : stocker en metadata si souhaité)
        gift: isGift ? '1' : '0',                // idem
        body: JSON.stringify(payload),
      }),
    })

    if (!res.ok) {
      setStatus('error')
      let msg = 'Unknown error'
      try {
        const j = await res.json()
        if (j.error === 'rate_limited') msg = 'Trop de tentatives. Réessaye dans ~1 minute.'
        else if (j.error === 'invalid_ts') msg = 'Horodatage invalide. Utilise un ISO comme 2100-01-01T00:00Z.'
        else if (j.error === 'missing_fields') msg = 'Renseigne au minimum l’email et l’horodatage à la minute.'
        else msg = j.error || msg
      } catch {}
      setError(msg); return
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

  /** Texte d’aperçu : noir doux pour être lisible sur papier clair même en dark UI */
  const previewTextColor = 'rgba(26, 31, 42, 0.92)'  // #1A1F2A avec légère transparence
  const previewSubtle = 'rgba(26, 31, 42, 0.70)'

  // si l’utilisateur tape une ISO manuelle, basculer en mode ISO
  useEffect(()=>{
    if (prefillTs) setForm(f=>({...f, ts: prefillTs}))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [customBg, setCustomBg] = useState<{
    url: string;        // object URL pour l’aperçu
    dataUrl: string;    // data:URL base64 pour le backend
    w: number; h: number;
  } | null>(null)
  const [customErr, setCustomErr] = useState<string>('')

  async function fileToDataUrl(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.onerror = rej
      r.readAsDataURL(f)
    })
  }
  
  async function onPickCustomBg(file?: File | null) {
    setCustomErr('')
    if (!file) { setCustomBg(null); return }
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setCustomErr('Format invalide. Utilisez PNG ou JPG.'); return
    }
    const dataUrl = await fileToDataUrl(file)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight
      const ratio = w / h
      const okExact = ALLOWED_EXACT_SIZES.some(s => s.w === w && s.h === h)
      const okRatio =
      Math.abs(ratio - A4_RATIO)   < RATIO_TOL ||
      Math.abs(ratio - RATIO_2x3)  < RATIO_TOL
    if (!okExact && !okRatio) {
      setCustomErr('Dimensions non supportées. Utilisez 2480×3508 (A4), 1024×1536, ou un ratio proche.')
    }
      const url = URL.createObjectURL(file)
      setCustomBg({ url, dataUrl, w, h })
    }
    img.onerror = () => setCustomErr('Impossible de lire l’image.')
    img.src = dataUrl
  }

  
  return (
    <main style={containerStyle}>
      <section style={{maxWidth:1200, margin:'0 auto', padding:'48px 24px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
          <a href="/" style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; Parcels of Time</a>
          <div style={{fontSize:12, color:'var(--color-muted)'}}>Paiement sécurisé <strong>Stripe</strong></div>
        </div>

        <header style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:16, marginBottom:14}}>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:0}}>
            {isGift ? 'Offrir une minute' : 'Réserver votre minute'}
          </h1>
          <button
            onClick={()=>setIsGift(v=>!v)}
            style={{
              background:'var(--color-surface)', color:'var(--color-text)', border:'1px solid var(--color-border)',
              padding:'8px 12px', borderRadius:10, cursor:'pointer'
            }}
            aria-pressed={isGift}
          >
            {isGift ? '🎁 Mode cadeau activé' : '🎁 Activer le mode cadeau'}
          </button>
        </header>

        <div style={{display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:18, alignItems:'start'}}>
          {/* ---------- FORM COLUMN ---------- */}
          <form onSubmit={onSubmit} style={{display:'grid', gap:14}}>
            {/* Step 1 — Email + identités */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                ÉTAPE 1 — INFORMATIONS
              </div>

              <label style={{display:'grid', gap:6, marginBottom:10}}>
                <span>{isGift ? 'Votre e-mail (reçu & certificat)' : 'E-mail (reçu & certificat)'}</span>
                <input
                  required type="email" value={form.email}
                  onChange={e=>setForm(f=>({...f, email:e.target.value}))}
                  placeholder="vous@exemple.com"
                  style={{
                    padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10,
                    background:'transparent', color:'var(--color-text)'
                  }}
                />
              </label>

              <label style={{display:'grid', gap:6}}>
                <span>{isGift ? 'Nom du·de la destinataire (public sur le certificat)' : 'Nom affiché (public sur le certificat)'}</span>
                <input
                  type="text" value={form.display_name}
                  onChange={e=>setForm(f=>({...f, display_name:e.target.value}))}
                  placeholder={isGift ? 'Ex. “Camille & Jonas”' : 'Ex. “Camille D.”'}
                  style={{
                    padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10,
                    background:'transparent', color:'var(--color-text)'
                  }}
                />
              </label>

              <label style={{display:'grid', gap:6, marginTop:10}}>
                <span>Titre (optionnel) — affiché sur le certificat</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={e=>setForm(f=>({...f, title:e.target.value}))}
                  placeholder="Ex. “Premier baiser sous la pluie”"
                  style={{
                    padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10,
                    background:'transparent', color:'var(--color-text)'
                  }}
                />
              </label>


              <label style={{display:'grid', gap:6, marginTop:10}}>
                <span>Message (optionnel)</span>
                <textarea
                  value={form.message}
                  onChange={e=>setForm(f=>({...f, message:e.target.value}))}
                  rows={3}
                  placeholder={isGift ? '“Pour la minute de notre rencontre…”' : '“La minute où tout a commencé.”'}
                  style={{
                    padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10,
                    background:'transparent', color:'var(--color-text)'
                  }}
                />
                <small style={{opacity:.6}}>Contenu modéré. Restez bienveillant(e) ❤️</small>
              </label>

              <details style={{marginTop:10}}>
                <summary style={{cursor:'pointer'}}>Lien (optionnel)</summary>
                <div style={{marginTop:8}}>
                  <input
                    type="url"
                    value={form.link_url}
                    onChange={e=>setForm(f=>({...f, link_url:e.target.value}))}
                    placeholder="https://votre-lien.exemple"
                    style={{
                      width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10,
                      background:'transparent', color:'var(--color-text)'
                    }}
                  />
                  <small style={{opacity:.6}}>Le lien peut pointer vers une vidéo, une galerie, un site…</small>
                </div>
              </details>
            </div>

            {/* Step 2 — Choix de la minute (sélecteur local ergonomique) */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                ÉTAPE 2 — VOTRE MINUTE
              </div>

              {/* mode de sélection */}
              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
                <button type="button"
                        onClick={()=>setPickMode('local')}
                        aria-pressed={pickMode==='local'}
                        style={{
                          padding:'8px 10px', borderRadius:10, cursor:'pointer',
                          border: pickMode==='local' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background:'transparent', color:'var(--color-text)'
                        }}>
                  Sélection locale (recommandé)
                </button>
                <button type="button"
                        onClick={()=>setPickMode('iso')}
                        aria-pressed={pickMode==='iso'}
                        style={{
                          padding:'8px 10px', borderRadius:10, cursor:'pointer',
                          border: pickMode==='iso' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background:'transparent', color:'var(--color-text)'
                        }}>
                  Saisie ISO UTC avancée
                </button>
              </div>

              {/* LOCAL PICKER */}
              {pickMode==='local' && (
                <div style={{display:'grid', gap:12}}>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8}}>
                    {/* Année */}
                    <label style={{display:'grid', gap:6}}>
                      <span>Année</span>
                      <select value={Y} onChange={e=>setY(parseInt(e.target.value))}
                              style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                        {range(1900, 2100).map(y=> <option key={y} value={y} style={{color:'#000'}}>{y}</option>)}
                      </select>
                    </label>
                    {/* Mois */}
                    <label style={{display:'grid', gap:6}}>
                      <span>Mois</span>
                      <select value={M} onChange={e=>setM(parseInt(e.target.value))}
                              style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                        {MONTHS_FR.map((txt,idx)=> <option key={idx} value={idx+1} style={{color:'#000'}}>{txt}</option>)}
                      </select>
                    </label>
                    {/* Jour */}
                    <label style={{display:'grid', gap:6}}>
                      <span>Jour</span>
                      <select value={D} onChange={e=>setD(parseInt(e.target.value))}
                              style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                        {range(1, daysInMonth(Y,M)).map(d=> <option key={d} value={d} style={{color:'#000'}}>{d.toString().padStart(2,'0')}</option>)}
                      </select>
                    </label>
                    {/* Heure */}
                    <label style={{display:'grid', gap:6}}>
                      <span>Heure</span>
                      <select value={h} onChange={e=>setH(parseInt(e.target.value))}
                              style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                        {range(0,23).map(H=> <option key={H} value={H} style={{color:'#000'}}>{H.toString().padStart(2,'0')}</option>)}
                      </select>
                    </label>
                    {/* Minute */}
                    <label style={{display:'grid', gap:6}}>
                      <span>Minute</span>
                      <select value={m} onChange={e=>setMin(parseInt(e.target.value))}
                              style={{padding:'12px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}>
                        {range(0,59).map(Mi=> <option key={Mi} value={Mi} style={{color:'#000'}}>{Mi.toString().padStart(2,'0')}</option>)}
                      </select>
                    </label>
                  </div>
                  <small style={{opacity:.7}}>Fuseau local détecté : <strong>{tzLabel}</strong>. L’horodatage final est enregistré en <strong>UTC</strong>.</small>
                </div>
              )}

              {/* ISO INPUT */}
              {pickMode==='iso' && (
                <label style={{display:'grid', gap:6}}>
                  <span>Horodatage <strong>UTC</strong> (ISO — ex. <code>2100-01-01T00:00Z</code>)</span>
                  <input
                    placeholder="2100-01-01T00:00Z"
                    type="text" value={form.ts}
                    onChange={e=>setForm(f=>({...f, ts:e.target.value}))}
                    style={{
                      padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10,
                      background:'transparent', color:'var(--color-text)'
                    }}
                  />
                </label>
              )}

              {/* Readouts */}
              <div style={{display:'flex', gap:14, flexWrap:'wrap', marginTop:12, fontSize:14}}>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}>
                  <strong>UTC&nbsp;:</strong> {utcReadable || '—'}
                </div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}>
                  <strong>Heure locale&nbsp;:</strong> {localReadableStr || '—'}
                </div>
                <div style={{padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:8}}>
                  <strong>Édition&nbsp;:</strong> {edition ? (edition === 'premium' ? 'Premium' : 'Standard') : '—'}
                </div>
              </div>

              {/* Affichage sur le certificat */}
              <div style={{marginTop:12}}>
                <div style={{fontSize:14, color:'var(--color-muted)', marginBottom:8}}>Affichage sur le certificat</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {(['utc','utc+local','local+utc'] as const).map(option => (
                    <label key={option} style={{
                      padding:'8px 10px', borderRadius:10, cursor:'pointer',
                      border: form.time_display===option ? '2px solid var(--color-primary)' : '1px solid var(--color-border)'
                    }}>
                      <input type="radio" name="time_display" value={option}
                             checked={form.time_display===option}
                             onChange={()=>setForm(f=>({...f, time_display: option}))}
                             style={{display:'none'}}/>
                      {{
                        'utc':'UTC seulement',
                        'utc+local':'UTC + local discret',
                        'local+utc':'Local + UTC discret'
                      }[option]}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3 — Style du certificat */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                ÉTAPE 3 — STYLE DU CERTIFICAT
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
                {STYLES.map(s => {
                  const selected = form.cert_style === s.id
                  const thumb = `/cert_bg/${s.id}_thumb.jpg`
                  const full = `/cert_bg/${s.id}.png`
                  return (
                    <label key={s.id}
                      style={{
                        cursor:'pointer',
                        border:selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        borderRadius:16, background:'var(--color-surface)', padding:12, display:'grid', gap:8,
                        boxShadow: selected ? 'var(--shadow-elev1)' : undefined
                      }}>
                      <input
                        type="radio" name="cert_style" value={s.id}
                        checked={selected}
                        onChange={()=>setForm(f=>({...f, cert_style:s.id}))}
                        style={{display:'none'}}
                      />
                      <div
                        style={{
                          height:110, borderRadius:12, border:'1px solid var(--color-border)',
                          backgroundImage:`url(${thumb}), url(${full})`,
                          backgroundSize:'cover', backgroundPosition:'center', backgroundColor:'#0E1017'
                        }}
                        aria-hidden
                      />
                      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                        <div>
                          <div style={{fontWeight:700}}>{s.label}</div>
                          {s.hint && <div style={{opacity:.6, fontSize:12}}>{s.hint}</div>}
                        </div>
                        <span aria-hidden="true" style={{
                          width:10, height:10, borderRadius:99,
                          background:selected ? 'var(--color-primary)' : 'var(--color-border)'
                        }} />
                      </div>
                    </label>
                  )
                })}
              </div>

              {form.cert_style === 'custom' && (
                <div style={{marginTop:12, padding:12, border:'1px dashed var(--color-border)', borderRadius:12}}>
                  <label style={{display:'grid', gap:8}}>
                    <span><strong>Importer votre fond (A4 portrait)</strong> — PNG/JPG 2480×3508 px recommandé</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e)=>onPickCustomBg(e.currentTarget.files?.[0] || null)}
                    />
                  </label>
                  {!!customErr && <p style={{color:'#ff8a8a', marginTop:8}}>{customErr}</p>}
                  {customBg && (
                    <p style={{opacity:.7, fontSize:12, marginTop:8}}>
                      Image chargée : {customBg.w}×{customBg.h}px
                    </p>
                  )}
                </div>
              )}

              <p style={{margin:'10px 2px 0', fontSize:12, opacity:.7}}>
                Les vignettes utilisent <code>/public/cert_bg/&lt;style&gt;_thumb.jpg</code> (fallback sur <code>&lt;style&gt;.png</code>).
              </p>
            </div>

            {/* Submit */}
            <div>
              <button
                disabled={status==='loading'}
                type="submit"
                style={{
                  background:'var(--color-primary)', color:'var(--color-on-primary)',
                  padding:'14px 18px', borderRadius:12, fontWeight:800, border:'none',
                  boxShadow: status==='loading' ? '0 0 0 6px rgba(228,183,61,.12)' : 'none',
                  cursor: status==='loading' ? 'progress' : 'pointer'
                }}
              >
                {status==='loading' ? 'Redirection…'
                  : (isGift ? 'Offrir cette minute' : 'Payer & réserver cette minute')}
              </button>
              {status==='error' && error && <p style={{color:'#ff8a8a', marginTop:8}}>{error}</p>}

              <p style={{marginTop:8, fontSize:12, color:'var(--color-muted)'}}>
                Contenu numérique livré immédiatement : vous demandez l’exécution immédiate et <strong>renoncez</strong> au droit de rétractation (UE).
              </p>
            </div>
          </form>

          {/* ---------- PREVIEW COLUMN ---------- */}
          <aside aria-label="Aperçu du certificat"
            style={{
              position:'sticky', top:24,
              background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:12,
              boxShadow:'var(--shadow-elev1)'
            }}
          >
            <div style={{position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid var(--color-border)'}}>
            <img
              src={form.cert_style==='custom' ? (customBg?.url || '/cert_bg/neutral.png')
                                              : `/cert_bg/${form.cert_style}.png`}
              alt={`Aperçu fond certificat — ${form.cert_style}`}
              width={840} height={1188}
              style={{width:'100%', height:'auto', display:'block', background:'#0E1017'}}
            />

              {/* Filigrane */}
              <div aria-hidden
                style={{
                  position:'absolute', inset:0, pointerEvents:'none',
                  display:'grid', placeItems:'center', transform:'rotate(-22deg)',
                  opacity:.14, mixBlendMode:'multiply'
                }}>
                <div style={{fontWeight:900, fontSize:'min(18vw, 120px)', letterSpacing:2, color:'#1a1f2a'}}>
                  PARCELS OF TIME — PREVIEW
                </div>
              </div>

              {/* Overlay : contenu dans la safe-area */}
              {(() => {
                const ins = SAFE_INSETS_PCT[form.cert_style]
                const EDGE_PX = 12 // marge visuelle contre le bord de la page (preview)
                return (
                  <>
                    <div style={{
                      position:'absolute',
                      top:`${ins.top}%`, right:`${ins.right}%`, bottom:`${ins.bottom}%`, left:`${ins.left}%`,
                      display:'grid', gridTemplateRows:'auto 1fr', color:previewTextColor, textAlign:'center'
                    }}>
                      {/* En-tête */}
                      <div style={{textAlign:'left'}}>
                        <div style={{fontWeight:900, fontSize:'min(3.8vw, 20px)'}}>Parcels of Time</div>
                        <div style={{opacity:.9, fontSize:'min(3.2vw, 14px)'}}>Certificate of Claim</div>
                      </div>

                      {/* Zone centrale */}
                      <div style={{display:'grid', placeItems:'center'}}>
                        <div style={{maxWidth:520}}>
                          {/* Horodatage */}
                          {form.time_display === 'utc' && (
                            <div style={{fontWeight:800, fontSize:'min(9vw, 26px)', marginBottom:6}}>
                              {utcReadable || 'YYYY-MM-DD HH:MM UTC'}
                            </div>
                          )}
                          {form.time_display === 'utc+local' && (
                            <>
                              <div style={{fontWeight:800, fontSize:'min(9vw, 26px)'}}>
                                {utcReadable || 'YYYY-MM-DD HH:MM UTC'}
                              </div>
                              <div style={{color:previewSubtle, fontSize:'min(3.6vw, 13px)', marginTop:4}}>
                                {localReadableStr ? `${localReadableStr} (${tzLabel})` : ''}
                              </div>
                            </>
                          )}
                          {form.time_display === 'local+utc' && (
                            <>
                              <div style={{fontWeight:800, fontSize:'min(9vw, 26px)'}}>
                                {localReadableStr ? `${localReadableStr} (${tzLabel})` : 'JJ/MM/AAAA HH:MM (Local)'}
                              </div>
                              <div style={{color:previewSubtle, fontSize:'min(3.6vw, 13px)', marginTop:4}}>
                                {utcReadable || 'YYYY-MM-DD HH:MM UTC'}
                              </div>
                            </>
                          )}

                          {/* Title */}
                          {form.title && (
                            <>
                              <div style={{opacity:.7, fontSize:'min(3.4vw, 13px)', marginTop:8}}>Title</div>
                              <div style={{fontWeight:800, fontSize:'min(6.4vw, 18px)'}}>{form.title}</div>
                            </>
                          )}

                          <div style={{opacity:.7, fontSize:'min(3.4vw, 13px)', marginTop:10}}>Owned by</div>
                          <div style={{fontWeight:800, fontSize:'min(6.4vw, 18px)'}}>
                            {form.display_name || (isGift ? 'Nom du·de la destinataire' : 'Votre nom')}
                          </div>

                          {form.message && (
                            <div style={{marginTop:10, fontStyle:'italic', lineHeight:1.3, fontSize:'min(3.8vw, 13px)'}}>
                              “{form.message}”
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ⬇️ Pied de page ANCRÉ AUX BORDS DE LA PAGE (et non à la safe-area) */}
                    <div
                    style={{
                      position:'absolute',
                      left: EDGE_PX,
                      bottom: EDGE_PX,
                      fontSize:'min(3.2vw,12px)',
                      color: previewSubtle,
                      textAlign:'left',
                      pointerEvents:'none'
                    }}
                  >
                    Certificate ID • Integrity hash (aperçu)
                  </div>
                    <div style={{
                    position:'absolute',
                    right: EDGE_PX,
                    bottom: EDGE_PX,
                    width:'min(18vw,110px)',
                    height:'min(18vw,110px)',
                    border:'1px dashed rgba(26,31,42,.45)',
                    borderRadius:8,
                    display:'grid',
                    placeItems:'center',
                    fontSize:'min(6vw,12px)',
                    opacity:.85,
                    pointerEvents:'none'
                  }}>
                      QR
                    </div>
                  </>
                )
              })()}
            </div>

            <div style={{marginTop:10, fontSize:12, color:'var(--color-muted)'}}>
              Le PDF final est généré côté serveur : texte net, QR code réel, métadonnées signées.
              Cet aperçu est indicatif (filigrane ajouté).
            </div>
          </aside>

        </div>
      </section>
    </main>
  )
}