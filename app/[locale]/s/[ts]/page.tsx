//app/[locale]/s/[ts]/page.tsx
import { redirect } from 'next/navigation'
type Params = { ts: string }
export default async function Page({ params }: { params: Promise<Params> }) {
  const { ts } = await params
  redirect(`/m/${encodeURIComponent(ts)}`)
}
