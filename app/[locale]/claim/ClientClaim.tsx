//app/[locale]/claim/clientclaim.tsx
'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

declare module 'exifr' {
  export function parse(input: Blob | ArrayBuffer | string, options?: any): Promise<any>;
}

type CertStyle =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation' | 'custom';

/** ====== Styles disponibles (uniquement les IDs ; libellés/hints localisés plus bas) ====== */
const STYLE_IDS: readonly CertStyle[] = [
  'neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'
]
const STYLES: { id: CertStyle }[] = STYLE_IDS.map(id => ({ id }))

/** ====== Constantes PDF (miroir de app/lib/cert.ts) ====== */
const A4_W_PT = 595.28
const A4_H_PT = 841.89
const EDGE_PT = 16
const QR_SIZE_PT = 120
const META_H_PT = 76
const PT_PER_CM = 28.3465
const SHIFT_UP_PT = Math.round(2 * PT_PER_CM) // 2cm

function getSafeArea(style: CertStyle){
  const base = { top: 120, right: 100, bottom: 130, left: 100 }
  switch (style) {
    case 'romantic':   return { top: 120, right: 100, bottom: 130, left: 100 }
    case 'birthday':   return { top: 120, right: 100, bottom: 130, left: 100 }
    case 'birth':      return { top: 120, right: 100, bottom: 130, left: 100 }
    case 'wedding':    return { top: 120, right: 100, bottom: 130, left: 100 }
    case 'christmas':  return { top: 120, right: 100, bottom: 130, left: 100 }
    case 'newyear':    return { top: 120, right: 100, bottom: 130, left: 100 }
    case 'graduation': return { top: 120, right: 100, bottom: 130, left: 100 }
    case 'custom':     return { top: 120, right: 100, bottom: 130, left: 100 }
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

// string ISO/Date -> YMD
const ymd = (d: Date | string) => {
  try { const dd = new Date(d as any); dd.setUTCHours(0,0,0,0); return dd.toISOString().slice(0,10) } catch { return '' }
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

function stripAttestationText(input: string): string {
  if (!input) return ''
  return input
    .replace(/\s*Ce certificat atteste que[\s\S]+?cette acquisition\.\s*/gi, '')
    .replace(/\s*This certificate attests that[\s\S]+?this acquisition\.\s*/gi, '')
    .trim()
}

function unpackClaimMessage(raw: string) {
  const GIFT_MAX = 40
  if (!raw) return { message: '', giftedBy: '', hideOwned: false, hadAttestation: false }

  // Détection de l'attestation FR/EN avant strip
  const RE_ATTEST_FR = /Ce certificat atteste que[\s\S]+?cette acquisition\./i
  const RE_ATTEST_EN = /This certificate attests that[\s\S]+?this acquisition\./i
  const hadAttestation = RE_ATTEST_FR.test(raw) || RE_ATTEST_EN.test(raw)

  // Retire l'attestation
  let msg = raw.replace(RE_ATTEST_FR, '').replace(RE_ATTEST_EN, '').trim()

  // Flag de masquage du propriétaire
  let hideOwned = false
  if (/\[\[\s*HIDE_OWNED_BY\s*\]\]/i.test(msg)) {
    hideOwned = true
    msg = msg.replace(/\s*\[\[\s*HIDE_OWNED_BY\s*\]\]\s*/gi, '').trim()
  }

  // “Offert par / Gifted by”
  let giftedBy = ''
  const giftedRe = /(?:^|\n)\s*(?:Offert\s+par|Gifted\s+by)\s*:\s*(.+)\s*$/i
  const m = msg.match(giftedRe)
  if (m) {
    giftedBy = (m[1] || '').trim().slice(0, GIFT_MAX)
    msg = msg.replace(giftedRe, '').trim()
  }

  return { message: msg, giftedBy, hideOwned, hadAttestation }
}





/** ====== Localisation ====== */

// Libellés de styles (FR/EN)
function STYLE_TEXTS(fr:boolean): Record<CertStyle, {label:string; hint?:string}> {
  return fr ? {
    neutral:    { label:'Neutre',      hint:'sobre & élégant' },
    romantic:   { label:'Romantique',  hint:'cœurs & dentelle' },
    birthday:   { label:'Anniversaire',hint:'ballons & confettis' },
    wedding:    { label:'Mariage',     hint:'anneaux & botanique' },
    birth:      { label:'Naissance',   hint:'nuages pastel & étoiles' },
    christmas:  { label:'Noël',        hint:'sapin & neige' },
    newyear:    { label:'Nouvel An',   hint:'traînées de feux d’artifice' },
    graduation: { label:'Diplôme',     hint:'laurier & toques' },
    custom:     { label:'Personnalisé',hint:'A4 2480×3508 ou 1024×1536' },
  } : {
    neutral:    { label:'Neutral',     hint:'subtle & elegant' },
    romantic:   { label:'Romantic',    hint:'hearts & lace' },
    birthday:   { label:'Birthday',    hint:'balloons & confetti' },
    wedding:    { label:'Wedding',     hint:'rings & botanicals' },
    birth:      { label:'Birth',       hint:'pastel clouds & stars' },
    christmas:  { label:'Christmas',   hint:'pine & snow' },
    newyear:    { label:'New Year',    hint:'fireworks trails' },
    graduation: { label:'Graduation',  hint:'laurel & caps' },
    custom:     { label:'Custom',      hint:'A4 2480×3508 or 1024×1536' },
  }
}

// Textes d’interface
function TEXTS(fr:boolean) {
  return {
    brand: 'Parcels of Time',
    securePayment: fr ? 'Paiement sécurisé ' : 'Secure payment ',
    headerGift: fr ? 'Offrir une journée' : 'Gift this day',
    headerReserve: fr ? 'Réserver votre journée' : 'Reserve your day',
    giftOn: fr ? '🎁 Mode cadeau activé' : '🎁 Gift mode on',
    giftOff: fr ? '🎁 Activer le mode cadeau' : '🎁 Enable gift mode',

    step1: fr ? 'ÉTAPE 1 — VOTRE JOUR' : 'STEP 1 — YOUR DAY',
    year: fr ? 'Année' : 'Year',
    month: fr ? 'Mois' : 'Month',
    day: fr ? 'Jour' : 'Day',
    updating: fr ? '— Maj…' : '— updating…',
    loadingCert: fr ? '— chargement du certificat…' : '— loading certificate…',
    daySuffix: {
      unavailable: fr ? ' — indisponible' : ' — unavailable',
      onSale: fr ? ' — en vente' : ' — on sale',
      available: fr ? ' — disponible' : ' — available',
    },
    redHint: fr ? 'Les jours en rouge sont indisponibles.' : 'Red days are unavailable.',
    yellowHint: fr ? 'Les jours en jaune sont revendus (marketplace).' : 'Yellow days are being resold (marketplace).',

    price: fr ? 'Prix' : 'Price',
    pill: {
      unavailable: fr ? 'Indisponible' : 'Unavailable',
      marketplace: 'Marketplace',
      available: fr ? 'Disponible' : 'Available',
    },
    sellerNote: fr ? 'fixé par le vendeur' : 'set by seller',

    step2: fr ? 'ÉTAPE 2 — INFORMATIONS' : 'STEP 2 — INFORMATION',
    emailLabelGift: fr ? 'Votre e-mail (reçu & certificat)' : 'Your email (receipt & certificate)',
    emailLabel: fr ? 'E-mail (reçu & certificat)' : 'Email (receipt & certificate)',
    emailPh: fr ? 'vous@exemple.com' : 'you@example.com',

    ownedBy: fr ? 'Au nom de' : 'Owned by',
    giftedBy: fr ? 'Offert par' : 'Gifted by',
    nameOnCert: fr ? 'Nom sur le certificat' : 'Name on certificate',
    destName: fr ? 'Nom du·de la destinataire' : 'Recipient’s name',
    giftedPh: fr ? 'Ex. “Offert par Vincent”' : 'e.g. “Gifted by Vincent”',
    anon: fr ? 'Anonyme' : 'Anonymous',

    titleLabel: fr ? 'Titre' : 'Title',
    titlePh: fr ? 'Ex. “Joyeux anniversaire !”' : 'e.g. “Happy Birthday!”',
    messageLabel: fr ? 'Message' : 'Message',
    messagePhGift: fr ? '“Le jour de notre rencontre…”' : '“The day we met…”',
    messagePh: fr ? '“Le jour où tout a commencé.”' : '“The day it all began.”',
    messageOverflow: fr ? 'Votre message dépasse la limite autorisée' : 'Your message exceeds the allowed limit',

    showHideHeader: fr
      ? 'Affichage sur le certificat (vous pouvez retirer les éléments non essentiels)'
      : 'Display on the certificate (you can hide non-essential elements)',
    attestationLabel: fr ? 'Texte d’attestation' : 'Attestation text',
    alwaysShown: fr ? 'Imposés :' : 'Always shown:',
    alwaysShownList: fr ? 'Parcels of Time, Certificate of Claim, la date.' : 'Parcels of Time, Certificate of Claim, the date.',

    textColorHeader: fr ? 'COULEUR DE LA POLICE' : 'TEXT COLOR',
    contrast: fr ? 'Contraste' : 'Contrast',
    textPreview: fr ? 'Aperçu de texte' : 'Text preview',
    picker: fr ? 'Sélecteur' : 'Picker',
    hex: 'HEX',
    colorTip: fr ? 'Astuce : choisissez une couleur sombre pour la lisibilité sur fond clair.'
                 : 'Tip: pick a dark color for good readability on a light background.',

    step3: fr ? 'ÉTAPE 3 — STYLE' : 'STEP 3 — STYLE',
    loadingDots: fr ? 'Chargement…' : 'Loading…',
    imageLoaded: fr ? 'Image chargée ✓' : 'Image loaded ✓',

    registryEyebrowFR: 'Registre public (optionnel)',
    registryEyebrowEN: 'Public Registry (optional)',

    consentsHeader: fr ? 'Conformité & consentements' : 'Compliance & consents',
    acceptTermsA: fr ? 'J’accepte et j’ai lu les ' : 'I accept and have read the ',
    terms: fr ? 'CGU/CGV' : 'Terms & Conditions',
    andPrivacy: fr ? ' et la ' : ' and the ',
    privacy: fr ? 'Privacy Policy' : 'Privacy Policy',
    stripeNotice: fr
      ? 'Je comprends que mes données (email, montant, pays) sont partagées avec Stripe pour le paiement sécurisé.'
      : 'I understand my data (email, amount, country) is shared with Stripe for secure payment.',
    imgRightsConsent: fr
      ? 'En cas de publication dans le registre public, j’atteste disposer des droits nécessaires (ou d’une licence) pour l’image importée.'
      : 'If publishing to the public registry, I confirm I have the necessary rights (or a license) for the uploaded image.',
    fullBreakdown: fr
      ? 'Le récapitulatif complet (prix, taxes le cas échéant) est affiché sur la page Stripe avant paiement.'
      : 'The full breakdown (price, taxes if any) is shown on Stripe before payment.',

    submitRedirecting: fr ? 'Redirection…' : 'Redirecting…',
    submitGift: fr ? 'Offrir cette journée' : 'Gift this day',
    submitPayReserve: fr ? 'Payer & réserver cette journée' : 'Pay & reserve this day',
    immediateExec: fr
      ? 'Contenu numérique livré immédiatement : vous demandez l’exécution immédiate et renoncez au droit de rétractation (UE).'
      : 'Digital content delivered immediately: you request immediate execution and waive the right of withdrawal (EU).',

    asideLabel: fr ? 'Aperçu du certificat' : 'Certificate preview',
    loadingCertificate: fr ? 'Chargement du certificat…' : 'Loading certificate…',
    bgAltPrefix: fr ? 'Aperçu fond certificat — ' : 'Certificate background preview — ',

    footerCertId: fr ? 'ID du certificat' : 'Certificate ID',
    footerIntegrity: fr ? 'Intégrité (SHA-256)' : 'Integrity (SHA-256)',
    asideTip: (owned:string, title:string, message:string) =>
      fr
        ? `Astuce : pour un certificat minimaliste, décochez “${owned}”, “${title}”, “${message}”.`
        : `Tip: for a minimalist certificate, uncheck “${owned}”, “${title}”, “${message}”.`,

    // Erreurs & validations
    errors: {
      dateInvalid: fr ? 'Merci de saisir une date valide.' : 'Please enter a valid date.',
      dateTooHigh: (max:string) =>
        fr ? `La date choisie dépasse la limite autorisée (${max}).`
           : `Selected date exceeds the allowed limit (${max}).`,
      dayUnavailable: fr ? 'Ce jour est indisponible. Merci d’en choisir un autre.' : 'This day is unavailable. Please choose another one.',
      checkoutCreate: fr ? 'Erreur de création de session de paiement.' : 'Error creating checkout session.',
      heavyImage413: fr
        ? 'Image personnalisée trop lourde (413 Payload Too Large). Réduisez la taille de votre image et réessayez.'
        : 'Custom image too large (413 Payload Too Large). Reduce the image size and try again.',
      unknown: fr ? 'Erreur inconnue' : 'Unknown error',
      // Friendly mapping
      friendlyMap: (status:number, rid?:string) => ({
        rate_limited: fr ? 'Trop de tentatives. Réessayez dans ~1 minute.' : 'Too many attempts. Please try again in ~1 minute.',
        invalid_ts: fr ? 'Horodatage invalide. Utilisez un ISO comme 2100-01-01.' : 'Invalid timestamp. Use an ISO date like 2100-01-01.',
        missing_fields: fr ? 'Merci de renseigner au minimum l’e-mail et la date.' : 'Please provide at least email and date.',
        custom_bg_invalid: fr ? 'Image personnalisée invalide (PNG/JPEG en data URL requis).' : 'Invalid custom image (PNG/JPEG data URL required).',
        stripe_key_missing: fr ? 'Configuration Stripe absente côté serveur.' : 'Missing Stripe configuration on server.',
        bad_price: fr ? 'Prix invalide pour cette journée.' : 'Invalid price for this day.',
        stripe_error: fr ? 'Erreur Stripe côté serveur.' : 'Stripe error on server.',
        date_unavailable: fr ? 'Ce jour vient d’être vendu. Merci d’en choisir un autre.' : 'This day has just been sold. Please pick another one.',
        wrap: (base:string, code:string, detail?:string) =>
          `${base} (${status}${rid ? ` • req ${rid}` : ''}) — ${code}${detail ? ` : ${String(detail).slice(0, 300)}` : ''}`
      })
    },

    // Aide taille / formats custom
    customLimits: fr
      ? 'Rappels — images custom :\n• Formats en entrée : JPEG, PNG, WebP, AVIF, GIF (1er frame), BMP, SVG, HEIC/HEIF (convertis), TIFF (baseline).\n• Sortie envoyée : JPEG A4 2480×3508 (~300 dpi), taille finale < 4 Mo.\n• Le serveur n’accepte que PNG/JPEG en data URL.\n• AVIF/WebP/TIFF peuvent ne pas être décodés par certains navigateurs.\n• Les GIF/HEIC “séquence” sont aplatis au 1er frame.\n• Les images énormes peuvent échouer (limite mémoire/canvas) : réduisez la résolution si besoin.'
      : 'Reminders — custom images:\n• Input formats: JPEG, PNG, WebP, AVIF, GIF (first frame), BMP, SVG, HEIC/HEIF (converted), TIFF (baseline).\n• Output sent: A4 JPEG 2480×3508 (~300 dpi), final size < 4 MB.\n• Server accepts only PNG/JPEG as data URLs.\n• AVIF/WebP/TIFF may not decode in some browsers.\n• GIF/HEIC “sequence” files are flattened to first frame.\n• Very large images may fail (memory/canvas limit): reduce the image size if needed.'
  }
}

/* ========================================================================================= */

export default function ClientClaim({ prefillEmail }: { prefillEmail?: string }) {
  const params = useSearchParams()
  const prefillRaw = params.get('ts') || ''
  const prefillTs = prefillRaw ? safeDecode(prefillRaw) : ''
  const styleParam = (params.get('style') || '').toLowerCase()
  const giftParam = params.get('gift')
  const initialGift = giftParam === '1' || giftParam === 'true'
  /* === Mobile breakpoint — n'impacte pas le desktop === */
  const [isSmall, setIsSmall] = useState(false)
  useEffect(() => {
    const onResize = () => setIsSmall(typeof window !== 'undefined' && window.innerWidth < 980)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Locale
  const loc = useMemo(() => {
    try {
      const seg = (window.location.pathname.split('/')[1] || '').slice(0,2).toLowerCase()
      if (seg === 'fr' || seg === 'en') return seg
      return (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en'
    } catch { return 'en' }
  }, [])
  const isFR = loc === 'fr'
  const T = useMemo(()=>TEXTS(isFR), [isFR])
  const ST = useMemo(()=>STYLE_TEXTS(isFR), [isFR])

  const allowed = STYLES.map(s => s.id)
  const initialStyle: CertStyle = (allowed as readonly string[]).includes(styleParam as CertStyle)
    ? (styleParam as CertStyle) : 'neutral'

  const [isGift, setIsGift] = useState<boolean>(initialGift)

  // bornes
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

  // Date initiale
  const prefillDate = parseToDateOrNull(prefillTs) || todayUtc
  const [Y, setY] = useState<number>(prefillDate.getUTCFullYear())
  const [M, setM] = useState<number>(prefillDate.getUTCMonth()+1)
  const [D, setD] = useState<number>(prefillDate.getUTCDate())

  const MIN_GAP_HEADER_PT = 28
  const lastPrefilledYmdRef = useRef<string | null>(null)
  const ymdSelected = useMemo(() => {
    try { return new Date(Date.UTC(Y, M-1, D)).toISOString().slice(0,10) } catch { return '' }
  }, [Y, M, D])

  // ---- Listing actif (par /api/marketplace/by-ts/[ts]) ----
  type Listing = { id: string; ts: string; price_cents: number; currency: string; hide_claim_details?: boolean }
  const [activeListing, setActiveListing] = useState<Listing | null>(null)
  const [listingForYMD, setListingForYMD] = useState<string>('')

  useEffect(() => {
    let cancelled = false
  
    // ⚠️ reset immédiat du rendu claim le temps de (re)charger
    setIsLoadingClaim(false)
    setActiveListing(null)
    setListingForYMD(ymdSelected)
  
    // ✅ on passe YMD nu (YYYY-MM-DD) – plus robuste côté API
    ;(async () => {
      try {
        const res = await fetch(`/api/marketplace/by-ts/${encodeURIComponent(ymdSelected)}`, { cache:'no-store' })
        const j = await res.json()
        if (!cancelled) {
          // ✅ ne PAS re-filtrer par ymd(ret.ts) — certaines horodatations décalent le jour
          setActiveListing(j?.listing || null)
        }
      } catch {
        if (!cancelled) setActiveListing(null)
      }
    })()
  
    return () => { cancelled = true }
  }, [ymdSelected])
  
  

  // util
  function pickFirstFreeWhiteDay(days: Array<{ ymd: string; sold?: boolean; listing_active?: boolean }>, todayYmd: string) {
    const white = days.find(d => !d.sold && !d.listing_active)
    if (white) return white.ymd
    const freeAny = days.find(d => !d.sold)
    if (freeAny) return freeAny.ymd
    return todayYmd
  }

  // clamp Y/M/D
  useEffect(()=>{ const dim=daysInMonth(Y,M); if(D>dim) setD(dim) }, [Y,M])
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

  const L = useMemo(()=>({
    brand: T.brand,
    title: isFR ? 'Certificat d’acquisition' : 'Certificate of Claim',
    ownedBy: T.ownedBy,
    giftedBy: T.giftedBy,
    titleLabel: T.titleLabel,
    message: T.messageLabel,
    attestationLabel: T.attestationLabel,
    link: isFR ? 'Lien' : 'Link',
    anon: T.anon,
    placeholders:{
      giftedName: isFR ? 'Votre nom' : 'Your name',
      title:      isFR ? 'Votre titre' : 'Your title',
      message:    isFR ? 'Votre message…' : 'Your message…',
      dateYMD:    isFR ? 'AAAA-MM-JJ' : 'YYYY-MM-DD',
    }
  }), [T, isFR])

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
    gifted_by: '',
    link_url: '',
    ts: prefillTs,
    cert_style: initialStyle as CertStyle,
    time_display: 'local+utc' as 'utc'|'utc+local'|'local+utc',
    local_date_only: true,
    text_color: '#1A1F2A',
    title_public: false,
    message_public: false,
    public_registry: false,
  })

  // Visibilité des sections
  const [show, setShow] = useState({
    ownedBy: true,
    title: true,
    message: true,
    attestation: true,
    giftedBy: true,
  })

  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  // Jours indisponibles / en vente (pour l’affichage du sélecteur & prix)
  const [unavailableDays, setUnavailableDays] = useState<number[]>([])
  const [isLoadingDays, setIsLoadingDays] = useState(false)
  const [forSaleDays, setForSaleDays] = useState<number[]>([])
  const [saleLookup, setSaleLookup] = useState<Record<number, { id:string; price_cents:number; currency:string }>>({})
  const [isLoadingClaim, setIsLoadingClaim] = useState(false)
  const autoPickDoneRef = useRef(false)

  // auto-pick jour blanc si pas de ts pré-rempli
  useEffect(() => {
    if (autoPickDoneRef.current || prefillTs) { autoPickDoneRef.current = true; return }
    if (!hasHydrated(Y, M)) return
    ;(async () => {
      const nearest = await findNearestWhiteDate()
      if (nearest) { setY(nearest.y); setM(nearest.m); setD(nearest.d) }
      autoPickDoneRef.current = true
    })()
  }, [prefillTs, Y, M, isLoadingDays])

  // cache par mois
  type MonthCache = {
    red: number[]
    yellow: number[]
    lookup: Record<number, { id:string; price_cents:number; currency:string }>
    hydrated: boolean
  }
  const monthCacheRef = useRef<Map<string, MonthCache>>(new Map())
  const monthKey = (y:number,m:number) => `${y}-${String(m).padStart(2,'0')}`
  const hasHydrated = (y:number, m:number) => !!monthCacheRef.current.get(monthKey(y,m))?.hydrated

  async function getMonthData(y:number, m:number): Promise<MonthCache> {
    const ym = monthKey(y,m)
    const cached = monthCacheRef.current.get(ym)
    if (cached?.hydrated) return cached
    try {
      const res = await fetch(`/api/unavailable?ym=${ym}`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      const red = Array.isArray(data?.unavailable) ? data.unavailable : []
      const yellow = Array.isArray(data?.for_sale) ? data.for_sale : []
      const listingList = Array.isArray(data?.listings) ? data.listings : []
      const lookup: Record<number, { id:string; price_cents:number; currency:string }> = {}
      for (const it of listingList) {
        if (typeof it?.d === 'number') {
          lookup[it.d] = { id: String(it.id), price_cents: it.price_cents, currency: it.currency || 'EUR' }
        }
      }
      const mc: MonthCache = { red, yellow, lookup, hydrated:true }
      monthCacheRef.current.set(ym, mc)
      return mc
    } catch {
      return { red:[], yellow:[], lookup:{}, hydrated:false }
    }
  }

  async function isWhiteDay(date: Date): Promise<boolean> {
    if (date.getTime() > maxDateUtc.getTime()) return false
    const y = date.getUTCFullYear(), m = date.getUTCMonth()+1, d = date.getUTCDate()
    const dim = daysInMonth(y, m)
    const maxDayThisMonth = (y === MAX_Y && m === MAX_M) ? Math.min(dim, MAX_D) : dim
    if (d > maxDayThisMonth) return false
    const month = await getMonthData(y, m)
    return !month.red.includes(d) && !month.yellow.includes(d)
  }

  async function findNearestWhiteDate(): Promise<{y:number; m:number; d:number} | null> {
    const forwardLimit = Math.ceil((maxDateUtc.getTime() - todayUtc.getTime()) / (24*3600*1000))
    const backwardLimit = 365
    const limit = Math.max(forwardLimit, backwardLimit)
    for (let delta = 0; delta <= limit; delta++) {
      const offsets = delta === 0 ? [0] : [delta, -delta]
      for (const off of offsets) {
        const cand = new Date(todayUtc)
        cand.setUTCDate(cand.getUTCDate() + off)
        if (await isWhiteDay(cand)) {
          return { y: cand.getUTCFullYear(), m: cand.getUTCMonth()+1, d: cand.getUTCDate() }
        }
      }
    }
    return null
  }

  // fetch des jours par mois
  const daysReqAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    const ym = `${Y}-${String(M).padStart(2,'0')}`
    if (daysReqAbortRef.current) { try { daysReqAbortRef.current.abort() } catch {}; daysReqAbortRef.current = null }
    setIsLoadingDays(true)
    setUnavailableDays([]); setForSaleDays([]); setSaleLookup({})

    const cached = monthCacheRef.current.get(ym)
    if (cached?.hydrated) {
      setUnavailableDays(cached.red)
      setForSaleDays(cached.yellow)
      setSaleLookup(cached.lookup)
      setIsLoadingDays(false)
      return
    }
    const ctrl = new AbortController()
    daysReqAbortRef.current = ctrl
    ;(async () => {
      try {
        const res = await fetch(`/api/unavailable?ym=${ym}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error('bad status')
        const data = await res.json()
        const red = Array.isArray(data?.unavailable) ? data.unavailable : []
        const yellow = Array.isArray(data?.for_sale) ? data.for_sale : []
        const listingList = Array.isArray(data?.listings) ? data.listings : []

        setUnavailableDays(red)
        setForSaleDays(yellow)

        const map: Record<number, {id:string; price_cents:number; currency:string}> = {}
        for (const it of listingList) {
          if (typeof it?.d === 'number') {
            map[it.d] = { id: String(it.id), price_cents: it.price_cents, currency: it.currency || 'EUR' }
          }
        }
        setSaleLookup(map)
        monthCacheRef.current.set(ym, { red, yellow, lookup: map, hydrated:true })
      } catch (e:any) {
        if (e?.name !== 'AbortError') {
          setUnavailableDays([]); setForSaleDays([]); setSaleLookup({})
        }
      } finally {
        if (daysReqAbortRef.current === ctrl) daysReqAbortRef.current = null
        setIsLoadingDays(false)
      }
    })()
    return () => {
      if (daysReqAbortRef.current === ctrl) { try { ctrl.abort() } catch {}; daysReqAbortRef.current = null }
    }
  }, [Y, M])

  // Si le jour sélectionné devient indisponible
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

  // Recalcule ts
  useEffect(()=>{
    const d = new Date(Date.UTC(Y, M-1, D, 0, 0, 0, 0))
    setForm(f=>({ ...f, ts: isoDayString(d) }))
  }, [Y, M, D])

// --------- Pré-remplissage si jour en vente ---------
useEffect(() => {
  // 🔹 Pas de listing → pas de preview → pas de loader
  if (!activeListing) { setIsLoadingClaim(false); return }

  // 🔹 Mode “vierge” → purge + pas de preview → pas de loader
  if (activeListing?.hide_claim_details) {
    setIsLoadingClaim(false)
    lastPrefilledYmdRef.current = null

    setForm(f => ({
      ...f,
      display_name: '',
      title: '',
      message: '',
      gifted_by: '',
      link_url: '',
      cert_style: 'neutral',
      text_color: '#1A1F2A',
    }))
    setCustomBg(null)
    setShow(s => ({
    ...s,
    ownedBy: true,
    title: true,
    message: true,
    attestation: true,
    giftedBy: isGift ? true : false,
  }))

  return
}

  // Listing classique : on hydrate avec la preview du claim
  const ysel = ymdSelected
  if (lastPrefilledYmdRef.current === ysel) return
  lastPrefilledYmdRef.current = ysel


  let cancelled = false
  setIsLoadingClaim(true)
  ;(async () => {
    try {
      const res = await fetch(`/api/claim/preview/by-ts/${encodeURIComponent(ysel)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('bad status')
      const j = await res.json()
      const c = j?.claim
      if (!c) return
      if (cancelled || ymdSelected !== ysel) return

      // Déplie le message : enlève attestation, récupère “Offert par / Gifted by” et le flag hide owned
      const { message: msgUser, giftedBy, hideOwned, hadAttestation } =
       unpackClaimMessage(String(c.message || ''))


      // Style texte & thème
      const nextStyle = (STYLE_IDS as readonly string[]).includes(String(c.cert_style || '').toLowerCase())
        ? (String(c.cert_style).toLowerCase() as CertStyle)
        : 'neutral'
      const nextColor = (c.text_color && /^#[0-9a-f]{6}$/i.test(c.text_color)) ? c.text_color : '#1A1F2A'

      // Fond custom s’il existe dans la preview
      const bgUrl =
        j?.custom_bg_data_url // ✅ la preview renvoie souvent l’image ici (niveau racine)
        || c?.custom_bg_data_url
        || c?.custom_bg_url
        || c?.bg_url
        || c?.background_url
        || ''

      if (nextStyle === 'custom' && bgUrl) {
        // dimensions A4 pour la preview
        setCustomBg({ url: bgUrl, dataUrl: bgUrl, w: 2480, h: 3508 })
      } else {
        setCustomBg(null)
      }

      // Met à jour le formulaire
      setForm(f => ({
        ...f,
        display_name: String(c.display_name || ''),
        title: String(c.title || ''),
        message: String(msgUser || ''),
        gifted_by: String(giftedBy || ''),
        link_url: String(c.link_url || ''),
        cert_style: nextStyle,
        text_color: nextColor,
      }))

      // Logiques d’affichage
      setIsGift(Boolean(giftedBy))
      setShow({
        ownedBy: hideOwned ? false : Boolean(c.display_name && String(c.display_name).trim()),
        title: Boolean(c.title && String(c.title).trim()),
        message: Boolean(msgUser && String(msgUser).trim()),
        attestation: hadAttestation,     // ✅ respecte l'état réel du certificat source
        giftedBy: Boolean(giftedBy),
      })
    } catch {
      // no-op : on laissera l’état par défaut si la preview échoue
    } finally {
      if (!cancelled) setIsLoadingClaim(false)
    }
  })()

  // cleanup en cas de changement de jour
  return () => { cancelled = true; setIsLoadingClaim(false) }
}, [activeListing, ymdSelected])

  

  // Quand la date n'est pas en vente → état par défaut
  useEffect(() => {
    if (activeListing) return
    // 🧯 Jour blanc : aucun fetch claim → on s'assure que le loader est coupé
    setIsLoadingClaim(false)
  
    lastPrefilledYmdRef.current = null
    setForm(f => ({
      ...f,
      display_name: '',
      title: '',
      message: '',
      gifted_by: '',
      link_url: '',
      cert_style: 'neutral',
      text_color: '#1A1F2A',
    }))
    setCustomBg(null)
    setShow(s => ({
      ...s,
      ownedBy: true,
      title: true,
      message: true,
      attestation: true,
      giftedBy: isGift ? true : false,
    }))
  }, [activeListing, isGift])
  

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

  // Consentements requis
  const needsCustomImageConsent = useMemo(
    () => form.cert_style === 'custom' && !!customBg,
    [form.cert_style, customBg]
  )
  const needsPublicContentConsent = useMemo(
    () => !!form.public_registry,
    [form.public_registry]
  )

  const [acceptCustomImageRules, setAcceptCustomImageRules] = useState(false)
  const [acceptPublicContentRules, setAcceptPublicContentRules] = useState(false)
  useEffect(() => { if (!needsCustomImageConsent) setAcceptCustomImageRules(false) }, [needsCustomImageConsent])
  useEffect(() => { if (!needsPublicContentConsent) setAcceptPublicContentRules(false) }, [needsPublicContentConsent])

    const moderationConsentText: React.ReactNode = isFR ? (
      <>
        Je confirme que mon contenu public respecte notre{" "}
        <a href={`/${loc}/support`} style={{ color: 'var(--color-text)' }}>
          charte de modération
        </a>
        . Publication modérée ; contenu susceptible d’être retiré.
      </>
    ) : (
      <>
        I confirm my public content follows our{" "}
        <a href={`/${loc}/support`} style={{ color: 'var(--color-text)' }}>
          moderation guidelines
        </a>
        . Publication is moderated and content may be removed.
      </>
    )
    
  // ====== Conversions images (HEIC/TIFF/etc.) ======
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
    if (looks(['heic','heif'], name, type)) {
      const { file: afterHeic } = await heicToPngIfNeeded(original)
      const orientation = await getExifOrientation(original)
      return rasterizeVectorOrBitmap(afterHeic, orientation)
    }
    if (looks(['tif','tiff'], name, type)) {
      return decodeTiffToPngDataUrl(original)
    }
    if (looks(['svg'], name, type)) {
      return rasterizeVectorOrBitmap(original, 1)
    }
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

  const onPickCustomBg = async (file?: File | null) => {
    try {
      setCustomErr('')
      if (!file) { log('No file selected'); return }
      setImgLoading(true)
      const { dataUrl: normalizedUrl, w, h } = await normalizeToPng(file)
      const { dataUrl: a4Url, w: tw, h: th } = await coverToA4JPEG(normalizedUrl, w, h)
      if (bytesFromDataURL(a4Url) > 4 * 1024 * 1024) {
        setCustomErr((isFR
          ? 'Image trop lourde après préparation (< 4 Mo requis). Recadrez/compressez l’image puis réessayez.\n\n'
          : 'Image too heavy after preparation (< 4 MB required). Crop/compress then try again.\n\n'
        ) + T.customLimits)
        return
      }
      setCustomBg({ url: a4Url, dataUrl: a4Url, w: tw, h: th })
      setForm(f => ({ ...f, cert_style: 'custom' }))
      log('CustomBG ready (A4 JPEG)', { w: tw, h: th, approxKB: Math.round(bytesFromDataURL(a4Url) / 1024) })
    } catch (e) {
      console.error('[Claim/CustomBG] onPickCustomBg', e)
      setCustomErr(
        (isFR
          ? 'Erreur de lecture ou de conversion de l’image. Possible : format non supporté par votre navigateur (AVIF/WebP/TIFF), fichier corrompu, ou image trop volumineuse.\n\n'
          : 'Error reading or converting the image. Possible: format not supported by your browser (AVIF/WebP/TIFF), corrupted file, or image too large.\n\n'
        ) + T.customLimits
      )
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setImgLoading(false)
    }
  }

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
    if (!d) { setStatus('error'); setError(T.errors.dateInvalid); return }
    if (d.getTime() > maxDateUtc.getTime()) {
      setStatus('error'); setError(T.errors.dateTooHigh(ymdUTC(maxDateUtc))); return
    }

    // Marketplace ?
    const dayNum = D
    const listing = saleLookup[dayNum]
    if (listing) {
      const safeUserMsg = show.message ? (form.message || '') : ''
      const cappedUserMsg = userMsgMaxChars > 0 ? safeUserMsg.slice(0, userMsgMaxChars) : ''
      const msgParts: string[] = []
      if (show.message && cappedUserMsg.trim()) msgParts.push(cappedUserMsg.trim())
      if (show.attestation) msgParts.push(attestationText)
      if (isGift && show.giftedBy && form.gifted_by.trim()) {
        msgParts.push(`${giftLabel}: ${form.gifted_by.trim().slice(0, GIFT_MAX)}`)
      }
      if (!show.ownedBy) msgParts.push('[[HIDE_OWNED_BY]]')
      const finalMessage = msgParts.length ? msgParts.join('\n') : ''

      const payload:any = {
        ts: d.toISOString(),
        buyer_email: form.email,
        display_name: form.display_name || '',
        title: form.title || '',
        message: finalMessage,
        link_url: '',
        cert_style: form.cert_style || 'neutral',
        time_display: 'local+utc',
        local_date_only: '1',
        text_color: form.text_color || '#1A1F2A',
        title_public: '0',
        message_public: '0',
        public_registry: form.public_registry ? '1' : '0',
      }

      try {
        const body:any = {
          listing_id: Number(listing.id),
          buyer_email: form.email,
          locale: (loc === 'en' ? 'en' : 'fr'),
          ...payload,
        }
        if (payload.cert_style === 'custom' && customBg?.dataUrl) {
          body.custom_bg_data_url = customBg.dataUrl
        }
        const res2 = await fetch('/api/marketplace/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res2.ok) {
          const rid = res2.headers.get('x-request-id') || res2.headers.get('x-vercel-id') || ''
          if (res2.status === 413) {
            setStatus('error'); setError(T.errors.heavyImage413); return
          }
          const j = await parseErrorResponse(res2)
          const errCode = j?.error || j?.code || 'unknown_error'
          const detail  = j?.message || j?.error_text || ''
          const wrap = T.errors.friendlyMap(res2.status, rid).wrap
          const base = T.errors[errCode as keyof typeof T.errors] as string | undefined
          const friendlyMap = T.errors.friendlyMap(res2.status, rid)
          const baseMsg = (friendlyMap as any)[errCode] || base || T.errors.unknown
          setStatus('error')
          setError(wrap(baseMsg, errCode, detail))
          console.error('[Marketplace checkout] failed', { status: res2.status, rid, body: j })
          return
        }
        const j = await res2.json()
        window.location.href = j.url
        return
      } catch (e:any) {
        setStatus('error'); setError(T.errors.checkoutCreate); console.error('[Marketplace checkout]', e); return
      }
    }

    // Interdit les jours indisponibles
    if (unavailableDays.includes(D)) {
      setStatus('error'); setError(T.errors.dayUnavailable); return
    }

    // Prépare champs selon visibilité
    const finalDisplayName = show.ownedBy ? (form.display_name || undefined) : undefined
    const finalTitle = show.title ? (form.title || undefined) : undefined

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
      const rid = res.headers.get('x-request-id') || res.headers.get('x-vercel-id') || ''
      if (res.status === 413) { setStatus('error'); setError(T.errors.heavyImage413); return }
      const j = await parseErrorResponse(res)
      const errCode = j?.error || j?.code || 'unknown_error'
      const detail  = j?.message || j?.error_text || ''
      const friendly = T.errors.friendlyMap(res.status, rid)
      const baseMsg = (friendly as any)[errCode] || T.errors.unknown
      setStatus('error'); setError(friendly.wrap(baseMsg, errCode, detail))
      console.error('[Checkout] failed', { status: res.status, rid, body: j })
      return
    }
    const data = await res.json()
    window.location.href = data.url
  }

  /** Styles globaux */
  const containerStyle: React.CSSProperties = {
    ['--color-bg' as any]:        '#0A1224',
    ['--color-surface' as any]:   '#101B36',
    ['--color-text' as any]:      '#F4F8FF',
    ['--color-muted' as any]:     '#B7C3E0',
    ['--color-primary' as any]:   '#FFD147',
    ['--color-on-primary' as any]:'#0A0F1C',
    ['--color-border' as any]:    '#233459',
    ['--shadow-elev1' as any]:    '0 8px 22px rgba(0,0,0,.45)',
    ['--shadow-elev2' as any]:    '0 16px 44px rgba(0,0,0,.55)',
    background:'var(--color-bg)',
    color:'var(--color-text)',
    minHeight:'100vh'
  }

  // palette couleurs
  const SWATCHES = [
    '#000000', '#FFFFFF',
    '#FF1744', '#FF5252', '#FF3D00',
    '#FFEA00', '#FFD600', '#FFC107', '#FFE082',
    '#FF69B4', '#FF007F', '#F50057', '#FF4081', '#D500F9',
    '#651FFF', '#7C4DFF', '#B388FF',
    '#2979FF', '#00B0FF', '#18FFFF',
    '#76FF03', '#00E676', '#64FFDA', '#C6FF00',
    '#FF6D00', '#FF8F00', '#FF5722',
    '#FF00AA', '#FFB300',
  ]

  /** ====== PREVIEW (mêmes calculs que le PDF) ====== */
  const previewWrapRef = useRef<HTMLDivElement|null>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = previewWrapRef.current
    if (!el) return
  
    const compute = () => {
      // ⚠️ clientWidth exclut la bordure → scale identique à l’ancienne version
      const w = el.clientWidth
      const s = w / A4_W_PT
      setScale(s || 1)
    }
  
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ownerForText = (form.display_name || '').trim() || L.anon
  const attestationText = isFR
    ? `Ce certificat atteste que ${ownerForText} est reconnu(e) comme propriétaire symbolique de la journée du ${chosenDateStr}. Le présent document confirme la validité et l'authenticité de cette acquisition.`
    : `This certificate attests that ${ownerForText} is recognized as the symbolic owner of the day ${chosenDateStr}. This document confirms the validity and authenticity of this acquisition.`

  // données pour la préview
  const showOwned = show.ownedBy
  const showGifted = isGift && show.giftedBy
  const showT = show.title
  const showM = show.message
  const showA = show.attestation

  const titleForPreview    = showT ? (form.title.trim() || L.placeholders.title) : ''
  const messageOnlyPreview = showM ? (form.message.trim() || L.placeholders.message) : ''
  const attestationPreview = showA ? attestationText : ''

  const nameForPreview = showOwned ? (form.display_name.trim() || L.anon) : ''
  const giftedByStr = showGifted ? (form.gifted_by.trim() || L.placeholders.giftedName) : ''

  const mainTime = chosenDateStr // AAAA-MM-JJ ou YYYY-MM-DD

  // tailles PDF
  const tsSize = 26, labelSize = 11, nameSize = 15, msgSize = 12.5
  const gapSection = 14, gapSmall = 8
  const lineHMsg = 16

  // safe area & colonnes en points
  const SA = getSafeArea(form.cert_style)
  const LEFT = SA.left, RIGHT = A4_W_PT - SA.right, TOP_Y = A4_H_PT - SA.top, BOT_Y = SA.bottom
  const COLW = RIGHT - LEFT
  const CX = (LEFT + RIGHT) / 2

  // header positions
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

  const meas = useMemo(()=>makeMeasurer(scale), [scale])

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
  const attestLinesAll = (attestationPreview) ? meas.wrap(attestationPreview, msgSize, COLW, false) : []
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

  const maxMsgLines = Math.max(0, Math.floor(afterTitleSpace / lineHMsg))
  const NAME_MAX  = 40
  const GIFT_MAX  = 40
  const TITLE_MAX = 80

  const blockH =
    fixedTop
    + (titleBlockNoGap ? (gapSection + titleBlockNoGap) : 0)
    + (msgLines.length ? (gapSection + msgLines.length * lineHMsg) : 0)
    + (attestLines.length ? (gapSection + attestLines.length * lineHMsg) : 0)

  let y = contentTopMax

  async function parseErrorResponse(res: Response) {
    const ct = res.headers.get('content-type') || ''
    try {
      if (ct.includes('application/json')) return await res.json()
      const txt = await res.text()
      return { error_text: txt }
    } catch {
      return null
    }
  }

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
  }, [LINES_FOR_USER, scale, form.cert_style, show, isGift, chosenDateStr])

  // Helpers: convertir baseline PDF -> CSS top px
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

  // === CALCUL des y ===
  y -= (tsSize + 6)
  const topMainTime = toTopPx(y, tsSize)

  let ownedLabelTop:number|null = null
  let ownedNameTop:number|null = null
  if (showOwned) {
    y -= gapSection
    ownedLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 2 + gapSmall)
    ownedNameTop = toTopPx(y - (nameSize + 4) + 4, nameSize)
    y -= (nameSize + 4)
  }

  let giftedLabelTop:number|null = null
  let giftedNameTop:number|null = null
  if (showGifted) {
    y -= gapSection
    giftedLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 2 + gapSmall)
    giftedNameTop = toTopPx(y - (nameSize + 4) + 4, nameSize)
    y -= (nameSize + 4)
  }

  let titleLabelTop:number|null = null
  const titleLineTops:number[] = []
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


  let attestLabelTop:number|null = null
  const attestLineTops:number[] = []

  let linkLabelTop: number | null = null
  const linkLineTops: number[] = []

  if (attestLines.length) {
    y -= gapSection
    attestLabelTop = toTopPx(y - (labelSize + 2), labelSize)
    y -= (labelSize + 6)
    for (const _ of attestLines) {
      attestLineTops.push(toTopPx(y - lineHMsg, msgSize))
      y -= lineHMsg
    }
  }


  const topBrand = toTopPx(yBrand, brandSize)
  const topCert  = toTopPx(yCert,  subSize)

  const minTimeTopPx = topCert + (MIN_GAP_HEADER_PT * scale)
  const contentOffsetPx = Math.max(0, minTimeTopPx - topMainTime)

  const isMsgOverflow = show.message && userMsgMaxChars>0 && (form.message?.length||0) > userMsgMaxChars

  const finalDisplayName = show.ownedBy
    ? ((form.display_name || '').slice(0, NAME_MAX) || undefined)
    : undefined

  const finalTitle = show.title
    ? ((form.title || '').slice(0, TITLE_MAX) || undefined)
    : undefined  
    
    
  const push = (v:number|null) => (v==null ? v : v + contentOffsetPx)
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

  const Preview: React.FC = () => (
    <aside
      aria-label={T.asideLabel}
      style={{
        position: isSmall ? 'static' : 'sticky',
        top: isSmall ? undefined : 24,
        marginTop: isSmall ? 12 : 0,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 12,
        boxShadow: 'var(--shadow-elev1)',
      }}
    >
      <div
        ref={previewWrapRef}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${A4_W_PT}/${A4_H_PT}`,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          // 👇 NEW: cohérence mesure/rendu
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontVariantLigatures: 'none',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        {isLoadingClaim && (
          <div
            aria-live="polite"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              background: 'rgba(0,0,0,.28)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 13,
              }}
            >
              {T.loadingCertificate}
            </div>
          </div>
        )}
  
        <img
          key={(form.cert_style === 'custom' ? customBg?.url : form.cert_style) || 'none'}
          src={
            form.cert_style === 'custom'
              ? customBg?.url || '/cert_bg/neutral.png'
              : `/cert_bg/${form.cert_style}.png`
          }
          alt={T.bgAltPrefix + form.cert_style}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            background: '#0E1017',
          }}
        />
  
        {/* Filigrane */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'grid',
            placeItems: 'center',
            transform: 'rotate(-22deg)',
            opacity: 0.14,
            mixBlendMode: 'multiply',
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: 'min(18vw, 120px)',
              letterSpacing: 2,
              color: '#1a1f2a',
            }}
          >
            PARCELS OF TIME — PREVIEW
          </div>
        </div>
  
        {/* === Contenu texte de la preview (inchangé) === */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            top: toTopPx(yBrand, 18),
            fontWeight: 700,
            fontSize: 18 * scale,
            color: form.text_color,
          }}
        >
          {L.brand}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            top: toTopPx(yCert, 12),
            fontWeight: 400,
            fontSize: 12 * scale,
            color: subtleColor,
          }}
        >
          {L.title}
        </div>
  
        {/* Date principale */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            top: topMainTime2,
            fontWeight: 800,
            fontSize: tsSize * scale,
            color: form.text_color,
          }}
        >
          {mainTime}
        </div>
  
        {/* Owned by */}
        {showOwned && (
          <>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                top: ownedLabelTop!,
                fontWeight: 400,
                fontSize: 11 * scale,
                color: subtleColor,
              }}
            >
              {ownedByLabel}
            </div>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                top: ownedNameTop!,
                fontWeight: 800,
                fontSize: 15 * scale,
                color: form.text_color,
              }}
            >
              {nameForPreview}
            </div>
          </>
        )}
  
        {/* Gifted by */}
        {isGift && showGifted && (
          <>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                top: giftedLabelTop!,
                fontWeight: 400,
                fontSize: 11 * scale,
                color: subtleColor,
              }}
            >
              {giftLabel}
            </div>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                top: giftedNameTop!,
                fontWeight: 800,
                fontSize: 15 * scale,
                color: form.text_color,
              }}
            >
              {giftedByStr}
            </div>
          </>
        )}
  
        {/* Titre */}
        {titleForPreview && (
          <>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                top: titleLabelTop!,
                fontWeight: 400,
                fontSize: 11 * scale,
                color: subtleColor,
                whiteSpace: 'pre',
                wordBreak: 'normal',
              }}
            >
              {titleLabel}
            </div>
            {titleLines.map((line, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  top: titleLineTops[i],
                  fontWeight: 800,
                  fontSize: 15 * scale,
                  whiteSpace: 'pre',
                  wordBreak: 'normal',
                  color: form.text_color,
                }}
              >
                {line}
              </div>
            ))}
          </>
        )}
  
        {/* Message */}
        {msgLines.length > 0 && (
          <>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                top: msgLabelTop!,
                fontWeight: 400,
                fontSize: 11 * scale,
                color: subtleColor,
                whiteSpace: 'pre',
                wordBreak: 'normal',
              }}
            >
              {messageLabel}
            </div>
            {msgLines.map((line, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  top: msgLineTops[i],
                  fontSize: 12.5 * scale,
                  whiteSpace: 'pre',
                  wordBreak: 'normal',
                  color: form.text_color,
                }}
              >
                {line}
              </div>
            ))}
          </>
        )}
  
        {/* Attestation */}
        {attestLines.length > 0 && (
          <>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                top: attestLabelTop!,
                fontWeight: 400,
                fontSize: 11 * scale,
                color: subtleColor,
                whiteSpace: 'pre',
                wordBreak: 'normal',
              }}
            >
              {L.attestationLabel}
            </div>
            {attestLines.map((line, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  top: attestLineTops[i],
                  fontSize: 12.5 * scale,
                  whiteSpace: 'pre',
                  wordBreak: 'normal',
                  color: form.text_color,
                }}
              >
                {line}
              </div>
            ))}
          </>
        )}
  
        {/* Footer meta + QR */}
        <div
          style={{
            position: 'absolute',
            left: EDGE_PT * scale,
            bottom: EDGE_PT * scale,
            width: (A4_W_PT / 2) * scale,
            height: META_H_PT * scale,
            color: subtleColor,
            fontSize: 11 * scale,
            lineHeight: 1.2,
          }}
        >
          <div style={{ opacity: 0.9 }}>{T.footerCertId}</div>
          <div
            style={{
              marginTop: 6,
              fontWeight: 800,
              color: form.text_color,
              fontSize: 10.5 * scale,
            }}
          >
            ••••••••••••••••••••••••••••••••••••••
          </div>
          <div style={{ marginTop: 8, opacity: 0.9 }}>{T.footerIntegrity}</div>
          <div style={{ marginTop: 6, color: form.text_color, fontSize: 9.5 * scale }}>
            ••••••••••••••••••••••••••••••••••••••
          </div>
          <div style={{ marginTop: 4, color: form.text_color, fontSize: 9.5 * scale }}>
            ••••••••••••••••••••••••••••••••••••••
          </div>
        </div>
  
        <div
          style={{
            position: 'absolute',
            right: EDGE_PT * scale,
            bottom: EDGE_PT * scale,
            width: QR_SIZE_PT * scale,
            height: QR_SIZE_PT * scale,
            border: '1px dashed rgba(26,31,42,.45)',
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            fontSize: 12 * scale,
            color: 'rgba(26,31,42,.85)',
            background: 'rgba(255,255,255,.08)',
          }}
          aria-label="QR placeholder"
        >
          QR
        </div>
      </div>
  
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-muted)' }}>
        {isFR
          ? 'Le PDF final est généré côté serveur : texte net, QR code réel, métadonnées signées. '
          : 'The final PDF is generated server-side: sharp text, real QR code, signed metadata. '}
        {T.asideTip(ownedByLabel, titleLabel, messageLabel)}
      </div>
    </aside>
  ); 


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
          <a href={`/${loc}`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; {T.brand}</a>
          <div style={{fontSize:12, color:'var(--color-muted)'}}>{T.securePayment}<strong>Stripe</strong></div>
        </div>

            <header
              style={{
                display: isSmall ? 'grid' : 'flex',
                alignItems: isSmall ? 'start' : 'baseline',
                justifyContent: isSmall ? 'stretch' : 'space-between',
                gap: 16,
                marginBottom: isSmall ? 10 : 14,
              }}
            >
              <h1
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: isSmall ? 30 : 40,
                  lineHeight: isSmall ? '36px' : '48px',
                  margin: 0,
                }}
              >
                {isGift ? T.headerGift : T.headerReserve}
              </h1>

              <button
                onClick={() => setIsGift(v => !v)}
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  padding: '8px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  width: isSmall ? '100%' : 'auto',
                }}
                aria-pressed={isGift}
              >
                {isGift ? T.giftOn : T.giftOff}
              </button>
            </header>

            <div
      style={{
        display: 'grid',
        gridTemplateColumns: isSmall ? '1fr' : '1.1fr 0.9fr',
        gap: isSmall ? 14 : 18,
        alignItems: 'start',
      }}
    >
      {/* ---------- FORM COLUMN ---------- */}
      <form
        onSubmit={onSubmit}
        onKeyDown={(e) => {
          if (e.defaultPrevented) return
          if (e.key === 'Enter') {
            const t = e.target as HTMLElement
            const tag = (t?.tagName || '').toLowerCase()
            const type = (t as HTMLInputElement)?.type?.toLowerCase?.()
            const isTextarea = tag === 'textarea'
            const isSubmit = tag === 'button' || (tag === 'input' && type === 'submit')
            if (!isTextarea && !isSubmit) e.preventDefault()
          }
        }}
        style={{ display: 'grid', gap: 14 }}
      >
        {/* Step 1 — Journée (mobile: grille 2 colonnes, Jour sur toute la largeur) */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--color-muted)',
              marginBottom: 8,
            }}
          >
            {T.step1}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {/* Année */}
            <label style={{ display: 'grid', gap: 6 }}>
              <span>{T.year}</span>
              <select
                value={Y}
                onChange={(e) => setY(parseInt(e.target.value))}
                style={{
                  padding: '12px 10px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--color-text)',
                }}
              >
                {range(1900, MAX_Y).map((y) => (
                  <option key={y} value={y} style={{ color: '#000' }}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            {/* Mois */}
            <label style={{ display: 'grid', gap: 6 }}>
              <span>{T.month}</span>
              {(() => {
                const maxMonthForYear = Y === MAX_Y ? MAX_M : 12
                return (
                  <select
                    value={M}
                    onChange={(e) => setM(parseInt(e.target.value))}
                    style={{
                      padding: '12px 10px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--color-text)',
                    }}
                  >
                    {Array.from({ length: maxMonthForYear }, (_, i) => i + 1).map((v) => (
                      <option key={v} value={v} style={{ color: '#000' }}>
                        {String(v).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                )
              })()}
            </label>

            {/* Jour (⚠️ mobile: span sur 2 colonnes) */}
            <label
              style={{
                display: 'grid',
                gap: 6,
                gridColumn: isSmall ? '1 / -1' : undefined,
              }}
            >
              <span>
                {T.day}{' '}
                {isLoadingDays && (
                  <em style={{ fontSize: 12, opacity: 0.7 }}>{T.updating}</em>
                )}
                {isLoadingClaim && (
                  <em style={{ fontSize: 12, opacity: 0.7, marginLeft: 6 }}>
                    {T.loadingCert}
                  </em>
                )}
              </span>
              {(() => {
                const dim = daysInMonth(Y, M)
                const maxDayForThisMonth =
                  Y === MAX_Y && M === MAX_M ? Math.min(dim, MAX_D) : dim
                const days = Array.from({ length: maxDayForThisMonth }, (_, i) => i + 1)
                const setRed = new Set(unavailableDays)
                const setYellow = new Set(forSaleDays)
                return (
                  <select
                    key={`${Y}-${M}`}
                    value={D}
                    onChange={(e) => setD(parseInt(e.target.value))}
                    aria-busy={isLoadingDays || undefined}
                    style={{
                      padding: '12px 10px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--color-text)',
                    }}
                  >
                    {days.map((d) => {
                      const unavailable = setRed.has(d)
                      const onSale = setYellow.has(d)
                      const labelBase = d.toString().padStart(2, '0')
                      const suffix = unavailable
                        ? T.daySuffix.unavailable
                        : onSale
                        ? T.daySuffix.onSale
                        : T.daySuffix.available
                      const label = labelBase + suffix
                      return (
                        <option
                          key={d}
                          value={d}
                          disabled={unavailable}
                          aria-disabled={unavailable}
                          style={{
                            color: unavailable
                              ? '#ff4d4d'
                              : onSale
                              ? '#e0a800'
                              : '#000',
                          }}
                        >
                          {(unavailable ? '⛔ ' : onSale ? '🟡 ' : '') + label}
                        </option>
                      )
                    })}
                  </select>
                )
              })()}
            </label>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#ff8a8a' }}>{T.redHint}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#e0a800' }}>
            {T.yellowHint}
          </div>
        </div>

        {/* Prix courant */}
        {(() => {
          const currentListing = saleLookup[D]
          const isUnavailable = unavailableDays.includes(D)
          const isOnSale = !!currentListing
          const pill = (txt: string, bg: string, bd: string, fg: string) => (
            <span
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 999,
                background: bg,
                border: `1px solid ${bd}`,
                color: fg,
              }}
            >
              {txt}
            </span>
          )
          return (
            <div
              aria-live="polite"
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: 'var(--color-muted)',
                  }}
                >
                  {T.price}
                </div>
                {isUnavailable
                  ? pill(
                      T.pill.unavailable,
                      'rgba(255,122,122,.10)',
                      '#ff7a7a',
                      '#ffb2b2'
                    )
                  : isOnSale
                  ? pill(
                      T.pill.marketplace,
                      'rgba(255,209,71,.12)',
                      '#E4B73D',
                      'var(--color-primary)'
                    )
                  : pill(
                      T.pill.available,
                      'rgba(11,216,122,.10)',
                      '#0BBF6A',
                      '#0BBF6A'
                    )}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  {isOnSale ? (currentListing.price_cents / 100).toFixed(0) : 29} €
                </div>
                {isOnSale && (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{T.sellerNote}</div>
                )}
              </div>
            </div>
          )
        })()}

            {/* Step 2 — Infos */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>{T.step2}</div>

              <label style={{display:'grid', gap:6, marginBottom:10}}>
                <span>{isGift ? T.emailLabelGift : T.emailLabel}</span>
                <input required type="email" value={form.email}
                  onChange={e=>setForm(f=>({...f, email:e.target.value}))}
                  placeholder={T.emailPh}
                  style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                />
              </label>

              {/* Nom */}
              {show.ownedBy && (
                <label style={{display:'grid', gap:6}}>
                  <span>{isGift ? T.destName : T.nameOnCert}</span>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={e=>setForm(f=>({...f, display_name:e.target.value}))}
                    maxLength={40}
                    placeholder={isFR ? 'Ex. “Marie”' : 'e.g. “Mary”'}
                    style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                  />
                </label>
              )}

              {/* 🎁 Offert par / Gifted by */}
              {isGift && show.giftedBy && (
                <label style={{display:'grid', gap:6, marginTop:10}}>
                  <span>{giftLabel}</span>
                  <input
                    type="text"
                    value={form.gifted_by}
                    onChange={e=>setForm(f=>({...f, gifted_by:e.target.value}))}
                    maxLength={40}
                    placeholder={T.giftedPh}
                    style={{padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                  />
                </label>
              )}

              {/* Titre */}
              {show.title && (
                <div style={{display:'grid', gap:6, marginTop:10}}>
                  <label>
                    <span>{titleLabel}</span>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e=>setForm(f=>({...f, title:e.target.value}))}
                      maxLength={80}
                      placeholder={T.titlePh}
                      style={{width:'100%', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                    />
                  </label>
                </div>
              )}

              {/* Message */}
              {show.message && (
                <div style={{display:'grid', gap:6, marginTop:10}}>
                  <label>
                    <span>{messageLabel}</span>
                    <textarea
                      value={form.message}
                      onChange={e=>setForm(f=>({...f, message:e.target.value}))}
                      maxLength={userMsgMaxChars || undefined}
                      placeholder={isGift ? T.messagePhGift : T.messagePh}
                      style={{
                        width:'100%',
                        padding:'12px 14px',
                        border:'1px solid ' + (isMsgOverflow ? '#ff6b6b' : 'var(--color-border)'),
                        borderRadius:10,
                        background:'transparent',
                        color:'var(--color-text)'
                      }}
                    />
                    <div style={{textAlign:'right', fontSize:12, marginTop:4, color: isMsgOverflow ? '#ff6b6b' : 'inherit', opacity: isMsgOverflow ? 1 : .65}}>
                      {(form.message?.length || 0)} / {userMsgMaxChars || '∞'}
                    </div>
                    {isMsgOverflow && (
                      <div role="alert" aria-live="polite" style={{marginTop:6, fontSize:12, color:'#ff6b6b'}}>
                        {T.messageOverflow}
                      </div>
                    )}
                  </label>
                </div>
              )}

              {/* Affichage / Masquage */}
              <div style={{marginTop:12, paddingTop:10, borderTop:'1px dashed var(--color-border)'}}>
                <div style={{fontSize:13, color:'var(--color-muted)', marginBottom:8}}>
                  {T.showHideHeader}
                </div>
                <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                  <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <input
                      type="checkbox"
                      checked={show.ownedBy}
                      onChange={e=>{
                        const checked = e.target.checked
                        setShow(s=>({...s, ownedBy: checked}))
                        if (!checked) setForm(f=>({...f, display_name: ''}))
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
                        if (!checked) setForm(f=>({...f, title: ''}))
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
                        if (!checked) setForm(f=>({...f, message: ''}))
                      }}
                    />
                    <span>{messageLabel}</span>
                  </label>

                  <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <input
                      type="checkbox"
                      checked={show.attestation}
                      onChange={e=>setShow(s=>({...s, attestation: e.target.checked}))}
                    />
                    <span>{L.attestationLabel}</span>
                  </label>

                  {isGift && (
                    <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                      <input
                        type="checkbox"
                        checked={show.giftedBy}
                        onChange={e=>{
                          const checked = e.target.checked
                          setShow(s=>({...s, giftedBy: checked}))
                          if (!checked) setForm(f=>({...f, gifted_by: ''}))
                        }}
                      />
                      <span>{giftLabel}</span>
                    </label>
                  )}
                </div>
                <small style={{display:'block', marginTop:8, opacity:.7}}>
                  <strong>{T.alwaysShown}</strong> {T.alwaysShownList}
                </small>
              </div>
            </div>

            {/* Couleur de la police */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
                <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)'}}>{T.textColorHeader}</div>
                <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
                  <span style={{width:10, height:10, borderRadius:99, background:ratioMeta.color, display:'inline-block'}} />
                  <span>{T.contrast}: {ratio.toFixed(2)} — {ratioMeta.label}</span>
                </div>
              </div>

              <div aria-label={T.textPreview} style={{marginTop:10, display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:42, height:42, borderRadius:10, border:'1px solid var(--color-border)', display:'grid', placeItems:'center', background: CERT_BG_HEX, color: form.text_color, fontWeight:800}}>
                  Aa
                </div>
                <div style={{flex:1, height:12, borderRadius:99, background: CERT_BG_HEX, position:'relative', border:'1px solid var(--color-border)'}}>
                  <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', padding:'0 10px', color:form.text_color, fontSize:12}}>“{L.ownedBy} — 2024-12-31”</div>
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(34px, 1fr))', gap:8, marginTop:12}}>
                {SWATCHES.map(c => (
                  <button key={c} type="button" onClick={()=>setForm(f=>({...f, text_color: c}))}
                    aria-label={(isFR ? 'Couleur ' : 'Color ') + c} title={c}
                    style={{width:34, height:34, borderRadius:12, cursor:'pointer', background:c, border:'1px solid var(--color-border)', outline: form.text_color===c ? '3px solid rgba(228,183,61,.5)' : 'none'}}
                  />
                ))}
              </div>

              <div style={{display:'flex', alignItems:'center', gap:10, marginTop:12, flexWrap:'wrap'}}>
                <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <input type="color" value={form.text_color} onChange={e=>setForm(f=>({...f, text_color: e.target.value}))}/>
                  <span style={{fontSize:12, opacity:.8}}>{T.picker}</span>
                </label>
                <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:12, opacity:.8}}>{T.hex}</span>
                  <input type="text" value={form.text_color}
                    onChange={e=>{ const v=e.target.value.trim(); if(/^#[0-9a-fA-F]{6}$/.test(v)) setForm(f=>({...f, text_color:v})) }}
                    style={{width:120, padding:'8px 10px', border:'1px solid var(--color-border)', borderRadius:10, background:'transparent', color:'var(--color-text)'}}
                    placeholder="#1A1F2A"/>
                </label>
                <small style={{opacity:.7}}>{T.colorTip}</small>
              </div>
            </div>

            {/* Step 3 — Style */}
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>{T.step3}</div>

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
                  const label = ST[s.id].label
                  const hint  = ST[s.id].hint
                  return (
                    <div key={s.id} style={{position:'relative'}}>
                      <div
                        onClick={()=>onSelectStyle(s.id)}
                        onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); onSelectStyle(s.id) } }}
                        role="button" tabIndex={0} aria-label={`${isFR?'Style':'Style'} ${label}`}
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
                            <div style={{fontWeight:700}}>{label}</div>
                            {hint && <div style={{opacity:.6, fontSize:12}}>{hint}</div>}
                          </div>
                          <span aria-hidden="true" style={{width:10, height:10, borderRadius:99, background:selected ? 'var(--color-primary)' : 'var(--color-border)'}} />
                        </div>
                      </div>

                      {isCustom && imgLoading && (
                        <div style={{position:'absolute', top:10, left:10, fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(255,255,255,.08)', border:'1px solid var(--color-border)'}}>{T.loadingDots}</div>
                      )}
                      {isCustom && customBg && (
                        <div style={{position:'absolute', top:10, right:10, fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(228,183,61,.14)', border:'1px solid var(--color-primary)'}}>{T.imageLoaded} ✓ {customBg.w}×{customBg.h}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* --- PREVIEW mobile : avant le registre public --- */}
            {isSmall && <Preview />}

            {/* Publication dans le registre (bloc bilingue autonome) */}
            {(() => {
              const isFRloc = loc === 'fr'
              const t = isFRloc ? {
                eyebrow:'Registre public (optionnel)',
                title:'Exposer votre certificat dans la galerie',
                sub:'Un geste symbolique et artistique — vous contribuez à une œuvre participative.',
                bullets:[
                  '🖼️ Visibilité : votre certificat apparaît dans la galerie publique',
                  '🎨 Œuvre participative : vous enrichissez une galerie vivante',
                  '🔒 Contrôle : publier/retirer à tout moment (QR ou Compte)',
                ],
                more:'En savoir plus',
                moreBody:
                  'Publier peut révéler des données personnelles (nom, titre, extrait, photo). Évitez les informations sensibles et les visages de mineurs. Contenus modérés, consultation seule.',
                btnOn:'✓ Publication activée — Retirer',
                btnOff:'Publier ce certificat (PDF complet) dans la galerie',
                explore:'Voir le registre',
              } : {
                eyebrow:'Public Registry (optional)',
                title:'Show your certificate in the public gallery',
                sub:'A symbolic, artistic gesture — contribute to participatory art.',
                bullets:[
                  '🖼️ Visibility: appears in the public gallery',
                  '🎨 Participatory art: enrich a living collective piece',
                  '🔒 Control: publish/unpublish anytime (QR or Account)',
                ],
                more:'Learn more',
                moreBody:
                  'Publishing may reveal personal data (name, title, excerpt, photo). Avoid sensitive info and minors’ faces. Moderated, view-only.',
                btnOn:'✓ Publishing enabled — Unpublish',
                btnOff:'Publish this certificate (full PDF) to the gallery',
                explore:'Open the registry',
              }

              const baseBtn: React.CSSProperties = {
                display:'inline-flex', alignItems:'center', gap:10,
                padding:'14px 18px', borderRadius:12, fontWeight:900,
                cursor:'pointer', transition:'transform .12s ease, box-shadow .12s ease',
              }
              const btnOn: React.CSSProperties = {
                ...baseBtn,
                background:'linear-gradient(180deg, #FFE259 0%, #FFA751 100%)',
                color:'#0B0E14',
                border:'1px solid rgba(0,0,0,.18)',
                boxShadow:'0 12px 34px rgba(255,193,7,.35), 0 0 0 6px rgba(255,193,7,.18)',
              }
              const btnOff: React.CSSProperties = {
                ...baseBtn,
                background:'linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0))',
                color:'var(--color-text)',
                border:'1px solid var(--color-border)',
              }

              return (
                <section
                  aria-labelledby="registry-opt-title"
                  style={{
                    marginBottom:10,
                    padding:'14px 16px',
                    border:'1px solid var(--color-border)',
                    borderRadius:16,
                    background:'linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0))',
                  }}
                >
                  <div style={{display:'grid', gap:6}}>
                    <div style={{fontSize:12, letterSpacing:1, textTransform:'uppercase', color:'var(--color-muted)'}}>
                      {t.eyebrow}
                    </div>
                    <h3 id="registry-opt-title" style={{margin:0, fontSize:16, lineHeight:'22px'}}>{t.title}</h3>
                    <p style={{margin:0, fontSize:12, color:'var(--color-muted)'}}>{t.sub}</p>

                    <button
                      type="button"
                      onClick={()=>setForm(f=>({ ...f, public_registry: !f.public_registry }))}
                      aria-pressed={form.public_registry}
                      style={form.public_registry ? btnOn : btnOff}
                      onMouseDown={e=>(e.currentTarget.style.transform='translateY(1px)')}
                      onMouseUp={e=>(e.currentTarget.style.transform='translateY(0)')}
                    >
                      {form.public_registry ? t.btnOn : t.btnOff}
                    </button>

                    <ul style={{margin:'6px 0 0', paddingLeft:18, lineHeight:'22px', fontSize:13}}>
                      {t.bullets.map((b,i)=><li key={i}>{b}</li>)}
                    </ul>

                    <details style={{marginTop:6}}>
                      <summary style={{cursor:'pointer', fontSize:12}}>{t.more}</summary>
                      <p style={{margin:'8px 0 0', fontSize:12, color:'var(--color-muted)'}}>{t.moreBody}</p>
                      <div style={{marginTop:6}}>
                        <a href={`/${loc}/explore`} style={{color:'var(--color-text)'}}>{t.explore} →</a>
                      </div>
                    </details>
                  </div>
                </section>
              )
            })()}

            {/* Conformité & consentements */}
            <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--color-muted)', marginBottom:8}}>
                {T.consentsHeader}
              </div>
              <div style={{display:'grid', gap:8, fontSize:12}}>
                <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                  <input type="checkbox" required name="accept_terms" />
                  <span>
                    {T.acceptTermsA}
                    <a href={`/${loc}/legal/terms`} style={{color:'var(--color-text)'}}>{T.terms}</a>
                    {T.andPrivacy}
                    <a href={`/${loc}/legal/privacy`} style={{color:'var(--color-text)'}}>{T.privacy}</a>.
                  </span>
                </label>

                <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                  <input type="checkbox" required name="stripe_notice" />
                  <span>{T.stripeNotice}</span>
                </label>

                {needsCustomImageConsent && (
                  <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                    <input
                      type="checkbox"
                      required
                      checked={acceptCustomImageRules}
                      onChange={e=>setAcceptCustomImageRules(e.target.checked)}
                    />
                    <span>{T.imgRightsConsent}</span>
                  </label>
                )}

                {needsPublicContentConsent && (
                  <label style={{display:'inline-flex', alignItems:'flex-start', gap:8}}>
                    <input
                      type="checkbox"
                      required
                      checked={acceptPublicContentRules}
                      onChange={e=>setAcceptPublicContentRules(e.target.checked)}
                    />
                    <span>{moderationConsentText}</span>
                  </label>
                )}
                <small style={{opacity:.75}}>
                  {T.fullBreakdown}
                </small>
              </div>
            </section>

            {/* Submit */}
            <div>
              <button disabled={
                  status === 'loading' ||
                  (needsCustomImageConsent && !acceptCustomImageRules) ||
                  (needsPublicContentConsent && !acceptPublicContentRules)
                }
                type="submit"
                style={{background:'var(--color-primary)', color:'var(--color-on-primary)', padding:'14px 18px', borderRadius:12, fontWeight:800, border:'none', boxShadow: status==='loading' ? '0 0 0 6px rgba(228,183,61,.12)' : 'none', cursor: status==='loading' ? 'progress' : 'pointer'}}>
                {status==='loading' ? T.submitRedirecting : (isGift ? T.submitGift : T.submitPayReserve)}
              </button>
              {status==='error' && error && <p style={{color:'#ff8a8a', marginTop:8}}>{error}</p>}
              <p style={{marginTop:8, fontSize:12, color:'var(--color-muted)'}}>
                {T.immediateExec}
              </p>
            </div>
          </form>

          {/* ---------- PREVIEW COLUMN (desktop only) ---------- */}
          {!isSmall && <Preview />}
        </div>
      </section>
    </main>
  )
}
