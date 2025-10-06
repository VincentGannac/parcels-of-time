// lib/email.ts
import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
export const resend = apiKey ? new Resend(apiKey) : null

const FROM =
  process.env.FROM_EMAIL || 'Parcels of Time <no-reply@parcelsoftime.com>'
const REPLY_TO =
  process.env.REPLY_TO_EMAIL || 'support@parcelsoftime.com'
const BCC_TO =
  process.env.BCC_EMAIL || 'support@parcelsoftime.com'

function resolveBcc(to: string | string[]): string | string[] | undefined {
  const list = Array.isArray(to) ? to.map(s => s.toLowerCase()) : [to.toLowerCase()]
  return list.includes(BCC_TO.toLowerCase()) ? undefined : BCC_TO
}

/** Reçu d’achat */
export async function sendClaimReceiptEmail(input: {
  to: string | string[]
  ts: string
  displayName?: string | null
  publicUrl: string
  certUrl: string
  transfer?: {
    claimId: string
    hash: string
    code?: string
    recoverUrl: string
    instructionsPdfUrl?: string
    locale: 'fr'|'en'
  }
}) {
  const { to, ts, displayName, publicUrl, certUrl, transfer } = input
  const isFR = transfer?.locale === 'fr'

  const subject = isFR
    ? `Votre certificat — ${ts}`
    : `Your certificate — ${ts}`

  const giftBlockTxt = transfer ? (
    isFR
      ? [
          '',
          '——',
          '🎁 Pour offrir (transfert de propriété) :',
          `ID certificat : ${transfer.claimId}`,
          `SHA-256 : ${transfer.hash}`,
          transfer.code ? `Code (à usage unique) : ${transfer.code}` : 'Code : (créé)',
          `Récupérer un cadeau : ${transfer.recoverUrl}`,
          transfer.instructionsPdfUrl ? `PDF d’instructions : ${transfer.instructionsPdfUrl}` : '',
        ].join('\n')
      : [
          '',
          '——',
          '🎁 To gift (ownership transfer):',
          `Certificate ID: ${transfer.claimId}`,
          `SHA-256: ${transfer.hash}`,
          transfer.code ? `Code (one-time): ${transfer.code}` : 'Code: (created)',
          `Recover a gift: ${transfer.recoverUrl}`,
          transfer.instructionsPdfUrl ? `Instructions PDF: ${transfer.instructionsPdfUrl}` : '',
        ].join('\n')
  ) : ''

  const text = [
    isFR
      ? `Bonjour${displayName ? ' ' + displayName : ''},`
      : `Hi${displayName ? ' ' + displayName : ''},`,
    isFR
      ? `Merci pour votre achat. Vous détenez désormais le certificat du ${ts}.`
      : `Thanks for your purchase. You now own the certificate for ${ts}.`,
    `Page publique : ${publicUrl}`,
    `PDF du certificat : ${certUrl}`,
    giftBlockTxt,
    '',
    '— Parcels of Time',
  ].join('\n')

  const giftBlockHtml = transfer ? (
    isFR
      ? `
        <hr />
        <p>🎁 <strong>Pour offrir (transfert de propriété)</strong></p>
        <ul>
          <li><strong>ID certificat</strong> : ${transfer.claimId}</li>
          <li><strong>SHA-256</strong> : ${transfer.hash}</li>
          ${transfer.code ? `<li><strong>Code (à usage unique)</strong> : ${transfer.code}</li>` : ''}
          <li><a href="${transfer.recoverUrl}">Récupérer un cadeau</a></li>
          ${transfer.instructionsPdfUrl ? `<li><a href="${transfer.instructionsPdfUrl}">PDF d’instructions</a></li>` : ''}
        </ul>
      `
      : `
        <hr />
        <p>🎁 <strong>To gift (ownership transfer)</strong></p>
        <ul>
          <li><strong>Certificate ID</strong>: ${transfer.claimId}</li>
          <li><strong>SHA-256</strong>: ${transfer.hash}</li>
          ${transfer.code ? `<li><strong>Code (one-time)</strong>: ${transfer.code}</li>` : ''}
          <li><a href="${transfer.recoverUrl}">Recover a gift</a></li>
          ${transfer.instructionsPdfUrl ? `<li><a href="${transfer.instructionsPdfUrl}">Instructions PDF</a></li>` : ''}
        </ul>
      `
  ) : ''

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
      <p>${isFR ? 'Bonjour' : 'Hi'}${displayName ? ' ' + displayName : ''},</p>
      <p>${isFR
        ? `Merci pour votre achat. Vous détenez désormais le certificat du <strong>${ts}</strong>.`
        : `Thanks for your purchase. You now own the certificate for <strong>${ts}</strong>.`}
      </p>
      <p>
        <a href="${publicUrl}">${isFR ? 'Page publique' : 'Public page'}</a>
        &nbsp;·&nbsp;
        <a href="${certUrl}">${isFR ? 'PDF du certificat' : 'Certificate (PDF)'}</a>
      </p>
      ${giftBlockHtml}
      <p>— Parcels of Time</p>
    </div>
  `.trim()

  if (!resend) {
    console.log('[email][receipt] (dry-run)', { to, ts, publicUrl, certUrl, transfer })
    return
  }

  try {
    await resend.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      bcc: resolveBcc(to),
      subject,
      text,
      html,
    })
  } catch (e) {
    console.error('[email][receipt] send error', e)
  }
}


export async function sendSecondarySaleEmails(opts: {
  ts: string,
  buyerEmail: string,
  pdfUrl: string,
  publicUrl: string,
  sessionId: string
}) {
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const subjectFR = `Achat confirmé — Certificat du ${opts.ts}`
  const subjectEN = `Purchase confirmed — Certificate for ${opts.ts}`

  // Buyer (PDF)
  await resend.emails.send({
    from: 'Parcels of Time <hello@parcelsoftime.com>',
    to: [opts.buyerEmail],
    subject: subjectEN,
    html: `
      <p>Thank you for your purchase.</p>
      <p>Your certificate PDF: <a href="${opts.pdfUrl}">Download</a></p>
      <p>Manage and view here: <a href="${opts.publicUrl}">${opts.publicUrl}</a></p>
    `
  })

  // Seller recap (si tu veux retrouver l'email vendeur, fais une petite requête au besoin)
  // await resend.emails.send({ ... })
}


/** Réinitialisation de mot de passe */
export async function sendPasswordResetEmail(
  to: string | string[],
  link: string,
  locale: 'fr' | 'en'
): Promise<boolean> {
  const subject =
    locale === 'fr' ? 'Réinitialiser votre mot de passe' : 'Reset your password'
  const intro =
    locale === 'fr'
      ? 'Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe (valide 30 minutes) :'
      : 'Click the link below to reset your password (valid for 30 minutes):'
  const outro =
    locale === 'fr'
      ? "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."
      : "If you didn't request this, you can safely ignore this email."

  const text = [intro, link, '', outro, '', '— Parcels of Time'].join('\n')
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
      <p>${intro}</p>
      <p><a href="${link}">${link}</a></p>
      <p>${outro}</p>
      <p>— Parcels of Time</p>
    </div>
  `.trim()

  try {
    if (!resend) {
      console.log('[email][reset] (dry-run)', { to, link })
      return false
    }
    await resend.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,           // 👈 camelCase
      bcc: resolveBcc(to),
      subject,
      text,
      html,
    })
    return true
  } catch (e) {
    console.error('[email][reset] send error', e)
    return false
  }
}
