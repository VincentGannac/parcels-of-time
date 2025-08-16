'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SiteHeader() {
  const pathname = usePathname()
  if (pathname === '/') return null // ⬅️ cache le header sur la landing

  return (
    <header style={{borderBottom:'1px solid #E9E7E3', background:'#FAF9F7'}}>
      <nav style={{
        maxWidth:1000, margin:'0 auto', padding:'14px 20px',
        display:'flex', alignItems:'center', gap:16, justifyContent:'space-between'
      }}>
        <Link href="/" style={{display:'flex', alignItems:'center', gap:10, textDecoration:'none', color:'#0B0B0C'}}>
          <img src="/logo.svg" alt="Parcels of Time" width={28} height={28}/>
          <strong>Parcels of Time</strong>
        </Link>
        <div style={{display:'flex', gap:14}}>
          <Link href="/company" style={{textDecoration:'none', color:'#0B0B0C'}}>About</Link>
          <Link href="/support" style={{textDecoration:'none', color:'#0B0B0C'}}>Support</Link>
          <Link href="/search"  style={{textDecoration:'none', color:'#0B0B0C'}}>Search</Link>
          <Link href="/claim"   style={{background:'#0B0B0C', color:'#FAF9F7', padding:'8px 12px',
            borderRadius:8, textDecoration:'none', fontWeight:600}}>Claim</Link>
        </div>
      </nav>
    </header>
  )
}
