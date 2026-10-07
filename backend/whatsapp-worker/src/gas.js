// Cliente del Apps Script (meta, inboxAppend, ai). La URL /exec redirige (302): fetch la sigue solo.
async function gasFetch(env, action, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  try {
    const r = await fetch(env.GAS_URL, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: env.GAS_TOKEN, ...(body || {}) }),
    });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch (x) { return { ok: false, code: 'BAD_JSON', error: txt.slice(0, 200) }; }
  } finally { clearTimeout(t); }
}
async function gasGet(env, action, params) {
  const u = new URL(env.GAS_URL);
  u.searchParams.set('action', action); u.searchParams.set('token', env.GAS_TOKEN);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { redirect: 'follow' });
  return r.json();
}

// Cuentas/categorías/subcategorías/reglas de la app, cacheadas 5 min en KV
export async function getMeta(env, force) {
  if (!force) {
    const c = await env.STATE.get('meta', 'json');
    if (c) return c;
  }
  const j = await gasGet(env, 'meta');
  if (!j || !j.ok) throw new Error('meta: ' + (j && (j.error || j.code)));
  const meta = {
    accounts: (j.accounts || []).map((a) => ({ name: a.name, type: a.type, currency: a.currency || 'ARS' })),
    cats: j.cats || { expense: [], income: [] },
    subs: j.subs || {},
    rules: j.rules || [],
  };
  await env.STATE.put('meta', JSON.stringify(meta), { expirationTtl: 300 });
  return meta;
}

export function inboxAppend(env, item) { return gasFetch(env, 'inboxAppend', { items: [item] }); }

export function aiTicket(env, base64, mime) { return gasFetch(env, 'ai', { task: 'ticket', image: { media_type: mime, data: base64 } }); }

export function aiParse(env, text, meta, today) {
  return gasFetch(env, 'ai', { task: 'parse', text, today, meta: { accounts: meta.accounts.map((a) => a.name), cats: meta.cats, subs: meta.subs } });
}
