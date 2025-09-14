// lib/email.ts
import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
export const resend = apiKey ? new Resend(apiKey) : null

const FROM = process.env.FROM_EMAIL || 'Parcels of Time <no-reply@parcelsoftime.com>'

/**
 * Reçu après achat (Stripe) — envoie les liens public & PDF,
 * et facultativement un lien magique de connexion (magicUrl) pour ouvrir la page privée directement.
 */
export async function sendClaimReceiptEmail(input: {
  to: string
  ts: string
  displayName?: string | null
  publicUrl: string
  certUrl: string
  /** Optionnel : lien magique auto-connexion, 1-clic vers la page privée (login + redirect). */
  magicUrl?: string | null
}) {
  if (!resend) return
  const { to, ts, displayName, publicUrl, certUrl, magicUrl } = input
  const greet = displayName ? ` ${displayName}` : ''

  const textLines = [
    `Hi${greet},`,
    `Thanks for your purchase. You now own the symbolic claim to ${ts}.`,
    `Public page: ${publicUrl}`,
    `Certificate (PDF): ${certUrl}`,
  ]
  if (magicUrl) {
    textLines.push('', '1-click sign-in to manage your certificate:', magicUrl)
  }
  textLines.push('— Parcels of Time')

  const html = `
    <p>Hi${greet},</p>
    <p>Thanks for your purchase. You now own the symbolic claim to <strong>${ts}</strong>.</p>
    <p><a href="${publicUrl}">Public page</a> · <a href="${certUrl}">Certificate (PDF)</a></p>
    ${magicUrl ? `<p style="margin-top:12px"><a href="${magicUrl}">1-click sign-in</a> to manage your certificate.</p>` : ''}
    <p>— Parcels of Time</p>
  `

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Your minute — ${ts}`,
      text: textLines.join('\n'),
      html,
    })
  } catch {
    /* silencieux en MVP */
  }
}

/**
 * Email d’authentification (code magique à 6 chiffres + lien 1-clic).
 */
export async function sendLoginCodeEmail({
  to,
  code,
  magicUrl,
}: {
  to: string
  code: string
  magicUrl: string
}) {
  if (!resend) return

  const subject = 'Votre code de connexion — Parcels of Time'
  const text = [
    `Votre code : ${code}`,
    `Ou connexion en 1 clic : ${magicUrl}`,
    `Le code expire dans 15 minutes.`,
  ].join('\n')

  const html = `
    <p>Voici votre code : <strong style="font-size:20px; letter-spacing:2px">${code}</strong></p>
    <p>Ou cliquez ici : <a href="${magicUrl}">${magicUrl}</a></p>
    <p style="color:#666">Le code expire dans 15 minutes.</p>
  `

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject,
      text,
      html,
    })
  } catch {
    /* silencieux en MVP */
  }
}
