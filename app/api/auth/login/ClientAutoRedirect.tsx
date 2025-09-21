// app/[locale]/login/ClientAutoRedirect.tsx
'use client'

import { useEffect } from 'react'

export default function ClientAutoRedirect({ next }: { next: string }) {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/health/auth', { cache: 'no-store', credentials: 'same-origin' })
        const j = await r.json().catch(() => null)
        const ok =
          !!j?.cookies?.normalVariant?.valid ||
          !!j?.cookies?.hostVariant?.valid
        if (ok && !cancelled) {
          // on garde l’URL "propre" (sans le cache-buster éventuellement ajouté côté serveur)
          window.location.replace(next)
        }
      } catch {
        // noop
      }
    })()
    return () => { cancelled = true }
  }, [next])

  return null
}
