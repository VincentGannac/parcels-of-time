// lib/email.ts
import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
export const resend = apiKey ? new Resend(apiKey) : null

const FROM =
  process.env.FROM_EMAIL || 'Parcels of Time <no-reply@parcelsoftime.com>'
const REPLY_TO =
  process.env.REPLY_TO_EMAIL || 'vincent.gannac@icloud.com'
const BCC_TO =
  process.env.BCC_EMAIL || 'vincent.gannac@icloud.com'

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
}) {
  if (!resend) {
    console.log('[email][receipt] (dry-run)', input)
    return
  }

  const { to, ts, displayName, publicUrl, certUrl } = input

  try {
    await resend.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,           // 👈 camelCase
      bcc: resolveBcc(to),
      subject: `Your minute — ${ts}`,
      text: [
        `Hi${displayName ? ' ' + displayName : ''},`,
        `Thanks for your purchase. You now own the symbolic claim to ${ts}.`,
        `Public page: ${publicUrl}`,
        `Certificate (PDF): ${certUrl}`,
        `— Parcels of Time`,
      ].join('\n'),
      html: `
        <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
          <p>Hi${displayName ? ' ' + displayName : ''},</p>
          <p>Thanks for your purchase. You now own the symbolic claim to <strong>${ts}</strong>.</p>
          <p>
            <a href="${publicUrl}">Public page</a>
            &nbsp;·&nbsp;
            <a href="${certUrl}">Certificate (PDF)</a>
          </p>
          <p>— Parcels of Time</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('[email][receipt] send error', e)
  }
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
