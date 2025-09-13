//app/components/SiteFooter.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SiteFooter() {
  const pathname = usePathname()
  if (pathname === '/') return null // ⬅️ cache le footer sur la landing

  return (
    <footer style={{borderTop:'1px solid #E9E7E3', marginTop:40}}>
      <div style={{
        maxWidth:1000, margin:'0 auto', padding:'20px',
        display:'flex', flexWrap:'wrap', gap:12, justifyContent:'space-between'
      }}>
        <span style={{opacity:.7}}>© {new Date().getFullYear()} Parcels of Time</span>
        <div style={{display:'flex', gap:12}}>
          <Link href="/legal/terms"   style={{textDecoration:'none', color:'#0B0B0C'}}>Terms</Link>
          <Link href="/legal/refund"  style={{textDecoration:'none', color:'#0B0B0C'}}>Refund</Link>
          <Link href="/legal/privacy" style={{textDecoration:'none', color:'#0B0B0C'}}>Privacy</Link>
          <Link href="/company"       style={{textDecoration:'none', color:'#0B0B0C'}}>About</Link>
          <Link href="/support"       style={{textDecoration:'none', color:'#0B0B0C'}}>Support</Link>
        </div>
      </div>
    </footer>
  )
}
