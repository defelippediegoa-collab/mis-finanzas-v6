/**
 * Bandeja de entrada (Inbox): movimientos que llegan desde afuera del teléfono (bot de WhatsApp).
 * Viven en la pestaña "Inbox" del Sheet hasta que la app los confirma (inboxDone). Nunca tocan el blob.
 *
 * Fila: id | createdAt | status (pending|done|discarded) | doneAt | source | json
 * InboxItem: { id, createdAt, status, source:'wa', from, complete:boolean,
 *              draft:{type, amount, currency, account, category, sub, note, date, dueMonth?, inst?:[1,N], merchant?, items?},
 *              raw:{text?, mediaId?, mime?} }
 */
var INBOX_HEADER = ['id', 'createdAt', 'status', 'doneAt', 'source', 'json'];

function inboxSheet() {
  var doc = sheetDoc();
  var sh = doc.getSheetByName('Inbox');
  if (!sh) {
    sh = doc.insertSheet('Inbox');
    sh.getRange(1, 1, 1, INBOX_HEADER.length).setValues([INBOX_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function inboxRows(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, INBOX_HEADER.length).getValues();
}
function inboxList(status) {
  var sh = inboxSheet();
  var items = [];
  inboxRows(sh).forEach(function (r) {
    if (!r[0]) return;
    if (status && status !== 'all' && r[2] !== status) return;
    var it; try { it = JSON.parse(r[5] || '{}'); } catch (x) { it = { draft: {}, corrupt: true }; }
    it.id = r[0]; it.createdAt = Number(r[1]) || 0; it.status = r[2]; it.source = r[4] || it.source || 'wa';
    items.push(it);
  });
  items.sort(function (a, b) { return a.createdAt - b.createdAt; });
  return { ok: true, items: items };
}
function inboxAppend(items) {
  if (!Array.isArray(items) || !items.length) return err('BAD_REQUEST', 'items vacío');
  if (items.length > 50) return err('BAD_REQUEST', 'máximo 50 items por llamada');
  var sh = inboxSheet();
  var now = Date.now(), ids = [], rows = [];
  items.forEach(function (it, i) {
    if (!it || typeof it !== 'object' || !it.draft) { return; }
    var id = it.id || ('wa_' + now + '_' + i + '_' + Math.floor(Math.random() * 9000 + 1000));
    var rec = { id: id, createdAt: it.createdAt || now, status: 'pending', source: it.source || 'wa', from: it.from || '', complete: !!it.complete, draft: it.draft, raw: it.raw || {} };
    ids.push(id);
    rows.push([id, rec.createdAt, 'pending', '', rec.source, JSON.stringify(rec)]);
  });
  if (!rows.length) return err('BAD_REQUEST', 'ningún item válido (falta draft)');
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, INBOX_HEADER.length).setValues(rows);
  return { ok: true, ids: ids };
}
function inboxDone(ids, status) {
  if (!Array.isArray(ids) || !ids.length) return err('BAD_REQUEST', 'ids vacío');
  if (status !== 'done' && status !== 'discarded') return err('BAD_REQUEST', 'status debe ser done o discarded');
  var sh = inboxSheet();
  var rows = inboxRows(sh), want = {}, updated = 0, missing = ids.slice();
  ids.forEach(function (id) { want[id] = true; });
  for (var i = 0; i < rows.length; i++) {
    var id = rows[i][0];
    if (want[id]) {
      sh.getRange(i + 2, 3, 1, 2).setValues([[status, Date.now()]]);
      updated++;
      missing.splice(missing.indexOf(id), 1);
    }
  }
  return { ok: true, updated: updated, missing: missing };
}
/** Opcional: instalar como trigger semanal para limpiar filas viejas ya procesadas. */
function inboxPurgeOld() {
  var sh = inboxSheet(), rows = inboxRows(sh), limit = Date.now() - 90 * 86400000;
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i][2] !== 'pending' && Number(rows[i][1]) < limit) sh.deleteRow(i + 2);
  }
}
