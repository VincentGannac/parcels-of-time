  // app/[locale]/m/[ts]/opengraph-image.tsx
  import { ImageResponse } from 'next/og'
  export const runtime = 'edge'
  export const alt = 'Parcels of Time'
  export const size = { width: 1200, height: 630 }
  export const contentType = 'image/png'

  export default async function Image(
    { params }: { params: Promise<{ locale: string; ts: string }> }
  ) {
    try {
      const { ts } = await params
      const pretty = decodeURIComponent(ts)
        .replace(':00.000Z','Z').replace('T',' ').replace('Z',' UTC')
      return new ImageResponse(
        (
          <div style={{
            width:'100%', height:'100%', display:'flex', background:'#FAF9F7',
            color:'#0B0B0C', padding:64, flexDirection:'column', justifyContent:'space-between'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:48, height:48, border:'6px solid #0B0B0C', borderRadius:'50%', position:'relative' }}>
                <div style={{ position:'absolute', top:-12, left:18, width:6, height:24, background:'#0B0B0C' }} />
              </div>
              <div style={{ fontSize:36, fontWeight:700 }}>Parcels of Time</div>
            </div>
            <div>
              <div style={{ fontSize:80, fontWeight:700, fontFamily:'serif' }}>Own a minute, forever.</div>
              <div style={{ fontSize:36, marginTop:12 }}>{pretty}</div>
            </div>
            <div style={{ opacity:.8 }}>parcelsoftime.com</div>
          </div>
        ),
        { ...size }
      )
    } catch {
      return new ImageResponse(
        (<div style={{
          width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
          background:'#FAF9F7', color:'#0B0B0C', fontSize:36, fontWeight:700
        }}>Parcels of Time</div>),
        { ...size }
      )
    }
  }
