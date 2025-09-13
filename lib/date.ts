//app/lib/date.ts
export function formatISOAsNice(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // Normalise à la minute (UTC)
    d.setUTCSeconds(0, 0);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const HH = String(d.getUTCHours()).padStart(2, '0');
    const MM = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${HH}:${MM} UTC`;
  } catch {
    return iso;
  }
}
