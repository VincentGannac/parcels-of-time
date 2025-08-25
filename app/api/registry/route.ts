// app/api/registry/route.ts
import { NextResponse } from 'next/server'
// TODO: remplace par ta vraie lecture DB
async function fetchPublicRows() {
  // rows = await db.public_minutes.findMany({ where:{ is_public:true }, orderBy:{ ts:'desc' } })
  return [] // ← renvoyer [{ts, owner, title, message, style, is_public:true}, ...]
}
export async function GET() {
  const rows = await fetchPublicRows()
  return NextResponse.json(rows)
}
