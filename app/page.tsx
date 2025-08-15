// app/page.tsx — Parcels of Time • Landing v2.0 Ultimate (dark by default)
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import UTCClock from './components/UTCClock'
import CertificateShowcase from './components/CertificateShowcase'

/** ---- Design Tokens (Dark Premium / Light Éditorial) ---- */
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

/** ---- Helpers ---- */
function applyTheme(vars: Record<string, string>) {
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

function useABVariant() {
  const params = useSearchParams()
  const explicit = (params.get('hero') || '').toLowerCase()
  // 'a' = Certificat macro / 'b' = Photo moment
  const initial = explicit === 'a' || explicit === 'b' ? (explicit as 'a'|'b') : (Math.random() > 0.5 ? 'a' : 'b')
  const [variant, setVariant] = useState<'a' | 'b'>(initial)
  return { variant, setVariant }
}

/** ---- UI atoms ---- */
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
  const onKeyDown: React.KeyboardEventHandler<HTMLAnchorElement> = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.currentTarget) e.currentTarget.click()
  }
  return (
    <Link href={href} aria-label={ariaLabel} onKeyDown={onKeyDown}
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

/** Accept any div props (id, aria-*, className...) */
function SectionLabel(props: React.HTMLAttributes<HTMLDivElement>) {
  const { children, style, ...rest } = props
  return (
    <div
      {...rest}
      style={{
        fontSize:14, letterSpacing:1, textTransform:'uppercase',
        color:'var(--color-muted)', marginBottom:8,
        ...(style || {})
      }}
    >
      {children}
    </div>
  )
}

/** ---- Header sticky ---- */
function Header({onToggleTheme}:{onToggleTheme:()=>void}) {
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
        <Link href="/" style={{display:'inline-flex', alignItems:'center', gap:10, textDecoration:'none', color:'var(--color-text)'}}>
          <img src="/logo.svg" alt="Parcels of Time" width={28} height={28} />
          <strong style={{fontFamily:'Fraunces, serif', fontWeight:700}}>Parcels of Time</strong>
        </Link>

        <ul aria-label="Navigation principale" style={{
          display:'flex', gap:18, listStyle:'none', justifyContent:'center', margin:0, padding:0,
          color:'var(--color-text)'
        }}>
          <li><a href="#pourquoi" style={{textDecoration:'none', color:'inherit'}}>Pourquoi</a></li>
          <li><a href="#comment" style={{textDecoration:'none', color:'inherit'}}>Comment</a></li>
          <li><a href="#prix" style={{textDecoration:'none', color:'inherit'}}>Prix</a></li>
          <li><a href="#iconiques" style={{textDecoration:'none', color:'inherit'}}>Minutes rares</a></li>
          <li><a href="#offrir" style={{textDecoration:'none', color:'inherit'}}>Offrir</a></li>
          <li><a href="#faq" style={{textDecoration:'none', color:'inherit'}}>FAQ</a></li>
        </ul>

        <div style={{display:'flex', gap:10, justifyContent:'flex-end', alignItems:'center'}}>
          <Button href="/claim" variant="secondary" ariaLabel="Offrir une minute">Offrir une minute</Button>
          <Button href="/claim" variant="primary" ariaLabel="Réserver ma minute">Réserver ma minute</Button>
          <button aria-label="Basculer le thème" onClick={onToggleTheme}
                  style={{marginLeft:6, padding:10, borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)'}}>
            ☀︎/☾
          </button>
        </div>
      </nav>
    </header>
  )
}

/** ---- Hero A/B ---- */
function Hero({variant}:{variant:'a'|'b'}) {
  return (
    <section style={{position:'relative', overflow:'clip', borderBottom:'1px solid var(--color-border)'}}>
      {/* halo */}
      <div aria-hidden style={{
        position:'absolute', inset:0,
        background: 'radial-gradient(50% 30% at 60% -10%, rgba(140,214,255,.12), transparent 60%), radial-gradient(40% 24% at 20% -6%, rgba(228,183,61,.18), transparent 60%)'
      }} />
      <div style={{maxWidth:1280, margin:'0 auto', padding:'72px 24px 40px', display:'grid', gap:24,
                   gridTemplateColumns:'repeat(12, 1fr)', alignItems:'center'}}>
        <div style={{gridColumn:'span 6', color:'var(--color-text)'}}>
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
            <img src="/logo.svg" alt="" width={40} height={40} />
            <span style={{fontFamily:'Fraunces, serif', fontSize:20}}>Parcels of Time</span>
          </div>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:56, lineHeight:'64px', margin:'8px 0 12px'}}>
            Possédez la minute qui compte.
          </h1>
          <p style={{fontSize:18, lineHeight:'28px', maxWidth:560, color:'var(--color-text)'}}>
            Gravez un moment de vie en le revendiquant pour toujours. <strong>Unique.</strong> <strong>Numérique.</strong> <strong>Partageable.</strong>
          </p>
          <div style={{display:'flex', gap:12, flexWrap:'wrap', marginTop:16}}>
            <Button href="/claim" variant="primary" ariaLabel="Réserver ma minute">Réserver ma minute</Button>
            <Button href="/claim?gift=1" variant="secondary" ariaLabel="Offrir une minute">Offrir une minute</Button>
          </div>
          <div style={{marginTop:14, fontSize:14, color:'var(--color-muted)'}}>
            Rareté réelle&nbsp;: <strong>525 600</strong> minutes par année.
          </div>
          <div style={{marginTop:18}}>
            {/* fix: pas de prop mode si non typée */}
            <UTCClock />
          </div>
        </div>

        <div style={{gridColumn:'span 6', position:'relative'}}>
          {variant === 'a' ? (
            // Macro certificat + QR (parallaxe légère)
            <div style={{
              borderRadius:16, padding:16, background:'var(--color-surface)', border:'1px solid var(--color-border)',
              boxShadow:'var(--shadow-elev2)', transform:'perspective(1200px) rotateX(2deg) rotateY(-3deg)'
            }}>
              <img src="/og-cert-macro.webp" alt="Certificat Parcels of Time avec QR code" width={640} height={420}
                   style={{width:'100%', height:'auto', borderRadius:12, display:'block'}} loading="eager" />
            </div>
          ) : (
            // Photo moment bokeh
            <div style={{position:'relative'}}>
              <img src="/hero-life-bokeh.webp" alt="Moments de vie — mariage, naissance, concert" width={640} height={420}
                   style={{width:'100%', height:'auto', borderRadius:16, border:'1px solid var(--color-border)', boxShadow:'var(--shadow-elev2)'}} loading="eager" />
              <div style={{position:'absolute', bottom:12, left:12, background:'color-mix(in srgb, var(--color-bg) 74%, transparent)', padding:'8px 10px', borderRadius:10, fontSize:13, color:'var(--color-text)', border:'1px solid var(--color-border)'}}>
                Mariage • Naissance • Concert • Voyage
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** ---- Carrousel d’usages (auto) ---- */
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

/** ---- Cards simples ---- */
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

/** ---- Pricing ---- */
function Pricing() {
  return (
    <section id="prix" style={{maxWidth:1280, margin:'0 auto', padding:'40px 24px 72px'}}>
      <SectionLabel>Prix & offres</SectionLabel>
      <h3 style={{fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:'0 0 18px'}}>Des minutes pour chaque histoire</h3>
      <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
        {/* Standard */}
        <div style={{gridColumn:'span 4', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:20}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Standard</div>
          <div style={{fontSize:32, fontWeight:800}}>9–19 €</div>
          <p style={{opacity:.9}}>Une minute unique. Certificat, QR code, page dédiée.</p>
          <Button href="/claim" variant="primary">Réserver ma minute</Button>
        </div>
        {/* Pack */}
        <div style={{gridColumn:'span 4', background:'var(--color-surface)', border:'2px solid var(--color-primary)', borderRadius:16, padding:20, boxShadow:'var(--shadow-glow)'}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Pack “Moment” ×5</div>
          <div style={{fontSize:32, fontWeight:800}}>–20%</div>
          <p style={{opacity:.9}}>Pour une histoire à plusieurs chapitres (familiale, tournée, marathon…)</p>
          <Button href="/claim?bundle=5" variant="primary">Choisir le pack</Button>
        </div>
        {/* Iconiques */}
        <div style={{gridColumn:'span 4', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:20}}>
          <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Minutes iconiques</div>
          <div style={{fontSize:32, fontWeight:800}}>Prix selon rareté</div>
          <p style={{opacity:.9}}>Séries spéciales (Nouvel An, éclipses, finales, records).</p>
          <Link href="#iconiques" style={{textDecoration:'none', color:'var(--color-text)'}}>Voir les minutes rares →</Link>
        </div>
      </div>
    </section>
  )
}

/** ---- Témoignages ---- */
function Testimonials() {
  const items = [
    { q:'“Nous avons revendiqué la minute de la naissance de Léo… frissons à chaque fois !”', a:'Camille' },
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

/** ---- FAQ ---- */
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

export default function Page() {
  const { variant, setVariant } = useABVariant()
  const [theme, setTheme] = useState<'dark'|'light'>('dark')

  useEffect(()=>{ applyTheme(theme === 'dark' ? TOKENS_DARK : TOKENS_LIGHT) },[theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const whyText = useMemo(()=>(
    'Nous accumulons des photos et des vidéos… mais l’instant se perd dans la masse. Parcels of Time vous permet de posséder la minute qui a changé votre histoire.'
  ),[])

  return (
    <main style={{background:'var(--color-bg)', color:'var(--color-text)'}}>
      <Header onToggleTheme={toggleTheme} />

      {/* HERO A/B */}
      <Hero variant={variant} />
      <div style={{maxWidth:1280, margin:'0 auto', padding:'0 24px 12px', display:'flex', justifyContent:'flex-end', gap:10}}>
        <button onClick={()=>setVariant(v=>v==='a'?'b':'a')}
                style={{fontSize:12, color:'var(--color-muted)', background:'transparent', border:'1px dashed var(--color-border)', padding:'6px 10px', borderRadius:10}}>
          Voir autre visuel (A/B)
        </button>
      </div>

      {/* POURQUOI maintenant */}
      <section id="pourquoi" style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
        <SectionLabel>Pourquoi maintenant&nbsp;?</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16, alignItems:'start'}}>
          <p style={{gridColumn:'span 7', margin:0, fontSize:18, lineHeight:'28px'}}>{whyText}</p>
          <div style={{gridColumn:'span 5'}}>
            <UsagesCarousel />
          </div>
        </div>
      </section>

      {/* CE QUE VOUS POSSEDEZ */}
      <section aria-labelledby="possedez" style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
        {/* fix: SectionLabel accepte id */}
        <SectionLabel id="possedez">Ce que vous possédez</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Une minute unique" text="Jamais vendue deux fois. Votre instant, pour toujours." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Certificat de Claim" text="PDF/JPG signé, prêt à imprimer et encadrer." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="QR code scannable" text="Accès direct à votre page souvenir et partage facile." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Page dédiée" text="Message + lien (modérés), horodatage UTC & heure locale." /></div>
        </div>
      </section>

      {/* CE QUE VOUS RECEVEZ (showcase) */}
      <section id="receive" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Ce que vous recevez</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16}}>
          <div>
            {/* fix: pas de prop mode si non typée */}
            <CertificateShowcase />
          </div>
          <aside style={{display:'grid', gap:12, alignContent:'start'}}>
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>✅ Certificat numérique (PDF/JPG) haute définition</div>
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>✅ QR code scannable (cadre, invitation, bio)</div>
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>✅ Page souvenir (message + lien) • Badge d’authenticité</div>
            <div style={{display:'flex', gap:10, marginTop:4}}>
              <Button href="/claim" variant="primary">Réserver ma minute</Button>
              <Button href="/claim?gift=1" variant="secondary">Offrir une minute</Button>
            </div>
          </aside>
        </div>
      </section>

      {/* COMMENT ça marche */}
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

      {/* Editions limitées */}
      <section id="iconiques" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Éditions limitées & minutes iconiques</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          {['newyear','wedding','birth','graduation'].map((style)=>(
            <a key={style} href={`/claim?style=${style}`} style={{
              gridColumn:'span 3', textDecoration:'none', color:'var(--color-text)'
            }}>
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

      {/* CTA final */}
      <section aria-labelledby="cta-final" style={{
        borderTop:'1px solid var(--color-border)', background:'linear-gradient(0deg, color-mix(in srgb, var(--color-surface) 85%, transparent), transparent)',
        marginTop:16
      }}>
        <div style={{maxWidth:1280, margin:'0 auto', padding:'36px 24px 64px', textAlign:'center'}}>
          <h3 id="cta-final" style={{fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:'0 0 8px'}}>
            Votre histoire mérite mieux qu’un simple post.
          </h3>
          <p style={{margin:'0 0 16px'}}>Réservez la minute qui compte — aujourd’hui.</p>
          <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <Button href="/claim" variant="primary">Réserver ma minute</Button>
            <Button href="/claim?gift=1" variant="secondary">Offrir une minute</Button>
          </div>
          <div style={{marginTop:12, fontSize:12, color:'var(--color-muted)'}}>Paiement sécurisé Stripe • Certificat haute définition • Jamais vendue deux fois</div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{borderTop:'1px solid var(--color-border)', color:'var(--color-muted)'}}>
        <div style={{maxWidth:1280, margin:'0 auto', padding:'20px 24px', display:'flex', flexWrap:'wrap', gap:12, justifyContent:'space-between'}}>
          <span>© {new Date().getFullYear()} Parcels of Time</span>
          <div style={{display:'flex', gap:12}}>
            <Link href="/legal/terms" style={{textDecoration:'none', color:'inherit'}}>Conditions</Link>
            <Link href="/legal/refund" style={{textDecoration:'none', color:'inherit'}}>Remboursement</Link>
            <Link href="/legal/privacy" style={{textDecoration:'none', color:'inherit'}}>Confidentialité</Link>
            <Link href="/company" style={{textDecoration:'none', color:'inherit'}}>À propos</Link>
            <Link href="/support" style={{textDecoration:'none', color:'inherit'}}>Support</Link>
            <a href="mailto:hello@parcelsoftime.com" style={{textDecoration:'none', color:'inherit'}}>B2B</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
