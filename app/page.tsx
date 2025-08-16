// app/page.tsx (server component)
import { redirect } from 'next/navigation'

// Si tu préfères FR par défaut, remplace '/en' par '/fr'
export default function Page() {
  redirect('/en')
}
