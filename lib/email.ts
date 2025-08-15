// lib/email.ts
import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
export const resend = apiKey ? new Resend(apiKey) : null

export async function sendClaimReceiptEmail(input: {
  to: string; ts: string; displayName?: string | null;
  publicUrl: string; certUrl: string;
}) {
  if (!resend) return
  const { to, ts, displayName, publicUrl, certUrl } = input
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Parcels of Time <no-reply@parcelsoftime.com>',
      to, subject: `Your minute — ${ts}`,
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
  } catch { /* on garde silencieux en MVP */ }
}
