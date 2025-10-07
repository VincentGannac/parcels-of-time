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

// lib/email.ts (extrait) — remplace uniquement sendClaimReceiptEmail

/** Small helpers */
function safeYMD(input: string): string {
  try {
    // ISO → YYYY-MM-DD
    const d = new Date(input)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  } catch {}
  // déjà YYYY-MM-DD ?
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0,10)
  return input
}
function esc(s: string) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

/** Reçu d’achat — version premium */
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
  const ymd = safeYMD(ts)

  // --------- Texte (fallback) ---------
  const textLinesFR = [
    `Bonjour${displayName ? ' ' + displayName : ''},`,
    `Merci pour votre achat. Vous détenez désormais le certificat du ${ymd}.`,
    `Gérer ma date : ${publicUrl}`,
    `PDF du certificat : ${certUrl}`,
    transfer ? '' : '',
    transfer ? '——' : '',
    transfer ? '🎁 Pour offrir ce certificat :' : '',
    transfer ? `1) Ouvrez la page « Récupérer » : ${transfer.recoverUrl}` : '',
    transfer ? '2) Le destinataire clique sur “Récupérer” puis saisit :' : '',
    transfer ? `   • ID du certificat : ${transfer.claimId}` : '',
    transfer ? `   • Empreinte SHA-256 : ${transfer.hash}` : '',
    transfer?.code ? `   • Code à 5 caractères : ${transfer.code}` : '   • Code à 5 caractères : (transmis séparément)',
    transfer?.instructionsPdfUrl ? `3) Vous pouvez imprimer les instructions : ${transfer.instructionsPdfUrl}` : '',
    '',
    '— Parcels of Time',
  ].filter(Boolean)

  const textLinesEN = [
    `Hi${displayName ? ' ' + displayName : ''},`,
    `Thanks for your purchase. You now own the certificate for ${ymd}.`,
    `Manage my date: ${publicUrl}`,
    `Certificate PDF: ${certUrl}`,
    transfer ? '' : '',
    transfer ? '——' : '',
    transfer ? '🎁 To gift this certificate:' : '',
    transfer ? `1) Open the “Recover” page: ${transfer.recoverUrl}` : '',
    transfer ? '2) The recipient clicks “Recover” and enters:' : '',
    transfer ? `   • Certificate ID: ${transfer.claimId}` : '',
    transfer ? `   • SHA-256 fingerprint: ${transfer.hash}` : '',
    transfer?.code ? `   • 5-char code: ${transfer.code}` : '   • 5-char code: (sent separately)',
    transfer?.instructionsPdfUrl ? `3) You can print the instructions: ${transfer.instructionsPdfUrl}` : '',
    '',
    '— Parcels of Time',
  ].filter(Boolean)

  const subject = isFR
    ? `Votre certificat — ${ymd}`
    : `Your certificate — ${ymd}`

  const text = (isFR ? textLinesFR : textLinesEN).join('\n')

  // --------- HTML premium (table-based) ---------
  const brand = {
    accent: '#E4B73D',
    dark: '#0B0E14',
    text: '#1A1F2A',
    border: '#E6EAF2',
    lightBg: '#F7F8FB',
  }
  const labelManage = isFR ? 'Gérer ma date' : 'Manage my date'
  const labelPdf = isFR ? 'Télécharger le PDF' : 'Download the PDF'
  const giftTitle = isFR ? '🎁 Offrir ce certificat' : '🎁 Gift this certificate'
  const recoverCta = isFR ? 'Récupérer' : 'Recover'
  const intro = isFR
    ? `Bonjour${displayName ? ' ' + esc(displayName) : ''},`
    : `Hi${displayName ? ' ' + esc(displayName) : ''},`

  const p1 = isFR
    ? `Merci pour votre achat. Vous détenez désormais le certificat du <strong>${ymd}</strong>.`
    : `Thanks for your purchase. You now own the certificate for <strong>${ymd}</strong>.`

  const giftExplain = isFR
    ? `Pour offrir ce certificat, transmettez les 3 éléments ci-dessous au destinataire. Il devra cliquer sur <strong>${recoverCta}</strong> puis les saisir pour transférer la propriété.`
    : `To gift this certificate, share the following 3 items with the recipient. They must click <strong>${recoverCta}</strong> and enter them to transfer ownership.`

  const giftNote = isFR
    ? `Astuce : vous pouvez joindre le <em>PDF d’instructions</em> à imprimer avec le certificat.`
    : `Tip: you can include the printable <em>instructions PDF</em> along with the certificate.`

  const giftListHtml = transfer ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:12px 16px;border:1px solid #E6EAF2;border-radius:10px;background:#fff">
          <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;line-height:1.6;font-size:14px;color:${brand.text}">
            <p style="margin:0 0 8px">${giftExplain}</p>
            <ol style="margin:0 0 8px 16px;padding:0">
              <li style="margin-bottom:6px"><a href="${esc(transfer.recoverUrl)}" style="color:${brand.text};text-decoration:underline">${recoverCta}</a></li>
              <li style="margin-bottom:6px">${isFR ? 'Saisies requises :' : 'Required fields:'}
                <div style="margin-top:6px;padding:10px;border:1px dashed #D6DAE3;border-radius:8px;background:${brand.lightBg}">
                  <div><strong>${isFR ? 'ID du certificat' : 'Certificate ID'}</strong> : <code>${esc(transfer.claimId)}</code></div>
                  <div><strong>SHA-256</strong> : <code>${esc(transfer.hash)}</code></div>
                  <div><strong>${isFR ? 'Code (5 caractères)' : '5-char code'}</strong> : <code>${esc(transfer.code || '•••••')}</code></div>
                </div>
              </li>
            </ol>
            <p style="margin:6px 0 0;opacity:.85">${giftNote}</p>
          </div>
        </td>
      </tr>
    </table>
  ` : ''

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="UTF-8" />
      <title>${esc(subject)}</title>
      <style>
        @media (max-width: 620px) {
          .container { width: 100% !important; }
          .btn { display:block !important; width:100% !important; }
        }
      </style>
    </head>
    <body style="margin:0;padding:0;background:#ffffff">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff">
        <tr>
          <td align="center" style="padding:24px">
            <table class="container" role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%;border-collapse:collapse">
              <!-- Header -->
              <tr>
                <td style="padding:10px 0 18px;text-align:center;">
                  <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;font-weight:900;font-size:20px;letter-spacing:.3px;color:${brand.text}">
                    Parcels of Time
                  </div>
                </td>
              </tr>

              <!-- Hero -->
              <tr>
                <td style="padding:20px;border:1px solid #ECEFF6;border-radius:16px;background:linear-gradient(180deg,#FCFCFF, #F5F7FD)">
                  <div style="font-family:Fraunces, ui-serif, Georgia; font-size:28px; line-height:1.15; font-weight:900; color:${brand.text}">
                    ${isFR ? 'Votre certificat' : 'Your certificate'} — ${ymd}
                  </div>
                  <p style="margin:10px 0 0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;color:${brand.text};opacity:.9">
                    ${intro}
                  </p>
                  <p style="margin:8px 0 0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;color:${brand.text}">
                    ${p1}
                  </p>

                  <div style="margin-top:14px">
                    <a class="btn" href="${esc(publicUrl)}"
                      style="display:inline-block;padding:12px 18px;border-radius:12px;background:${brand.accent};color:${brand.dark};text-decoration:none;font-weight:800;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;margin-right:8px">
                      ${labelManage}
                    </a>
                    <a class="btn" href="${esc(certUrl)}"
                      style="display:inline-block;padding:12px 18px;border-radius:12px;border:1px solid #D9DFEB;background:#fff;color:${brand.text};text-decoration:none;font-weight:700;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial">
                      ${labelPdf}
                    </a>
                  </div>
                </td>
              </tr>

              ${transfer ? `
              <!-- Gift block -->
              <tr><td style="height:16px"></td></tr>
              <tr>
                <td style="padding:16px;border:1px solid #ECEFF6;border-radius:16px;background:#FFFFFF">
                  <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;font-weight:800;color:${brand.text};margin-bottom:8px">${giftTitle}</div>
                  ${giftListHtml}
                  <div style="margin-top:12px">
                    <a class="btn" href="${esc(transfer.recoverUrl)}"
                      style="display:inline-block;padding:10px 16px;border-radius:10px;border:1px solid #D9DFEB;background:#fff;color:${brand.text};text-decoration:none;font-weight:700;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;margin-right:8px">
                      ${recoverCta}
                    </a>
                    ${transfer.instructionsPdfUrl ? `
                      <a class="btn" href="${esc(transfer.instructionsPdfUrl)}"
                        style="display:inline-block;padding:10px 16px;border-radius:10px;background:${brand.accent};color:${brand.dark};text-decoration:none;font-weight:800;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial">
                        ${isFR ? 'PDF d’instructions' : 'Instructions PDF'}
                      </a>
                    ` : ''}
                  </div>
                  <p style="margin:10px 0 0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;color:${brand.text};opacity:.8;font-size:12px;line-height:1.4">
                    ${isFR
                      ? 'Une fois le transfert effectué, le destinataire devient l’unique détenteur de cette date.'
                      : 'Once the transfer is completed, the recipient becomes the unique holder of this date.'}
                  </p>
                </td>
              </tr>` : ''}

              <!-- Footer -->
              <tr><td style="height:16px"></td></tr>
              <tr>
                <td style="text-align:center;color:#8A93A5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;font-size:12px">
                  © Parcels of Time • ${isFR ? 'Assistance' : 'Support'} : <a href="mailto:support@parcelsoftime.com" style="color:#8A93A5">support@parcelsoftime.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `.trim()

  if (!resend) {
    console.log('[email][receipt] (dry-run)', { to, subject, text })
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


/** Email “secondary sale” (acheteur) — design premium, aligné sur le reçu primaire */
export async function sendSecondarySaleEmails(opts: {
  ts: string
  buyerEmail: string
  pdfUrl: string
  publicUrl: string
  sessionId: string
  buyerDisplayName?: string | null
  locale?: 'fr' | 'en'
}) {
  // Helpers locaux (noms différents pour éviter tout conflit)
  const safeYMD2 = (input: string): string => {
    try {
      const d = new Date(input)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    } catch {}
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10)
    return input
  }
  const esc2 = (s: string) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const ymd = safeYMD2(opts.ts)
  const guessFR = opts.locale ? opts.locale === 'fr' : /\/fr\//.test(opts.publicUrl)
  const isFR = !!guessFR

  // Sujets & libellés harmonisés
  const subject = isFR ? `Votre certificat — ${ymd}` : `Your certificate — ${ymd}`
  const intro = isFR
    ? `Bonjour${opts.buyerDisplayName ? ' ' + esc2(opts.buyerDisplayName) : ''},`
    : `Hi${opts.buyerDisplayName ? ' ' + esc2(opts.buyerDisplayName) : ''},`
  const p1 = isFR
    ? `Merci pour votre achat. Vous détenez désormais le certificat du <strong>${ymd}</strong>.`
    : `Thanks for your purchase. You now own the certificate for <strong>${ymd}</strong>.`
  const labelManage = isFR ? 'Gérer ma date' : 'Manage my date'
  const labelPdf = isFR ? 'Télécharger le PDF' : 'Download the PDF'

  // Fallback texte (pour clients mail texte)
  const text = [
    intro.replace(/<[^>]+>/g, ''),
    isFR
      ? `Merci pour votre achat. Vous détenez désormais le certificat du ${ymd}.`
      : `Thanks for your purchase. You now own the certificate for ${ymd}.`,
    (isFR ? 'Gérer ma date : ' : 'Manage my date: ') + opts.publicUrl,
    (isFR ? 'PDF du certificat : ' : 'Certificate PDF: ') + opts.pdfUrl,
    '',
    '— Parcels of Time',
  ].join('\n')

  // HTML premium (identique au reçu primaire : header, hero, 2 CTA)
  const brand = {
    accent: '#E4B73D',
    dark: '#0B0E14',
    text: '#1A1F2A',
  }

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="UTF-8" />
      <title>${esc2(subject)}</title>
      <style>
        @media (max-width: 620px) {
          .container { width: 100% !important; }
          .btn { display:block !important; width:100% !important; }
        }
      </style>
    </head>
    <body style="margin:0;padding:0;background:#ffffff">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff">
        <tr>
          <td align="center" style="padding:24px">
            <table class="container" role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%;border-collapse:collapse">
              <!-- Header -->
              <tr>
                <td style="padding:10px 0 18px;text-align:center;">
                  <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;font-weight:900;font-size:20px;letter-spacing:.3px;color:${brand.text}">
                    Parcels of Time
                  </div>
                </td>
              </tr>

              <!-- Hero -->
              <tr>
                <td style="padding:20px;border:1px solid #ECEFF6;border-radius:16px;background:linear-gradient(180deg,#FCFCFF,#F5F7FD)">
                  <div style="font-family:Fraunces, ui-serif, Georgia; font-size:28px; line-height:1.15; font-weight:900; color:${brand.text}">
                    ${isFR ? 'Votre certificat' : 'Your certificate'} — ${esc2(ymd)}
                  </div>
                  <p style="margin:10px 0 0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;color:${brand.text};opacity:.9">
                    ${intro}
                  </p>
                  <p style="margin:8px 0 0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;color:${brand.text}">
                    ${p1}
                  </p>

                  <div style="margin-top:14px">
                    <a class="btn" href="${esc2(opts.publicUrl)}"
                      style="display:inline-block;padding:12px 18px;border-radius:12px;background:${brand.accent};color:${brand.dark};text-decoration:none;font-weight:800;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;margin-right:8px">
                      ${labelManage}
                    </a>
                    <a class="btn" href="${esc2(opts.pdfUrl)}"
                      style="display:inline-block;padding:12px 18px;border-radius:12px;border:1px solid #D9DFEB;background:#fff;color:${brand.text};text-decoration:none;font-weight:700;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial">
                      ${labelPdf}
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr><td style="height:16px"></td></tr>
              <tr>
                <td style="text-align:center;color:#8A93A5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;font-size:12px">
                  © Parcels of Time • ${isFR ? 'Assistance' : 'Support'} :
                  <a href="mailto:${REPLY_TO}" style="color:#8A93A5">${REPLY_TO}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `.trim()

  // Envoi
  if (!resend) {
    console.log('[email][secondary] (dry-run)', {
      to: opts.buyerEmail,
      subject,
    })
    return
  }
  await resend.emails.send({
    from: FROM,
    to: [opts.buyerEmail],
    replyTo: REPLY_TO,
    bcc: resolveBcc(opts.buyerEmail),
    subject,
    text,
    html,
  })
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
