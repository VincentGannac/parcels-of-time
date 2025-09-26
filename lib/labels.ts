//app/lib/labels.ts
export type Edition = 'classic' | 'premium' | 'iconic';

export function isLeapDay(d: Date) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  return isLeapYear && m === 1 && day === 29;
}

function pad2(n: number) { return n.toString().padStart(2,'0'); }

export function timeStringMinute(d: Date) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function isPrettyMinute(d: Date) {
  const t = timeStringMinute(d); // HH:MM
  // patterns "minutes" désirables
  return (
    t === '11:11' ||
    t === '22:22' ||
    t === '12:34' ||
    t === '00:00' ||
    /^(\d)(\d):\2\1$/.test(t)    // palindromes ex: 12:21, 13:31, 20:02
  );
}

export function detectEdition(d: Date): Edition {
  if (isLeapDay(d) || isPrettyMinute(d)) return 'premium';
  return 'classic';
}
