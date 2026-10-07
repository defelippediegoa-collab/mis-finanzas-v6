# Mis Finanzas v6

App de finanzas personales (PWA para el celular) con backend en Google Apps Script. Evolución de la v55 (un solo `index.html`) a varios archivos sin paso de compilación.

```
app/                      PWA (se publica tal cual en GitHub Pages)
  index.html              shell, vistas y hojas modales
  css/app.css
  js/                     scripts clásicos, cargados en orden (no hay bundler)
    store.js              claves fin_db_v5 / fin_cfg_v5, normalize, migración v4→v5, mergeDB
    helpers.js            estado global (DB, CFG, cur), helpers de dinero/fechas, persist()
    model.js              saldos, tarjetas, cuotas
    views/*.js            una vista o modal por archivo
    sync.js               Subir/Bajar contra el Apps Script (token, STALE, merge)
    main.js               arranque, service worker, aviso de versión nueva
  sw.js                   cache versionado (subir VERSION en cada deploy)
  manifest.webmanifest
backend/apps-script/      Code.gs, Sheets.gs, Inbox.gs, AI.gs, Prompts.gs — ver su README
backend/whatsapp-worker/  bot de WhatsApp (Cloudflare Worker) — ver su README; `npm test` corre la conversación offline
docs/                     migration.md, architecture.md, setup-meta.md, testing.md
```

## Desarrollo local

```bash
npx -y serve app -l 8080
```

Qué hay en la v6, además de todo lo de la v55:

- **🧾 Escanear ticket** (botón flotante o menú): foto, archivo o carga manual → ítems editables → cuenta, mes de pago o cuotas. Estadísticas → "Ítems del mes".
- **📥 Pendientes de WhatsApp**: lo que cargás desde el bot queda en una bandeja hasta que lo confirmás.
- **Compartir a la app** desde WhatsApp o la galería (PWA instalada en Android).
- **☑️ Edición masiva**: filtrar, seleccionar varios y cambiar categoría, subcategoría, cuenta o etiquetas a todos; deshacer; "recordar" reglas por comercio.
- **IA opcional** (Claude vía Apps Script): tickets y texto libre. Sin clave, todo funciona a mano.

Para probar en el celular hace falta HTTPS (service worker, compartir a la app): usar GitHub Pages directamente o `cloudflared tunnel --url http://localhost:8080`.

## Deploy

Cada push a `main` que toque `app/` publica en GitHub Pages (`.github/workflows/pages.yml`). Antes de publicar, subir `VERSION` en `app/sw.js` y `APP_VERSION` en `app/js/store.js`.

## Migrar desde la v55

Ver [docs/migration.md](docs/migration.md).
