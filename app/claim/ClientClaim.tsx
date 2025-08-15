// app/claim/ClientClaim.tsx — V2 Ultimate (minute-first, gift-friendly, live preview)
'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type CertStyle =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation'

const STYLES: { id: CertStyle; label: string; hint?: string }[] = [
  { id: 'neutral',    label: 'Neutral',     hint: 'sobre & élégant' },
  { id: 'romantic',   label: 'Romantic',    hint: 'hearts & lace' },
  { id: 'birthday',   label: 'Birthday',    hint: 'balloons & confetti' },
  { id: 'wedding',    label: 'Wedding',     hint: 'rings & botanicals' },
  { id: 'birth',      label: 'Birth',       hint: 'pastel clouds & stars' },
  { id: 'christmas',  label: 'Christmas',   hint: 'pine & snow' },
  { id: 'newyear',    label: 'New Year',    hint: 'fireworks trails' },
  { id: 'graduation', label: 'Graduation',  hint: 'laurel & caps' },
] as const

/** ------- Utils ------- **/
function safeDecode(value: string): string {
  let out = value
  try { for (let i=0;i<3;i++){ const dec=decodeURIComponent(out); if(dec===out) break; out=dec } } catch {}
  return out
}

function isoMinuteString(d: Date) {
  const copy = new Date(d.getTime())
  copy.setUTCSeconds(0,0)
  return copy.toISOString().replace(':00.000Z', ':00Z') // cosmetically shorter
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
      hour:'2-digit', minute:'2-digit',
      hour12:false
    })
  } catch { return '' }
}

/** Quick presets (UTC-based) */
function withTimeUTC(base: Date, hh: number, mm: number) {
  const d = new Date(base.getTime())
  d.setUTCSeconds(0,0)
  d.setUTCHours(hh, mm, 0, 0)
  return d
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
    ? (styleParam as CertStyle)
    : 'neutral'

  const [isGift, setIsGift] = useState<boolean>(initialGift)

  const [form, setForm] = useState({
    email: '',
    display_name: '',
    message: '',
    link_url: '',
    ts: prefillTs,
    cert_style: initialStyle as CertStyle,
  })
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  /** Derived date & strings */
  const parsedDate = useMemo(() => parseToDateOrNull(form.ts), [form.ts])
  const tsISO = useMemo(() => parsedDate ? isoMinuteString(parsedDate) : '', [parsedDate])
  const utcReadable = useMemo(() => parsedDate ? parsedDate.toISOString().replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC') : '', [parsedDate])
  const localReadableStr = useMemo(() => localReadable(parsedDate), [parsedDate])

  /** Edition hint (client-side heuristic for UX only) */
  const edition = useMemo(() => {
    if (!parsedDate) return null
    const y = parsedDate.getUTCFullYear()
    const m = parsedDate.getUTCMonth()
    const d = parsedDate.getUTCDate()
    const h = parsedDate.getUTCHours().toString().padStart(2,'0')
    const mm = parsedDate.getUTCMinutes().toString().padStart(2,'0')
    const time = `${h}:${mm}`
    const isLeap = ((y%4===0 && y%100!==0) || y%400===0) && m===1 && d===29
    const pretty = (time==='11:11' || time==='12:34' || time==='22:22' || (/^([0-9])\1:([0-9])\2$/).test(time))
    return (isLeap || pretty) ? 'premium' : 'standard'
  }, [parsedDate])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')

    const d = parseToDateOrNull(form.ts)
    if (!d) {
      setStatus('error'); setError('Merci de saisir une minute valide (ISO ex. 2100-01-01T00:00Z).'); return
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ts: d.toISOString(), // côté API on tronque aussi à la minute en cas de doute
        email: form.email,
        display_name: form.display_name || undefined, // destinataire si cadeau
        message: form.message || undefined,
        link_url: form.link_url || undefined,
        cert_style: form.cert_style || 'neutral',
        // NOTE: si tu veux exploiter côté backend : ajouter `gift: isGift ? '1' : '0'` dans metadata (et maj de /api/checkout)
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

  /** Quick actions */
  const setNowUTC = () => {
    const now = new Date()
    now.setUTCSeconds(0,0)
    setForm(f => ({ ...f, ts: isoMinuteString(now) }))
  }

  const setPresetUTC = (hh:number, mm:number) => {
    const base = new Date()
    const target = withTimeUTC(base, hh, mm)
    setForm(f => ({ ...f, ts: isoMinuteString(target) }))
  }

  /** Styles */
  const containerStyle: React.CSSProperties = {
    // tokens dark premium (identiques à la landing)
    ['--color-bg' as any]: '#0B0E14',
    ['--color-surface' as any]: '#111726',
    ['--color-text' as any]: '#E6EAF2',
    ['--color-muted' as any]: '#A7B0C0',
    ['--color-primary' as any]: '#E4B73D',
    ['--color-on-primary' as any]: '#0B0E14',
    ['--color-secondary' as any]: '#00D2A8',
    ['--color-accent' as any]: '#8CD6FF',
    ['--color-border' as any]: '#1E2A3C',
    ['--shadow-elev1' as any]: '0 6px 20px rgba(0,0,0,.35)',
    ['--shadow-elev2' as any]: '0 12px 36px rgba(0,0,0,.45)',
    background:'var(--color-bg)', color:'var(--color-text)', minHeight:'100vh'
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
                Étape 1 — Informations
              </div>

              <label style={{display:'grid', gap:6, marginBottom:10}}>
                <span>{isGift ? 'Votre e-mail (reçu & certificat)' : 'E-mail (reçu & certificat)'}</span>
                <input
                  required type="email" value={form.email}
                  onChange={e=>setForm(f=>({...f, email:e.target.value}))}
                  placeholder={isGift ? 'vous@exemple.com' : 'vous@exemple.com'}
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

            {/* Step 2 — Choix de la minute (UTC + local) */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                Étape 2 — Votre minute
              </div>

              <label style={{display:'grid', gap:6}}>
                <span>Horodatage <strong>UTC</strong> (ISO, ex. <code>2100-01-01T00:00Z</code>)</span>
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

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
                <label style={{display:'grid', gap:6}}>
                  <span>Ou sélectionnez en local (arrondi à la minute)</span>
                  <input
                    type="datetime-local" step={60}
                    onChange={e=>setForm(f=>({...f, ts:e.target.value}))}
                    style={{
                      padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10,
                      background:'transparent', color:'var(--color-text)'
                    }}
                  />
                </label>
                <div>
                  <div style={{fontSize:14, color:'var(--color-muted)', marginBottom:6}}>Raccourcis</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                    <button type="button" onClick={setNowUTC}
                      style={{border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'8px 10px', borderRadius:10, cursor:'pointer'}}>Maintenant (UTC)</button>
                    <button type="button" onClick={()=>setPresetUTC(11,11)}
                      style={{border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'8px 10px', borderRadius:10, cursor:'pointer'}}>11:11 (UTC)</button>
                    <button type="button" onClick={()=>setPresetUTC(12,34)}
                      style={{border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'8px 10px', borderRadius:10, cursor:'pointer'}}>12:34 (UTC)</button>
                    <button type="button" onClick={()=>setPresetUTC(0,0)}
                      style={{border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'8px 10px', borderRadius:10, cursor:'pointer'}}>00:00 (Nouvel An UTC)</button>
                  </div>
                </div>
              </div>

              {/* Readouts */}
              <div style={{display:'flex', gap:14, flexWrap:'wrap', marginTop:10, fontSize:14}}>
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
            </div>

            {/* Step 3 — Style du certificat */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                Étape 3 — Style du certificat
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
                {status==='loading' ? (isGift ? 'Redirection…' : 'Redirection…')
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
            {/* Fond affiché depuis /public/cert_bg */}
            <div style={{position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid var(--color-border)'}}>
              <img
                src={`/cert_bg/${form.cert_style}.png`}
                alt={`Aperçu fond certificat — ${form.cert_style}`}
                width={840} height={1188}
                style={{width:'100%', height:'auto', display:'block', background:'#0E1017'}}
              />

              {/* Overlay de lecture — ne remplace pas le vrai PDF, juste pour se projeter */}
              <div style={{
                position:'absolute', inset:0, display:'grid',
                gridTemplateRows:'auto 1fr auto', padding:'6% 8%'
              }}>
                {/* En-tête en haut */}
                <div style={{textAlign:'left'}}>
                  <div style={{fontWeight:900, fontSize:'min(3.8vw, 20px)'}}>Parcels of Time</div>
                  <div style={{opacity:.9, fontSize:'min(3.2vw, 14px)'}}>Certificate of Claim</div>
                </div>

                {/* Zone centrale */}
                <div style={{display:'grid', placeItems:'center', textAlign:'center'}}>
                  <div style={{maxWidth:520}}>
                    <div style={{fontWeight:800, fontSize:'min(9vw, 26px)', marginBottom:6}}>
                      {utcReadable || 'YYYY-MM-DD HH:MM UTC'}
                    </div>
                    <div style={{opacity:.7, fontSize:'min(3.4vw, 13px)'}}>Owned by</div>
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

                {/* Footer placeholder (QR + meta) */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontSize:'min(3.2vw, 12px)', opacity:.8}}>
                    Certificate ID • Integrity hash (aperçu)
                  </div>
                  <div style={{
                    width:'min(16vw, 92px)', height:'min(16vw, 92px)',
                    border:'1px dashed rgba(255,255,255,.35)', borderRadius:8,
                    display:'grid', placeItems:'center', fontSize:'min(6vw, 12px)', opacity:.8
                  }}>
                    QR
                  </div>
                </div>
              </div>
            </div>

            <div style={{marginTop:10, fontSize:12, color:'var(--color-muted)'}}>
              Le PDF final est généré côté serveur : texte net, QR code réel, métadonnées signées.  
              Cet aperçu est indicatif (mise en page similaire).
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
