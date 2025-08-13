// api/health/email/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const to = url.searchParams.get('to')
  const key = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || 'Parcels of Time <onboarding@resend.dev>'

  if (!key) return NextResponse.json({ ok:false, error:'RESEND_API_KEY not set' }, { status:500 })
  if (!to)  return NextResponse.json({ ok:false, error:'missing ?to=' }, { status:400 })

  const resend = new Resend(key)
  try {
    await resend.emails.send({
      from, to,
      subject: 'Parcels of Time — test email',
      text: 'If you got this, Resend works! 🚀',
    })
    return NextResponse.json({ ok:true })
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message || 'send_error' }, { status:500 })
  }
}
