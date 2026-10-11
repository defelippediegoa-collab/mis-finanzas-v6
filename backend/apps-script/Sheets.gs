/**
 * Pestañas de solo lectura en el Sheet: "Movimientos", "Items", "Recordatorios", "Cuentas", "Productos" y "Préstamos".
 * Son una copia para mirar/filtrar en Google Sheets; editarlas NO afecta la app (se pisan en cada sync).
 */
function sheetDoc() {
  var id = PROPS.getProperty('SHEET_ID');
  if (!id) throw new Error('falta SHEET_ID en Script Properties');
  return SpreadsheetApp.openById(id);
}
function tab(doc, name, header) {
  var sh = doc.getSheetByName(name);
  if (!sh) { sh = doc.insertSheet(name); }
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}
function writeSheets(db) {
  var doc = sheetDoc();
  var tx = (db.tx || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });

  var mh = ['Fecha', 'Tipo', 'Cuenta', 'Categoria', 'Subcategoria', 'Nota', 'Importe', 'Moneda', 'Desde', 'Hacia', 'Etiquetas', 'MesPago', 'Cuota', 'Comercio', 'Origen', 'Parte', 'Pendiente', 'Reintegro', 'Ticket', 'Id'];
  var mrows = tx.map(function (t) {
    var tipo = t.type === 'transfer' ? 'Transferencia' : (t.type === 'income' ? 'Ingreso' : 'Gasto');
    return [t.date || '', tipo, t.account || '', t.category || '', t.sub || '', t.note || '', Number(t.amount) || 0, t.currency || 'ARS',
      t.from || '', t.to || '', (t.tags || []).join(', '), t.dueMonth || '', t.inst ? (t.inst[0] + '/' + t.inst[1]) : '', t.merchant || '', t.source || '',
      t.ticketPart ? (t.ticketPart[0] + '/' + t.ticketPart[1]) : '', t.pending ? 'Sí' : '', t.refund ? (t.refund.pct ? t.refund.pct + '%' : Number(t.refund.amount)) : '', t.ticketId || '', t.id || ''];
  });
  var ms = tab(doc, 'Movimientos', mh);
  if (mrows.length) ms.getRange(2, 1, mrows.length, mh.length).setValues(mrows);

  var ih = ['Fecha', 'Comercio', 'Item', 'Producto', 'Cantidad', 'Unidad', 'PrecioLista', 'PrecioPagado', 'Descuento', 'Importe', 'Categoria', 'Subcategoria', 'Cuenta', 'TxId'];
  var pById = {};(db.products || []).forEach(function (p) { pById[p.id] = p; });
  var irows = [];
  tx.forEach(function (t) {
    (t.items || []).forEach(function (i) {
      var pr = i.productId && pById[i.productId] ? pById[i.productId].name : '';
      irows.push([t.date || '', t.merchant || '', i.desc || '', pr, Number(i.qty) || 1, i.unit || 'u', i.listPrice == null ? (i.unitPrice == null ? '' : Number(i.unitPrice)) : Number(i.listPrice), i.unitPrice == null ? '' : Number(i.unitPrice), Number(i.discountAlloc) || 0, Number(i.amount) || 0, t.category || '', t.sub || '', t.account || '', t.id || '']);
    });
  });
  var is = tab(doc, 'Items', ih);
  if (irows.length) is.getRange(2, 1, irows.length, ih.length).setValues(irows);

  var rh = ['Nombre', 'Tipo', 'Importe', 'Frecuencia', 'Desde', 'Hasta', 'Cuenta', 'Categoria', 'Subcategoria', 'Etiquetas', 'Cambios', 'Id'];
  var rrows = (db.reminders || []).map(function (r) {
    return [r.name || '', r.type === 'income' ? 'Ingreso' : 'Gasto', Number(r.amount) || 0, r.freq === 'once' ? 'Una vez' : 'Mensual', r.from || '', r.until || '',
      r.account || '', r.category || '', r.sub || '', (r.tags || []).join(', '),
      (r.changes || []).map(function (c) { return c.from + ': ' + c.amount; }).join(' · '), r.id || ''];
  });
  var rs = tab(doc, 'Recordatorios', rh);
  if (rrows.length) rs.getRange(2, 1, rrows.length, rh.length).setValues(rrows);

  var ah = ['Cuenta', 'Tipo', 'Moneda', 'SaldoInicial', 'EnTotal', 'Cierre', 'Vencimiento', 'Descripcion'];
  var arows = (db.accounts || []).map(function (a) {
    return [a.name || '', a.type || '', a.currency || 'ARS', Number(a.initial) || 0, a.includeInTotal === false ? 'No' : 'Sí', a.cierre || '', a.venc || '', a.desc || ''];
  });
  var as = tab(doc, 'Cuentas', ah);
  if (arows.length) as.getRange(2, 1, arows.length, ah.length).setValues(arows);

  var ph = ['Producto', 'Tipo', 'Variedad', 'Marca', 'Tamaño', 'Unidad', 'Alias', 'Id'];
  var prows = (db.products || []).filter(function (p) { return !p.mergedInto; }).map(function (p) {
    return [p.name || '', p.kind || '', p.variety || '', p.brand || '', p.size || '', p.unit || 'u', (p.aliases || []).join(' | '), p.id || ''];
  });
  var ps = tab(doc, 'Productos', ph);
  if (prows.length) ps.getRange(2, 1, prows.length, ph.length).setValues(prows);

  var lh = ['Préstamo', 'Presta', 'Cuenta', 'Recibido', 'Moneda', 'EntraEn', 'Fecha', 'TotalADevolver', 'Cuotas', 'Cuota', 'InteresTotal', 'PrimeraCuota', 'PagaDesde', 'Id'];
  var lrows = (db.loans || []).map(function (l) {
    return [l.name || '', l.lender || '', l.account || '', Number(l.received) || 0, l.currency || 'ARS', l.inAccount || '', l.date || '', Number(l.totalToRepay) || 0, Number(l.n) || 0, Number(l.cuota) || 0, Number(l.interestTotal) || 0, l.firstMonth || '', l.payFrom || '', l.id || ''];
  });
  var lsh = tab(doc, 'Préstamos', lh);
  if (lrows.length) lsh.getRange(2, 1, lrows.length, lh.length).setValues(lrows);
}
