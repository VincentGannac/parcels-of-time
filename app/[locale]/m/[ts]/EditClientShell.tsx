'use client'

import dynamic from 'next/dynamic'

// On charge EditClient coté client uniquement (pas de SSR)
const EditClient = dynamic(() => import('./EditClient'), { ssr: false })

export default EditClient
