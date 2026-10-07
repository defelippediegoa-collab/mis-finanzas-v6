// Cliente de la WhatsApp Cloud API (Graph)
import { T } from './texts.js';

function graph(env) { return `https://graph.facebook.com/${env.GRAPH_VERSION || 'v21.0'}`; }

async function send(env, payload) {
  const r = await fetch(`${graph(env)}/${env.PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.META_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error('graph error', r.status, txt.slice(0, 300));
  }
  return r.ok;
}

export const sendText = (env, to, body) => send(env, { to, type: 'text', text: { body, preview_url: false } });

export const markRead = (env, messageId) =>
  fetch(`${graph(env)}/${env.PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.META_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch(() => {});

const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

// Botones de respuesta: máx 3, títulos ≤ 20 chars
export function sendButtons(env, to, body, buttons) {
  return send(env, { to, type: 'interactive', interactive: {
    type: 'button', body: { text: body },
    action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: cut(b.title, 20) } })) },
  } });
}
// Lista: máx 10 filas, título ≤ 24, descripción ≤ 72
export function sendList(env, to, body, buttonLabel, rows) {
  return send(env, { to, type: 'interactive', interactive: {
    type: 'list', body: { text: body },
    action: { button: cut(buttonLabel || 'Elegir', 20), sections: [{ title: 'Opciones', rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: cut(r.title, 24), description: r.description ? cut(r.description, 72) : undefined })) }] },
  } });
}
// Elige el formato según la cantidad: ≤3 botones, ≤10 lista, >10 texto numerado
export async function sendOptions(env, to, body, options) {
  if (options.length <= 3) return sendButtons(env, to, body, options);
  if (options.length <= 10) return sendList(env, to, body, 'Elegir', options);
  return sendText(env, to, `${body}\n\n${T.menuNumbered(options)}\n\n${T.pickNumber}`);
}

// Descarga un media de WhatsApp → { base64, mime, size }
export async function downloadMedia(env, mediaId, maxBytes = 4.5 * 1024 * 1024) {
  const h = { Authorization: `Bearer ${env.META_TOKEN}` };
  const m = await fetch(`${graph(env)}/${mediaId}`, { headers: h });
  if (!m.ok) throw new Error('media meta ' + m.status);
  const meta = await m.json();
  if (meta.file_size && meta.file_size > maxBytes) throw new Error('TOO_BIG');
  const f = await fetch(meta.url, { headers: h });
  if (!f.ok) throw new Error('media download ' + f.status);
  const buf = new Uint8Array(await f.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('TOO_BIG');
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { base64: btoa(bin), mime: meta.mime_type || 'image/jpeg', size: buf.length };
}
