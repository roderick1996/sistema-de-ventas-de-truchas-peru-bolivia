export const fmt = (n, d = 2) => Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d });
export const bs = (n) => 'Bs ' + fmt(n);
export const sol = (n) => 'S/ ' + fmt(n);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
export function weekRange(s) {
  const d = new Date(s + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7;
  return { from: addDays(s, -dow), to: addDays(s, -dow + 6) };
}
export const fdate = (s) => (s ? s.split('-').reverse().join('/') : '');
export function arrobas(a) {
  const w = Math.floor(a + 1e-9);
  const f = Math.round((a - w) * 100) / 100;
  const g = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[f];
  if (f === 0) return `${w} ${w === 1 ? 'arroba' : 'arrobas'}`;
  if (g) return w ? `${w}${g} arrobas` : `${g} arroba`;
  return `${fmt(a)} arrobas`;
}
export const dayName = (s) => new Date(s + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'long', day: '2-digit', month: '2-digit' });
export const daysSince = (s) => Math.max(0, Math.round((Date.parse(todayStr() + 'T12:00:00Z') - Date.parse(s + 'T12:00:00Z')) / 86400000));
export const productName = (p) => (p === 'RETACO' ? 'Retacos' : 'Normal');
export const daysLabel = (n) => (n <= 0 ? 'hoy' : n === 1 ? 'hace 1 día' : `hace ${n} días`);
