// app/[locale]/claim/page.tsx
import { Suspense } from 'react' 
import ClientClaim from './ClientClaim' 
export const dynamic = 'force-dynamic' // opt-out SSG pour cette page 
export const revalidate = 0 

export default function Page() { 
    return ( 
    <Suspense fallback={<main style=
        {{padding:24}}>Loading…</main>}> 
        <ClientClaim />
        </Suspense> 
    ) 
}