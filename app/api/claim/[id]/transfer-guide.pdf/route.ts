// app/api/claim/[id]/transfer-guide.pdf/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import PDFDocument from 'pdfkit'
import { pool } from '@/lib/db'

function ymd(ts: string) {
  try { const d = new Date(ts); if (!isNaN(d.getTime())) return d.toISOString().slice(0,10) } catch {}
  return (ts || '').slice(0,10)
}

function font(doc: any, size: number, bold = false) {
  doc.font('Helvetica' + (bold ? '-Bold' : '')).fontSize(size)
}

// ✅ Correction: déstructurer le 2ᵉ argument pour respecter la signature attendue par Next 15
export async function GET(req: Request, ctx: any) {
  const id = String((ctx?.params?.id ?? '')).trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  const url = new URL(req.url)
  const code = (url.searchParams.get('code') || '').toUpperCase()
  const locale = (url.searchParams.get('locale') || 'fr').toLowerCase() === 'en' ? 'en' : 'fr'

  const base = process.env.NEXT_PUBLIC_BASE_URL || url.origin

  // Récupère claim + hash + ts
  const { rows } = await pool.query(
    `select c.id, c.cert_hash, c.ts
       from claims c
      where c.id = $1
      limit 1`,
    [id]
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const certHash = String(rows[0].cert_hash || '')
  const tsISO = new Date(rows[0].ts).toISOString()
  const day = ymd(tsISO)

  // Lien "Récupérer"
  const recoverUrl = `${base}/${locale}/gift/recover?claim_id=${encodeURIComponent(id)}&cert_hash=${encodeURIComponent(certHash)}`

  // Génère QR (et passe en Buffer pour pdfkit)
  const qrDataUrl = await QRCode.toDataURL(recoverUrl, { margin: 0, width: 320 })
  const pngBase64 = qrDataUrl.split(',')[1] || ''
  const qrBuf = Buffer.from(pngBase64, 'base64')

  // PDF
  const doc = new PDFDocument({ size: 'A4', margin: 56 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise((res) => doc.on('end', res))

  // Palette
  const gold = '#E4B73D'
  const ink = '#1A1F2A'
  const muted = '#6B7280'

  // Header
  font(doc, 16, true); doc.fillColor(ink)
  doc.text(locale === 'fr' ? 'Parcels of Time' : 'Parcels of Time', { align: 'right' })
  doc.moveDown(0.5)

  // Titre
  font(doc, 26, true)
  doc.fillColor(ink).text((locale === 'fr' ? '🎁 Guide de récupération' : '🎁 Recovery Guide'), { align: 'left' })
  font(doc, 14); doc.fillColor(muted)
  doc.text(locale === 'fr' ? `Certificat du ${day}` : `Certificate for ${day}`)
  doc.moveDown(1.0)

  // Cartouche explication
  doc.roundedRect(doc.x, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 80, 8)
    .strokeColor('#E6EAF2').lineWidth(1).stroke()
  doc.save().translate(12, 12)
  font(doc, 12); doc.fillColor(ink)
  doc.text(locale === 'fr'
    ? `Ce document permet au destinataire de récupérer le certificat et d’en devenir l’unique détenteur.`
    : `This document enables the recipient to recover the certificate and become its unique holder.`
  , { width: doc.page.width - 2*doc.page.margins.left - 24 })
  doc.restore()
  doc.moveDown(0.6)

  // Étapes
  const steps = [
    locale === 'fr' ? 'Ouvrez la page « Récupérer un cadeau ».' : 'Open the “Recover a gift” page.',
    locale === 'fr' ? 'Cliquez sur « Récupérer ».' : 'Click “Recover”.',
    locale === 'fr' ? 'Saisissez les informations suivantes :' : 'Enter the following information:',
  ]
  const labels = {
    id: locale === 'fr' ? 'ID du certificat' : 'Certificate ID',
    sha: 'SHA-256',
    codeLabel: locale === 'fr' ? 'Code (5 caractères)' : '5-char code',
    unique: locale === 'fr'
      ? 'Une fois validé, vous devenez l’unique détenteur officiel de cette date dans notre registre.'
      : 'Once validated, you become the official, unique holder of this date in our registry.',
    about: locale === 'fr'
      ? 'Parcels of Time est un registre qui attribue chaque journée à un seul détenteur à la fois. Vous pouvez personnaliser votre certificat, le transférer, ou le revendre sur la place de marché.'
      : 'Parcels of Time is a registry that assigns each calendar day to a single holder at a time. You can personalize your certificate, transfer it, or resell it on the marketplace.',
  }

  font(doc, 14, true); doc.fillColor(ink).text(locale === 'fr' ? 'Étapes' : 'Steps')
  font(doc, 12); doc.moveDown(0.4)
  steps.forEach((s, i) => {
    doc.circle(doc.x + 6, doc.y + 7, 6).fillColor(gold).fill()
    doc.fillColor('#fff'); font(doc, 10, true); doc.text(String(i+1), doc.x - 1, doc.y - 12, { continued: false })
    doc.moveDown(-0.5)
    font(doc, 12); doc.fillColor(ink)
    doc.text(s, { indent: 22 }); doc.moveDown(0.3)
  })

  // QR + lien
  doc.moveDown(0.6)
  const startY = doc.y
  const qrSize = 110
  doc.image(qrBuf, doc.x, startY, { width: qrSize, height: qrSize })
  doc.rect(doc.x, startY, qrSize, qrSize).strokeColor('#E6EAF2').lineWidth(1).stroke()
  doc.moveUp(1)
  doc.translate(qrSize + 12, 0)
  font(doc, 12, true); doc.fillColor(ink).text(locale === 'fr' ? 'Lien de récupération' : 'Recovery link')
  font(doc, 11); doc.fillColor(ink).text(recoverUrl, { width: doc.page.width - doc.page.margins.right - doc.x, link: recoverUrl, underline: true })
  doc.translate(-(qrSize + 12), 0)
  doc.moveDown(0.8)

  // Bloc champs
  const boxW = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const lineH = 22
  const drawField = (label: string, value: string) => {
    font(doc, 11, true); doc.fillColor(muted).text(label)
    doc.roundedRect(doc.x, doc.y, boxW, lineH, 6).strokeColor('#D9DFEB').lineWidth(1).stroke()
    font(doc, 12, true); doc.fillColor(ink)
    doc.text(value, doc.x + 8, doc.y + 4, { continued: false })
    doc.moveDown(1.2)
  }

  drawField(labels.id, id)
  drawField(labels.sha, certHash)
  drawField(labels.codeLabel, code || (locale === 'fr' ? '•••••' : '•••••'))

  // Note d’unicité
  doc.moveDown(0.4)
  font(doc, 11); doc.fillColor(ink)
  doc.text(labels.unique)
  doc.moveDown(0.8)

  // À propos
  font(doc, 14, true); doc.fillColor(ink).text(locale === 'fr' ? 'À propos de Parcels of Time' : 'About Parcels of Time')
  font(doc, 11); doc.fillColor(ink)
  doc.text(labels.about)
  doc.moveDown(0.8)

  // Footer
  font(doc, 10); doc.fillColor(muted)
  doc.text(locale === 'fr'
    ? 'Besoin d’aide ? support@parcelsoftime.com'
    : 'Need help? support@parcelsoftime.com'
  )

  doc.end()
  await done

  const pdf = Buffer.concat(chunks)
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="transfer-guide-${day}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
