// app/api/claim/[id]/transfer-guide.pdf/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

// ----------------- Utils -----------------
const sha256hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

const ymd = (ts: string) => {
  try {
    const d = new Date(ts)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {}
  return (ts || '').slice(0, 10)
}

/* ---------- Fallback PDF (strict PDF 1.4, ASCII) ---------- */
function asciiSafe(s: string) {
  return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '')
}
function escapePdfString(s: string) {
  return asciiSafe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r/g, '')
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
  objs.push(obj(1, `<< /Type /Catalog /Pages 2 0 R >>`))
  objs.push(obj(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`))
  objs.push(obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`))
  objs.push(obj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`))
  objs.push(obj(5, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`))
  const contentLines: string[] = ['BT']
  for (const l of lines) {
    contentLines.push(`/${l.bold ? 'F2' : 'F1'} ${l.size} Tf`)
    contentLines.push(`1 0 0 1 ${l.x} ${l.y} Tm`)
    contentLines.push(`(${escapePdfString(l.text)}) Tj`)
  }
  contentLines.push('ET')
  const contentStr = contentLines.join('\r\n')
  const contentLen = Buffer.byteLength(contentStr, 'ascii')
  objs.push(obj(6, `<< /Length ${contentLen} >>\r\nstream\r\n${contentStr}\r\nendstream`))
  let file = '%PDF-1.4\r\n'
  const offsets: number[] = []
  for (const o of objs) { offsets.push(Buffer.byteLength(file, 'ascii')); file += o }
  const xrefStart = Buffer.byteLength(file, 'ascii')
  file += `xref\r\n0 ${objs.length + 1}\r\n0000000000 65535 f \r\n`
  for (const off of offsets) file += `${String(off).padStart(10, '0')} 00000 n \r\n`
  file += `trailer\r\n<< /Size ${objs.length + 1} /Root 1 0 R >>\r\nstartxref\r\n${xrefStart}\r\n%%EOF\r\n`
  return new Uint8Array(Buffer.from(file, 'ascii'))
}

/* ---------- Helpers (pdf-lib) ---------- */
function wrapLines(text: string, maxWidth: number, font: any, size: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(test, size) <= maxWidth) cur = test
    else { if (cur) lines.push(cur); cur = w }
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
    // 1) Sécurité
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
      if (!rows.length) return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 403 })
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
    const day = ymd(new Date(crows[0].ts).toISOString())

    const base = process.env.NEXT_PUBLIC_BASE_URL || url.origin
    const recoverUrl = `${base}/${locale}/gift/recover?claim_id=${encodeURIComponent(id)}&cert_hash=${encodeURIComponent(certHash)}`

    // 3) Version “riche” (pdf-lib + QR). Si échec → fallback.
    let bytes: Uint8Array | null = null
    let mode: 'rich' | 'plain' = 'plain'

    try {
      // QR PNG
      let qrPngBytes: Uint8Array | null = null
      try {
        const dataUrl = await QRCode.toDataURL(recoverUrl, { errorCorrectionLevel: 'M', margin: 0, width: 420 })
        qrPngBytes = new Uint8Array(Buffer.from((dataUrl.split(',')[1] || ''), 'base64'))
      } catch {}

      // Document
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([595.28, 841.89])
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
      const monoBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

      // Helpers
      const margin = 56
      let y = height - margin
      const text = (t: string, opts: { x?: number; y?: number; size?: number; font?: any; color?: any } = {}) => {
        const size = opts.size ?? 12
        const usedFont = opts.font ?? font
        const x = opts.x ?? margin
        const yy = opts.y ?? y
        page.drawText(t, { x, y: yy, size, font: usedFont, color: opts.color ?? ink })
        y = yy - size - 6
      }
      const paragraph = (t: string, x: number, maxWidth: number, opts: { size?: number; font?: any; color?: any; leading?: number } = {}) => {
        const size = opts.size ?? 12
        const usedFont = opts.font ?? font
        const leading = opts.leading ?? (size + 2)
        const lines = wrapLines(t, maxWidth, usedFont, size)
        for (const ln of lines) { page.drawText(ln, { x, y, size, font: usedFont, color: opts.color ?? ink }); y -= leading }
      }
      const hr = (yy: number) => page.drawLine({ start: { x: margin, y: yy }, end: { x: width - margin, y: yy }, thickness: 1, color: border })

      // Bordure
      page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: border, borderWidth: 1 })

      // En-tête marque
      const brand = 'Parcels of Time'
      page.drawText(brand, { x: width - margin - bold.widthOfTextAtSize(brand, 16), y, size: 16, font: bold, color: ink })
      y -= 8

      // Titre principal
      text(locale === 'fr' ? 'Guide de récupération' : 'Recovery Guide', { size: 30, font: bold })
      // Sous-titre date
      text(locale === 'fr' ? `Certificat du ${day}` : `Certificate for ${day}`, { size: 13, color: muted })
      y -= 4; hr(y); y -= 14

      // Bandeau d’instructions (sans afficher l’URL)
      const bandH = 88
      page.drawRectangle({ x: margin, y: y - bandH + 6, width: width - 2*margin, height: bandH, color: panel, borderColor: border, borderWidth: 1 })
      const msg = locale === 'fr'
        ? `Scannez le QR ou ouvrez votre compte Parcels of Time, cliquez sur « Récupérer », puis saisissez les mots de passe ci-dessous.`
        : `Scan the QR or open your Parcels of Time account, click “Recover”, then enter the passwords below.`
      const msgMax = width - 2*margin - 24
      y -= 18
      paragraph(msg, margin + 12, msgMax, { size: 12, leading: 14 })
      y = y - (bandH - 36) // remet en dessous du bandeau

      // Grille 60 / 40
      const colGap = 18
      const leftW = (width - 2*margin - colGap) * 0.60
      const rightW = (width - 2*margin - colGap) * 0.40

      // Colonne droite : QR
      if (qrPngBytes) {
        const png = await pdfDoc.embedPng(qrPngBytes)
        const qrSize = Math.min(184, rightW)
        const qrX = margin + leftW + colGap + (rightW - qrSize) / 2
        const qrY = y - qrSize + 8
        page.drawRectangle({ x: qrX - 8, y: qrY - 8, width: qrSize + 16, height: qrSize + 16, borderColor: border, borderWidth: 1, color: rgb(1,1,1) })
        page.drawImage(png, { x: qrX, y: qrY, width: qrSize, height: qrSize })
        page.drawText(locale === 'fr' ? 'Scanner pour ouvrir' : 'Scan to open', { x: qrX + 8, y: qrY - 20, size: 10, font, color: muted })
      }

      // Colonne gauche : champs (labels AU-DESSUS des boxes, plus de recouvrement)
      const leftX = margin
      let leftY = y

      const fieldBox = (label: string, height: number, drawContent: (bottom: number, top: number) => void) => {
        // 1) Label
        page.drawText(label, { x: leftX, y: leftY, size: 10, font: bold, color: muted })
        // 2) Rectangle sous le label
        const top = leftY - 12
        const bottom = top - height
        page.drawRectangle({ x: leftX, y: bottom, width: leftW, height, borderColor: border, borderWidth: 1, color: rgb(1,1,1) })
        // 3) Contenu
        drawContent(bottom, top)
        // 4) Espace après
        leftY = bottom - 14
      }

      // ID
      fieldBox(locale === 'fr' ? 'ID du certificat' : 'Certificate ID', 40, (bottom, top) => {
        page.drawText(id || '—', { x: leftX + 10, y: top - 16, size: 12, font: bold, color: ink })
      })

      // SHA (2 lignes monospaces fixes)
      const sha1 = certHash.slice(0, 32)
      const sha2 = certHash.slice(32, 64)
      fieldBox('SHA-256', 52, (bottom, top) => {
        page.drawText(sha1 || '—', { x: leftX + 10, y: top - 16, size: 12, font: monoBold, color: ink })
        if (sha2) page.drawText(sha2, { x: leftX + 10, y: top - 34, size: 12, font: monoBold, color: ink })
      })

      // Code
      fieldBox(locale === 'fr' ? 'Code (5 caractères)' : '5-char code', 48, (bottom, top) => {
        const big = code.split('').join('  ')
        page.drawText(big, { x: leftX + 10, y: top - 20, size: 16, font: bold, color: ink })
      })

      // À propos — reformulé “cadeau”
      y = Math.min(leftY, (y - 210)) - 10
      if (y < 160) y = 160
      hr(y); y -= 12

      text(locale === 'fr' ? 'À propos — Parcels of Time' : 'About — Parcels of Time', { size: 14, font: bold })

      const aboutFR = [
        'Cette date vous a été offerte. Elle est désormais la vôtre — vous en êtes l’unique détenteur symbolique.',
        'Votre certificat a déjà été personnalisé pour raconter cette histoire (titre, message, visuel). Il est prêt à être affiché, partagé ou imprimé.',
        'Le QR ouvre votre page dédiée pour l’ajouter à votre compte. Laissez-la privée ou rendez-la visible au public quand vous le souhaitez.',
        'L’empreinte d’intégrité SHA-256 imprimée ci-dessus permet de vérifier à tout moment l’authenticité de ce document.',
        'Conservez-le comme on garde un faire-part précieux : une trace officielle du jour qui marque votre histoire.'
      ]
      const aboutEN = [
        'This date was gifted to you. It is now yours — you are the unique symbolic holder.',
        'Your certificate is already personalized to tell this story (title, message, visual). It’s ready to display, share, or print.',
        'The QR opens your dedicated page so you can add it to your account. Keep it private or make it public whenever you wish.',
        'The printed SHA-256 integrity fingerprint lets anyone verify the document’s authenticity at any time.',
        'Keep it like a cherished announcement: an official trace of the day that marks your story.'
      ]
      const paras = locale === 'fr' ? aboutFR : aboutEN
      const pMax = width - 2*margin
      for (const p of paras) paragraph(p, margin, pMax, { size: 11, leading: 13 })

      y -= 6
      const help = locale === 'fr' ? 'Besoin d’aide ? support@parcelsoftime.com' : 'Need help? support@parcelsoftime.com'
      page.drawText(help, { x: margin, y, size: 10, font, color: muted })
      const sig = '© Parcels of Time'
      page.drawText(sig, { x: width - margin - font.widthOfTextAtSize(sig, 10), y, size: 10, font, color: muted })

      bytes = await pdfDoc.save()
      mode = 'rich'
    } catch (e) {
      // Si la version riche échoue, on assure un PDF minimal conforme
      bytes = renderPlainGuidePdf({ locale, day, id, certHash, code })
      mode = 'plain'
      console.error('[transfer-guide] rich generation failed → fallback:', e)
    }

    // 4) Réponse — buffer strict (copie)
    const ab = new ArrayBuffer((bytes as Uint8Array).byteLength)
    new Uint8Array(ab).set(bytes as Uint8Array)

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
