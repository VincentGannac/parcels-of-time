// app/api/claim/[id]/transfer-guide.pdf/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

// ----------------- Utils communes -----------------
const sha256hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

function ymd(ts: string) {
  try {
    const d = new Date(ts)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {}
  return (ts || '').slice(0, 10)
}

// ESM dynamiques (meilleure tolérance CJS/Edge)
async function loadPdfLib(): Promise<null | {
  PDFDocument: any; StandardFonts: any; rgb: any
}> {
  try {
    const m: any = await import('pdf-lib')
    const PDFDocument = m?.PDFDocument
    const StandardFonts = m?.StandardFonts
    const rgb = m?.rgb
    if (PDFDocument && StandardFonts && rgb) return { PDFDocument, StandardFonts, rgb }
    return null
  } catch { return null }
}

async function loadQRCode(): Promise<any | null> {
  try {
    const m: any = await import('qrcode')
    return m?.default || m
  } catch { return null }
}

/* ------------------------------------------------------------------
   Fallback PDF "plain", strict PDF 1.4 (CRLF + xref, ASCII Helvetica)
   ------------------------------------------------------------------ */
function asciiSafe(s: string) {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
}
function escapePdfString(s: string) {
  return asciiSafe(s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
}

function renderPlainGuidePdf(args: {
  locale: 'fr'|'en'
  day: string
  id: string
  certHash: string
  code: string
}): Uint8Array {
  const { locale, day, id, certHash, code } = args
  const L = locale === 'fr'
    ? {
        brand: 'Parcels of Time',
        title: 'Guide de recuperation',
        subtitle: `Certificat du ${day}`,
        steps: ['Ouvrez votre compte Parcels of Time.', 'Cliquez sur « Recuperer ».', 'Entrez les mots de passe suivants :'],
        cid: 'ID du certificat',
        sha: 'SHA-256',
        codeLbl: 'Code (5 caracteres)',
        note: 'Une fois valide, vous devenez le detenteur officiel et unique de cette date.',
        help: 'Support: support@parcelsoftime.com',
      }
    : {
        brand: 'Parcels of Time',
        title: 'Recovery Guide',
        subtitle: `Certificate for ${day}`,
        steps: ['Open your Parcels of Time account.', 'Click “Recover”.', 'Enter the following passwords:'],
        cid: 'Certificate ID',
        sha: 'SHA-256',
        codeLbl: '5-char code',
        note: 'Once validated, you become the official, unique holder of this date.',
        help: 'Support: support@parcelsoftime.com',
      }

  const W = 595, H = 842

  // SHA sur 2 lignes fixes (32 + 32) pour éviter tout débordement
  const sha1 = certHash.slice(0, 32)
  const sha2 = certHash.slice(32, 64)

  const lines = [
    { x: 56, y: 800, size: 16, text: L.brand, bold: true },
    { x: 56, y: 772, size: 26, text: L.title, bold: true },
    { x: 56, y: 748, size: 12, text: L.subtitle, bold: false },

    { x: 56, y: 708, size: 12, text: '1) ' + L.steps[0], bold: true },
    { x: 56, y: 690, size: 12, text: '2) ' + L.steps[1], bold: true },
    { x: 56, y: 672, size: 12, text: '3) ' + L.steps[2], bold: true },

    { x: 56, y: 642, size: 11, text: L.cid, bold: true },
    { x: 56, y: 625, size: 12, text: id, bold: false },

    { x: 56, y: 597, size: 11, text: L.sha, bold: true },
    { x: 56, y: 580, size: 10, text: sha1, bold: false },
    { x: 56, y: 565, size: 10, text: sha2, bold: false },

    { x: 56, y: 535, size: 11, text: L.codeLbl, bold: true },
    { x: 56, y: 518, size: 14, text: code.split('').join(' '), bold: true },

    { x: 56, y: 120, size: 10, text: L.note, bold: false },
    { x: 56, y: 102, size: 10, text: L.help, bold: false },
  ]

  const objs: string[] = []
  const obj = (n: number, body: string) => `${n} 0 obj\r\n${body}\r\nendobj\r\n`

  // 1: Catalog
  objs.push(obj(1, `<< /Type /Catalog /Pages 2 0 R >>`))
  // 2: Pages
  objs.push(obj(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`))
  // 3: Page
  objs.push(obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`))
  // 4: Helvetica
  objs.push(obj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`))
  // 5: Helvetica-Bold
  objs.push(obj(5, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`))

  // 6: Contents
  const contentLines: string[] = ['BT']
  for (const l of lines) {
    const fontRef = l.bold ? 'F2' : 'F1'
    contentLines.push(`/${fontRef} ${l.size} Tf`)
    contentLines.push(`1 0 0 1 ${l.x} ${l.y} Tm`)
    contentLines.push(`(${escapePdfString(l.text)}) Tj`)
  }
  contentLines.push('ET')
  const contentStr = contentLines.join('\r\n')
  const contentLen = Buffer.byteLength(contentStr, 'ascii')
  objs.push(obj(6, `<< /Length ${contentLen} >>\r\nstream\r\n${contentStr}\r\nendstream`))

  // Assembly + xref strict
  let file = '%PDF-1.4\r\n'
  const offsets: number[] = []
  for (const o of objs) {
    offsets.push(Buffer.byteLength(file, 'ascii'))
    file += o
  }
  const xrefStart = Buffer.byteLength(file, 'ascii')
  file += `xref\r\n`
  file += `0 ${objs.length + 1}\r\n`
  file += `0000000000 65535 f \r\n`
  for (const off of offsets) {
    file += `${String(off).padStart(10, '0')} 00000 n \r\n`
  }
  file += `trailer\r\n<< /Size ${objs.length + 1} /Root 1 0 R >>\r\nstartxref\r\n${xrefStart}\r\n%%EOF\r\n`

  return new Uint8Array(Buffer.from(file, 'ascii'))
}

/* ----------------- Wrap util pour paragraphes (pdf-lib) ----------------- */
function wrapLines(text: string, maxWidth: number, font: any, size: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    const width = font.widthOfTextAtSize(test, size)
    if (width <= maxWidth) {
      cur = test
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// ----------------- Handler -----------------
export async function GET(req: Request, ctx: { params?: { id?: string } } | any) {
  const id = String((ctx?.params?.id ?? '')).trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  const url = new URL(req.url)
  const code = (url.searchParams.get('code') || '').toUpperCase().trim()
  const locale: 'fr'|'en' = ((url.searchParams.get('locale') || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
  if (!/^[A-Z0-9]{5}$/.test(code)) {
    return NextResponse.json({ error: 'bad_code' }, { status: 400 })
  }

  try {
    // 1) Vérif security : code actif pour CE claim
    const codeHash = sha256hex(code)
    {
      const { rows } = await pool.query(
        `select 1
           from claim_transfer_tokens
          where claim_id = $1
            and code_hash = $2
            and is_revoked = false
            and used_at is null
          limit 1`,
        [id, codeHash]
      )
      if (!rows.length) {
        return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 403 })
      }
    }

    // 2) Claim
    const { rows: crows } = await pool.query(
      `select c.id, c.cert_hash, c.ts
         from claims c
        where c.id = $1
        limit 1`,
      [id]
    )
    if (!crows.length) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const certHash = String(crows[0].cert_hash || '')
    const tsISO = new Date(crows[0].ts).toISOString()
    const day = ymd(tsISO)

    const base = process.env.NEXT_PUBLIC_BASE_URL || url.origin
    const recoverUrl = `${base}/${locale}/gift/recover?claim_id=${encodeURIComponent(id)}&cert_hash=${encodeURIComponent(certHash)}`

    // 3) Version RICHE (pdf-lib + QR), sinon fallback "plain"
    let bytes: Uint8Array | null = null
    let mode: 'rich' | 'plain' = 'plain'

    try {
      const libs = await loadPdfLib()
      if (libs) {
        const { PDFDocument, StandardFonts, rgb } = libs
        const QR = await loadQRCode()

        // --- QR en PNG (optionnel, pas de texte d'URL)
        let qrPngBytes: Uint8Array | null = null
        if (QR) {
          try {
            const dataUrl: string = await QR.toDataURL(recoverUrl, { errorCorrectionLevel: 'M', margin: 0, width: 420 })
            const b64 = dataUrl.split(',')[1] || ''
            qrPngBytes = new Uint8Array(Buffer.from(b64, 'base64'))
          } catch {}
        }

        // --- Document
        const pdfDoc = await PDFDocument.create()
        const page = pdfDoc.addPage([595.28, 841.89]) // A4
        const { width, height } = page.getSize()

        // Palette
        const gold = rgb(0xE4/255, 0xB7/255, 0x3D/255)
        const goldSoft = rgb(0xF7/255, 0xEC/255, 0xD0/255)
        const ink = rgb(0x1A/255, 0x1F/255, 0x2A/255)
        const muted = rgb(0x6B/255, 0x72/255, 0x80/255)
        const border = rgb(0xE6/255, 0xEA/255, 0xF2/255)
        const panel = rgb(0xF8/255, 0xF9/255, 0xFB/255)

        // Fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const mono = await pdfDoc.embedFont(StandardFonts.Courier)
        const monoBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

        // Marges + helpers
        const margin = 56
        let y = height - margin
        const text = (t: string, opts: { x?: number; y?: number; size?: number; font?: any; color?: any; maxWidth?: number; lineHeight?: number } = {}) => {
          const size = opts.size ?? 12
          const usedFont = opts.font ?? font
          const x = opts.x ?? margin
          const yy = opts.y ?? y
          if (opts.maxWidth && t.includes(' ')) {
            const lines = wrapLines(t, opts.maxWidth, usedFont, size)
            let ly = yy
            for (const ln of lines) {
              page.drawText(ln, { x, y: ly, size, font: usedFont, color: opts.color ?? ink })
              ly -= (opts.lineHeight ?? size + 4)
            }
            y = ly
          } else {
            page.drawText(t, { x, y: yy, size, font: usedFont, color: opts.color ?? ink })
            y = yy - (opts.lineHeight ?? size + 6)
          }
        }
        const hr = (yy: number) => page.drawLine({ start: { x: margin, y: yy }, end: { x: width - margin, y: yy }, thickness: 1, color: border })

        // Cadre décoratif
        page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: border, borderWidth: 1 })

        // Badge "cadeau"
        const badgeW = 120, badgeH = 28
        page.drawRectangle({ x: margin, y: y - badgeH + 8, width: badgeW, height: badgeH, color: goldSoft, borderColor: gold, borderWidth: 1 })
        page.drawText(locale === 'fr' ? '🎁 Cadeau' : '🎁 Gift', {
          x: margin + 10, y: y - 12, size: 12, font: bold, color: ink
        })

        // Brand
        const brand = 'Parcels of Time'
        page.drawText(brand, {
          x: width - margin - bold.widthOfTextAtSize(brand, 16), y, size: 16, font: bold, color: ink
        })
        y -= 8

        // Titre & date
        text(locale === 'fr' ? '🎁 Guide de récupération' : '🎁 Recovery Guide', { size: 30, font: bold })
        text(locale === 'fr' ? `Certificat du ${day}` : `Certificate for ${day}`, { size: 13, color: muted })
        y -= 6
        hr(y); y -= 16

        // Bandeau d’instructions (sans afficher le lien)
        const bandH = 96
        page.drawRectangle({ x: margin, y: y - bandH + 6, width: width - 2*margin, height: bandH, color: panel, borderColor: border, borderWidth: 1 })
        const msg = locale === 'fr'
          ? `Scannez le QR ou ouvrez votre compte Parcels of Time, cliquez sur « Récupérer », puis saisissez les mots de passe ci-dessous.`
          : `Scan the QR or open your Parcels of Time account, click “Recover”, then enter the passwords below.`
        page.drawText(msg, { x: margin + 14, y: y - 18, size: 12, font, color: ink, maxWidth: width - 2*margin - 28, lineHeight: 14 })
        y -= (bandH + 12)

        // Disposition 2 colonnes
        const colGap = 18
        const leftW = (width - 2*margin - colGap) * 0.60
        const rightW = (width - 2*margin - colGap) * 0.40

        // Colonne droite : QR + légende
        if (qrPngBytes) {
          try {
            const png = await pdfDoc.embedPng(qrPngBytes)
            const qrSize = Math.min(180, rightW)
            const qrX = margin + leftW + colGap + (rightW - qrSize) / 2
            const qrY = y - qrSize + 12
            page.drawRectangle({ x: qrX - 8, y: qrY - 8, width: qrSize + 16, height: qrSize + 16, borderColor: border, borderWidth: 1, color: rgb(1,1,1) })
            page.drawImage(png, { x: qrX, y: qrY, width: qrSize, height: qrSize })
            page.drawText(locale === 'fr' ? 'Scanner pour ouvrir' : 'Scan to open', {
              x: qrX + 8, y: qrY - 20, size: 10, color: muted, font
            })
          } catch {}
        } else {
          const phW = Math.min(170, rightW)
          const phX = margin + leftW + colGap + (rightW - phW) / 2
          const phY = y - phW + 12
          page.drawRectangle({ x: phX - 6, y: phY - 6, width: phW + 12, height: phW + 12, borderColor: border, borderWidth: 1, color: rgb(1,1,1) })
          page.drawText(locale === 'fr' ? 'QR indisponible' : 'QR unavailable', { x: phX + 18, y: phY + phW/2 - 6, size: 10, color: muted })
        }

        // Colonne gauche : champs encartés
        const leftX = margin
        let leftY = y
        const fieldBox = (label: string, drawer: () => void, height: number) => {
          // Label
          page.drawText(label, { x: leftX, y: leftY, size: 10, font: bold, color: muted })
          // Box
          page.drawRectangle({ x: leftX, y: leftY - height + 6, width: leftW, height, borderColor: border, borderWidth: 1, color: rgb(1,1,1) })
          // Inner content
          drawer()
          leftY -= (height + 12)
        }

        // ID
        fieldBox(locale === 'fr' ? 'ID du certificat' : 'Certificate ID', () => {
          page.drawText(id || '—', { x: leftX + 10, y: leftY - 16, size: 12, font: bold, color: ink, maxWidth: leftW - 20 })
        }, 40)

        // SHA (2 lignes monospaces, aucune fuite sous le QR)
        const sha1 = certHash.slice(0, 32)
        const sha2 = certHash.slice(32, 64)
        fieldBox('SHA-256', () => {
          page.drawText(sha1 || '—', { x: leftX + 10, y: leftY - 16, size: 12, font: monoBold, color: ink })
          if (sha2) page.drawText(sha2, { x: leftX + 10, y: leftY - 34, size: 12, font: monoBold, color: ink })
        }, 52)

        // Code (gros, espacé)
        fieldBox(locale === 'fr' ? 'Code (5 caractères)' : '5-char code', () => {
          const big = code.split('').join('  ')
          page.drawText(big, { x: leftX + 10, y: leftY - 20, size: 16, font: bold, color: ink })
        }, 48)

        // À propos — Parcels of Time (encart cadeau / concept)
        y = Math.min(leftY, (y - 210)) - 6
        if (y < 160) y = 160
        hr(y); y -= 12

        const aboutTitle = locale === 'fr' ? 'À propos — Parcels of Time' : 'About — Parcels of Time'
        text(aboutTitle, { size: 14, font: bold })
        const bodyFR = [
          '• Édition unique : vous achetez la propriété symbolique d’une date (objet artistique, non un droit juridique).',
          '• Ce que vous recevez : certificat HD prêt à imprimer (PDF/JPG) avec QR vers une page dédiée et empreinte SHA-256 imprimée.',
          '• Personnalisation : titre, message, styles visuels, photo personnelle (contenu public modéré).',
          '• Achat & cadeau : pour vous ou à offrir — livraison quasi instantanée par e-mail.',
          '• Registre public : galerie d’art participatif où vous contrôlez la visibilité.',
          '• Revente : marketplace intégrée (Stripe Connect, KYC). Commission 15 % (min 1 €) à la vente ; virements par Stripe.',
          '• Sécurité : paiements Stripe, aucune donnée de carte stockée par Parcels of Time.',
        ]
        const bodyEN = [
          '• Single-edition: you acquire the symbolic ownership of a date (artistic object, not legal rights).',
          '• You receive: HD certificate ready to print (PDF/JPG) with a QR to a dedicated page and a printed SHA-256 fingerprint.',
          '• Personalization: title, message, visual styles, personal photo (public content is moderated).',
          '• Purchase & gift: for yourself or as a gift — near-instant delivery by email.',
          '• Public Registry: participatory gallery where you keep full visibility control.',
          '• Resale: built-in marketplace (Stripe Connect, KYC). 15% fee (min €1) on sale; payouts via Stripe.',
          '• Security: Stripe payments, we don’t store card data.',
        ]
        const bullets = locale === 'fr' ? bodyFR : bodyEN
        const pMax = width - 2*margin
        const lineSize = 11
        const lineLH = 13
        for (const p of bullets) {
          const wrapped = wrapLines(p, pMax, font, lineSize)
          for (const ln of wrapped) {
            page.drawText(ln, { x: margin, y, size: lineSize, font, color: ink })
            y -= lineLH
          }
          y -= 3
        }

        y -= 10
        const help = locale === 'fr'
          ? 'Besoin d’aide ? support@parcelsoftime.com'
          : 'Need help? support@parcelsoftime.com'
        page.drawText(help, { x: margin, y, size: 10, font, color: muted })
        const sig = '© Parcels of Time'
        page.drawText(sig, { x: width - margin - font.widthOfTextAtSize(sig, 10), y, size: 10, font, color: muted })

        bytes = await pdfDoc.save()
        mode = 'rich'
      }
    } catch {
      // ignore -> fallback
    }

    // 4) Fallback “plain” si pas de bytes
    if (!bytes) {
      bytes = renderPlainGuidePdf({
        locale, day, id, certHash, code
      })
      mode = 'plain'
    }

    // 5) Réponse — convertir vers un ArrayBuffer "strict"
    const ab = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(ab).set(bytes)

    return new Response(ab, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="transfer-guide-${day}.pdf"`,
        'cache-control': 'no-store',
        'X-Guide-Mode': mode,
      },
    })
  } catch (err) {
    console.error('[transfer-guide] fatal error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
