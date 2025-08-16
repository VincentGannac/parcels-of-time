'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import HeroSlideshow from './HeroSlideshow'
import { useLocaleHref } from './useLocaleHref'
import { useT } from '../i18n/I18nProvider'

/* -------------------- Tokens -------------------- */
const TOKENS_DARK = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-secondary': '#00D2A8',
  '--color-accent': '#8CD6FF',
  '--color-border': '#1E2A3C',
  '--shadow-elev1': '0 6px 20px rgba(0,0,0,.35)',
  '--shadow-elev2': '0 12px 36px rgba(0,0,0,.45)',
  '--shadow-glow': '0 0 0 6px rgba(228,183,61,.12)',
} as const
const TOKENS_LIGHT = {
  '--color-bg': '#FAFAF7',
  '--color-surface': '#FFFFFF',
  '--color-text': '#1D2433',
  '--color-muted': '#4B5565',
  '--color-primary': '#1C2B6B',
  '--color-on-primary': '#FFFFFF',
  '--color-secondary': '#4A8FFF',
  '--color-accent': '#D4AF37',
  '--color-border': '#E6E6EA',
  '--shadow-elev1': '0 6px 20px rgba(10,14,30,.08)',
  '--shadow-elev2': '0 12px 36px rgba(10,14,30,.12)',
  '--shadow-glow': '0 0 0 6px rgba(28,43,107,.12)',
} as const

function applyTheme(vars: Record<string, string>) {
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

/* -------------------- UI atoms -------------------- */
function Button({
  href, children, variant='primary', ariaLabel,
}: { href: string; children: React.ReactNode; variant?: 'primary'|'secondary'|'ghost'; ariaLabel?: string }) {
  const base: React.CSSProperties = {
    textDecoration:'none', fontWeight:700, borderRadius:12, padding:'14px 18px',
    display:'inline-flex', alignItems:'center', gap:10, outline:'none',
    border:'1px solid var(--color-border)',
    boxShadow:'none', transition:'transform .16s ease, box-shadow .16s ease, background .16s ease',
  }
  const styles: Record<'primary'|'secondary'|'ghost', React.CSSProperties> = {
    primary: { ...base, background:'var(--color-primary)', color:'var(--color-on-primary)', borderColor:'transparent' },
    secondary: { ...base, background:'var(--color-surface)', color:'var(--color-text)' },
    ghost: { ...base, background:'transparent', color:'var(--color-text)' },
  }
  return (
    <Link href={href} aria-label={ariaLabel}
      style={{ ...styles[variant] }}
      onMouseEnter={(e)=>{(e.currentTarget as any).style.boxShadow='var(--shadow-glow)'}}
      onMouseLeave={(e)=>{(e.currentTarget as any).style.boxShadow='none'}}
      onMouseDown={(e)=>{(e.currentTarget as any).style.transform='translateY(1px)'}}
      onMouseUp={(e)=>{(e.currentTarget as any).style.transform='translateY(0)'}}
    >
      {children}
    </Link>
  )
}

function SectionLabel(props: React.HTMLAttributes<HTMLDivElement>) {
  const { children, style, ...rest } = props
  return (
    <div {...rest} style={{ fontSize:14, letterSpacing:1, textTransform:'uppercase', color:'var(--color-muted)', marginBottom:8, ...(style||{}) }}>
      {children}
    </div>
  )
}

/* -------------------- Header -------------------- */
function Header({onToggleTheme, href}:{onToggleTheme:()=>void; href:(p:string)=>string}) {
  const { t } = useT()
  return (
    <header style={{
      position:'sticky', top:0, zIndex:40,
      background:'color-mix(in srgb, var(--color-bg) 86%, transparent)',
      backdropFilter:'saturate(120%) blur(10px)',
      borderBottom:'1px solid var(--color-border)'
    }}>
      <nav style={{
        maxWidth:1280, margin:'0 auto', padding:'12px 20px',
        display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:16
      }}>
        <Link href={href('/')} style={{display:'inline-flex', alignItems:'center', gap:10, textDecoration:'none', color:'var(--color-text)'}}>
          <img src="/logo.svg" alt="Parcels of Time" width={28} height={28} />
          <strong style={{fontFamily:'Fraunces, serif', fontWeight:700}}>Parcels of Time</strong>
        </Link>

        <ul aria-label="Navigation" style={{ display:'flex', gap:18, listStyle:'none', justifyContent:'center', margin:0, padding:0, color:'var(--color-text)' }}>
          <li><a href="#pourquoi" style={{textDecoration:'none', color:'inherit'}}>{t('nav.why')}</a></li>
          <li><a href="#comment"  style={{textDecoration:'none', color:'inherit'}}>{t('nav.how')}</a></li>
          <li><a href="#prix"     style={{textDecoration:'none', color:'inherit'}}>{t('nav.pricing')}</a></li>
          <li><a href="#iconiques"style={{textDecoration:'none', color:'inherit'}}>{t('nav.rare')}</a></li>
          <li><Link href={href('/claim?gift=1')} style={{textDecoration:'none', color:'inherit'}}>{t('nav.gift')}</Link></li>
          <li><a href="#faq"      style={{textDecoration:'none', color:'inherit'}}>{t('nav.faq')}</a></li>
        </ul>

        <div style={{display:'flex', gap:10, justifyContent:'flex-end', alignItems:'center'}}>
          <Button href={href('/claim?gift=1')} variant="secondary" ariaLabel={t('cta.gift')}>{t('cta.gift')}</Button>
          <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>{t('cta.claim')}</Button>
          <button aria-label="Toggle theme" onClick={onToggleTheme}
                  style={{marginLeft:6, padding:10, borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)'}}>
            ☀︎/☾
          </button>
        </div>
      </nav>
    </header>
  )
}

/* -------------------- Live UTC minute -------------------- */
function LiveUTCMinute() {
  const [now, setNow] = useState(new Date())
  useEffect(()=>{ const t = setInterval(()=>setNow(new Date()), 1000); return ()=>clearInterval(t) },[])
  const isoMinute = useMemo(()=>{
    const d = new Date(now); d.setSeconds(0,0)
    return d.toISOString().replace('T',' ').replace('Z',' UTC')
  },[now])
  return (
    <div style={{display:'flex', gap:12, alignItems:'center'}}>
      <input aria-label="Minute UTC actuelle" value={isoMinute} readOnly
        style={{flex:1, padding:'14px 16px', border:'1px solid var(--color-border)', borderRadius:12, background:'var(--color-surface)', color:'var(--color-text)', opacity:.9}}/>
      <button onClick={()=>{ navigator.clipboard?.writeText(isoMinute) }}
        style={{padding:'12px 14px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)'}}
        aria-label="Copier la minute">
        Copier
      </button>
    </div>
  )
}

/* ---------- CertificatePreview (identique) ---------- */
type PreviewStyle =
  | 'romantic' | 'birth' | 'wedding' | 'birthday' | 'christmas' | 'newyear' | 'graduation' | 'neutral';

function safePadding(style: PreviewStyle): string {
  switch (style) {
    case 'romantic':   return '9% 10% 13% 10%';
    case 'birth':      return '10% 9% 14% 9%';
    case 'wedding':    return '9% 11% 13% 11%';
    case 'birthday':   return '7% 12% 14% 12%';
    case 'christmas':  return '8% 10% 14% 10%';
    case 'newyear':    return '8% 10% 14% 10%';
    case 'graduation': return '9% 9% 14% 9%';
    default:           return '8% 8% 12% 8%';
  }
}

function CertificatePreview({
  styleId, owner, message, ts, href,
}: {
  styleId: PreviewStyle
  owner: string
  message?: string
  ts: string
  href: string
}) {
  const tsText = ts.includes('UTC') ? ts : ts.replace('T',' ').replace('Z',' UTC')
  return (
    <a href={href} style={{textDecoration:'none', color:'var(--color-text)'}} aria-label={`Choisir le style ${styleId}`}>
      <figure style={{
        margin:0, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16,
        overflow:'hidden', boxShadow:'var(--shadow-elev1)'
      }}>
        <div style={{ position:'relative', width:'100%', aspectRatio:'595/842', background:'#F4F1EC' }}>
          <img
            src={`/cert_bg/${styleId}.png`}
            alt={`Certificat style ${styleId}`}
            width={595} height={842}
            style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}}
          />
          <div aria-hidden style={{ position:'absolute', inset:0, padding:safePadding(styleId), display:'grid', gridTemplateRows:'auto 1fr auto', color:'#0B0B0C' }}>
            <div style={{textAlign:'center'}}>
              <div style={{fontWeight:800, fontSize:16, fontFamily:'Fraunces, serif'}}>Parcels of Time</div>
              <div style={{opacity:.8, fontSize:12, marginTop:2}}>Certificate of Claim</div>
            </div>
            <div style={{ display:'grid', placeItems:'center', textAlign:'center', gridAutoRows:'min-content', gap:10 }}>
              <div style={{fontWeight:700, fontSize:24, letterSpacing:.2}}>{tsText}</div>
              <div style={{opacity:.7, fontSize:12}}>Owned by</div>
              <div style={{fontWeight:700, fontSize:16}}>{owner || 'Anonymous'}</div>
              {message && (
                <>
                  <div style={{opacity:.7, fontSize:12, marginTop:6}}>Message</div>
                  <div style={{ maxWidth:'72%', lineHeight:'1.35', fontSize:13, textWrap:'balance' }}>
                    “{message}”
                  </div>
                </>
              )}
            </div>
            <div style={{display:'grid', placeItems:'center', gap:8}}>
              <div style={{
                width:84, height:84, border:'1px solid rgba(0,0,0,.18)', borderRadius:6,
                background:'conic-gradient(from 45deg at 50% 50%, #000 0 90deg, #fff 0 180deg, #000 0 270deg, #fff 0 360deg)',
                backgroundSize:'10px 10px', imageRendering:'pixelated'
              }} />
              <div style={{opacity:.7, fontSize:10}}>Certificate preview</div>
            </div>
          </div>
        </div>
        <figcaption style={{padding:'12px 14px', fontSize:12, color:'var(--color-muted)'}}>
          Aperçu non contractuel — le PDF final contient un QR code scannable et l’empreinte d’intégrité.
        </figcaption>
      </figure>
    </a>
  )
}

/* -------------------- Usages Carousel (identique) -------------------- */
function UsagesCarousel() {
  const items = [
    { title:'Amour & famille', text:'Rencontre, fiançailles, mariage, naissance, premier mot.', icon:'💛' },
    { title:'Réussite', text:'Diplôme, CDI, première vente, lancement de projet.', icon:'🏆' },
    { title:'Culture & fête', text:'Concert, finale, feu d’artifice, Nouvel An.', icon:'🎆' },
    { title:'Voyages', text:'Décollage, arrivée, lever de soleil, boussole vers ailleurs.', icon:'🧭' },
    { title:'Cadeaux', text:'Une minute à offrir, personnelle et mémorable.', icon:'🎁' },
  ]
  const [i, setI] = useState(0)
  useEffect(()=>{ const t = setInterval(()=>setI(v=>(v+1)%items.length), 3200); return ()=>clearInterval(t) },[])
  const it = items[i]
  return (
    <div role="region" aria-roledescription="carousel" aria-label="Idées d’utilisation"
         style={{border:'1px solid var(--color-border)', background:'var(--color-surface)', borderRadius:16, padding:16, boxShadow:'var(--shadow-elev1)'}}>
      <div style={{fontSize:18, display:'flex', alignItems:'center', gap:10}}>
        <span style={{fontSize:22}}>{it.icon}</span>
        <strong>{it.title}</strong>
      </div>
      <p style={{margin:'8px 0 0', color:'var(--color-text)', opacity:.9}}>{it.text}</p>
      <div style={{marginTop:10, display:'flex', gap:6}}>
        {items.map((_, idx)=>(
          <span key={idx} aria-label={idx===i?'élément actif':'élément'}
                style={{width:6, height:6, borderRadius:99, background: idx===i ? 'var(--color-primary)':'var(--color-border)'}} />
        ))}
      </div>
    </div>
  )
}

/* -------------------- Feature card -------------------- */
function FeatureCard({title, text}:{title:string; text:string}) {
  return (
    <div style={{
      background:'var(--color-surface)', color:'var(--color-text)', border:'1px solid var(--color-border)',
      borderRadius:16, padding:18
    }}>
      <strong style={{display:'block', marginBottom:6}}>{title}</strong>
      <p style={{margin:0, color:'var(--color-text)', opacity:.9}}>{text}</p>
    </div>
  )
}

/* -------------------- Pricing -------------------- */
function Pricing() {
  const href = useLocaleHref()
  return (
    <section id="prix" style={{maxWidth:1280, margin:'0 auto', padding:'40px 24px 72px'}}>
      <SectionLabel>Prix & offres</SectionLabel>
      <h3 style={{fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:'0 0 18px'}}>Des minutes pour chaque histoire</h3>
      <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
        <div style={{gridColumn:'span 6', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:20}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Standard</div>
          <div style={{fontSize:32, fontWeight:800}}>9–19 €</div>
          <p style={{opacity:.9}}>Une minute unique. Certificat, QR code, page dédiée.</p>
          <Button href={href('/claim')} variant="primary">Réserver ma minute</Button>
        </div>
        <div style={{gridColumn:'span 6', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:20}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Minutes iconiques</div>
          <div style={{fontSize:32, fontWeight:800}}>Prix selon rareté</div>
          <p style={{opacity:.9}}>Séries spéciales (Nouvel An, éclipses, finales, records).</p>
          <Link href="#iconiques" style={{textDecoration:'none', color:'var(--color-text)'}}>Voir les minutes rares →</Link>
        </div>
      </div>
    </section>
  )
}

/* -------------------- FAQ & Testimonials inchangés -------------------- */

/* -------------------- Hero (photos) -------------------- */
function HeroPhotos({href}:{href:(p:string)=>string}) {
  const { t } = useT()
  return (
    <section style={{position:'relative', overflow:'clip', borderBottom:'1px solid var(--color-border)'}}>
      <div aria-hidden style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background:'radial-gradient(50% 30% at 60% -10%, rgba(140,214,255,.12), transparent 60%), radial-gradient(40% 24% at 20% -6%, rgba(228,183,61,.18), transparent 60%)'
      }} />
      <div style={{maxWidth:1280, margin:'0 auto', padding:'72px 24px 40px', display:'grid', gap:24, gridTemplateColumns:'repeat(12, 1fr)', alignItems:'center'}}>
        <div style={{gridColumn:'span 6', color:'var(--color-text)'}}>
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
            <img src="/logo.svg" alt="" width={40} height={40} />
            <span style={{fontFamily:'Fraunces, serif', fontSize:20}}>Parcels of Time</span>
          </div>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:56, lineHeight:'64px', margin:'8px 0 12px'}}>
            {t('hero.h1')}
          </h1>
          <p style={{fontSize:18, lineHeight:'28px', maxWidth:560, color:'var(--color-text)'}}>
            {t('hero.subtitle')}
          </p>
          <div style={{display:'flex', gap:12, flexWrap:'wrap', marginTop:16}}>
            <Button href={href('/claim')} variant="primary" ariaLabel={t('cta.claim')}>{t('cta.claim')}</Button>
            <Button href={href('/claim?gift=1')} variant="secondary" ariaLabel={t('cta.gift')}>{t('cta.gift')}</Button>
          </div>
          <div style={{marginTop:14, fontSize:14, color:'var(--color-muted)'}}>
            {t('hero.rarity')}
          </div>
          <div style={{marginTop:18}}>
            <LiveUTCMinute />
          </div>
        </div>

        <div style={{gridColumn:'span 6'}}>
          <HeroSlideshow
            interval={2000}
            slides={[
              { src: '/hero/love.png',       alt: 'Amour — couple qui s’enlace au coucher du soleil', focal: 'center 40%' },
              { src: '/hero/birth.png',      alt: 'Naissance — peau à peau, lumière douce' },
              { src: '/hero/birthday.png',   alt: 'Anniversaire — bougies, confettis, joie' },
              { src: '/hero/graduation.png', alt: 'Diplôme — lancer de toques sur campus' },
            ]}
          />
        </div>
      </div>
    </section>
  )
}

/* -------------------- Page -------------------- */
export default function Landing() {
  const href = useLocaleHref()
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  useEffect(()=>{ applyTheme(theme === 'dark' ? TOKENS_DARK : TOKENS_LIGHT) },[theme])

  const whyText = useMemo(()=>(
    'Nous accumulons des photos et des vidéos… mais l’instant se perd dans la masse. Parcels of Time vous permet de posséder la minute qui a changé votre histoire.'
  ),[])

  return (
    <main style={{background:'var(--color-bg)', color:'var(--color-text)'}}>
      <Header onToggleTheme={()=>setTheme(t=>t==='dark'?'light':'dark')} href={href} />

      <HeroPhotos href={href} />

      {/* … sections équivalentes à avant … */}

      {/* Editions limitées (Link + href localisé) */}
      <section id="iconiques" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Éditions limitées & minutes iconiques</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          {['newyear','wedding','birth','graduation'].map((style)=>(
            <Link key={style} href={href(`/claim?style=${style}`)} style={{ gridColumn:'span 3', textDecoration:'none', color:'var(--color-text)' }}>
              <div style={{border:'1px solid var(--color-border)', background:'var(--color-surface)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-elev1)'}}>
                <img src={`/cert_bg/${style}.png`} alt={`Certificat style ${style}`} width={480} height={320}
                     style={{width:'100%', height:'auto', display:'block'}} loading="lazy" />
                <div style={{padding:12, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <strong style={{textTransform:'capitalize'}}>{style}</strong>
                  <span style={{fontSize:12, color:'var(--color-muted)'}}>Stock limité</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* … Pricing, Testimonials, FAQ, CTA final & Footer restent identiques,
          avec tous les href passés par href() comme déjà fait ci-dessus … */}
    </main>
  )
}
