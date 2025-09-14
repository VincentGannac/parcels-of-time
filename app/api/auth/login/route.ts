export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pool } from '@/lib/db'
import { resend } from '@/lib/email'
import { upsertOwnerByEmail } from '@/lib/auth'

function baseFromReq(req: Request) {
  const u = new URL(req.url)
  return process.env.NEXT_PUBLIC_BASE_URL || `${u.protocol}//${u.host}`
}

export async function POST(req: Request) {
  try {
    const { email, next, locale } = await req.json()
    const normEmail = String(email||'').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return NextResponse.json({ error: 'bad_email' }, { status: 400 })
    }
    const owner = await upsertOwnerByEmail(normEmail)

    // Token (one-time, 30 min)
    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    await pool.query(
        `insert into auth_login_tokens (token, email, owner_id, expires_at)
         values ($1, $2, $3, $4)`,
        [token, normEmail, owner.id, expiresAt] // owner.id est string (uuid)
      )
      

    const base = baseFromReq(req)
    const loc = (locale === 'fr' || locale === 'en') ? locale : 'fr'
    const fallbackNext = `/${loc}/account`
    const callbackUrl = `${base}/api/auth/callback?token=${token}&next=${encodeURIComponent(next || fallbackNext)}`

    // Envoi email (silencieux si RESEND non config)
    if (resend) {
      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'Parcels of Time <no-reply@parcelsoftime.com>',
        to: normEmail,
        subject: loc === 'fr' ? 'Votre lien de connexion' : 'Your sign-in link',
        text: loc === 'fr'
          ? `Cliquez pour vous connecter : ${callbackUrl}\nLe lien expire dans 30 minutes.`
          : `Click to sign in: ${callbackUrl}\nThe link expires in 30 minutes.`,
        html: `<p><a href="${callbackUrl}">Se connecter</a> (expire dans 30 minutes)</p>`,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
