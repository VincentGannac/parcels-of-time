export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { pool } from '@/lib/db'

const sha256hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await ctx.params
  const url = new URL(_req.url)
  const code = (url.searchParams.get('code') || '').trim().toUpperCase()
  const locale = (url.searchParams.get('locale') || 'en') as 'fr'|'en'
  if (!claimId || !/^[0-9a-f-]{36}$/i.test(claimId) || !/^[A-Z0-9]{5}$/.test(code)) {
    return NextResponse.json({ ok:false }, { status: 400 })
  }

  const codeHash = sha256hex(code)
  const { rows } = await pool.query(
    `select c.id, c.cert_hash
       from claim_transfer_tokens t
       join claims c on c.id = t.claim_id
      where t.claim_id = $1
        and t.code_hash = $2
        and t.is_revoked = false
        and t.used_at is null
      limit 1`,
    [claimId, codeHash]
  )
  const row = rows[0]
  if (!row) return NextResponse.json({ ok:false }, { status: 404 })

  const certHash = String(row.cert_hash)
  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  const recoverUrl = `${base}/${locale}/gift/recover`

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawRectangle({ x:0, y:0, width, height, color: rgb(1,1,1) })
  let y = height - 80
  const title = locale==='fr' ? 'Récupérer un cadeau — Mode d’emploi' : 'Recover a gift — Instructions'
  page.drawText(title, { x: 48, y, size: 20, font: bold, color: rgb(.1,.12,.16) })
  y -= 28
  const p = (s:string, gap=16)=>{ page.drawText(s, { x:48, y, size:12, font, color: rgb(.12,.14,.2) }); y-=gap }
  p(locale==='fr'
    ? 'Pour basculer le certificat vers le compte du receveur, suivez les étapes ci-dessous :'
    : 'To transfer the certificate to the recipient’s account, follow the steps below:')

  y -= 6
  const steps = locale==='fr'
    ? [
        '1. Le receveur se connecte (ou crée un compte) sur Parcels of Time.',
        `2. Ouvrir ${recoverUrl}`,
        '3. Saisir les 3 éléments ci-dessous :',
      ]
    : [
        '1. The recipient signs in (or creates an account) on Parcels of Time.',
        `2. Open ${recoverUrl}`,
        '3. Enter the 3 items below:',
      ]
  steps.forEach(s => p(s))

  y -= 6
  page.drawText(locale==='fr' ? '• ID du certificat :' : '• Certificate ID:', { x:60, y, size:12, font: bold }); y-=16
  page.drawText(claimId, { x:72, y, size:11, font }); y-=18
  page.drawText('• SHA-256:', { x:60, y, size:12, font: bold }); y-=16
  page.drawText(certHash, { x:72, y, size:10, font }); y-=18
  page.drawText(locale==='fr' ? '• Code (usage unique) :' : '• Code (one-time):', { x:60, y, size:12, font: bold }); y-=16
  page.drawText(code, { x:72, y, size:14, font: bold }); y-=24

  const note = locale==='fr'
    ? 'Ce code n’expire pas. Il devient invalide dès que le transfert a été effectué.'
    : 'This code has no expiry. It becomes invalid as soon as the transfer is completed.'
  p(note, 18)

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="gift_instructions_${claimId}.pdf"`
    }
  })
}
