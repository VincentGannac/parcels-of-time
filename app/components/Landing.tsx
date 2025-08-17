// app/components/Landing.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import HeroSlideshow from './HeroSlideshow'
import { useLocaleHref } from './useLocaleHref'
import { useT } from '../i18n/I18nProvider'

/* -------------------- Design Tokens -------------------- */
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

/* ---------- CertificatePreview (identique à avant) ---------- */
type PreviewStyle =
  | 'romantic' | 'birth' | 'wedding' | 'birthday' | 'christmas' | 'newyear' | 'graduation' | 'neutral';

const SAFE_INSETS_PCT: Record<PreviewStyle, {top:number;right:number;bottom:number;left:number}> = {
    neutral:    { top:16.6, right:16.1, bottom:18.5, left:16.1 },
    romantic:   { top:19.0, right:19.5, bottom:18.5, left:19.5 },
    birthday:   { top:17.1, right:22.2, bottom:18.5, left:22.2 },
    birth:      { top:17.8, right:18.8, bottom:18.5, left:18.8 },
    wedding:    { top:19.0, right:20.8, bottom:18.5, left:20.8 },
    christmas:  { top:17.8, right:18.8, bottom:18.5, left:18.8 },
    newyear:    { top:17.8, right:18.8, bottom:18.5, left:18.8 },
    graduation: { top:17.8, right:18.8, bottom:18.5, left:18.8 },
}

function CertificatePreview({
  styleId, owner, title, message, ts, href,
}: {
  styleId: PreviewStyle
  owner: string
  title?: string
  message?: string
  ts: string
  href: string
}) {
  const tsText = ts.includes('UTC') ? ts : ts.replace('T', ' ').replace('Z', ' UTC')
  const previewTextColor = 'rgba(26, 31, 42, 0.92)'
  const previewSubtle = 'rgba(26, 31, 42, 0.70)'

  // ✅ calculé AVANT le JSX
  const ins = SAFE_INSETS_PCT[styleId]

  return (
    <a href={href} style={{ textDecoration: 'none', color: 'var(--color-text)' }} aria-label={`Choisir le style ${styleId}`}>
      <figure style={{
        margin: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16,
        overflow: 'hidden', boxShadow: 'var(--shadow-elev1)'
      }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '595/842', background: '#F4F1EC' }}>
          <img
            src={`/cert_bg/${styleId}.png`}
            alt={`Certificat style ${styleId}`}
            width={595} height={842}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Overlay harmonisé */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, color: previewTextColor }}>
            {/* Zone sûre = même géométrie que le PDF */}
            <div style={{
              position: 'absolute',
              top: `${ins.top}%`, right: `${ins.right}%`, bottom: `${ins.bottom}%`, left: `${ins.left}%`,
              display: 'grid', gridTemplateRows: 'auto 1fr', textAlign: 'center'
            }}>
              {/* En-tête */}
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Parcels of Time</div>
                <div style={{ opacity: .9, fontSize: 12 }}>Certificate of Claim</div>
              </div>

              {/* Zone centrale */}
              <div style={{ display: 'grid', placeItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: .2 }}>{tsText}</div>

                {/* Title AVANT Owned by */}
                {title && (
                  <>
                    <div style={{ opacity: .7, fontSize: 12, marginTop: 2 }}>Title</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
                  </>
                )}

                <div style={{ opacity: .7, fontSize: 12, marginTop: 8 }}>Owned by</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{owner || 'Anonymous'}</div>

                {message && (
                  <>
                    <div style={{ opacity: .7, fontSize: 12, marginTop: 6 }}>Message</div>
                    <div style={{ maxWidth: '72%', lineHeight: '1.35', fontSize: 13 }}>“{message}”</div>
                  </>
                )}
              </div>

              {/* Pied de page collé dans l’angle de la safe area */}
              <div style={{ position: 'absolute', left: 0, bottom: 0, fontSize: 12, color: previewSubtle, textAlign: 'left' }}>
                Certificate ID • Integrity hash (aperçu)
              </div>
              <div style={{
                position: 'absolute', right: 0, bottom: 0,
                width: 84, height: 84, border: '1px dashed rgba(26,31,42,.45)', borderRadius: 8,
                display: 'grid', placeItems: 'center', fontSize: 12, opacity: .85
              }}>
                QR
              </div>
            </div>
          </div>
        </div>

        <figcaption style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-muted)' }}>
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

/* -------------------- Feature card (identique) -------------------- */
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

/* -------------------- Pricing (identique, liens localisés) -------------------- */
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

/* -------------------- Témoignages (identique) -------------------- */
function Testimonials() {
  const items = [
    { q:'“Nous avons revendiqué la minute de la naissance d’Aïcha… frissons à chaque fois !”', a:'Camille' },
    { q:'“Mon cadeau préféré : la minute de notre rencontre.”', a:'Thomas' },
    { q:'“La minute du diplôme de ma sœur. Simple, mémorable, classe.”', a:'Mina' },
  ]
  return (
    <section style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
      <SectionLabel>Témoignages</SectionLabel>
      <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
        {items.map((t,i)=>(
          <blockquote key={i} style={{
            gridColumn:'span 4', margin:0, background:'var(--color-surface)', border:'1px solid var(--color-border)',
            borderRadius:16, padding:18, color:'var(--color-text)'
          }}>
            <p style={{margin:'0 0 8px', fontStyle:'italic'}}>{t.q}</p>
            <footer style={{opacity:.8}}>— {t.a}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}

/* -------------------- FAQ (identique) -------------------- */
function FAQ() {
  const rows = [
    { q:'Ma minute m’appartient-elle vraiment ?', a:'Oui. Chaque minute est vendue une seule fois. Votre certificat numérique agit comme preuve d’authenticité.' },
    { q:'Puis-je changer le message ?', a:'Oui, via votre page dédiée, tant que le contenu respecte nos règles de modération.' },
    { q:'Fuseaux horaires ?', a:'Horodatage en UTC, avec affichage de l’heure locale sur votre page.' },
    { q:'Impression ?', a:'Certificat haute définition prêt à imprimer (PDF/JPG).' },
    { q:'Délai ?', a:'Réservation et réception en moins de 2 minutes.' },
    { q:'Remboursement ?', a:'Contenu numérique livré immédiatement : vous renoncez au délai de rétractation. Erreurs de facturation → remboursement.' },
  ]
  return (
    <section id="faq" style={{maxWidth:1280, margin:'0 auto', padding:'24px 24px 72px'}}>
      <SectionLabel>FAQ</SectionLabel>
      <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:12}}>
        {rows.map((r,i)=>(
          <details key={i} style={{gridColumn:'span 6', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:14}}>
            <summary style={{cursor:'pointer', fontWeight:700}}>{r.q}</summary>
            <p style={{margin:'10px 0 0'}}>{r.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/* -------------------- Hero (photos uniquement, i18n) -------------------- */
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

/* -------------------- Page (tout identique, liens localisés) -------------------- */
export default function Landing() {
  const href = useLocaleHref()
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  const { /* t not needed below, we keep original FR copy */ } = useT()

  useEffect(()=>{ applyTheme(theme === 'dark' ? TOKENS_DARK : TOKENS_LIGHT) },[theme])

  const whyText = useMemo(()=>(
    'Nous accumulons des photos et des vidéos… mais l’instant se perd dans la masse. Parcels of Time vous permet de posséder la minute qui a changé votre histoire.'
  ),[])

  return (
    <main style={{background:'var(--color-bg)', color:'var(--color-text)'}}>
      <Header onToggleTheme={()=>setTheme(t=>t==='dark'?'light':'dark')} href={href} />

      {/* HERO (photos uniquement) */}
      <HeroPhotos href={href} />

      {/* POURQUOI (identique) */}
      <section id="pourquoi" style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
        <SectionLabel>Pourquoi maintenant&nbsp;?</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16, alignItems:'start'}}>
          <p style={{gridColumn:'span 7', margin:0, fontSize:18, lineHeight:'28px'}}>{whyText}</p>
          <div style={{gridColumn:'span 5'}}>
            <UsagesCarousel />
          </div>
        </div>
      </section>

      {/* CE QUE VOUS POSSEDEZ (identique) */}
      <section aria-labelledby="possedez" style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
        <SectionLabel id="possedez">Ce que vous possédez</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Une minute unique" text="Jamais vendue deux fois. Votre instant, pour toujours." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Certificat de Claim" text="PDF/JPG signé, prêt à imprimer et encadrer." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="QR code scannable" text="Accès direct à votre page souvenir et partage facile." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Page dédiée" text="Message + lien (modérés), horodatage UTC & heure locale." /></div>
        </div>
      </section>

      {/* CE QUE VOUS RECEVEZ (identique) */}
      <section id="receive" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Ce que vous recevez</SectionLabel>

        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          {/* Romantic */}
          <div style={{gridColumn:'span 4'}}>
            <CertificatePreview
              styleId="romantic"
              owner="Clara & Sam"
              title="Notre premier baiser"
              ts="2018-07-19T21:30:00Z"
              message="Te souviens-tu ? Ce 19 juillet 2028, on s’était abrités de l’averse. On riait comme des idiots, trempés jusqu’aux os. Puis, là, tu m’as embrassé."

              href={href('/claim?style=romantic')}
            />
          </div>

          {/* Birth */}
          <div style={{gridColumn:'span 4'}}>
            <CertificatePreview
              styleId="birth"
              owner="Nora & Mehdi"
              title="Bienvenue, Aïcha"
              ts="2023-03-02T06:12:00Z"
              message="À 06:12, le 2 mars 2023, tu as crié. Puis le silence d’après s’est rempli d’une nouvelle lumière : tu étais née. Le temps s’est figé. On a acheté cette minute pour ne jamais oublier ce moment."
              href={href('/claim?style=birth')}
            />
          </div>

          <div style={{gridColumn:'span 4'}}>
          <CertificatePreview
            styleId="wedding"
            owner="Inès & Hugo"
            title="À 17:31, plus que nous deux"
            ts="2024-07-20T17:31:00Z"
            message="Les amis criaient. Les confettis volaient. Mais je ne voyais que toi. À 17:31, nos deux « oui » ont effacé le reste. On garde cette minute pour entendre encore nos deux « oui » quand les mots manqueront."
            href={href('/claim?style=wedding')}
          />
        </div>
        </div>

        {/* Points de valeur + CTAs */}
        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16, marginTop:18}}>
          <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <ul style={{margin:0, paddingLeft:18, lineHeight:'28px'}}>
              <li>Certificat numérique haute définition (PDF/JPG) prêt à imprimer</li>
              <li>QR code scannable qui mène à votre page souvenir</li>
              <li>Page dédiée partageable (message + lien), badge d’authenticité</li>
              <li>Styles premium : Romantic, Birth, Wedding, Christmas, New Year, Graduation…</li>
            </ul>
          </div>
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <Button href={href('/claim')} variant="primary">Réserver ma minute</Button>
            <Button href={href('/claim?gift=1')} variant="secondary">Offrir une minute</Button>
          </div>
        </div>
      </section>

      {/* COMMENT (identique) */}
      <section id="comment" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Comment ça marche</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          <div style={{gridColumn:'span 4', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <div style={{fontSize:28}}>①</div>
            <strong>Choisissez date & heure</strong>
            <p style={{margin:'6px 0 0'}}>UTC géré automatiquement. Palindromes & 11:11 mis en avant.</p>
          </div>
          <div style={{gridColumn:'span 4', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <div style={{fontSize:28}}>②</div>
            <strong>Personnalisez</strong>
            <p style={{margin:'6px 0 0'}}>Propriétaire, message, style du certificat.</p>
          </div>
          <div style={{gridColumn:'span 4', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <div style={{fontSize:28}}>③</div>
            <strong>Réservez & recevez</strong>
            <p style={{margin:'6px 0 0'}}>Certificat + QR immédiatement. <span aria-label="moins de 2 minutes" title="moins de 2 minutes">⏱ &lt; 2&nbsp;minutes</span>.</p>
          </div>
        </div>
      </section>

      {/* Editions limitées (identique, liens localisés) */}
      <section id="iconiques" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Éditions limitées & minutes iconiques</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          {['newyear','wedding','birth','graduation'].map((style)=>(
            <a key={style} href={href(`/claim?style=${style}`)} style={{ gridColumn:'span 3', textDecoration:'none', color:'var(--color-text)' }}>
              <div style={{border:'1px solid var(--color-border)', background:'var(--color-surface)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-elev1)'}}>
                <img src={`/cert_bg/${style}.png`} alt={`Certificat style ${style}`} width={480} height={320}
                     style={{width:'100%', height:'auto', display:'block'}} loading="lazy" />
                <div style={{padding:12, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <strong style={{textTransform:'capitalize'}}>{style}</strong>
                  <span style={{fontSize:12, color:'var(--color-muted)'}}>Stock limité</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <Pricing />
      <Testimonials />
      <FAQ />

      {/* CTA final (identique, liens localisés) */}
      <section aria-labelledby="cta-final" style={{
        borderTop:'1px solid var(--color-border)', background:'linear-gradient(0deg, color-mix(in srgb, var(--color-surface) 85%, transparent), transparent)',
        marginTop:16
      }}>
        <div style={{maxWidth:1280, margin:'0 auto', padding:'36px 24px 64px', textAlign:'center'}}>
          <h3 id="cta-final" style={{fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:'0 0 8px'}}>
            Transformez un instant en héritage.
          </h3>
          <p style={{margin:'0 0 16px'}}>Réservez la minute qui compte — aujourd’hui.</p>
          <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <Button href={href('/claim')} variant="primary">Réserver ma minute</Button>
            <Button href={href('/claim?gift=1')} variant="secondary">Offrir une minute</Button>
          </div>
          <div style={{marginTop:12, fontSize:12, color:'var(--color-muted)'}}>Paiement sécurisé Stripe • Certificat haute définition • Jamais vendue deux fois</div>
        </div>
      </section>

      {/* Footer (identique, liens localisés) */}
      <footer style={{borderTop:'1px solid var(--color-border)', color:'var(--color-muted)'}}>
        <div style={{maxWidth:1280, margin:'0 auto', padding:'20px 24px', display:'flex', flexWrap:'wrap', gap:12, justifyContent:'space-between'}}>
          <span>© {new Date().getFullYear()} Parcels of Time</span>
          <div style={{display:'flex', gap:12}}>
            <Link href={href('/legal/terms')}  style={{textDecoration:'none', color:'inherit'}}>Conditions</Link>
            <Link href={href('/legal/refund')} style={{textDecoration:'none', color:'inherit'}}>Remboursement</Link>
            <Link href={href('/legal/privacy')}style={{textDecoration:'none', color:'inherit'}}>Confidentialité</Link>
            <Link href={href('/company')}      style={{textDecoration:'none', color:'inherit'}}>À propos</Link>
            <Link href={href('/support')}      style={{textDecoration:'none', color:'inherit'}}>Support</Link>
            <a href="mailto:hello@parcelsoftime.com" style={{textDecoration:'none', color:'inherit'}}>B2B</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
