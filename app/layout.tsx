import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Parcels of Time',
  description: 'Own a second, forever.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{background:'#FAF9F7', color:'#0B0B0C'}}>
        <header style={{borderBottom:'1px solid #E9E7E3', background:'#FAF9F7'}}>
          <nav style={{maxWidth:1000, margin:'0 auto', padding:'14px 20px', display:'flex', alignItems:'center', gap:16, justifyContent:'space-between'}}>
            <Link href="/" style={{display:'flex', alignItems:'center', gap:10, textDecoration:'none', color:'#0B0B0C'}}>
              <img src="/logo.svg" alt="Parcels of Time" width={28} height={28}/>
              <strong>Parcels of Time</strong>
            </Link>
            <div style={{display:'flex', gap:14}}>
              <Link href="/company" style={{textDecoration:'none', color:'#0B0B0C'}}>About</Link>
              <Link href="/support" style={{textDecoration:'none', color:'#0B0B0C'}}>Support</Link>
              <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'8px 12px', borderRadius:8, textDecoration:'none', fontWeight:600}}>Claim</Link>
            </div>
          </nav>
        </header>

        <main>{children}</main>

        <footer style={{borderTop:'1px solid #E9E7E3', marginTop:40}}>
          <div style={{maxWidth:1000, margin:'0 auto', padding:'20px', display:'flex', flexWrap:'wrap', gap:12, justifyContent:'space-between'}}>
            <span style={{opacity:.7}}>© {new Date().getFullYear()} Parcels of Time</span>
            <div style={{display:'flex', gap:12}}>
              <Link href="/legal/terms" style={{textDecoration:'none', color:'#0B0B0C'}}>Terms</Link>
              <Link href="/legal/refund" style={{textDecoration:'none', color:'#0B0B0C'}}>Refund</Link>
              <Link href="/legal/privacy" style={{textDecoration:'none', color:'#0B0B0C'}}>Privacy</Link>
              <Link href="/company" style={{textDecoration:'none', color:'#0B0B0C'}}>About</Link>
              <Link href="/support" style={{textDecoration:'none', color:'#0B0B0C'}}>Support</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
