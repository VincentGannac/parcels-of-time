// app/api/auth/logout/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'
export async function POST() { clearSession(); return NextResponse.json({ ok:true }) }
