# Arquitectura v6

```
 celular (PWA, único escritor del blob)
   │  GET/POST blob, meta, inbox, ai        (token compartido, body text/plain)
   ▼
 Google Apps Script  ──▶ Drive: fin_db_v5.json (la base)
   │                  ──▶ Sheet: Movimientos, Items (solo lectura), Inbox (bandeja)
   │                  ──▶ api.anthropic.com (clave en Script Properties)
   ▲
   │  inboxAppend / meta / ai
 Cloudflare Worker (bot de WhatsApp) ◀──▶ Meta Cloud API (número de prueba)
```

## Principios

- **Un solo escritor del blob**: el teléfono. Cualquier otro origen (bot, futuros scripts) deja movimientos en la **Inbox** y la app los confirma. Así el sync "último escribe gana" nunca pisa datos externos.
- **Sin build**: scripts clásicos cargados en orden desde `index.html`; variables globales compartidas como en la v55. Un archivo nuevo = agregarlo a `index.html` y a `ASSETS` en `sw.js`.
- **Config del dispositivo separada de los datos**: `fin_cfg_v5` (URL, token, modelo) no viaja en exports ni en la nube.
- **La IA es opcional**: sin `ANTHROPIC_API_KEY` el servidor responde `AI_UNCONFIGURED` y la app ofrece carga manual.
- **El servidor siempre responde 200**: los clientes miran `ok` y `code`.

## Modelo de datos (v5)

Ver `app/js/store.js` (`normalize`, `mergeDB`). Movimiento:

```js
{ id, date:'YYYY-MM-DD', type:'expense'|'income'|'transfer', account, category, sub, from, to,
  amount, currency, note, tags?:[], dueMonth?:'YYYY-MM', purchaseDate?, inst?:[n,N],
  rate?, currencyTo?, amountTo?, hist?,
  // v5
  merchant?, items?:[{desc,key,qty,unit:'u'|'kg'|'l'|'m',unitPrice,amount,discount?}],
  source?:'app'|'ticket'|'wa'|'share'|'import', inboxId?, ticketId?, createdAt?, updatedAt? }
```

Cuentas y categorías se referencian por **nombre** (herencia de la v55). Renombrar una cuenta reescribe sus referencias.

## Versionado

- `APP_VERSION` en `app/js/store.js` (se muestra en el menú).
- `VERSION` en `app/sw.js`: al cambiar, el SW nuevo se instala en espera y la app muestra "Hay una versión nueva · Tocá para actualizar".
- `VERSION` en `backend/apps-script/Code.gs` (`gas-6.x`): la app verifica `^gas-6` antes de escribir por primera vez.
