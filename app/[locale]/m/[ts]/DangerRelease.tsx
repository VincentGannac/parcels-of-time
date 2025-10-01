'use client'

import { useState, useTransition } from 'react'

export default function DangerRelease({
  locale,
  tsYMD,
}: { locale: string; tsYMD: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>('')

  const L = {
    title: locale==='fr' ? 'Libérer cette date' : 'Release this date',
    desc: locale==='fr'
      ? `Cette action est irréversible. Vous ne posséderez plus cette journée et n'aurez plus accès à cette page.`
      : `This action is irreversible. You will no longer own this day and you won't have access to this page.`,
    btn: locale==='fr' ? 'Libérer la date' : 'Release date',
    confirm: locale==='fr'
      ? `Voulez-vous vraiment libérer définitivement cette date ?\nVous ne la posséderez plus et n'aurez plus accès à cette page.`
      : `Are you sure you want to permanently release this date?\nYou will no longer own it and will lose access to this page.`,
    working: locale==='fr' ? 'Libération…' : 'Releasing…',
  }

  async function onRelease() {
    setError('')
    if (!window.confirm(L.confirm)) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/day/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ts: tsYMD, locale }),
          cache: 'no-store',
        })
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          throw new Error(j?.error || `HTTP ${res.status}`)
        }
        const j = await res.json()
        window.location.href = j?.next || `/${locale}/account?freed=${encodeURIComponent(tsYMD)}`
      } catch (e:any) {
        setError(e?.message || 'Failed')
      }
    })
  }

  return (
    <section
      style={{
        marginTop: 24,
        background: 'rgba(220, 38, 38, .10)',
        border: '1px solid rgba(220, 38, 38, .35)',
        borderRadius: 16,
        padding: 16
      }}
    >
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'#fca5a5', marginBottom:6}}>
            {locale==='fr' ? 'Action irréversible' : 'Irreversible action'}
          </div>
          <div style={{maxWidth:720, opacity:.92}}>{L.desc}</div>
        </div>
        <button
          onClick={onRelease}
          disabled={pending}
          style={{
            padding:'12px 16px',
            borderRadius:12,
            fontWeight:900,
            border:'1px solid rgba(220, 38, 38, .45)',
            background: pending ? 'rgba(220, 38, 38, .35)' : 'rgba(220, 38, 38, .18)',
            color:'#fecaca',
            cursor: pending ? 'progress' : 'pointer'
          }}
        >
          {pending ? L.working : L.btn}
        </button>
      </div>
      {error && (
        <div style={{marginTop:10, color:'#fecaca', fontSize:13}}>
          {locale==='fr' ? 'Erreur :' : 'Error:'} {error}
        </div>
      )}
    </section>
  )
}
