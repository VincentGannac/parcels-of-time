// lib/ymd.ts
export function isoDayUTC(input: string|Date){
    const d = typeof input==='string' ? new Date(input) : new Date(input)
    if (isNaN(d.getTime())) return null
    d.setUTCHours(0,0,0,0)
    return d.toISOString()
  }
  
  export function fee10Min1(price_cents: number){
    return Math.max(100, Math.round(price_cents * 0.10))
  }
  