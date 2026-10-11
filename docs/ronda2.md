# Ronda 2 (6.4 → 6.6): productos, descuentos, categorías por ítem, reintegros, préstamos

## Qué cambió en el modelo (todo aditivo; un export viejo se importa igual)

- **Ítem de ticket**: `listPrice` (precio impreso), `unitPrice` (neto, lo que pagaste por unidad después de repartir descuentos), `discountAlloc`, `pos`, `category`/`sub` (solo si difiere del ticket), `productId`.
- **Movimiento**: `ticketPart:[k,K]` cuando el ticket se guardó en varias categorías; `discounts[]` en la parte principal; `pending:true` + `refundOf` en un ingreso de reintegro todavía no recibido; `refund:{pct,amount,account,due}` en el gasto; `loanId`/`loanCuota` en los movimientos de un préstamo.
- **`DB.products[]`**: catálogo. `kind` = RUBRO en el que se agrupa el gasto (comida, galletitas, limpieza, higiene…) → `variety` = qué producto es (queso cremoso, puré de tomate…) → producto con `brand`, `size`, `unit` → `aliases[]` (descripciones normalizadas vistas en tickets). El alias manda: `normalize()` re-deriva `productId` desde el alias, así los datos viejos y otros dispositivos quedan vinculados solos. Fusionar deja `mergedInto`.
- **`DB.loans[]`**: préstamos recibidos. Cada uno tiene una cuenta tipo `Préstamo` (saldo negativo = capital que falta), una transferencia de entrada y un recordatorio mensual de cuotas (`kind:'loan'`).

## Reglas contables nuevas

- Un movimiento `pending` no mueve saldos ni entra en ingresos (Panel, Estadísticas, Trans, financiamiento). Aparece atenuado con "⏳ pendiente" y en Proyección como ingreso esperado (o "reintegro atrasado" si venció). Se confirma desde el movimiento con "Confirmar que lo recibí".
- Las cuentas `Préstamo` quedan FUERA de todos los totales (Cuentas muestra el capital por devolver aparte; Panel y Trans no las suman). Criterio de caja para el flujo mensual: el préstamo recibido entra como plata del mes (figura en Ingresos con la aclaración) y cada cuota sale en su mes: el capital como gasto contado y el interés como gasto "Gastos Fijos › Intereses"; las cuotas futuras figuran por el recordatorio. En "¿Cómo se financió?" (modo mes) el préstamo es "deuda nueva". La deuda total de Tarjetas suma tarjetas + préstamos.
- Registrar una cuota desde el detalle del préstamo crea la transferencia de capital (cuenta de pago → cuenta Préstamo) y el gasto de interés (Gastos Fijos › Intereses), y tilda el recordatorio del mes.

## Backend

Hay que volver a pegar en Apps Script y publicar **Nueva versión**: `Prompts.gs` y `AI.gs` (tarea `products`) y `Sheets.gs` (columnas Parte, Pendiente, Reintegro, Ticket, Producto, PrecioLista/PrecioPagado/Descuento; pestañas Productos y Préstamos). Sin eso la app funciona igual; solo la vinculación con IA y las columnas nuevas del Sheet quedan sin efecto.

## Cómo se usa

- **Ticket**: en cada descuento elegí *Repartir entre todos*, *Al ítem de arriba* o *Dejar como línea*. Tocá la categoría de un ítem para cambiarla; el ticket se guarda como una parte por categoría. El chip "¿producto?" vincula el ítem a un producto para seguir su precio; con IA se completa solo.
- **Productos y precios** (menú o desde Estadísticas → Ítems): buscá, tocá un producto para ver "más barato en", la evolución por comercio y el historial; "comparar ›" en un tipo compara marcas con precio por kg/l. "Vincular" procesa los ítems viejos sin producto.
- **Reintegro**: en el gasto (formulario o ticket) tildá "Tiene reintegro", poné % o importe, la cuenta donde vuelve y la fecha estimada. Cuando llegue, abrí el ingreso pendiente y confirmá.
- **Préstamo**: menú "Nuevo préstamo" o Tarjetas → Préstamos → "+ nuevo". Cargá lo recibido, el total a devolver y las cuotas. Cada mes, en el detalle, "Registrar cuota".
