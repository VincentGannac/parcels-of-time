export function formatISOAsNice(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().replace('T',' ').replace('Z',' UTC');
  } catch {
    return iso;
  }
}
