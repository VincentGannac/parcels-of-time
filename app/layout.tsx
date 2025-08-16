// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Parcels of Time',
  description: 'Claim a unique minute in UTC with a signed certificate.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://parcelsoftime.com'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
