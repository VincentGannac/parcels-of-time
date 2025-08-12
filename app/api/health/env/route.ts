import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    has_DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DATABASE_URL_preview: process.env.DATABASE_URL?.slice(0, 40) + '…',
  });
}
