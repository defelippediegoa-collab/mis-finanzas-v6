// Test offline de la conversación: node test/flow.test.mjs  (no necesita wrangler ni cuenta de Meta)
// Prueba offline de la máquina de estados del bot: stubea fetch (Graph + Apps Script) y KV.
import { handle, emptyState } from '../src/flow.js';

const META = { ok: true, accounts: [
  { name: 'Efectivo Casa', type: 'Efectivo', currency: 'ARS' }, { name: 'Bco Credicoop', type: 'Cuentas', currency: 'ARS' }, { name: 'MercadoPago', type: 'Cuentas', currency: 'ARS' },
  { name: 'Santander', type: 'Cuentas', currency: 'ARS' }, { name: 'Santander visa', type: 'Tarjetas de crédito', currency: 'ARS' }, { name: 'Nacion MasterCard', type: 'Tarjetas de crédito', currency: 'ARS' },
  { name: 'Credicoop cabal', type: 'Tarjetas de crédito', currency: 'ARS' }, { name: 'Casa USD', type: 'Ahorros', currency: 'USD' }, { name: 'Bco Galicia', type: 'Cuentas', currency: 'ARS' },
  { name: 'MercadoPago USD', type: 'Ahorros', currency: 'USD' }, { name: 'Creditos', type: 'Préstamo', currency: 'ARS' } ],
  cats: { expense: ['Gastos Fijos', 'Gastos Variables', 'Gastos Discresionales', '🎁 Regalos', 'otros'], income: ['Salario', '💵 Dinero extra'] },
  subs: { 'Gastos Variables': ['Supermercado', 'Nafta'], 'Gastos Fijos': [], otros: [] }, rules: [{ kind: 'merchant', match: 'coto', category: 'Gastos Variables', sub: 'Supermercado' }], usdRate: 1000 };

const sent = []; const inbox = []; let aiMode = 'parse-ok';
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('MEDIA_ID')) return new Response(JSON.stringify({ url: 'https://cdn.example/x.jpg', mime_type: 'image/jpeg', file_size: 1000 }));
  if (u.includes('graph.facebook.com')) { const b = JSON.parse(opts.body); if (b.status === 'read') return new Response('{}'); sent.push(b); return new Response('{"messages":[{"id":"x"}]}'); }
  if (u.includes('script.google.com')) {
    if (opts && opts.method === 'POST') { const b = JSON.parse(opts.body);
      if (b.action === 'inboxAppend') { inbox.push(...b.items); return new Response(JSON.stringify({ ok: true, ids: ['wa_1'] })); }
      if (b.action === 'ai' && b.task === 'parse') { if (aiMode === 'off') return new Response(JSON.stringify({ ok: false, code: 'AI_UNCONFIGURED', error: 'no key' }));
        return new Response(JSON.stringify({ ok: true, result: { type: 'expense', amount: 1500, currency: 'ARS', account: 'galicia', category: 'Gastos Variables', sub: 'Supermercado', note: 'super', date: '2026-10-07', confidence: 0.9, missing: [] } })); }
      if (b.action === 'ai' && b.task === 'ticket') return new Response(JSON.stringify({ ok: true, result: { merchant: 'COTO', date: '2026-10-06', currency: 'ARS', total: 4000, subtotal: 4300, discount_total: 300, items: [{ desc: 'Leche', qty: 2, unit: 'u', unit_price: 1250, amount: 2500, is_discount: false }, { desc: 'Pan', qty: 1, unit: 'u', unit_price: 1800, amount: 1800, is_discount: false }, { desc: 'DTO', qty: 1, unit: 'u', unit_price: null, amount: -300, is_discount: true }], payment_hint: 'VISA', confidence: 0.9, warnings: [] } }));
    }
    return new Response(JSON.stringify(META));
  }
  if (u.includes('MEDIA_ID')) return new Response(JSON.stringify({ url: 'https://cdn.example/x.jpg', mime_type: 'image/jpeg', file_size: 1000 }));
  if (u.includes('cdn.example')) return new Response(new Uint8Array([1, 2, 3]));
  throw new Error('unexpected fetch ' + u);
};
const kv = new Map();
const env = { STATE: { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => kv.set(k, v) }, GAS_URL: 'https://script.google.com/macros/s/X/exec', GAS_TOKEN: 't', AI_MODE: 'gas', PHONE_NUMBER_ID: '1', META_TOKEN: 'x' };

const from = '5491100000000';
let st = emptyState();
const say = async (text) => { st = await handle(env, from, st, { kind: 'text', text }); return last(); };
const tap = async (optionId, text) => { st = await handle(env, from, st, { kind: 'option', optionId, text }); return last(); };
const last = () => { const m = sent[sent.length - 1]; if (!m) return ''; if (m.type === 'text') return 'TEXT: ' + m.text.body; if (m.interactive.type === 'button') return 'BTN(' + m.interactive.action.buttons.map((b) => b.reply.id).join(',') + '): ' + m.interactive.body.text; return 'LIST(' + m.interactive.action.sections[0].rows.length + '): ' + m.interactive.body.text; };
const assert = (c, msg) => { if (!c) { console.error('FAIL:', msg, '\n last:', last(), '\n state:', JSON.stringify(st)); process.exit(1); } };

// 1) flujo guiado completo
console.log(await say('hola')); assert(st.step === 'type', 'pide tipo');
console.log(await tap('type:expense', 'Gasto')); assert(st.step === 'amount', 'pide importe');
console.log(await say('1.250,50')); assert(st.step === 'account' && st.draft.amount === 1250.5, 'importe parseado');
assert(/^TEXT:/.test(last()) && sent[sent.length - 1].text.body.includes('11)'), '11 cuentas → texto numerado');
console.log(await say('6')); assert(st.step === 'paymonth' && st.draft.account === 'Nacion MasterCard', 'cuenta por número → tarjeta → mes de pago');
console.log(await tap('pm:1')); assert(st.step === 'inst', 'pide cuotas');
console.log(await tap('in:3')); assert(st.step === 'category' && st.draft.inst[1] === 3, 'cuotas 3');
console.log(await tap('cat:1', 'Gastos Variables')); assert(st.step === 'sub', 'pide sub');
console.log(await tap('sub:0', 'Supermercado')); assert(st.step === 'note', 'pide nota');
console.log(await say('coto')); assert(st.step === 'date', 'pide fecha');
console.log(await tap('dt:0')); assert(st.step === 'confirm', 'confirmar');
console.log(await tap('ok:edit')); assert(st.step === 'edit_pick', 'elegir campo');
console.log(await tap('ed:amount')); assert(st.step === 'amount' && st.returnTo === 'confirm', 'vuelve a importe');
console.log(await say('2000')); assert(st.step === 'confirm' && st.draft.amount === 2000, 'vuelve a confirmar tras editar');
console.log(await tap('ok:save')); assert(st.step === 'idle' && inbox.length === 1, 'guardado en inbox');
const d = inbox[0].draft; assert(d.account === 'Nacion MasterCard' && d.inst[1] === 3 && d.dueMonth && d.category === 'Gastos Variables' && d.sub === 'Supermercado' && d.note === 'coto' && d.amount === 2000, 'draft correcto ' + JSON.stringify(d));

// 2) número suelto → gasto rápido, cuenta por nombre, cancelar
console.log(await say('2500')); assert(st.step === 'account' && st.draft.amount === 2500, 'atajo número');
console.log(await say('mercado')); assert(st.step === 'category' && st.draft.account === 'MercadoPago', 'cuenta por nombre aproximado: ' + st.draft.account);
console.log(await say('cancelar')); assert(st.step === 'idle', 'cancelado');

// 3) texto libre con IA
console.log(await say('1500 super galicia')); assert(st.draft.account === 'Bco Galicia' && st.draft.category === 'Gastos Variables', 'parse IA aplicado');
assert(st.step === 'confirm', 'con todo completo va a confirmar: ' + st.step);
console.log(await say('si')); assert(inbox.length === 2 && inbox[1].draft.account === 'Bco Galicia', 'guardado parse');

// 4) texto libre sin IA
aiMode = 'off';
console.log(await say('nafta 25000')); assert(st.step === 'account' && st.draft.amount === 25000 && st.draft.note === 'nafta', 'sin IA usa importe y nota: ' + JSON.stringify(st.draft));
await say('cancelar');

// 5) ticket por foto
st = await handle(env, from, st, { kind: 'media', media: { id: 'MEDIA_ID_123', mime: 'image/jpeg' } });
console.log(last()); assert(st.step === 'ticket_account' && st.draft.items.length === 3 && st.draft.category === 'Gastos Variables' && st.draft.amount === 4000, 'ticket leído: ' + JSON.stringify(st.draft).slice(0, 200));
console.log(await say('santander visa')); assert(st.step === 'paymonth' && st.draft.account === 'Santander visa', 'cuenta del ticket (tarjeta)');
console.log(await tap('pm:0')); console.log(await tap('in:1')); assert(st.step === 'confirm', 'ticket a confirmar');
console.log(await tap('ok:save')); assert(inbox.length === 3 && inbox[2].draft.items.length === 3 && inbox[2].draft.merchant === 'COTO', 'ticket en inbox');

// 6) transferencia
console.log(await say('hola')); console.log(await tap('type:transfer')); console.log(await say('100 usd'));
assert(st.step === 'from' && st.draft.currency === 'USD', 'transfer usd');
console.log(await say('casa usd')); console.log(await say('mercadopago usd')); assert(st.step === 'note' && st.draft.to === 'MercadoPago USD', 'hacia ok: ' + st.draft.to);
console.log(await say('no')); console.log(await tap('dt:1')); assert(st.step === 'confirm', 'transfer confirm');
console.log(await tap('ok:save')); assert(inbox[3].draft.type === 'transfer' && inbox[3].draft.from === 'Casa USD', 'transfer guardada');
console.log('\nALL OK ·', sent.length, 'mensajes enviados ·', inbox.length, 'items en inbox');
