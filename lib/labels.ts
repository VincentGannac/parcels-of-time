//lib/labels.ts
export type Edition = 'classic' | 'premium' | 'iconic';

export function isLeapDay(d: Date) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  return isLeapYear && m === 1 && day === 29;
}

function pad2(n: number) { return n.toString().padStart(2,'0'); }

export function timeString(d: Date) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

export function isPrettyTime(d: Date) {
  const t = timeString(d);
  return (
    t === '11:11:11' ||
    t === '22:22:22' ||
    t === '12:34:56' ||
    /^([0-9])\1:([0-9])\2:([0-9])\3$/.test(t)
  );
}

export function detectEdition(d: Date): Edition {
  if (isLeapDay(d) || isPrettyTime(d)) return 'premium';
  return 'classic';
}
