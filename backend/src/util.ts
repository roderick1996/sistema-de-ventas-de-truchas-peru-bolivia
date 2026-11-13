export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const todayBO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
export const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
export const addDaysISO = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function weekRange(d: string) {
  const dt = new Date(d + 'T12:00:00Z');
  const dow = (dt.getUTCDay() + 6) % 7;
  const mon = new Date(dt.getTime() - dow * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(mon), to: iso(sun) };
}
