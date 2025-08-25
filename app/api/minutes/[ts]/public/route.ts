// app/api/minutes/[ts]/public/route.ts
import { NextResponse } from 'next/server'

// PUT: { is_public:boolean }
export async function PUT(_: Request, { params }:{ params:{ ts:string } }) {
  const ts = decodeURIComponent(params.ts)
  // TODO: auth propriétaire + update DB: minutes.update({ ts, data:{ is_public: body.is_public } })
  return NextResponse.json({ ok:true })
}

// GET optionnel: retourne l’état
export async function GET(_: Request, { params }:{ params:{ ts:string } }) {
  const ts = decodeURIComponent(params.ts)
  // const row = await db.minutes.findUnique({ where:{ ts } })
  return NextResponse.json({ is_public: false }) // ← remplace
}
