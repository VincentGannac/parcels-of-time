import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

// ⬇️ nouveaux imports
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Parcels of Time — Own a minute, forever.',
  description: 'Claim a unique minute in UTC, get a signed certificate & public page.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://parcelsoftime.com'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{background:'#FAF9F7', color:'#0B0B0C'}}>
        {/* ⬇️ Le header global ne s’affiche pas sur la home */}
        <SiteHeader />
        <main>{children}</main>
        <Analytics />
        {/* ⬇️ Le footer global ne s’affiche pas sur la home */}
        <SiteFooter />
      </body>
    </html>
  )
}
