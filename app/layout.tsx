// app/layout.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import './globals.css'

export const metadata: Metadata = {
  title: 'Parcels of Time',
  description: 'Claim a unique minute in UTC with a signed certificate.',
  // Pas d’ENV publique ici : on fige sur l’hôte canonique (www)
  metadataBase: new URL('https://www.parcelsoftime.com'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
