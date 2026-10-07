// Webhook de WhatsApp Cloud API → conversación guiada → Inbox del Apps Script
import { handle, emptyState } from './flow.js';
import { markRead, sendText } from './meta.js';

const STATE_TTL = 1800; // 30 min sin actividad: se olvida la conversación a medias

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '') return new Response('finbot ok', { status: 200 });
    if (url.pathname !== '/webhook') return new Response('not found', { status: 404 });

    if (req.method === 'GET') { // verificación del webhook (Meta manda hub.challenge y hay que devolverlo en texto plano)
      const mode = url.searchParams.get('hub.mode'), token = url.searchParams.get('hub.verify_token'), challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token && token === env.META_VERIFY_TOKEN) return new Response(challenge || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      return new Response('forbidden', { status: 403 });
    }
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

    const raw = await req.text();
    if (!(await verifySignature(env.META_APP_SECRET, raw, req.headers.get('X-Hub-Signature-256')))) return new Response('bad signature', { status: 401 });

    let body; try { body = JSON.parse(raw); } catch (x) { return new Response('bad json', { status: 400 }); }
    for (const entry of body.entry || []) {
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        if (!v.messages) continue; // statuses (entregado/leído) no nos interesan
        for (const msg of v.messages) ctx.waitUntil(processMessage(env, msg).catch((e) => console.error('process', e)));
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });
  },
};

async function verifySignature(secret, raw, header) {
  if (!secret || !header || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice(7).toLowerCase();
  if (given.length !== hex.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// 549XXXXXXXXXX y 54XXXXXXXXXX son el mismo celular argentino
const normPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^549/, '54');

async function processMessage(env, msg) {
  if (!msg || !msg.id || !msg.from) return;
  // dedupe: Meta reintenta si no respondemos rápido
  if (await env.STATE.get('msg:' + msg.id)) return;
  await env.STATE.put('msg:' + msg.id, '1', { expirationTtl: 86400 });

  const allowed = (env.ALLOWED_NUMBERS || '').split(',').map(normPhone).filter(Boolean);
  if (!allowed.includes(normPhone(msg.from))) { console.log('ignorado: remitente no permitido', msg.from); return; }

  await markRead(env, msg.id);
  const input = normalizeInput(msg);
  if (!input) { await sendText(env, msg.from, 'Solo entiendo texto, botones y fotos 🙂'); return; }

  const key = 'conv:' + msg.from;
  const st = (await env.STATE.get(key, 'json')) || emptyState();
  const next = await handle(env, msg.from, st, input);
  await env.STATE.put(key, JSON.stringify(next), { expirationTtl: STATE_TTL });
}

function normalizeInput(msg) {
  switch (msg.type) {
    case 'text': return { kind: 'text', text: (msg.text && msg.text.body) || '' };
    case 'interactive': {
      const i = msg.interactive || {};
      if (i.type === 'button_reply' && i.button_reply) return { kind: 'option', optionId: i.button_reply.id, text: i.button_reply.title || '' };
      if (i.type === 'list_reply' && i.list_reply) return { kind: 'option', optionId: i.list_reply.id, text: i.list_reply.title || '' };
      return null;
    }
    case 'button': return { kind: 'text', text: (msg.button && msg.button.text) || '' };
    case 'image': return { kind: 'media', media: { id: msg.image.id, mime: msg.image.mime_type || 'image/jpeg' }, text: (msg.image.caption || '') };
    case 'document': {
      const mt = msg.document.mime_type || '';
      if (!/^image\/|application\/pdf/.test(mt)) return null;
      return { kind: 'media', media: { id: msg.document.id, mime: mt }, text: msg.document.caption || '' };
    }
    default: return null;
  }
}
