# Apps Script v6 — puesta en marcha

El backend guarda toda la base como un JSON en tu Drive, escribe pestañas de solo lectura en un Sheet (Movimientos, Items), administra la bandeja de WhatsApp (Inbox) y hace de proxy a Claude (la clave nunca sale de acá).

## 1. Crear el Sheet y el proyecto

1. En Google Drive: **Nuevo → Hojas de cálculo**, nombrala "Finanzas v6". Copiá el ID de la URL (`.../spreadsheets/d/<ID>/edit`).
2. En el Sheet: **Extensiones → Apps Script**. Borrá el `Code.gs` vacío.
3. Creá un archivo por cada `.gs` de esta carpeta (**+ → Secuencia de comandos**) y pegá el contenido: `Code.gs`, `Sheets.gs`, `Inbox.gs`, `AI.gs`, `Prompts.gs`.
4. **Configuración del proyecto (engranaje) → Mostrar el archivo de manifiesto "appsscript.json"** y pegá el contenido de `appsscript.json`.

## 2. Script Properties

Configuración del proyecto → **Propiedades del script → Añadir propiedad**:

| Propiedad | Valor |
|---|---|
| `API_TOKEN` | una contraseña larga al azar (30+ caracteres). La misma va en la app, en Sincronizar → Token. |
| `SHEET_ID` | el ID del Sheet del paso 1 |
| `ANTHROPIC_API_KEY` | opcional; sin esto la app funciona igual pero sin leer tickets ni texto libre |
| `AI_MODEL` | opcional, default `claude-opus-5-5` |
| `AI_EFFORT` | opcional, default `low` |

`BLOB_FILE_ID` se crea solo la primera vez que subís datos.

Para generar un token, en una terminal:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

## 3. Publicar

**Implementar → Nueva implementación → tipo "Aplicación web"**: ejecutar como **Yo**, acceso **Cualquier persona**. Autorizá los permisos (Drive, Sheets, conexiones externas). Copiá la URL que termina en `/exec`.

Cada vez que cambies el código: **Implementar → Administrar implementaciones → lápiz → Versión: Nueva → Implementar**. La URL no cambia.

## 4. Probar

```bash
curl -L "https://script.google.com/macros/s/XXXX/exec?action=ping&token=TU_TOKEN"
```

Debe responder `{"ok":true,"version":"gas-6.0","ai":false,...}`. Con token incorrecto: `{"ok":false,"code":"AUTH",...}`.

Subir un blob de prueba:

```bash
curl -L -X POST -H "Content-Type: text/plain" --data-binary '{"action":"blob","token":"TU_TOKEN","db":{"tx":[],"accounts":[],"updatedAt":1}}' "https://script.google.com/macros/s/XXXX/exec"
```

## Acciones

| action | método | parámetros | respuesta |
|---|---|---|---|
| `ping` | GET | — | `{ok, version, ai, model, time}` |
| `blob` | GET | — | la base completa (`{tx:[], updatedAt:0, empty:true}` si está vacía) |
| `blob` | POST | `{db}` | `{ok, updatedAt, tx, sheets}`; `STALE` si la nube es más nueva |
| `meta` | GET | — | `{accounts, cats, subs, rules, usdRate}` (lo usa el bot) |
| `inbox` | GET | `status=pending|done|discarded|all` | `{items:[...]}` |
| `inboxAppend` | POST | `{items:[{draft, complete, from, raw}]}` | `{ids}` |
| `inboxDone` | POST | `{ids, status:'done'|'discarded'}` | `{updated, missing}` |
| `ai` | POST | `{task:'ticket', image:{media_type,data}}` o `{task:'parse', text, meta, today}` | `{result, usage, model}` |

Siempre HTTP 200; mirar `ok`. Importante: la URL `/exec` responde con una redirección 302 (por eso `curl -L`); los navegadores y los Workers la siguen solos.
