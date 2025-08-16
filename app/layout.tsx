// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Parcels of Time',
  description: 'Claim a unique minute in UTC with a signed certificate.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://parcelsoftime.com'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // NB: le layout racine doit contenir <html> et <body>.
  // On laisse `lang="en"` par défaut ; le contenu est localisé via le layout /[locale].
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
