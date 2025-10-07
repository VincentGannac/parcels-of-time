// app/api/claim/[id]/transfer-guide.pdf/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import crypto from 'node:crypto'

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

// ----------------- Fallback PDF "plain", zéro dépendance -----------------
// Construit un petit PDF valide (Helvetica, texte seulement)
function escapePdfString(s: string) {
  return String(s)
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
  recoverUrl: string
}): Uint8Array {
  const { locale, day, id, certHash, code, recoverUrl } = args
  const L = locale === 'fr'
    ? {
        title: '🎁 Guide de récupération',
        subtitle: `Certificat du ${day}`,
        link: 'Lien de récupération',
        cid: 'ID du certificat',
        sha: 'SHA-256',
        codeLbl: 'Code (5 caractères)',
        brand: 'Parcels of Time'
      }
    : {
        title: '🎁 Recovery Guide',
        subtitle: `Certificate for ${day}`,
        link: 'Recovery link',
        cid: 'Certificate ID',
        sha: 'SHA-256',
        codeLbl: '5-char code',
        brand: 'Parcels of Time'
      }

  // Page A4
  const W = 595.28, H = 841.89
  // Petit contenu texte
  const lines = [
    { x: 50, y: 800, size: 16, text: L.brand, bold: true },
    { x: 50, y: 770, size: 26, text: L.title, bold: true },
    { x: 50, y: 745, size: 12, text: L.subtitle },

    { x: 50, y: 705, size: 12, text: L.link, bold: true },
    { x: 50, y: 688, size: 11, text: recoverUrl },

    { x: 50, y: 655, size: 12, text: L.cid, bold: true },
    { x: 50, y: 638, size: 11, text: id },

    { x: 50, y: 608, size: 12, text: L.sha, bold: true },
    { x: 50, y: 591, size: 10, text: certHash.slice(0, 64) },
    { x: 50, y: 576, size: 10, text: certHash.slice(64) },

    { x: 50, y: 546, size: 12, text: L.codeLbl, bold: true },
    { x: 50, y: 529, size: 12, text: code },
  ]

  const objs: string[] = []
  const offsets: number[] = []

  // 1: Catalog
  objs.push(`1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
`)

  // 2: Pages
  objs.push(`2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
`)

  // 3: Page
  objs.push(`3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}]
   /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >>
   /Contents 6 0 R
>>
endobj
`)

  // 4: Helvetica (Regular)
  objs.push(`4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
`)

  // 5: Helvetica-Bold
  objs.push(`5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
`)

  // 6: Contents stream
  const content = [
    'BT',
    ...lines.map(l => {
      const fontRef = l.bold ? 'F2' : 'F1'
      const txt = escapePdfString(l.text)
      return `/${fontRef} ${l.size} Tf ${l.x} ${l.y} Td (${txt}) Tj`
    }),
    'ET',
  ].join('\n')

  const contentBytes = Buffer.from(content, 'utf8')
  objs.push(`6 0 obj
<< /Length ${contentBytes.length} >>
stream
${content}
endstream
endobj
`)

  // Concat + xref
  let pdf = `%PDF-1.4\n`
  offsets.push(pdf.length)
  for (const obj of objs) {
    pdf += obj
    offsets.push(pdf.length)
  }

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n`
  pdf += `0000000000 65535 f \n`
  let pos = 0
  for (let i = 0; i < objs.length; i++) {
    const off = (i === 0 ? offsets[0] : offsets[i]) // position de début de chaque obj
    const s = String(off).padStart(10, '0')
    pdf += `${s} 00000 n \n`
    pos = off
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return new Uint8Array(Buffer.from(pdf, 'utf8'))
}

// ----------------- Handler -----------------
export async function GET(req: Request, ctx: { params?: { id?: string } } | any) {
  // On isole la partie “validation + DB”.
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
    // 1) Sécurité : le code doit exister & être actif pour CE claim
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

    // 2) Récupère le claim (hash & date)
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

    // 3) Tente la version “riche” (pdf-lib + QR). Sinon bascule vers fallback “plain”.
    let bytes: Uint8Array | null = null
    let mode: 'rich' | 'plain' = 'plain'

    try {
      const libs = await loadPdfLib()
      if (libs) {
        const { PDFDocument, StandardFonts, rgb } = libs
        const QR = await loadQRCode()

        // QR (optionnel)
        let qrPngBytes: Uint8Array | null = null
        if (QR) {
          try {
            const dataUrl: string = await QR.toDataURL(recoverUrl, { errorCorrectionLevel: 'M', margin: 0, width: 320 })
            const b64 = dataUrl.split(',')[1] || ''
            qrPngBytes = new Uint8Array(Buffer.from(b64, 'base64'))
          } catch {}
        }

        // PDF
        const pdfDoc = await PDFDocument.create()
        const page = pdfDoc.addPage([595.28, 841.89])
        const { width, height } = page.getSize()
        const margin = 56
        let y = height - margin

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const gold = rgb(0xE4/255, 0xB7/255, 0x3D/255)
        const ink = rgb(0x1A/255, 0x1F/255, 0x2A/255)
        const muted = rgb(0x6B/255, 0x72/255, 0x80/255)
        const border = rgb(0xE6/255, 0xEA/255, 0xF2/255)

        const text = (t: string, opts: { x?: number; y?: number; size?: number; font?: any; color?: any } = {}) => {
          const size = opts.size ?? 12
          const usedFont = opts.font ?? font
          const x = opts.x ?? margin
          const yy = opts.y ?? y
          page.drawText(t, { x, y: yy, size, font: usedFont, color: opts.color ?? ink })
          y = yy - size - 6
        }

        // Header
        const brand = 'Parcels of Time'
        text(brand, { x: width - margin - bold.widthOfTextAtSize(brand, 16), y, size: 16, font: bold })
        y -= 8

        // Titre
        text(locale === 'fr' ? '🎁 Guide de récupération' : '🎁 Recovery Guide', { size: 26, font: bold })
        text(locale === 'fr' ? `Certificat du ${day}` : `Certificate for ${day}`, { size: 14, color: muted })

        // Cartouche
        const boxW = width - 2 * margin
        const boxH = 80
        page.drawRectangle({ x: margin, y: y - boxH + 6, width: boxW, height: boxH, borderColor: border, borderWidth: 1 })
        const intro = locale === 'fr'
          ? `Ce document permet au destinataire de récupérer le certificat et d’en devenir l’unique détenteur.`
          : `This document enables the recipient to recover the certificate and become its unique holder.`
        page.drawText(intro, { x: margin + 12, y: y - 18, size: 12, font, color: ink, maxWidth: boxW - 24, lineHeight: 14 })
        y -= (boxH + 6)

        // Étapes
        const steps = [
          locale === 'fr' ? 'Ouvrez la page « Récupérer un cadeau ».' : 'Open the “Recover a gift” page.',
          locale === 'fr' ? 'Cliquez sur « Récupérer ».' : 'Click “Recover”.',
          locale === 'fr' ? 'Saisissez les informations suivantes :' : 'Enter the following information:',
        ]
        text(locale === 'fr' ? 'Étapes' : 'Steps', { size: 14, font: bold })
        y -= 4
        steps.forEach((s, i) => {
          const cy = y + 10
          page.drawCircle({ x: margin + 6, y: cy, size: 6, color: gold })
          page.drawText(String(i + 1), { x: margin + 3.8, y: cy - 5, size: 10, font: bold, color: rgb(1,1,1) })
          page.drawText(s, { x: margin + 24, y, size: 12, font, color: ink })
          y -= 18
        })

        // QR + lien
        y -= 6
        const qrSize = 110
        let linkX = margin
        if (qrPngBytes) {
          try {
            const png = await pdfDoc.embedPng(qrPngBytes)
            const yy = y - qrSize + 12
            page.drawImage(png, { x: margin, y: yy, width: qrSize, height: qrSize })
            page.drawRectangle({ x: margin, y: yy, width: qrSize, height: qrSize, borderColor: border, borderWidth: 1 })
            linkX = margin + qrSize + 12
          } catch {}
        }
        page.drawText(locale === 'fr' ? 'Lien de récupération' : 'Recovery link',
          { x: linkX, y: y + 86, size: 12, font: bold, color: ink })
        page.drawText(recoverUrl, { x: linkX, y: y + 66, size: 11, font, color: ink, maxWidth: width - margin - linkX })
        y -= (qrSize + 6)

        const lineH = 22
        const drawField = (label: string, value: string) => {
          page.drawText(label, { x: margin, y, size: 11, font: bold, color: muted })
          page.drawRectangle({ x: margin, y: y - lineH + 4, width: boxW, height: lineH, borderColor: rgb(0xD9/255,0xDF/255,0xEB/255), borderWidth: 1 })
          page.drawText(value || '—', { x: margin + 8, y: y - 12, size: 12, font: bold, color: ink })
          y -= (lineH + 10)
        }
        drawField(locale === 'fr' ? 'ID du certificat' : 'Certificate ID', id)
        drawField('SHA-256', certHash)
        drawField(locale === 'fr' ? 'Code (5 caractères)' : '5-char code', code)

        // Footer
        const note = locale === 'fr'
          ? 'Une fois validé, vous devenez l’unique détenteur officiel de cette date dans notre registre.'
          : 'Once validated, you become the official, unique holder of this date in our registry.'
        page.drawText(note, { x: margin, y, size: 11, font, color: ink, maxWidth: boxW, lineHeight: 13 })
        y -= 28
        const about = locale === 'fr'
          ? 'Parcels of Time est un registre qui attribue chaque journée à un seul détenteur à la fois. Vous pouvez personnaliser votre certificat, le transférer, ou le revendre sur la place de marché.'
          : 'Parcels of Time is a registry that assigns each calendar day to a single holder at a time. You can personalize your certificate, transfer it, or resell it on the marketplace.'
        page.drawText(locale === 'fr' ? 'À propos de Parcels of Time' : 'About Parcels of Time',
          { x: margin, y, size: 14, font: bold, color: ink })
        y -= 18
        page.drawText(about, { x: margin, y, size: 11, font, color: ink, maxWidth: boxW, lineHeight: 13 })
        y -= 32
        page.drawText(locale === 'fr' ? 'Besoin d’aide ? support@parcelsoftime.com' : 'Need help? support@parcelsoftime.com',
          { x: margin, y: Math.max(y, margin), size: 10, font, color: muted })

        bytes = await pdfDoc.save()
        mode = 'rich'
      }
    } catch (e) {
      // ignore -> fallback
    }

    // 4) Fallback “plain” si pas de bytes
    if (!bytes) {
      bytes = renderPlainGuidePdf({
        locale, day, id, certHash, code, recoverUrl
      })
      mode = 'plain'
    }

 
   
    // 5) Réponse — convertir vers un ArrayBuffer "strict"
    const ab = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(ab).set(bytes) // copie les octets

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
    // Échecs DB/validation → on reste explicite (pas de 500 silencieux pour ces cas)
    console.error('[transfer-guide] fatal error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
