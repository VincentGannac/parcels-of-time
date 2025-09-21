export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/auth'

function pickLocale(h: Headers) {
  const acc = (h.get('accept-language') || '').toLowerCase()
  return acc.startsWith('fr') ? 'fr' : 'en'
}

function htmlAfterLogout(toHref: string) {
  const esc = toHref.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="refresh" content="0; url=${esc}">` +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Signing out…</title></head>' +
    '<body style="font:16px system-ui;padding:24px">' +
    '<p>Signing out…</p>' +
    `<p><a href="${esc}">Continue</a></p>` +
    `<script>setTimeout(function(){location.replace(${JSON.stringify(toHref)})},0)</script>` +
    '</body></html>'
  )
}

function respondAndClear(toAbsUrl: string, host: string) {
  const res = new NextResponse(htmlAfterLogout(toAbsUrl), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Ce header ordonne au navigateur de purger les cookies de l’origine.
      'Clear-Site-Data': '"cookies"',
    },
  })
  clearSessionCookies(res, host)
  return res
}

export async function POST(req: Request) {
  const base = new URL(req.url).origin
  const host = new URL(req.url).hostname
  const locale = pickLocale(req.headers)
  const to = new URL(`/${locale}/?logged_out=1`, base).toString()
  return respondAndClear(to, host)
}

export async function GET(req: Request) {
  return POST(req)
}
