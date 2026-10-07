// Manda un payload de prueba firmado al worker local (npx wrangler dev) o al desplegado.
// Uso:  node test/send.mjs text            → test/payloads/text.json
//       node test/send.mjs button_reply http://localhost:8787
// Lee META_APP_SECRET de .dev.vars (o de la variable de entorno) para firmar como lo hace Meta.
import { readFileSync, existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const name = process.argv[2] || 'text';
const base = process.argv[3] || 'http://localhost:8787';
let secret = process.env.META_APP_SECRET;
if (!secret && existsSync('.dev.vars')) {
  const m = readFileSync('.dev.vars', 'utf8').match(/^META_APP_SECRET\s*=\s*"?([^"\n]+)"?/m);
  if (m) secret = m[1].trim();
}
if (!secret) { console.error('Falta META_APP_SECRET (en .dev.vars o como variable de entorno)'); process.exit(1); }

const raw = readFileSync(new URL(`./payloads/${name}.json`, import.meta.url), 'utf8');
const sig = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
const r = await fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body: raw });
console.log(r.status, await r.text());
