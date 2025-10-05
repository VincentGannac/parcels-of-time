// app/components/Landing.tsx 
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import HeroSlideshow from './HeroSlideshow'
import { useLocaleHref } from './useLocaleHref'
import { useT } from '../i18n/I18nProvider'
import { usePathname } from 'next/navigation'



function CookieBanner() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    try {
      const v = localStorage.getItem('cookieConsent')
      if (!v) setVisible(true)
    } catch {}
  }, [])
  if (!visible) return null
  const accept = (val:'accept'|'reject') => {
    try { localStorage.setItem('cookieConsent', val) } catch {}
    setVisible(false)
  }
  return (
    <div role="dialog" aria-live="polite"
      style={{position:'fixed', zIndex:50, left:16, right:16, bottom:16, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:12, boxShadow:'var(--shadow-elev2)'}}>
      <div style={{fontSize:14, marginBottom:8}}>
        Nous utilisons des cookies essentiels (sécurité, paiement) et de mesure d’audience. 
        Consultez la <a href="/fr/legal/cookies" style={{color:'var(--color-text)'}}>Politique des cookies</a>.
      </div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <button onClick={()=>accept('reject')} style={{padding:'8px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)'}}>Refuser (hors essentiels)</button>
        <button onClick={()=>accept('accept')} style={{padding:'8px 12px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800}}>Accepter</button>
      </div>
    </div>
  )
}

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
}: { href: string; children: React.ReactNode; variant?: 'primary'|'secondary'|'ghost'|'accent'; ariaLabel?: string }) {
  const base: React.CSSProperties = {
    textDecoration:'none', fontWeight:700, borderRadius:12, padding:'14px 18px',
    display:'inline-flex', alignItems:'center', gap:10, outline:'none',
    border:'1px solid var(--color-border)',
    boxShadow:'none', transition:'transform .16s ease, box-shadow .16s ease, background .16s ease',
  }
  const styles: Record<'primary'|'secondary'|'ghost'|'accent', React.CSSProperties> = {
    primary: { ...base, background:'var(--color-primary)', color:'var(--color-on-primary)', borderColor:'transparent' },
    secondary: { ...base, background:'var(--color-surface)', color:'var(--color-text)' },
    ghost: { ...base, background:'transparent', color:'var(--color-text)' },
    // Accent = mettre en avant l’offre cadeau
    accent: { ...base, background:'var(--color-secondary)', color:'var(--color-on-primary)', borderColor:'transparent' },
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
          <li><Link href={href('/explore')} style={{textDecoration:'none', color:'inherit'}}>Registre public</Link></li>
          {/* ⇩ fixé à "Mon Compte" */}
          <li><Link href={href('/account')} style={{textDecoration:'none', color:'inherit'}}>Mon Compte</Link></li>
        </ul>

        <div style={{display:'flex', gap:10, justifyContent:'flex-end', alignItems:'center'}}>
          {/* Offrir = accentué */}
          <Button href={href('/claim?gift=1')} variant="accent" ariaLabel={t('cta.gift')}>🎁 {t('cta.gift')}</Button>
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




/* ---------- CertificatePreview (MAJ ordre) ---------- */
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
const EDGE_PX = 12;

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
// Affiche uniquement la date UTC
const tsText = useMemo(() => {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0,0,0,0))
  return utc.toISOString().slice(0,10) + ' UTC'
}, [ts])
  const previewTextColor = 'rgba(26, 31, 42, 0.92)'
  const previewSubtle = 'rgba(26, 31, 42, 0.70)'

  const ins = SAFE_INSETS_PCT[styleId];

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

          {/* Overlay */}
          <div aria-hidden style={{ position:'absolute', inset:0, color:previewTextColor }}>
            {/* Contenu dans la safe-area */}
            <div style={{
              position:'absolute',
              top:`${ins.top}%`, right:`${ins.right}%`, bottom:`${ins.bottom}%`, left:`${ins.left}%`,
              display:'grid', gridTemplateRows:'auto 1fr', textAlign:'center'
            }}>
              {/* En-tête */}
              <div>
                <div style={{fontWeight:900, fontSize:16}}>Parcels of Time</div>
                <div style={{opacity:.9, fontSize:12}}>Certificate of Claim</div>
              </div>


              {/* ⬆️ Contenu aligné en haut (plus de place sous "Message") */}
              <div style={{
                display:'grid',
                alignItems:'start',     // ⬅️ était placeItems:'center'
                justifyItems:'center',  // ⬅️ centrage horizontal conservé
                rowGap:8,               // spacing doux
                paddingTop:8            // petite respiration
              }}>
                <div style={{fontWeight:800, fontSize:24, letterSpacing:.2}}>{tsText}</div>

                <div style={{opacity:.7, fontSize:12, marginTop:8}}>Owned by</div>
                <div style={{fontWeight:800, fontSize:16}}>{owner || 'Anonymous'}</div>

                {title && (
                  <>
                    <div style={{opacity:.7, fontSize:12, marginTop:8}}>Title</div>
                    <div style={{fontWeight:800, fontSize:16}}>{title}</div>
                  </>
                )}

                {message && (
                  <>
                    <div style={{opacity:.7, fontSize:12, marginTop:6}}>Message</div>
                    <div style={{ maxWidth:'72%', lineHeight:1.35, fontSize:13 }}>
                      “{message}”
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer mock */}
            <div
              style={{
                position: 'absolute',
                left: EDGE_PX,
                bottom: EDGE_PX,
                fontSize: 12,
                color: previewSubtle,
                textAlign: 'left',
                pointerEvents: 'none',
              }}
            >
              Certificate ID • Integrity hash (aperçu)
            </div>

            <div
              style={{
                position: 'absolute',
                right: EDGE_PX,
                bottom: EDGE_PX,
                width: 84,
                height: 84,
                border: '1px dashed rgba(26,31,42,.45)',
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                opacity: .85,
                pointerEvents: 'none',
              }}
            >
              QR
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
    { title:'Cadeaux', text:'Une journée à offrir, personnelle et mémorable.', icon:'🎁' },
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


/* -------------------- Témoignages (identique) -------------------- */
function Testimonials() {
  const items = [
    { q:'“Nous avons revendiqué la journée de la naissance d’Aïcha… frissons à chaque fois !”', a:'Camille' },
    { q:'“Mon cadeau préféré : la journée de notre rencontre.”', a:'Thomas' },
    { q:'“La journée du diplôme de ma sœur. Simple, mémorable, classe.”', a:'Mina' },
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

/* -------------------- FAQ (FR + EN, sans ***, refonte) -------------------- */
function FAQ() {
  const pathname = usePathname() || '/'
  const href = useLocaleHref()
  const isFR = /^\/fr(\/|$)/.test(pathname)

  const rowsFR = [
    {
      q: 'Qu’est-ce que j’achète exactement ?',
      a: `Vous acquérez la propriété symbolique d’une journée (en UTC), vendue une seule fois.
Elle est matérialisée par un certificat numérique (PDF/JPG HD) et une page publique dédiée.
Ce n’est pas un droit juridique sur la date elle-même : c’est un objet de collection unique, comme une édition limitée.`
    },
    {
      q: 'Le certificat est-il personnalisable (photo) ?',
      a: `Oui. Vous pouvez définir un titre, un message, choisir un style de certificat et, sur les styles compatibles, ajouter une photo personnelle.
Le rendu HD inclut un QR code vers votre page. Contenu modéré.`
    },
    {
      q: 'Photos personnelles : exigences et droits',
      a: `Formats acceptés : JPG/PNG en haute résolution. Vous devez détenir les droits (ou disposer d’une autorisation).
Pas de visages de mineurs sans consentement parental, ni de contenus sensibles ou illicites. Vous pouvez remplacer la photo depuis votre page.`
    },
    {
      q: 'Comment garantissez-vous l’authenticité (SHA-256) ?',
      a: `Chaque certificat embarque une empreinte d’intégrité (SHA-256) calculée sur ses données clés (date UTC, propriétaire, titre, message, style…).
L’empreinte est imprimée sur le certificat et vérifiable via le QR. Toute altération la casserait : c’est notre preuve d’authenticité.`
    },
    {
      q: 'UTC, fuseaux horaires et précision',
      a: `La journée est ancrée en UTC. Sur la page, l’heure locale est affichée pour le contexte.
L’objet vendu est la journée (pas la minute), mais vous pouvez préciser l’heure dans votre message.`
    },
    {
      q: 'Puis-je revendre ma journée ?',
      a: `Oui. Revente possible sur notre place de marché.
Activez votre compte marchand Stripe (KYC) depuis votre compte.
Commission plateforme 10 % (min 1 €) lors de la vente. Virements via Stripe. Vos obligations fiscales s’appliquent.`
    },
    {
      q: 'Compte marchand : Particulier ou Professionnel',
      a: `En Particulier, la revente occasionnelle est possible ; si vos ventes deviennent régulières, passez en Professionnel.
Le changement de statut conserve l’historique Stripe. Stripe peut demander des informations KYC/KYB.`
    },
    {
      q: 'Qu’est-ce que le Registre public ?',
      a: `Une galerie — de l’art participatif — où vous pouvez exposer (ou non) votre certificat (date, titre, extrait, vignette).
Vous contrôlez la visibilité. Parcourir : ${href('/explore')}.`
    },
    {
      q: 'Impression et formats',
      a: `Fichiers HD (PDF/JPG) prêts à imprimer. Recommandé : A4/A3 en 300 DPI.
Les styles avec photo réservent une zone optimisée.`
    },
    {
      q: 'Délais et livraison',
      a: `Génération quasi immédiate (souvent moins de 2 minutes).
Vous recevez un e-mail avec les fichiers et le lien de page.`
    },
    {
      q: 'Paiement et sécurité',
      a: `Paiements opérés par Stripe. Aucune donnée de carte n’est stockée par Parcels of Time.
En revente, encaissements et virements passent par Stripe Connect.`
    },
    {
      q: 'Remboursement et erreurs',
      a: `Produit numérique livré immédiatement : renonciation au droit de rétractation.
En cas d’erreur de facturation (doublon, montant), contactez-nous pour correction/remboursement si applicable.`
    }
  ]

  const rowsEN = [
    {
      q: 'What exactly am I buying?',
      a: `You acquire the symbolic ownership of a calendar day (UTC), sold only once.
It is materialized by a digital certificate (HD PDF/JPG) and a dedicated public page.
This is not a legal right over the date itself: it is a unique collectible, like a limited edition.`
    },
    {
      q: 'Is the certificate customizable (photo)?',
      a: `Yes. You can set a title, a message, pick a certificate style and, on compatible styles, add your own photo.
The HD output includes a QR code to your page. All content is moderated.`
    },
    {
      q: 'Personal photos: requirements and rights',
      a: `Use JPG/PNG in high resolution. You must own the rights (or have permission).
No minors’ faces without parental consent, and no sensitive/illegal content. You can replace the photo later.`
    },
    {
      q: 'How is authenticity guaranteed (SHA-256)?',
      a: `Each certificate embeds an integrity hash (SHA-256) computed from its core data (UTC date, owner, title, message, style…).
The hash is printed on the certificate and verifiable via the QR. Any alteration would break it — that’s our proof of authenticity.`
    },
    {
      q: 'UTC, time zones, and precision',
      a: `The day is anchored in UTC. Your page also shows the local time for context.
The object sold is the day (not a minute), though you can note the exact time in your message.`
    },
    {
      q: 'Can I resell my day?',
      a: `Yes. You can resell it on our marketplace.
Enable your Stripe merchant account (KYC) from your account area.
Platform fee is 10% (min €1) at sale. Payouts handled by Stripe. Taxes are your responsibility.`
    },
    {
      q: 'Merchant account: Individual vs Business',
      a: `As an Individual, occasional resales are allowed; if sales become regular, switch to Business.
Switching status preserves your Stripe history. Stripe may require KYC/KYB information.`
    },
    {
      q: 'What is the Public Register?',
      a: `A gallery — participatory art — where owners can exhibit (or not) their certificate (date, title, snippet, thumbnail).
You control visibility. Browse it: ${href('/explore')}.`
    },
    {
      q: 'Printing and formats',
      a: `You’ll receive HD files (PDF/JPG) ready to print. Recommended: A4/A3 at 300 DPI.
Photo styles include an optimized image area.`
    },
    {
      q: 'Delivery time',
      a: `Near-instant generation (often under 2 minutes).
We email your files and the page link.`
    },
    {
      q: 'Payment and security',
      a: `Payments are processed by Stripe. Parcels of Time does not store card details.
For resales, charges and payouts run through Stripe Connect.`
    },
    {
      q: 'Refunds and mistakes',
      a: `Digital goods are delivered immediately, so you waive the right of withdrawal.
For billing mistakes (duplicates, wrong amount), contact us — we will fix/refund when applicable.`
    }
  ]

  const rows = isFR ? rowsFR : rowsEN

  return (
    <section id="faq" style={{maxWidth:1280, margin:'0 auto', padding:'24px 24px 72px'}}>
      <SectionLabel>FAQ</SectionLabel>
      <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:12}}>
        {rows.map((r,i)=>(
          <details key={i} style={{
            gridColumn:'span 6',
            background:'var(--color-surface)',
            border:'1px solid var(--color-border)',
            borderRadius:12,
            padding:14
          }}>
            <summary style={{cursor:'pointer', fontWeight:700, lineHeight:1.2}}>{r.q}</summary>
            <p style={{margin:'10px 0 0', whiteSpace:'pre-wrap'}}>{r.a}</p>
          </details>
        ))}
      </div>
      <div style={{marginTop:12, fontSize:12, color:'var(--color-muted)'}}>
        {isFR ? (
          <>Besoin d’aide ? Consultez <a href={href('/legal/terms')} style={{color:'inherit'}}>CGU/CGV</a> • <a href={href('/legal/privacy')} style={{color:'inherit'}}>Confidentialité</a> • <a href="mailto:hello@parcelsoftime.com" style={{color:'inherit'}}>Support</a></>
        ) : (
          <>Need help? See <a href={href('/legal/terms')} style={{color:'inherit'}}>Terms</a> • <a href={href('/legal/privacy')} style={{color:'inherit'}}>Privacy</a> • <a href="mailto:hello@parcelsoftime.com" style={{color:'inherit'}}>Support</a></>
        )}
      </div>
    </section>
  )
}


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


/* -------------------- Gift spotlight (NOUVEAU) -------------------- */
function GiftSpotlight() {
  const href = useLocaleHref()
  return (
    <section aria-labelledby="gift" style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
      <SectionLabel id="gift">Le cadeau original & personnalisable</SectionLabel>
      <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
        <div style={{gridColumn:'span 7', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:18}}>
          <h3 style={{margin:'0 0 8px', fontFamily:'Fraunces, serif'}}>Offrez une journée qui ne se reproduira jamais</h3>
          <ul style={{margin:0, paddingLeft:18, lineHeight:'28px'}}>
            <li>Certificat HD avec votre **photo** et **message** (modérés)</li>
            <li>QR vers une **page publique** (ou privée) pour partager l’histoire</li>
            <li>Livraison **instantanée** par e-mail — parfait pour un cadeau de dernière minute</li>
            <li>Véritable **rareté** : une seule vente par journée</li>
          </ul>
          <div style={{marginTop:12, display:'flex', gap:10, flexWrap:'wrap'}}>
            <Button href={href('/claim?gift=1')} variant="accent">🎁 Offrir un jour</Button>
            <Button href={href('/claim')} variant="secondary">Réserver pour moi</Button>
          </div>
        </div>
        <div style={{gridColumn:'span 5', display:'grid', gap:10}}>
          <div style={{border:'1px solid var(--color-border)', borderRadius:16, padding:14, background:'var(--color-surface)'}}>
            <strong>Occasions</strong>
            <p style={{margin:'6px 0 0', opacity:.9}}>Anniversaire, rencontre, diplôme, naissance, “le jour où…”</p>
          </div>
          <div style={{border:'1px solid var(--color-border)', borderRadius:16, padding:14, background:'var(--color-surface)'}}>
            <strong>Format</strong>
            <p style={{margin:'6px 0 0', opacity:.9}}>PDF/JPG haute définition, prêt à imprimer (A4/A3, 300 DPI)</p>
          </div>
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

  const whyText = useMemo(
    () =>
      "Nous accumulons des photos et des vidéos… et l’instant se perd. Parcels of Time vous permet de posséder une journée unique — avec un certificat HD, une page publique, et la possibilité de la revendre plus tard via Stripe Connect.",
    []
  )
  

  return (
    <main style={{background:'var(--color-bg)', color:'var(--color-text)'}}>
      <CookieBanner />
      <Header onToggleTheme={()=>setTheme(t=>t==='dark'?'light':'dark')} href={href} />
        
      <HeroPhotos href={href} />
      <GiftSpotlight /> 


      <section id="pourquoi" style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
        <SectionLabel>Pourquoi maintenant&nbsp;?</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16, alignItems:'start'}}>
          <p style={{gridColumn:'span 7', margin:0, fontSize:18, lineHeight:'28px'}}>{whyText}</p>
          <div style={{gridColumn:'span 5'}}>
            <UsagesCarousel />
          </div>
        </div>
      </section>

      <section aria-labelledby="possedez" style={{maxWidth:1280, margin:'0 auto', padding:'24px'}}>
        <SectionLabel id="possedez">Ce que vous possédez</SectionLabel>
        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Une journée unique" text="Jamais vendue deux fois. Votre instant, pour toujours." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Certificat de Claim" text="PDF/JPG signé, prêt à imprimer et encadrer." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="QR code scannable" text="Accès direct à votre page souvenir et partage facile." /></div>
          <div style={{gridColumn:'span 3'}}><FeatureCard title="Page dédiée" text="Message + lien (modérés), horodatage UTC & heure locale." /></div>
        </div>
      </section>

      <section id="receive" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Ce que vous recevez</SectionLabel>

        <div style={{display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
          <div style={{gridColumn:'span 4'}}>
            <CertificatePreview
              styleId="romantic"
              owner="Clara & Sam"
              title="Notre premier baiser"
              ts="2018-07-19"
              message="Te souviens-tu ? Ce 19 juillet 2018, on s’était abrités de l’averse. On riait comme des idiots, trempés jusqu’aux os. Puis, là, tu m’as embrassé."
              href={href('/claim?style=romantic')}
            />
          </div>

          <div style={{gridColumn:'span 4'}}>
            <CertificatePreview
              styleId="birth"
              owner="Nora & Mehdi"
              title="Bienvenue, Aïcha"
              ts="2023-03-02"
              message="À 06:12, le 2 mars 2023, tu as crié. Puis le silence d’après s’est rempli d’une nouvelle lumière : tu étais née. Le temps s’est figé. On a acheté cette journée pour ne jamais oublier ce moment."
              href={href('/claim?style=birth')}
            />
          </div>

          <div style={{gridColumn:'span 4'}}>
            <CertificatePreview
              styleId="wedding"
              owner="Inès & Hugo"
              title="À 17:31, plus que nous deux"
              ts="2024-07-20"
              message="Les amis criaient. Les confettis volaient. Mais je ne voyais que toi. À 17:31, nos deux « oui » ont effacé le reste. On garde cette journée pour entendre encore nos deux « oui » quand les mots manqueront."
              href={href('/claim?style=wedding')}
            />
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16, marginTop:18}}>
          <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <ul style={{margin:0, paddingLeft:18, lineHeight:'28px'}}>
              <li>Certificat numérique haute définition (PDF/JPG) prêt à imprimer</li>
              <li>QR code scannable qui mène à votre page souvenir</li>
              <li>Page dédiée partageable (message + lien), badge d’authenticité</li>
              <li>Styles premium : Romantic, Birth, Wedding, Christmas, New Year, Graduation…</li>
            </ul>
            <div style={{marginTop:12, fontSize:14, color:'var(--color-muted)'}}>
            Paiements & revente sécurisés par Stripe • Commission de place de marché : 10% (min 1 €) lors de la revente.
          </div>
          </div>
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <Button href={href('/claim')} variant="primary">Réserver un jour</Button>
            <Button href={href('/claim?gift=1')} variant="secondary">Offrir un jour</Button>
          </div>
        </div>
      </section>

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

      <section id="iconiques" style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px 40px'}}>
        <SectionLabel>Éditions limitées & jours iconiques</SectionLabel>
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

      <Testimonials />
      <FAQ />

      <section aria-labelledby="cta-final" style={{
        borderTop:'1px solid var(--color-border)', background:'linear-gradient(0deg, color-mix(in srgb, var(--color-surface) 85%, transparent), transparent)',
        marginTop:16
      }}>
        <div style={{maxWidth:1280, margin:'0 auto', padding:'36px 24px 64px', textAlign:'center'}}>
          <h3 id="cta-final" style={{fontFamily:'Fraunces, serif', fontSize:40, lineHeight:'48px', margin:'0 0 8px'}}>
            Transformez un instant en héritage.
          </h3>
          <p style={{margin:'0 0 16px'}}>Réservez le jour qui compte — aujourd’hui.</p>
          <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <Button href={href('/claim')} variant="primary">Réserver mon jour</Button>
            <Button href={href('/claim?gift=1')} variant="secondary">Offrir un jour</Button>
          </div>
          <div style={{marginTop:12, fontSize:12, color:'var(--color-muted)'}}>
          Paiement sécurisé Stripe • Certificat HD • Revente C2C possible • Une seule vente par journée
        </div>
        </div>
      </section>

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
      <footer style={{borderTop:'1px solid var(--color-border)', marginTop:24}}>
        <div style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px', display:'flex', gap:12, flexWrap:'wrap', fontSize:12, opacity:.85}}>
          <a href={href('/legal/legal-notice')} style={{color:'var(--color-text)'}}>Mentions légales</a>
          <a href={href('/legal/terms')} style={{color:'var(--color-text)'}}>CGU/CGV</a>
          <a href={href('/legal/seller')} style={{color:'var(--color-text)'}}>Conditions Vendeur</a>
          <a href={href('/legal/privacy')} style={{color:'var(--color-text)'}}>Confidentialité</a>
          <a href={href('/legal/cookies')} style={{color:'var(--color-text)'}}>Cookies</a>
        </div>
      </footer>
    </main>
  )
}
