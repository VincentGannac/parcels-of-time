// EditSection.tsx
'use client'

import dynamic from 'next/dynamic'
import type { EditClientProps } from './EditClient'

// 👇 Le générique est le type de PROPS
const EditClient = dynamic<EditClientProps>(
  () => import('./EditClient').then(m => m.default), // 👈 retourne bien le composant
  {
    ssr: false,
    loading: () => <div style={{opacity:.7}}>Chargement de l’éditeur…</div>,
  }
)

// Ré-export local si tu veux garder le même alias dans la page
export type EditProps = EditClientProps

export default function EditSection(props: EditProps) {
  try {
    return <EditClient {...props} />
  } catch {
    return <div style={{color:'#b44'}}>Éditeur indisponible.</div>
  }
}
