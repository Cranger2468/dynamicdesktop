// Approximate offline exchange rates per 1 USD.
const usd: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.37, JPY: 150, AUD: 1.52, CHF: 0.88, CNY: 7.2, INR: 83, MXN: 17, SEK: 10.5 };
const units: Record<string, [string, number]> = { km: ['len', 1000], m: ['len', 1], cm: ['len', 0.01], mi: ['len', 1609.344], ft: ['len', 0.3048], in: ['len', 0.0254], kg: ['mass', 1], g: ['mass', 0.001], lb: ['mass', 0.453592], oz: ['mass', 0.0283495], l: ['vol', 1], ml: ['vol', 0.001], gal: ['vol', 3.78541] };
const zones: Record<string, string> = { london: 'Europe/London', tokyo: 'Asia/Tokyo', 'new york': 'America/New_York', toronto: 'America/Toronto', paris: 'Europe/Paris', berlin: 'Europe/Berlin', sydney: 'Australia/Sydney', 'los angeles': 'America/Los_Angeles', chicago: 'America/Chicago', dubai: 'Asia/Dubai', singapore: 'Asia/Singapore', mumbai: 'Asia/Kolkata', utc: 'UTC' };
const round = (n: number) => Number(n.toFixed(n < 10 ? 3 : 2)).toLocaleString('en-US');

function offset(zone: string, at: Date) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
  const g = (t: string) => Number(p.find(x => x.type === t)?.value);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - at.getTime()) / 60000;
}

export function convert(input: string, now = new Date()): string | null {
  const q = input.trim().toLowerCase();
  const t = q.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(.+?)\s+(?:in|to)\s+(.+)$/);
  if (t && t[1] && t[4] && t[5] && zones[t[4]] && zones[t[5]]) {
    const z4 = zones[t[4]] as string, z5 = zones[t[5]] as string, tz5 = t[5];
    let h = Number(t[1]) % 12 + (t[3] === 'pm' ? 12 : 0); if (!t[3]) h = Number(t[1]);
    const from = offset(z4, now), to = offset(z5, now);
    const mins = ((h * 60 + Number(t[2] || 0) - from + to) % 1440 + 1440) % 1440;
    const hh = Math.floor(mins / 60), mm = mins % 60;
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'} in ${tz5.replace(/\b\w/g, c => c.toUpperCase())}`;
  }
  const m = q.match(/^(-?[\d.,]+)\s*([a-z°]+)\s+(?:in|to)\s+([a-z°]+)$/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const n = Number(m[1].replace(/,/g, '')), a = m[2].replace('°', ''), b = m[3].replace('°', '');
  if (!Number.isFinite(n)) return null;
  const A = a.toUpperCase(), B = b.toUpperCase();
  const ra = usd[A], rb = usd[B];
  if (ra && rb) return `≈ ${round(n / ra * rb)} ${B} (approximate rate)`;
  if ((a === 'c' || a === 'f') && (b === 'c' || b === 'f')) return `${round(a === b ? n : a === 'c' ? n * 9 / 5 + 32 : (n - 32) * 5 / 9)} °${B}`;
  const ua = units[a], ub = units[b];
  if (ua && ub && ua[0] === ub[0]) return `${round(n * ua[1] / ub[1])} ${b}`;
  return null;
}
