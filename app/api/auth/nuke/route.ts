export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/auth'

function htmlAfterNuke() {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Cookies cleared</title></head>' +
    '<body style="font:16px system-ui;padding:24px">' +
    '<p>All cookie variants cleared.</p>' +
    '<p><a href="/">Back to home</a></p>' +
    '</body></html>'
  )
}

export async function POST(req: Request) {
  const host = new URL(req.url).hostname
  const res = new NextResponse(htmlAfterNuke(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Clear-Site-Data': '"cookies"',
    },
  })
  clearSessionCookies(res, host)
  return res
}

export async function GET(req: Request) { return POST(req) }
