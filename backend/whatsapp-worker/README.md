# Bot de WhatsApp (Cloudflare Worker)

Recibe los mensajes de WhatsApp (webhook de la Cloud API de Meta), te guía campo por campo y deja el movimiento en la **Inbox** del Apps Script. La app lo muestra como "pendiente de WhatsApp" hasta que lo confirmes. Nunca escribe directo en tus datos.

Requisitos: Node 18+, cuenta de Cloudflare (gratis), app de Meta con WhatsApp (ver [docs/setup-meta.md](../../docs/setup-meta.md)).

## Puesta en marcha

```bash
cd backend/whatsapp-worker
npm install
npx wrangler login
npx wrangler kv namespace create STATE        # copiá el id que imprime en wrangler.toml
```

Editá `wrangler.toml`: `PHONE_NUMBER_ID`, `GAS_URL`, `ALLOWED_NUMBERS` (tu número, ej. `5491155551234`), y el `id` del KV.

Secretos (te los pide por consola, no quedan en el repo):

```bash
npx wrangler secret put META_APP_SECRET
npx wrangler secret put META_TOKEN
npx wrangler secret put META_VERIFY_TOKEN
npx wrangler secret put GAS_TOKEN
```

Desplegar:

```bash
npx wrangler deploy
```

Imprime la URL, por ejemplo `https://finbot.<tu-cuenta>.workers.dev`. El webhook para Meta es esa URL + `/webhook`.

## Probar en local

1. Copiá `.dev.vars.example` a `.dev.vars` y completá los valores.
2. `npx wrangler dev` (queda en `http://localhost:8787`).
3. Verificación del webhook:

```bash
curl "http://localhost:8787/webhook?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=123"
```

Debe responder `123`.

4. Mensajes simulados (firmados como los firma Meta):

```bash
node test/send.mjs hola
node test/send.mjs number
node test/send.mjs button_reply
node test/send.mjs list_reply
node test/send.mjs image
node test/send.mjs not_allowed
node test/send.mjs status
```

Cada uno responde `200 EVENT_RECEIVED`; en la consola de `wrangler dev` ves las llamadas a Graph (van a fallar con el token de prueba, es normal) y los errores. Con firma inválida el worker responde `401`.

En producción: `npx wrangler tail` muestra los logs en vivo mientras le escribís al bot.

## Cómo conversa

| Paso | Pregunta | Acepta |
|---|---|---|
| inicio | "hola" → botones Gasto / Ingreso / Transferencia. Un número suelto ("2500") arranca un gasto con ese importe. Texto libre ("1500 super galicia") se interpreta con IA si está configurada. Una foto se lee como ticket. | |
| importe | ¿Cuánto fue? | `1500`, `1.500,50`, `15k`, `20 usd` |
| cuenta | ¿Con qué cuenta? | botón/lista, número de orden o nombre aproximado ("galicia") |
| tarjeta | ¿En qué resumen lo pagás? → ¿cuántas cuotas? | Este mes / Mes que viene / Otro (`2026-12` o `12`) · 1, 3, 6 o un número |
| categoría / sub | listas de la app | |
| nota | texto o "no" | |
| fecha | Hoy / Ayer / Otra (`7/10`) | |
| confirmar | Guardar / Cambiar (elegís el campo) / Cancelar | "si", "no" |

Comandos en cualquier momento: `cancelar`, `ayuda`, `hola` (menú), `actualizar` (recarga cuentas y categorías de la app).

## Archivos

- `src/worker.js` — webhook: verificación GET, firma `X-Hub-Signature-256`, dedupe por id, lista blanca de remitentes, `ctx.waitUntil`.
- `src/flow.js` — máquina de estados (KV `conv:<teléfono>`, 30 min).
- `src/meta.js` — Graph API: texto, botones (≤3), listas (≤10), texto numerado (>10), descarga de medios.
- `src/gas.js` — Apps Script: `meta` (cacheado 5 min en KV), `inboxAppend`, `ai`.
- `src/texts.js` — todos los textos. `src/util.js` — importes, fechas, coincidencia de opciones.

## Problemas típicos

- **Meta no verifica el webhook**: el `META_VERIFY_TOKEN` del worker no coincide con el que pusiste en Meta, o el worker no está desplegado.
- **El bot no contesta**: tu número no está en `ALLOWED_NUMBERS` (mirá `wrangler tail`: "remitente no permitido"), o el `META_TOKEN` venció (el temporal dura 24 h; usá el de System User).
- **Responde "No pude guardarlo en la nube"**: `GAS_URL`/`GAS_TOKEN` mal, o el Apps Script no está publicado como "Cualquier persona".
- **Cuentas desactualizadas**: escribile `actualizar`.
