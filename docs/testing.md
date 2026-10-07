# Cómo probar cada pieza

## App en la compu (sin celular)

```bash
npx -y serve app -l 8080
```

Abrí `http://localhost:8080`. Carga con datos de ejemplo. Consola del navegador (F12) sin errores.

Ojo con el service worker: sirve la app desde cache. Después de cambiar código y **sin** subir `VERSION` en `app/sw.js`, hacé "Vaciar caché y recargar de forma forzada" (F12 → clic derecho en recargar) o desregistrá el SW en Application → Service Workers.

## App en el celular

HTTPS es obligatorio para el service worker y para "Compartir a la app". Opciones:

- **GitHub Pages** (lo normal): push a `main` y en 1-2 minutos está en `https://defelippediegoa-collab.github.io/mis-finanzas-v6/`. En la app aparece "Hay una versión nueva · Tocá para actualizar".
- **Túnel desde la compu** para probar antes de publicar: `cloudflared tunnel --url http://localhost:8080` te da una URL `https://….trycloudflare.com`.
- Logs del celular: cable USB + `chrome://inspect` en Chrome de la compu.

## Checklist por fase

### Paridad con la v55 (migración)
- [ ] Importar el export JSON de la v55 → el diálogo muestra los conteos correctos.
- [ ] Capital, saldo por cuenta, "A pagar" de cada tarjeta, Panel del mes: iguales a la v55 al peso.
- [ ] Una serie de cuotas se ve igual; borrar una cuota ofrece borrar la serie.
- [ ] Modo avión → la app abre igual (service worker).
- [ ] Sincronizar: Subir ▲ → Sheet con pestañas Movimientos e Items; Bajar ▼ recupera lo mismo.
- [ ] Token incorrecto → "Token inválido". URL del script viejo → "Esa URL no es del Apps Script v6".

### Apps Script

```bash
curl -L "URL/exec?action=ping&token=TOKEN"
curl -L -X POST -H "Content-Type: text/plain" --data-binary '{"action":"inboxAppend","token":"TOKEN","items":[{"draft":{"type":"expense","amount":1500,"account":"MercadoPago","category":"Gastos Variables","sub":"Supermercado","note":"prueba","date":"2026-10-07"},"complete":true}]}' "URL/exec"
curl -L "URL/exec?action=inbox&token=TOKEN"
```

Sin `ANTHROPIC_API_KEY`: `{"action":"ai","task":"parse","text":"hola"}` responde `AI_UNCONFIGURED`. En Apps Script → Ejecuciones se ven los errores.

### Tickets
- [ ] Foto de un ticket real (COTO, Día, Carrefour): comercio, fecha, total e ítems; "Suma de ítems ✓".
- [ ] Ticket borroso o cortado: aparece el aviso ⚠️ y se puede corregir a mano.
- [ ] PDF (comprobante de Mercado Pago).
- [ ] Tarjeta en 3 cuotas → 3 movimientos, los ítems solo en la cuota 1, el detalle se abre desde cualquiera.
- [ ] Sin IA (sin clave): "Cargar los ítems a mano" funciona igual.
- [ ] Estadísticas → "Ítems del mes" → tocar un ítem muestra historial y precio unitario.

### Compartir a la app (Android)
- [ ] Instalar la PWA (Chrome → ⋮ → Instalar aplicación). Abrirla una vez.
- [ ] Galería → Compartir → "Mis Finanzas" → se abre el escaneo con esa foto.
- [ ] WhatsApp → mantener apretado un mensaje de texto → Compartir → "Mis Finanzas" → formulario prellenado (con IA interpreta "coto 23450").
- Si la app no aparece en el menú Compartir: desinstalá y volvé a instalar la PWA (Chrome cachea el manifest).

### Bandeja de WhatsApp
- [ ] Con un item en la Inbox (vía curl o bot) → al abrir la app aparece "📥 1 movimiento desde WhatsApp".
- [ ] Revisar y guardar → movimiento creado con origen `wa`; en el Sheet la fila pasa a `done`.
- [ ] Descartar → fila `discarded`.
- [ ] Sin red al guardar → se encola y se marca cuando vuelve la conexión.

### Bot (Worker)
Ver [backend/whatsapp-worker/README.md](../backend/whatsapp-worker/README.md). Test offline de la conversación completa: `node test/send.mjs …` contra `wrangler dev`, y `npx wrangler tail` en producción.
- [ ] "hola" → botones. Número suelto → pide cuenta. "1500 super galicia" → "Entendí: …" y solo pregunta lo que falta.
- [ ] Más de 10 cuentas → lista numerada; responde "6" o "galicia".
- [ ] Tarjeta → mes de pago y cuotas. Cambiar → elegir campo → vuelve a confirmar.
- [ ] Foto → resumen del ticket → cuenta → guardado; aparece en la bandeja con ítems.
- [ ] "cancelar" en medio; mensaje de un número no permitido → ignorado (tail).

### Edición masiva
- [ ] Filtrar categoría "otros" del mes → Todos → Cambiar categoría → vista previa con el conteo → Aplicar.
- [ ] Deshacer restaura exactamente.
- [ ] "Recordar: coto → Gastos Variables › Supermercado" → un ticket nuevo de COTO toma esa categoría; el bot también (después de "actualizar").
- [ ] Cambiar cuenta con una selección ARS + USD → bloqueado con aviso.
- [ ] "serie" en una cuota selecciona toda la serie.

## Antes de publicar

1. Subir `VERSION` en `app/sw.js` y `APP_VERSION` en `app/js/store.js`.
2. Si agregaste un archivo JS/CSS: sumarlo a `index.html` y a `ASSETS` en `sw.js`.
3. `node --check` de los JS (o abrir en el navegador y mirar la consola).
4. Commit y push a `main`.
