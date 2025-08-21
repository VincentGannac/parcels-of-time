// app/m/[ts]/page.tsx
import { formatISOAsNice } from '@/lib/date'
import { absoluteUrl } from '@/lib/url'

type Params = { ts: string }

type PublicMinute =
  | { found: false }
  | { found: true; id: string; ts: string; title: string | null; message: string | null }

async function getMinute(ts: string): Promise<PublicMinute> {
  const url = await absoluteUrl(`/api/minutes/${encodeURIComponent(ts)}`)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return { found: false }
  return res.json()
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { ts } = await params
  const decodedTs = decodeURIComponent(ts)
  const data = await getMinute(decodedTs)

  return (
    <main style={{fontFamily:'Inter, system-ui', background:'#FAF9F7', color:'#0B0B0C', minHeight:'100vh'}}>
      <section style={{maxWidth:860, margin:'0 auto', padding:'72px 24px'}}>
        <a href="/" style={{textDecoration:'none', color:'#0B0B0C', opacity:.8}}>&larr; Parcels of Time</a>
        <h1 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:40, margin:'16px 0 4px'}}>Minute</h1>
        <p style={{fontSize:18, opacity:.9, marginTop:0}}>{formatISOAsNice(decodedTs)}</p>

        {data.found ? (
          <div style={{border:'1px solid #D9D7D3', borderRadius:12, padding:20, background:'#fff'}}>
            {/* Titre / message éventuellement publics (anonymes) */}
            {data.title && (
              <h3 style={{margin:'0 0 12px', fontSize:20, fontWeight:600}}>{data.title}</h3>
            )}
            {data.message && (
              <blockquote style={{margin:'0 0 12px', fontStyle:'italic'}}>&ldquo;{data.message}&rdquo;</blockquote>
            )}
            <p style={{margin:'8px 0 0', fontSize:12, opacity:.65}}>
              Entrée du registre public — anonymisée, partagée avec consentement.
            </p>

            {/* Téléchargement du certificat */}
            <a
              href={`/api/cert/${encodeURIComponent(decodedTs)}`}
              target="_blank"
              style={{display:'inline-block', marginTop:14, background:'#0B0B0C', color:'#FAF9F7', padding:'10px 14px', borderRadius:8, textDecoration:'none', fontWeight:600}}
            >
              Download certificate (PDF)
            </a>
          </div>
        ) : (
          <div style={{border:'1px dashed #D9D7D3', borderRadius:12, padding:20, background:'#fff'}}>
            <p>This minute is not yet claimed.</p>
            <a href={`/claim?ts=${encodeURIComponent(decodedTs)}`}>Claim this minute</a>
          </div>
        )}
      </section>
    </main>
  )
}
