/**
 * Mis Finanzas v6 — backend en Google Apps Script.
 *
 * Transporte: GET  ?action=X&token=T&...
 *             POST body text/plain con JSON {action, token, ...}   (sin preflight CORS)
 * Siempre HTTP 200 (ContentService no permite otro código): el cliente decide por `ok`.
 * Errores: {ok:false, code:'AUTH'|'BAD_REQUEST'|'STALE'|'NOT_FOUND'|'AI_UNCONFIGURED'|'AI_ERROR'|'AI_TIMEOUT'|'LOCK'|'INTERNAL', error}
 *
 * Script Properties: API_TOKEN (obligatorio), SHEET_ID (obligatorio),
 *                    ANTHROPIC_API_KEY (opcional), AI_MODEL (default claude-opus-5-5), AI_EFFORT (default low),
 *                    BLOB_FILE_ID (se crea solo).
 */
var VERSION = 'gas-6.0';
var PROPS = PropertiesService.getScriptProperties();

function respond(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function err(code, msg, detail) {
  var o = { ok: false, code: code, error: msg };
  if (detail !== undefined) o.detail = detail;
  return o;
}
function auth(token) {
  var want = PROPS.getProperty('API_TOKEN');
  return !!want && token === want;
}
function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return err('LOCK', 'el servidor está ocupado, probá de nuevo');
  try { return fn(); } finally { lock.releaseLock(); }
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var action = p.action || 'blob';
    if (!auth(p.token)) return respond(err('AUTH', 'token inválido'));
    switch (action) {
      case 'ping': return respond(ping());
      case 'blob': return respond(readBlob());
      case 'meta': return respond(meta());
      case 'inbox': return respond(inboxList(p.status || 'pending'));
      default: return respond(err('BAD_REQUEST', 'acción desconocida: ' + action));
    }
  } catch (ex) {
    return respond(err('INTERNAL', String(ex && ex.message || ex)));
  }
}

function doPost(e) {
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (x) { return respond(err('BAD_REQUEST', 'JSON inválido')); }
    var action = body.action, db = body.db;
    if (!action && Array.isArray(body.tx)) { action = 'blob'; db = body; } // compatibilidad con el formato v55 (igual exige token)
    if (!auth(body.token)) return respond(err('AUTH', 'token inválido'));
    switch (action) {
      case 'blob': return respond(withLock(function () { return writeBlob(db); }));
      case 'inboxAppend': return respond(withLock(function () { return inboxAppend(body.items); }));
      case 'inboxDone': return respond(withLock(function () { return inboxDone(body.ids, body.status || 'done'); }));
      case 'ai': return respond(aiHandle(body));
      default: return respond(err('BAD_REQUEST', 'acción desconocida: ' + action));
    }
  } catch (ex) {
    return respond(err('INTERNAL', String(ex && ex.message || ex)));
  }
}

function ping() {
  return { ok: true, version: VERSION, ai: !!PROPS.getProperty('ANTHROPIC_API_KEY'), model: PROPS.getProperty('AI_MODEL') || 'claude-opus-5-5', time: new Date().toISOString() };
}

/* ---------- blob (toda la base, un JSON en Drive) ---------- */
function blobFile() {
  var id = PROPS.getProperty('BLOB_FILE_ID');
  if (id) { try { return DriveApp.getFileById(id); } catch (x) { /* se recrea abajo */ } }
  var f = DriveApp.createFile('fin_db_v5.json', JSON.stringify({ tx: [], updatedAt: 0 }), MimeType.PLAIN_TEXT);
  try { // lo dejamos junto al Sheet, si se puede
    var sh = DriveApp.getFileById(PROPS.getProperty('SHEET_ID'));
    var parents = sh.getParents();
    if (parents.hasNext()) { var folder = parents.next(); f.moveTo(folder); }
  } catch (x) { }
  PROPS.setProperty('BLOB_FILE_ID', f.getId());
  return f;
}
function readBlobRaw() {
  var txt = blobFile().getBlob().getDataAsString();
  var d; try { d = JSON.parse(txt || '{}'); } catch (x) { d = {}; }
  if (!Array.isArray(d.tx)) d.tx = [];
  d.updatedAt = d.updatedAt || 0;
  return d;
}
function readBlob() {
  var d = readBlobRaw();
  if (!d.tx.length) d.empty = true;
  return d;
}
function writeBlob(db) {
  if (!db || !Array.isArray(db.tx)) return err('BAD_REQUEST', 'falta db.tx');
  var cur = readBlobRaw();
  if (cur.updatedAt && db.updatedAt && db.updatedAt < cur.updatedAt && cur.tx.length) {
    return err('STALE', 'la nube tiene datos más nuevos', { serverUpdatedAt: cur.updatedAt });
  }
  delete db.empty; delete db.syncUrl; delete db.syncAuto; delete db.token; delete db.action;
  db.updatedAt = db.updatedAt || Date.now();
  blobFile().setContent(JSON.stringify(db));
  var sheets = 'ok';
  try { writeSheets(db); } catch (x) { sheets = 'error: ' + (x && x.message || x); }
  return { ok: true, updatedAt: db.updatedAt, tx: db.tx.length, sheets: sheets };
}

/* ---------- meta (lo que necesita el bot para ofrecer opciones) ---------- */
function meta() {
  var d = readBlobRaw();
  return {
    ok: true,
    accounts: (d.accounts || []).map(function (a) { return { name: a.name, type: a.type, currency: a.currency || 'ARS', includeInTotal: a.includeInTotal !== false }; }),
    cats: d.cats || { expense: [], income: [] },
    subs: d.subs || {},
    rules: d.rules || [],
    usdRate: d.usdRate || 0,
    updatedAt: d.updatedAt || 0
  };
}
