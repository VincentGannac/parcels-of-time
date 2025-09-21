// lib/email.ts
import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
export const resend = apiKey ? new Resend(apiKey) : null

const FROM = process.env.FROM_EMAIL || 'Parcels of Time <no-reply@parcelsoftime.com>'

/**
 * Reçu d’achat (inchangé)
 */
export async function sendClaimReceiptEmail(input: {
  to: string
  ts: string
  displayName?: string | null
  publicUrl: string
  certUrl: string
}) {
  if (!resend) return
  const { to, ts, displayName, publicUrl, certUrl } = input
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Your minute — ${ts}`,
      text: [
        `Hi${displayName ? ' ' + displayName : ''},`,
        `Thanks for your purchase. You now own the symbolic claim to ${ts}.`,
        `Public page: ${publicUrl}`,
        `Certificate (PDF): ${certUrl}`,
        `— Parcels of Time`,
      ].join('\n'),
      html: `
        <p>Hi${displayName ? ' ' + displayName : ''},</p>
        <p>Thanks for your purchase. You now own the symbolic claim to <strong>${ts}</strong>.</p>
        <p><a href="${publicUrl}">Public page</a> · <a href="${certUrl}">Certificate (PDF)</a></p>
        <p>— Parcels of Time</p>
      `,
    })
  } catch {
    /* on garde silencieux en MVP */
  }
}

/**
 * Email de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail(
  to: string,
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

  const text = [
    intro,
    link,
    '',
    outro,
    '',
    '— Parcels of Time',
  ].join('\n')

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
      // Utile en dev pour récupérer le lien si aucun provider n'est configuré
      console.log('[dev] Password reset link →', { to, link })
      return false
    }
    await resend.emails.send({
      from: FROM,
      to,
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
