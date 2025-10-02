// lib/email.ts
import { Resend } from 'resend'
import type { Party } from './invoice'
import { buildClassicInvoicePdf, buildMarketplacePdfs } from './invoice'

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

/** Reçu d’achat (texte + liens) */
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
  await resend.emails.send({
    from: FROM,
    to,
    replyTo: REPLY_TO,
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
}

/** Facture PDF (achat classique) — envoi à l’acheteur */
export async function sendClaimInvoiceEmail(input: {
  to: string | string[]
  ts: string                 // ex: "2025-03-15"
  invoiceNumber: string      // ex: "2025-000123"
  issueDate: string          // "yyyy-mm-dd"
  amount: number             // en devise (ex: 19.99)
  language: 'fr'|'en'
  buyer?: Party              // si fourni, remplace l’auto
}) {
  if (!resend) {
    console.log('[email][invoice-classic] (dry-run)', input)
    return
  }

  const issuer: Party = {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time',
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com',
    address: process.env.NEXT_PUBLIC_PUBLISHER_ADDR || '',
    siret: process.env.NEXT_PUBLIC_PUBLISHER_SIRET || '',
    vatNumber: process.env.NEXT_PUBLIC_PUBLISHER_VAT || '',
  }

  const customer: Party = input.buyer ?? {
    name: 'Customer',
    email: Array.isArray(input.to) ? input.to[0] : input.to,
  }

  const pdf = await buildClassicInvoicePdf({
    language: input.language,
    issuer,
    customer,
    tsLabel: input.ts,
    unitPrice: input.amount,
    currency: 'EUR',
    invoiceNumber: input.invoiceNumber,
    issueDate: input.issueDate,
    microEntrepreneur: true,
  })

  const subject = input.language === 'fr'
    ? `Facture ${input.invoiceNumber} — ${input.ts}`
    : `Invoice ${input.invoiceNumber} — ${input.ts}`

  await resend.emails.send({
    from: FROM,
    to: input.to,
    replyTo: REPLY_TO,
    bcc: resolveBcc(input.to),
    subject,
    text: input.language === 'fr'
      ? 'Vous trouverez ci-joint votre facture au format PDF.'
      : 'Please find your PDF invoice attached.',
    html: `<p>${input.language === 'fr'
      ? 'Vous trouverez ci-joint votre facture au format PDF.'
      : 'Please find your PDF invoice attached.'}</p>`,
    attachments: [{ filename: `INV-${input.invoiceNumber}.pdf`, content: Buffer.from(pdf) }],
  })
}

/** Marketplace : facture acheteur (autofacturation) + facture de commission (plateforme->vendeur) */
export async function sendMarketplaceInvoiceEmails(input: {
  language: 'fr'|'en'
  buyerEmail: string
  sellerEmail: string
  ts: string                // "YYYY-MM-DD"
  salePrice: number         // en devise
  fee: number               // en devise
  invoiceNumberBuyer: string
  invoiceNumberFee: string
  issueDate: string
  selfBilling?: boolean
  sellerParty?: Party
  buyerParty?: Party
}) {
  const platform: Party = {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time',
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@parcelsoftime.com',
    address: process.env.NEXT_PUBLIC_PUBLISHER_ADDR || '',
    siret: process.env.NEXT_PUBLIC_PUBLISHER_SIRET || '',
    vatNumber: process.env.NEXT_PUBLIC_PUBLISHER_VAT || '',
  }

  const seller: Party = input.sellerParty ?? { name: 'Marketplace seller', email: input.sellerEmail }
  const buyer: Party = input.buyerParty ?? { name: 'Buyer', email: input.buyerEmail }

  const { buyerInvoice, feeInvoice } = await buildMarketplacePdfs({
    language: input.language,
    platform,
    seller,
    buyer,
    tsLabel: input.ts,
    salePrice: input.salePrice,
    fee: input.fee,
    currency: 'EUR',
    invoiceNumberBuyer: input.invoiceNumberBuyer,
    invoiceNumberFee: input.invoiceNumberFee,
    issueDate: input.issueDate,
    selfBilling: input.selfBilling ?? true,
  })

  if (!resend) {
    console.log('[email][invoice-marketplace] (dry-run)', input)
    return
  }

  // ➜ Acheteur : facture de vente (autofacturation)
  await resend.emails.send({
    from: FROM,
    to: input.buyerEmail,
    replyTo: REPLY_TO,
    bcc: resolveBcc(input.buyerEmail),
    subject: input.language === 'fr'
      ? `Facture ${input.invoiceNumberBuyer} — ${input.ts}`
      : `Invoice ${input.invoiceNumberBuyer} — ${input.ts}`,
    text: input.language === 'fr'
      ? 'Ci-joint la facture de votre achat (marketplace).'
      : 'Attached is your marketplace purchase invoice.',
    html: `<p>${input.language === 'fr'
      ? 'Ci-joint la facture de votre achat (marketplace).'
      : 'Attached is your marketplace purchase invoice.'}</p>`,
    attachments: [{ filename: `INV-${input.invoiceNumberBuyer}.pdf`, content: Buffer.from(buyerInvoice) }],
  })

  // ➜ Vendeur : facture de commission (plateforme -> vendeur)
  await resend.emails.send({
    from: FROM,
    to: input.sellerEmail,
    replyTo: REPLY_TO,
    bcc: resolveBcc(input.sellerEmail),
    subject: input.language === 'fr'
      ? `Facture de commission ${input.invoiceNumberFee} — ${input.ts}`
      : `Platform fee invoice ${input.invoiceNumberFee} — ${input.ts}`,
    text: input.language === 'fr'
      ? 'Ci-joint votre facture de commission.'
      : 'Attached is your platform fee invoice.',
    html: `<p>${input.language === 'fr'
      ? 'Ci-joint votre facture de commission.'
      : 'Attached is your platform fee invoice.'}</p>`,
    attachments: [{ filename: `FEE-${input.invoiceNumberFee}.pdf`, content: Buffer.from(feeInvoice) }],
  })
}

/** Mot de passe */
export async function sendPasswordResetEmail(
  to: string | string[],
  link: string,
  locale: 'fr' | 'en'
): Promise<boolean> {
  const subject = locale === 'fr' ? 'Réinitialiser votre mot de passe' : 'Reset your password'
  const intro = locale === 'fr'
    ? 'Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe (valide 30 minutes) :'
    : 'Click the link below to reset your password (valid for 30 minutes):'
  const outro = locale === 'fr'
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
      replyTo: REPLY_TO,
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
