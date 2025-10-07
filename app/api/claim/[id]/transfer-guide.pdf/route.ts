// app/api/claim/[id]/transfer-guide.pdf/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import crypto from 'node:crypto'

const sha256hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

function ymd(ts: string) {
  try {
    const d = new Date(ts)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {}
  return (ts || '').slice(0, 10)
}

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

export async function GET(req: Request, ctx: { params?: { id?: string } } | any) {
  try {
    // --------- Params & sécurité ---------
    const id = String((ctx?.params?.id ?? '')).trim()
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'bad_id' }, { status: 400 })
    }

    const url = new URL(req.url)
    const code = (url.searchParams.get('code') || '').toUpperCase().trim()
    const locale = ((url.searchParams.get('locale') || 'fr').toLowerCase() === 'en') ? 'en' : 'fr'
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      return NextResponse.json({ error: 'bad_code' }, { status: 400 })
    }

    // Vérifie que le code appartient bien au claim & est actif
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

    // --------- Claim & URLs ---------
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
    const recoverUrl =
      `${base}/${locale}/gift/recover?claim_id=${encodeURIComponent(id)}&cert_hash=${encodeURIComponent(certHash)}`

    // --------- Libs ---------
    const libs = await loadPdfLib()
    if (!libs) return NextResponse.json({ error: 'server_unavailable' }, { status: 503 })
    const { PDFDocument, StandardFonts, rgb } = libs

    const QR = await loadQRCode() // facultatif
    let qrPngBytes: Uint8Array | null = null
    if (QR) {
      try {
        const dataUrl: string = await QR.toDataURL(recoverUrl, {
          errorCorrectionLevel: 'M',
          margin: 0,
          width: 320,
        })
        const b64 = dataUrl.split(',')[1] || ''
        qrPngBytes = new Uint8Array(Buffer.from(b64, 'base64'))
      } catch (e) {
        console.warn('[transfer-guide] QR toDataURL failed:', (e as any)?.message || e)
        qrPngBytes = null
      }
    }

    // --------- PDF via pdf-lib ---------
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 en points
    const { width, height } = page.getSize()
    const margin = 56
    let cursorY = height - margin

    // Polices
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Couleurs
    const gold = rgb(0xE4/255, 0xB7/255, 0x3D/255)
    const ink = rgb(0x1A/255, 0x1F/255, 0x2A/255)
    const muted = rgb(0x6B/255, 0x72/255, 0x80/255)
    const border = rgb(0xE6/255, 0xEA/255, 0xF2/255)

    const text = (t: string, opts: { x?: number; y?: number; size?: number; font?: any; color?: any } = {}) => {
      const size = opts.size ?? 12
      const usedFont = opts.font ?? font
      const x = opts.x ?? margin
      const y = opts.y ?? cursorY
      page.drawText(t, { x, y, size, font: usedFont, color: opts.color ?? ink })
      cursorY = y - size - 6
    }

    // Header
    text('Parcels of Time', { x: width - margin - bold.widthOfTextAtSize('Parcels of Time', 16), y: cursorY, size: 16, font: bold })
    cursorY -= 8

    // Titre
    text(locale === 'fr' ? '🎁 Guide de récupération' : '🎁 Recovery Guide', { size: 26, font: bold })
    text(locale === 'fr' ? `Certificat du ${day}` : `Certificate for ${day}`, { size: 14, color: muted })

    // Cartouche intro
    const boxW = width - 2*margin
    const boxH = 80
    page.drawRectangle({
      x: margin, y: cursorY - boxH + 6, width: boxW, height: boxH, borderColor: border, borderWidth: 1, color: undefined, borderOpacity: 1
    })
    const intro = locale === 'fr'
      ? `Ce document permet au destinataire de récupérer le certificat et d’en devenir l’unique détenteur.`
      : `This document enables the recipient to recover the certificate and become its unique holder.`
    page.drawText(intro, { x: margin + 12, y: cursorY - 18, size: 12, font, color: ink, maxWidth: boxW - 24, lineHeight: 14 })
    cursorY -= (boxH + 6)

    // Étapes
    const steps = [
      locale === 'fr' ? 'Ouvrez la page « Récupérer un cadeau ».' : 'Open the “Recover a gift” page.',
      locale === 'fr' ? 'Cliquez sur « Récupérer ».' : 'Click “Recover”.',
      locale === 'fr' ? 'Saisissez les informations suivantes :' : 'Enter the following information:',
    ]
    text(locale === 'fr' ? 'Étapes' : 'Steps', { size: 14, font: bold })
    cursorY -= 4
    steps.forEach((s, i) => {
      // pastille numérotée
      const cy = cursorY + 10
      page.drawCircle({ x: margin + 6, y: cy, size: 6, color: gold })
      page.drawText(String(i + 1), { x: margin + 3.8, y: cy - 5, size: 10, font: bold, color: rgb(1,1,1) })
      page.drawText(s, { x: margin + 24, y: cursorY, size: 12, font, color: ink })
      cursorY -= 18
    })

    // QR + lien
    cursorY -= 6
    const qrSize = 110
    let linkX = margin
    if (qrPngBytes) {
      try {
        const png = await pdfDoc.embedPng(qrPngBytes)
        const y = cursorY - qrSize + 12
        page.drawImage(png, { x: margin, y, width: qrSize, height: qrSize })
        // cadre léger
        page.drawRectangle({ x: margin, y, width: qrSize, height: qrSize, borderColor: border, borderWidth: 1 })
        linkX = margin + qrSize + 12
      } catch (e) {
        console.warn('[transfer-guide] embedPng failed:', (e as any)?.message || e)
      }
    }
    page.drawText(locale === 'fr' ? 'Lien de récupération' : 'Recovery link',
      { x: linkX, y: cursorY + 86, size: 12, font: bold, color: ink })
    page.drawText(recoverUrl,
      { x: linkX, y: cursorY + 66, size: 11, font, color: ink, maxWidth: width - margin - linkX })
    cursorY -= (qrSize + 6)

    // Champs (ID / SHA / code)
    const lineH = 22
    const drawField = (label: string, value: string) => {
      page.drawText(label, { x: margin, y: cursorY, size: 11, font: bold, color: muted })
      page.drawRectangle({ x: margin, y: cursorY - lineH + 4, width: boxW, height: lineH, borderColor: rgb(0xD9/255,0xDF/255,0xEB/255), borderWidth: 1, borderOpacity: 1 })
      page.drawText(value || '—', { x: margin + 8, y: cursorY - 12, size: 12, font: bold, color: ink })
      cursorY -= (lineH + 10)
    }
    drawField(locale === 'fr' ? 'ID du certificat' : 'Certificate ID', id)
    drawField('SHA-256', certHash)
    drawField(locale === 'fr' ? 'Code (5 caractères)' : '5-char code', code)

    // Note + à propos
    const note = locale === 'fr'
      ? 'Une fois validé, vous devenez l’unique détenteur officiel de cette date dans notre registre.'
      : 'Once validated, you become the official, unique holder of this date in our registry.'
    page.drawText(note, { x: margin, y: cursorY, size: 11, font, color: ink, maxWidth: boxW, lineHeight: 13 })
    cursorY -= 28

    page.drawText(locale === 'fr' ? 'À propos de Parcels of Time' : 'About Parcels of Time',
      { x: margin, y: cursorY, size: 14, font: bold, color: ink })
    cursorY -= 18
    const about = locale === 'fr'
      ? 'Parcels of Time est un registre qui attribue chaque journée à un seul détenteur à la fois. Vous pouvez personnaliser votre certificat, le transférer, ou le revendre sur la place de marché.'
      : 'Parcels of Time is a registry that assigns each calendar day to a single holder at a time. You can personalize your certificate, transfer it, or resell it on the marketplace.'
    page.drawText(about, { x: margin, y: cursorY, size: 11, font, color: ink, maxWidth: boxW, lineHeight: 13 })
    cursorY -= 32

    // Footer
    page.drawText(locale === 'fr' ? 'Besoin d’aide ? support@parcelsoftime.com' : 'Need help? support@parcelsoftime.com',
      { x: margin, y: Math.max(cursorY, margin), size: 10, font, color: muted })

    const bytes = await pdfDoc.save()

    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="transfer-guide-${day}.pdf"`,
        'cache-control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[transfer-guide] error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
