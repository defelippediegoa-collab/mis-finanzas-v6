# Migrar de la v55 a la v6

La v6 usa un Sheet y un Apps Script **nuevos**. Los viejos no se tocan: quedan de respaldo hasta que verifiques todo.

## Antes de empezar (en la v55, en el celular)

1. Menú ⋮ → **Sincronizar** → **Subir ▲** una vez más (la nube vieja queda al día).
2. Menú ⋮ → **Exportar copia (.json)**. Guardá `finanzas_backup.json` en Drive o mandátelo por WhatsApp a vos mismo.
3. Desactivá "Sincronizar automáticamente" en la v55 para que no siga escribiendo en la nube vieja.

## Backend nuevo

Seguí [backend/apps-script/README.md](../backend/apps-script/README.md): Sheet nuevo, pegar los `.gs`, Script Properties (`API_TOKEN`, `SHEET_ID`), publicar, probar `ping`.

## App nueva

1. Abrí la URL de GitHub Pages de la v6 en Chrome y **Instalar app** (menú ⋮ de Chrome → "Instalar aplicación" / "Agregar a pantalla principal").
2. Si abrís la v6 en la **misma URL** que la v55, los datos se migran solos (toast "Datos migrados desde la versión anterior"). Si la URL es otra, Menú ⋮ → **Importar datos (.json)** → elegí el backup → confirmá los conteos.
3. Comprobá contra la v55: Capital total, saldo de cada cuenta, "A pagar" de cada tarjeta, una serie de cuotas, el Panel del mes actual. Tienen que coincidir al peso.
4. Menú ⋮ → **Sincronizar**: pegá la URL `/exec` nueva y el token → **Guardar configuración** → **Subir ▲**. En el Sheet nuevo aparecen las pestañas Movimientos e Items.
5. Activá "Sincronizar automáticamente".

## Qué cambia en los datos

- Clave de almacenamiento `fin_db_v5` (la `fin_db_v4` queda intacta como respaldo local).
- La URL y el token de sync ya **no viajan** dentro del export ni de la nube: viven en `fin_cfg_v5`, solo en el dispositivo.
- Campos nuevos, todos opcionales: `items[]`, `merchant`, `source`, `ticketId`, `createdAt`, `updatedAt`, `rules[]` y `schema:5`. Un export v6 se puede abrir con la v55 (ignora lo que no conoce).
- Si el servidor rechaza una subida porque la nube es más nueva (`STALE`), la app fusiona por id y vuelve a subir: no se pierde nada de ningún lado.

## Si algo sale mal

- "Esa URL no es del Apps Script v6": pegaste la URL vieja. La v6 se niega a escribir ahí para no romper tu respaldo.
- "Token inválido": el `API_TOKEN` de Script Properties no coincide con el de la app.
- La nube vacía nunca pisa el teléfono: si bajás y la v6 dice "La nube está vacía", subí primero.
- Para volver a la v55: la app vieja sigue publicada y su nube no se tocó.
