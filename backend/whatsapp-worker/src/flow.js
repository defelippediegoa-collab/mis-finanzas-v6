// Máquina de estados de la conversación. Entrada normalizada:
//   { kind:'text'|'option'|'media', text, optionId, media:{id,mime} }
// Estado (KV conv:{from}): { step, draft, options:[{id,value,title}], returnTo, ticket }
import { T } from './texts.js';
import { norm, parseAmount, parseDate, parseMonth, todayAR, ymAR, fmtMoney, fmtDate, matchOption, rid } from './util.js';
import { sendText, sendOptions, downloadMedia } from './meta.js';
import { getMeta, inboxAppend, aiTicket, aiParse } from './gas.js';

export function emptyState() { return { step: 'idle', draft: {}, options: [], returnTo: null }; }

const isCard = (meta, name) => { const a = meta.accounts.find((x) => x.name === name); return !!a && a.type === 'Tarjetas de crédito'; };
const curOf = (meta, name) => { const a = meta.accounts.find((x) => x.name === name); return a ? a.currency : 'ARS'; };
const findName = (list, val) => { if (!val) return null; const n = norm(val); return list.find((x) => norm(x) === n) || list.find((x) => norm(x).includes(n) || n.includes(norm(x))) || null; };

// ---- helpers de envío que también guardan las opciones ofrecidas en el estado ----
async function ask(env, to, st, step, body, options) {
  st.step = step; st.options = options || [];
  if (options && options.length) await sendOptions(env, to, body, options);
  else await sendText(env, to, body);
  return st;
}
const opts = (values, prefix) => values.map((v, i) => ({ id: `${prefix}:${i}`, value: v, title: v }));

function summary(meta, d) {
  const em = d.type === 'income' ? '💰 Ingreso' : d.type === 'transfer' ? '🔁 Transferencia' : '💸 Gasto';
  const parts = [em, fmtMoney(d.amount || 0, d.currency || 'ARS')];
  if (d.type === 'transfer') parts.push(`${d.from || '?'} → ${d.to || '?'}`);
  else { parts.push(d.account || 'sin cuenta'); if (d.category) parts.push(d.category + (d.sub ? ' › ' + d.sub : '')); }
  if (d.inst && d.inst[1] > 1) parts.push(`${d.inst[1]} cuotas desde ${d.dueMonth}`);
  else if (d.dueMonth) parts.push(`paga ${d.dueMonth}`);
  parts.push(fmtDate(d.date || todayAR()));
  if (d.note) parts.push(`nota: ${d.note}`);
  if (d.items && d.items.length) parts.push(`🧾 ${d.items.length} ítems`);
  return parts.join(' · ');
}

// Siguiente paso que falta completar
function nextStep(meta, d) {
  if (!d.type) return 'type';
  if (!(d.amount > 0)) return 'amount';
  if (d.type === 'transfer') { if (!d.from) return 'from'; if (!d.to) return 'to'; }
  else {
    if (!d.account) return 'account';
    if (d.type === 'expense' && isCard(meta, d.account)) { if (!d.dueMonth) return 'paymonth'; if (!d.inst) return 'inst'; }
    if (!d.category) return 'category';
    if (d.sub === undefined && (meta.subs[d.category] || []).length) return 'sub';
  }
  if (d.note === undefined) return 'note';
  if (!d.date) return 'date';
  return 'confirm';
}

async function go(env, to, st, meta) {
  const d = st.draft;
  const step = st.returnTo === 'confirm' && st.step !== 'confirm' && nextStep(meta, d) === 'confirm' ? 'confirm' : nextStep(meta, d);
  switch (step) {
    case 'type': return ask(env, to, st, 'type', T.hello + '\n' + T.helloHint, [{ id: 'type:expense', value: 'expense', title: T.typeBtn.expense }, { id: 'type:income', value: 'income', title: T.typeBtn.income }, { id: 'type:transfer', value: 'transfer', title: T.typeBtn.transfer }]);
    case 'amount': return ask(env, to, st, 'amount', T.askAmount);
    case 'account': return ask(env, to, st, 'account', T.askAccount, opts(meta.accounts.map((a) => a.name), 'acc'));
    case 'from': return ask(env, to, st, 'from', T.askFrom, opts(meta.accounts.map((a) => a.name), 'acc'));
    case 'to': return ask(env, to, st, 'to', T.askTo, opts(meta.accounts.filter((a) => a.name !== d.from).map((a) => a.name), 'acc'));
    case 'paymonth': { const m0 = ymAR(0), m1 = ymAR(1); return ask(env, to, st, 'paymonth', T.askPayMonth, [{ id: 'pm:0', value: m0, title: T.payThis(m0) }, { id: 'pm:1', value: m1, title: T.payNext(m1) }, { id: 'pm:x', value: 'otro', title: T.payOther }]); }
    case 'inst': return ask(env, to, st, 'inst', T.askInst, [{ id: 'in:1', value: '1', title: '1 (sin cuotas)' }, { id: 'in:3', value: '3', title: '3 cuotas' }, { id: 'in:6', value: '6', title: '6 cuotas' }]);
    case 'category': return ask(env, to, st, 'category', T.askCategory, opts(meta.cats[d.type === 'income' ? 'income' : 'expense'] || [], 'cat'));
    case 'sub': return ask(env, to, st, 'sub', T.askSub, [...opts(meta.subs[d.category] || [], 'sub'), { id: 'sub:none', value: '', title: T.noSub }]);
    case 'note': return ask(env, to, st, 'note', T.askNote);
    case 'date': return ask(env, to, st, 'date', T.askDate, [{ id: 'dt:0', value: todayAR(0), title: T.dateToday }, { id: 'dt:1', value: todayAR(-1), title: T.dateYesterday }, { id: 'dt:x', value: 'otra', title: T.dateOther }]);
    default: {
      st.returnTo = null;
      return ask(env, to, st, 'confirm', `📝 ${summary(meta, d)}\n${T.confirmQ}`, [{ id: 'ok:save', value: 'save', title: T.save }, { id: 'ok:edit', value: 'edit', title: T.change }, { id: 'ok:cancel', value: 'cancel', title: T.cancel }]);
    }
  }
}

function pick(st, input) {
  return matchOption(input.kind === 'option' ? input.optionId : input.text, st.options);
}

export async function handle(env, from, st, input, ctx) {
  const to = from;
  const text = input.text || '';
  const n = norm(text);

  // ---- comandos globales ----
  if (input.kind === 'text') {
    if (/^(cancelar|cancel|salir)$/.test(n)) { const had = st.step !== 'idle'; Object.assign(st, emptyState()); await sendText(env, to, had ? T.cancelled : T.nothingToCancel); return st; }
    if (/^(ayuda|help|\?)$/.test(n)) { await sendText(env, to, T.help); return st; }
    if (/^(actualizar|refrescar)$/.test(n)) { await getMeta(env, true); await sendText(env, to, T.refreshed); return st; }
  }
  const meta = await getMeta(env, false);

  // ---- foto / documento ----
  if (input.kind === 'media') {
    if (st.step !== 'idle') { await sendText(env, to, T.mediaMidFlow); return st; }
    return handleTicket(env, to, st, meta, input.media);
  }

  switch (st.step) {
    case 'idle': {
      if (input.kind === 'option') { await sendText(env, to, T.unknown); return st; }
      if (/^(hola|menu|menú|inicio|buenas|hey)$/.test(n) || !n) { st.draft = {}; return go(env, to, st, meta); }
      const amt = parseAmount(text);
      const onlyNumber = /^[\d.,\s]+k?$/.test(n) || /^[\d.,\s]+\s*(usd|pesos|ars|\$)?$/.test(n);
      if (amt && onlyNumber) { st.draft = { type: 'expense', amount: amt.amount }; if (amt.currency) st.draft.currency = amt.currency; return go(env, to, st, meta); }
      // texto libre → IA si hay
      if ((env.AI_MODE || 'gas') !== 'off') {
        try {
          const j = await aiParse(env, text, meta, todayAR());
          if (j && j.ok && j.result && (j.result.confidence || 0) >= 0.5) {
            const r = j.result, d = { type: r.type || 'expense' };
            if (r.amount > 0) d.amount = r.amount;
            if (r.currency === 'USD') d.currency = 'USD';
            const acc = findName(meta.accounts.map((a) => a.name), r.account); if (acc) d.account = acc;
            const cat = findName(meta.cats[d.type === 'income' ? 'income' : 'expense'] || [], r.category); if (cat) d.category = cat;
            if (cat) { const sub = findName(meta.subs[cat] || [], r.sub); d.sub = sub || ''; }
            if (r.note) d.note = r.note;
            if (r.date) d.date = r.date;
            if (d.type === 'transfer') { delete d.account; delete d.category; delete d.sub; }
            st.draft = d;
            if (d.account) d.currency = d.currency || curOf(meta, d.account);
            await sendText(env, to, T.understood(summary(meta, d)));
            return go(env, to, st, meta);
          }
        } catch (e) { console.error('parse', e); }
      }
      // sin IA o sin confianza: si al menos hay importe, arrancamos con eso; si no, menú
      if (amt) { st.draft = { type: 'expense', amount: amt.amount, note: text.replace(/[\d.,]+\s*k?/, '').trim() || undefined }; if (amt.currency) st.draft.currency = amt.currency; return go(env, to, st, meta); }
      st.draft = {}; return go(env, to, st, meta);
    }
    case 'type': {
      const o = pick(st, input) || (/(gasto|gaste|pague)/.test(n) ? { value: 'expense' } : /(ingreso|cobre|sueldo)/.test(n) ? { value: 'income' } : /(transfer|pase|mande)/.test(n) ? { value: 'transfer' } : null);
      if (!o) { await sendText(env, to, T.unknown); return go(env, to, st, meta); }
      st.draft.type = o.value; if (o.value === 'transfer') { delete st.draft.account; delete st.draft.category; delete st.draft.sub; }
      return go(env, to, st, meta);
    }
    case 'amount': {
      const amt = parseAmount(text);
      if (!amt) { await sendText(env, to, T.badAmount); return st; }
      st.draft.amount = amt.amount; if (amt.currency) st.draft.currency = amt.currency;
      return go(env, to, st, meta);
    }
    case 'account': case 'from': case 'to': case 'ticket_account': {
      const o = pick(st, input);
      if (!o) { await sendText(env, to, T.unknown); return go(env, to, st, meta); }
      const field = st.step === 'from' ? 'from' : st.step === 'to' ? 'to' : 'account';
      st.draft[field] = o.value;
      if (field === 'account' || field === 'from') st.draft.currency = st.draft.currency || curOf(meta, o.value);
      if (field === 'account' && st.draft.type === 'expense' && isCard(meta, o.value)) { delete st.draft.dueMonth; delete st.draft.inst; }
      return go(env, to, st, meta);
    }
    case 'paymonth': {
      const o = pick(st, input);
      let m = o ? o.value : parseMonth(text);
      if (m === 'otro') { return ask(env, to, st, 'paymonth_text', T.askPayMonthText); }
      if (!m) { await sendText(env, to, T.badMonth); return st; }
      st.draft.dueMonth = m; return go(env, to, st, meta);
    }
    case 'paymonth_text': {
      const m = parseMonth(text); if (!m) { await sendText(env, to, T.badMonth); return st; }
      st.draft.dueMonth = m; return go(env, to, st, meta);
    }
    case 'inst': {
      const o = pick(st, input); const k = parseInt(o ? o.value : text, 10);
      if (!(k >= 1 && k <= 36)) { await sendText(env, to, T.badInst); return st; }
      st.draft.inst = k > 1 ? [1, k] : null; if (k <= 1) st.draft.inst = [1, 1];
      return go(env, to, st, meta);
    }
    case 'category': {
      const o = pick(st, input);
      if (!o) { await sendText(env, to, T.unknown); return go(env, to, st, meta); }
      st.draft.category = o.value; delete st.draft.sub;
      return go(env, to, st, meta);
    }
    case 'sub': {
      const o = pick(st, input) || (/^(no|ninguna|sin)$/.test(n) ? { value: '' } : null);
      if (!o) { await sendText(env, to, T.unknown); return go(env, to, st, meta); }
      st.draft.sub = o.value; return go(env, to, st, meta);
    }
    case 'note': {
      st.draft.note = (input.kind === 'text' && !/^(no|nada|ninguna|-)$/.test(n)) ? text.trim().slice(0, 120) : '';
      return go(env, to, st, meta);
    }
    case 'date': {
      const o = pick(st, input);
      if (o && o.value === 'otra') return ask(env, to, st, 'date_text', T.askDateText);
      const dt = o ? o.value : parseDate(text);
      if (!dt) { await sendText(env, to, T.badDate); return st; }
      st.draft.date = dt; return go(env, to, st, meta);
    }
    case 'date_text': {
      const dt = parseDate(text); if (!dt) { await sendText(env, to, T.badDate); return st; }
      st.draft.date = dt; return go(env, to, st, meta);
    }
    case 'confirm': {
      const o = pick(st, input) || (/^(si|sí|dale|ok|guardar)$/.test(n) ? { value: 'save' } : /^(cambiar|editar)$/.test(n) ? { value: 'edit' } : /^(no|cancelar)$/.test(n) ? { value: 'cancel' } : null);
      if (!o) { await sendText(env, to, T.unknown); return go(env, to, st, meta); }
      if (o.value === 'cancel') { Object.assign(st, emptyState()); await sendText(env, to, T.cancelled); return st; }
      if (o.value === 'edit') {
        const d = st.draft; const fields = d.type === 'transfer' ? ['type', 'amount', 'from', 'to', 'note', 'date'] : ['type', 'amount', 'account', ...(d.dueMonth ? ['dueMonth', 'inst'] : []), 'category', 'sub', 'note', 'date'];
        return ask(env, to, st, 'edit_pick', T.changeWhat, fields.map((f) => ({ id: 'ed:' + f, value: f, title: T.fields[f] })));
      }
      return saveDraft(env, to, st, meta, from);
    }
    case 'edit_pick': {
      const o = pick(st, input);
      if (!o) { await sendText(env, to, T.unknown); return st; }
      const f = o.value; st.returnTo = 'confirm';
      if (f === 'type') delete st.draft.type;
      else if (f === 'amount') delete st.draft.amount;
      else if (f === 'account') { delete st.draft.account; delete st.draft.dueMonth; delete st.draft.inst; }
      else if (f === 'from') delete st.draft.from;
      else if (f === 'to') delete st.draft.to;
      else if (f === 'dueMonth') delete st.draft.dueMonth;
      else if (f === 'inst') delete st.draft.inst;
      else if (f === 'category') { delete st.draft.category; delete st.draft.sub; }
      else if (f === 'sub') delete st.draft.sub;
      else if (f === 'note') delete st.draft.note;
      else if (f === 'date') delete st.draft.date;
      return go(env, to, st, meta);
    }
    default: { Object.assign(st, emptyState()); return go(env, to, st, meta); }
  }
}

async function saveDraft(env, to, st, meta, from) {
  const d = st.draft;
  const draft = { type: d.type, amount: d.amount, currency: d.currency || (d.account ? curOf(meta, d.account) : d.from ? curOf(meta, d.from) : 'ARS'), note: d.note || '', date: d.date || todayAR() };
  if (d.type === 'transfer') { draft.from = d.from; draft.to = d.to; }
  else { draft.account = d.account; draft.category = d.category || ''; draft.sub = d.sub || ''; if (d.dueMonth) draft.dueMonth = d.dueMonth; if (d.inst && d.inst[1] > 1) draft.inst = d.inst; }
  if (d.merchant) draft.merchant = d.merchant;
  if (d.items && d.items.length) draft.items = d.items;
  const item = { source: 'wa', from, complete: true, draft, raw: { text: d.rawText || '', mediaId: d.mediaId || '' }, createdAt: Date.now() };
  let j = null;
  try { j = await inboxAppend(env, item); } catch (e) { console.error('inboxAppend', e); }
  if (j && j.ok) { Object.assign(st, emptyState()); await sendText(env, to, T.saved); }
  else { await sendText(env, to, T.saveFail); }
  return st;
}

async function handleTicket(env, to, st, meta, media) {
  if ((env.AI_MODE || 'gas') === 'off') { st.draft = { type: 'expense', note: 'ticket', mediaId: media.id }; await sendText(env, to, T.ticketNoAi); return go(env, to, st, meta); }
  await sendText(env, to, T.readingTicket);
  let r = null;
  try {
    const f = await downloadMedia(env, media.id);
    const j = await aiTicket(env, f.base64, f.mime);
    if (j && j.ok) r = j.result;
    else console.error('aiTicket', j && (j.code + ' ' + j.error));
  } catch (e) { if (String(e.message) === 'TOO_BIG') { await sendText(env, to, T.mediaTooBig); return st; } console.error('ticket', e); }
  if (!r) { st.draft = { type: 'expense', note: 'ticket', mediaId: media.id }; await sendText(env, to, T.ticketFail); return go(env, to, st, meta); }
  const items = (r.items || []).map((i) => ({ desc: i.desc, qty: i.qty || 1, unit: i.unit || 'u', unitPrice: i.unit_price == null ? null : i.unit_price, amount: i.amount, discount: !!i.is_discount }));
  const sum = Math.round(items.reduce((s, i) => s + (i.amount || 0), 0) * 100) / 100;
  const total = typeof r.total === 'number' && r.total > 0 ? r.total : sum;
  const d = { type: 'expense', amount: total, currency: r.currency === 'USD' ? 'USD' : 'ARS', merchant: r.merchant || '', items, date: r.date || todayAR(), note: r.merchant || 'ticket', mediaId: media.id };
  // categoría por regla de la app o Supermercado por defecto
  const m = norm(d.merchant);
  const rule = (meta.rules || []).filter((x) => x.kind === 'merchant' && m && m.includes(x.match)).sort((a, b) => b.match.length - a.match.length)[0];
  if (rule) { d.category = rule.category; d.sub = rule.sub || ''; }
  else if ((meta.cats.expense || []).includes('Gastos Variables') && (meta.subs['Gastos Variables'] || []).includes('Supermercado')) { d.category = 'Gastos Variables'; d.sub = 'Supermercado'; }
  st.draft = d;
  await sendText(env, to, T.ticketSummary({ ...r, items, totalTxt: fmtMoney(total, d.currency) }));
  return ask(env, to, st, 'ticket_account', T.askTicketAccount, opts(meta.accounts.map((a) => a.name), 'acc'));
}
