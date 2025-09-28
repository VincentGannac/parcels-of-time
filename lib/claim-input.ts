// lib/claim-input.ts
import type { PoolClient } from 'pg'

export type ClaimUpdates = {
  display_name?: string
  title?: string
  message?: string
  link_url?: string
  cert_style?: string
  time_display?: 'utc'|'utc+local'|'local+utc'
  local_date_only?: boolean
  text_color?: string
  title_public?: boolean
  message_public?: boolean
  public_registry?: boolean
}

export function normalizeClaimUpdates(input: Record<string, any>): ClaimUpdates {
  const b = (v:any) => v === true || v === '1' || v === 1 || String(v).toLowerCase() === 'true'
  const s = (v:any) => (typeof v === 'string' ? v : (v==null ? '' : String(v)))

  // ⚠️ même règles que le flux Edit
  return {
    display_name: s(input.display_name) || undefined,
    title:        s(input.title)        || undefined,
    message:      s(input.message)      || undefined,
    link_url:     s(input.link_url)     || undefined,
    cert_style:   s(input.cert_style)   || 'neutral',
    time_display: (['utc','utc+local','local+utc'] as const).includes(input.time_display) ? input.time_display : 'local+utc',
    local_date_only: b(input.local_date_only ?? '1'),
    text_color:   /^#[0-9a-f]{6}$/i.test(s(input.text_color)) ? s(input.text_color) : '#1A1F2A',
    title_public:   b(input.title_public),
    message_public: b(input.message_public),
    public_registry: b(input.public_registry),
  }
}

// applique les updates “comme Edit/confirm”
export async function applyClaimUpdatesLikeEdit(
  tx: PoolClient,
  tsISO: string,
  updates: ClaimUpdates,
  opts?: { newOwnerId?: string, customBgDataUrl?: string | null }
) {
  const fields = [
    'title','message','link_url','cert_style','time_display',
    'local_date_only','text_color','title_public','message_public'
  ] as const

  // 1) transfert d’owner si demandé
  if (opts?.newOwnerId) {
    await tx.query(`update claims set owner_id = $2 where date_trunc('day', ts) = $1::timestamptz`, [tsISO, opts.newOwnerId])
  }

  // 2) appliquer les champs (identique Edit)
  const sets: string[] = []
  const vals: any[] = [tsISO]
  fields.forEach((k, i) => {
    if (updates[k] !== undefined) { sets.push(`${k} = $${vals.length+1}`); vals.push(updates[k]) }
  })
  if (sets.length) {
    await tx.query(
      `update claims set ${sets.join(', ')} where date_trunc('day', ts) = $1::timestamptz`,
      vals
    )
  }

  // 3) “Offert par” déjà injecté côté client; [[HIDE_OWNED_BY]] est gérée côté client aussi.
  // 4) fond custom (optionnel) — si tu as déjà une route/stockage pour ça:
  if (opts?.customBgDataUrl && updates.cert_style === 'custom') {
    // simple exemple: table claim_backgrounds(ts unique, data_url text)
    await tx.query(
      `insert into claim_backgrounds (ts, data_url)
         values ($1::timestamptz, $2)
       on conflict (ts) do update set data_url = excluded.data_url`,
      [tsISO, opts.customBgDataUrl]
    )
  }
}
