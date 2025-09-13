export default function Loading() {
  return (
    <main
      style={{
        background:'#0B0E14', color:'#E6EAF2', minHeight:'100vh',
        display:'grid', placeItems:'center', fontFamily:'Inter, system-ui'
      }}
    >
      <div style={{textAlign:'center'}}>
        <div
          aria-label="Chargement…"
          style={{
            width:42, height:42, margin:'0 auto 12px',
            borderRadius:'50%',
            border:'3px solid rgba(230,234,242,.15)',
            borderTopColor:'#E4B73D',
            animation:'spin 0.9s linear infinite'
          }}
        />
        <div style={{opacity:.85}}>Chargement du registre…</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
