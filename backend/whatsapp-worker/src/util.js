// Utilidades: normalización de texto, importes y fechas (zona horaria Argentina)
export const TZ = 'America/Argentina/Buenos_Aires';

export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// "1.500,50" → 1500.5 · "1500.50" → 1500.5 · "15k" → 15000 · "20 usd" → {amount:20, currency:'USD'}
export function parseAmount(text) {
  const low = String(text || '').toLowerCase();
  if (!low.trim()) return null;
  let currency = null;
  if (/\b(usd|dolares?|dolar|dólares?|dólar)\b/.test(low) || /u\$s|us\$/.test(low)) currency = 'USD';
  const t = low.replace(/u\$s|us\$/g, ' ').replace(/\b(usd|ars|pesos?|dolares?|dolar|dólares?|dólar)\b/g, ' ').replace(/\$/g, ' ');
  const m = t.match(/\d[\d.,]*(?:\s*k\b)?/);
  if (!m) return null;
  let s = m[0].replace(/\s+/g, '');
  let k = false;
  if (/k$/.test(s)) { k = true; s = s.slice(0, -1); }
  s = s.replace(/[.,]+$/, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); // 1.500,50
    else s = s.replace(/,/g, ''); // 1,500.50
  } else if (s.includes(',')) {
    const parts = s.split(',');
    s = (parts.length === 2 && parts[1].length <= 2) ? parts[0] + '.' + parts[1] : s.replace(/,/g, '');
  } else if (s.includes('.')) {
    const parts = s.split('.');
    s = (parts.length === 2 && parts[1].length <= 2) ? s : s.replace(/\./g, ''); // 12.345 = doce mil…
  }
  let n = parseFloat(s);
  if (!isFinite(n)) return null;
  if (k) n *= 1000;
  n = Math.round(Math.abs(n) * 100) / 100;
  if (n <= 0) return null;
  return { amount: n, currency };
}

export function todayAR(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
export function ymAR(offsetMonths = 0) {
  const [y, m] = todayAR().split('-').map(Number);
  const tot = y * 12 + (m - 1) + offsetMonths;
  return `${Math.floor(tot / 12)}-${String((tot % 12) + 1).padStart(2, '0')}`;
}

// "hoy" | "ayer" | "anteayer" | "7/10" | "07/10/2026" | "2026-10-07" → 'YYYY-MM-DD' | null
export function parseDate(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  const w = norm(t);
  if (w === 'hoy') return todayAR(0);
  if (w === 'ayer') return todayAR(-1);
  if (w === 'anteayer') return todayAR(-2);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : todayAR().slice(0, 4);
    const mm = m[2].padStart(2, '0'), dd = m[1].padStart(2, '0');
    if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null;
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

// "2026-12" | "12" | "12/2026" → 'YYYY-MM' | null
export function parseMonth(text) {
  const t = String(text || '').toLowerCase().trim();
  let m = t.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) {
    const [y, cm] = todayAR().split('-').map(Number);
    const yy = +m[1] < cm ? y + 1 : y;
    return `${yy}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

export function fmtMoney(n, cur = 'ARS') {
  const s = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-' : '') + (cur === 'USD' ? 'US$ ' : '$ ') + s;
}
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${+d}/${+m}${y !== todayAR().slice(0, 4) ? '/' + y : ''}`;
}

// Resuelve la respuesta del usuario contra una lista de opciones [{id, value, title}]
// Acepta: id exacto (botón/lista), número de orden, o nombre aproximado.
export function matchOption(input, options) {
  if (!input) return null;
  const raw = String(input).trim();
  let o = options.find((x) => x.id === raw);
  if (o) return o;
  if (/^\d{1,2}$/.test(raw)) { const i = +raw - 1; if (options[i]) return options[i]; }
  const n = norm(raw);
  if (!n) return null;
  o = options.find((x) => norm(x.value) === n);
  if (o) return o;
  const cands = options.filter((x) => norm(x.value).includes(n) || n.includes(norm(x.value)));
  if (cands.length === 1) return cands[0];
  if (cands.length > 1) { // varias: la más corta es la más específica ("mercado" → MercadoPago, no MercadoPago USD)
    const sorted = cands.slice().sort((x, y) => norm(x.value).length - norm(y.value).length);
    if (norm(sorted[0].value).length < norm(sorted[1].value).length) return sorted[0];
  }
  const words = n.split(' ').filter((w) => w.length > 1);
  const byWords = options.filter((x) => { const v = norm(x.value); return words.length && words.every((w) => v.includes(w)); });
  if (byWords.length === 1) return byWords[0];
  return null;
}

export function rid() { return Math.random().toString(36).slice(2, 8); }
