//app/[locale]/m/[ts]/error.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

type Steps = {
  ok: boolean
  steps?: any
  error?: string
}

function extractTsFromPath(pathname: string): { locale: string; tsRaw: string } {
  // attend /fr/m/<ts> ou /en/m/<ts>
  const m = /^\/(fr|en)\/m\/(.+)$/.exec(pathname)
  return { locale: m?.[1] || 'fr', tsRaw: m?.[2] ? decodeURIComponent(m[2]) : '' }
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()
  const search = useSearchParams()
  const { locale, tsRaw } = useMemo(() => extractTsFromPath(pathname || ''), [pathname])
  const [probe, setProbe] = useState<Steps | null>(null)
  const [fetchErr, setFetchErr] = useState<string>('')

  useEffect(() => {
    let stop = false
    async function run() {
      setFetchErr('')
      setProbe(null)
      if (!locale || !tsRaw) return
      try {
        // appelle ton endpoint diag: /[locale]/health/m-page?ts=…
        const res = await fetch(`/${locale}/health/m-page?ts=${encodeURIComponent(tsRaw)}`, { cache: 'no-store' })
        const j = await res.json()
        if (!stop) setProbe(j)
      } catch (e: any) {
        if (!stop) setFetchErr(String(e?.message || e))
      }
    }
    run()
    return () => { stop = true }
  }, [locale, tsRaw, error?.digest])

  const dayForLink = useMemo(() => {
    // si tsRaw est un ISO, force jour UTC pour le lien health principal
    try {
      const d = new Date(tsRaw)
      if (isNaN(d.getTime())) return ''
      d.setUTCHours(0,0,0,0)
      return d.toISOString().slice(0,10)
    } catch { return '' }
  }, [tsRaw])

  return (
    <main style={{maxWidth:900,margin:'0 auto',padding:24,fontFamily:'Inter,system-ui'}}>
      <h1 style={{margin:'0 0 6px'}}>Oups — chargement impossible</h1>
      <p style={{opacity:.8,marginTop:0}}>
        Une erreur est survenue pendant l’affichage de la page.
        {error?.digest ? <> (code:&nbsp;<code>{error.digest}</code>)</> : null}
      </p>

      <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
        <button onClick={reset} style={{padding:'10px 14px',border:'1px solid #ddd',borderRadius:10,cursor:'pointer'}}>
          Réessayer
        </button>
        {dayForLink && (
          <a href={`/${locale}/health?day=${encodeURIComponent(dayForLink)}`}
             style={{padding:'10px 14px',border:'1px solid #ddd',borderRadius:10,textDecoration:'none',color:'inherit'}}>
            Ouvrir Health (jour {dayForLink})
          </a>
        )}
      </div>

      <details open style={{border:'1px solid #eee',borderRadius:12,padding:12,background:'#fafbfc'}}>
        <summary style={{cursor:'pointer',fontWeight:700,marginBottom:8}}>Détails techniques</summary>

        <div style={{display:'grid',rowGap:6, fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize:13}}>
          <div><strong>pathname</strong>: <code>{pathname || '(n/a)'}</code></div>
          <div><strong>search</strong>: <code>{search?.toString() || '(n/a)'}</code></div>
          <div><strong>locale</strong>: <code>{locale}</code></div>
          <div><strong>ts (raw)</strong>: <code>{tsRaw || '(n/a)'}</code></div>
          <div><strong>digest</strong>: <code>{error?.digest || '(n/a)'}</code></div>
          {fetchErr && <div style={{color:'#b22'}}>fetch diag error: {fetchErr}</div>}
        </div>

        <div style={{marginTop:10}}>
          <div style={{fontWeight:700, marginBottom:6}}>Probe `/health/m-page`</div>
          <pre style={{ background:'#0b0e14', color:'#e6eaf2', padding:12, borderRadius:8, overflow:'auto' }}>
            {JSON.stringify(probe, null, 2)}
          </pre>
        </div>
      </details>
    </main>
  )
}
