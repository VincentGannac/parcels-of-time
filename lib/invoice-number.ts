// lib/invoice-number.ts
import { pool } from '@/lib/db'

export type InvoiceSeries = 'classic' | 'mp-buyer' | 'mp-fee'

/**
 * Crée la table compteur si absente, puis incrémente le compteur
 * pour (series, year) et renvoie un numéro "YYYY-NNNNNN".
 * Une série = une continuité (légal en France si chaque série est continue).
 */
export async function nextInvoiceNumber(series: InvoiceSeries, when = new Date()): Promise<string> {
  const y = when.getUTCFullYear()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      create table if not exists invoice_counter (
        series text not null,
        year int not null,
        seq bigint not null default 0,
        primary key (series, year)
      )
    `)

    await client.query(
      `insert into invoice_counter(series, year, seq)
       values ($1,$2,0)
       on conflict (series, year) do nothing`,
      [series, y]
    )

    const { rows } = await client.query<{ seq: string }>(
      `update invoice_counter
          set seq = seq + 1
        where series=$1 and year=$2
        returning seq`,
      [series, y]
    )

    await client.query('COMMIT')
    const n = Number(rows[0].seq) | 0
    return `${y}-${String(n).padStart(6, '0')}`
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    // fallback ultra-sûr (horodatage) si la DB est KO
    const stamp = Date.now().toString().slice(-8)
    return `${y}-FALLBACK-${stamp}`
  } finally {
    client.release()
  }
}
