/**
 * action=ai — proxy a la API de Claude. La clave vive en Script Properties (ANTHROPIC_API_KEY), nunca en el HTML.
 *
 * Request: {action:'ai', token, task:'ticket'|'parse', model?, effort?, ...campos de la tarea}
 *   ticket: {image:{media_type:'image/jpeg'|'image/png'|'image/webp'|'application/pdf', data:<base64>}, hint?:{date:'YYYY-MM-DD'}}
 *   parse : {text:'1500 super galicia', meta:{accounts:[nombres], cats:{expense,income}, subs:{}}, today:'YYYY-MM-DD'}
 * Response: {ok:true, task, result:{...}, usage:{input_tokens,output_tokens}, model}
 */
var AI_URL = 'https://api.anthropic.com/v1/messages';
var AI_DEFAULT_MODEL = 'claude-opus-5-5';
var AI_MAX_B64 = 6 * 1024 * 1024; // ~4,5 MB de archivo

function aiHandle(body) {
  var key = PROPS.getProperty('ANTHROPIC_API_KEY');
  if (!key) return err('AI_UNCONFIGURED', 'no hay ANTHROPIC_API_KEY en Script Properties');
  var task = body.task;
  var model = (body.model && /^claude-[a-z0-9.-]+$/.test(body.model)) ? body.model : (PROPS.getProperty('AI_MODEL') || AI_DEFAULT_MODEL);
  var effort = body.effort || PROPS.getProperty('AI_EFFORT') || 'low';
  if (['low', 'medium', 'high', 'xhigh', 'max'].indexOf(effort) < 0) effort = 'low';

  var system, schema, content, maxTokens;
  if (task === 'ticket') {
    var img = body.image;
    if (!img || !img.data || !img.media_type) return err('BAD_REQUEST', 'falta image.data / image.media_type');
    var data = String(img.data).replace(/\s+/g, '');
    if (data.length > AI_MAX_B64) return err('BAD_REQUEST', 'archivo demasiado grande (máx ~4,5 MB)');
    var isPdf = img.media_type === 'application/pdf';
    if (!isPdf && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].indexOf(img.media_type) < 0) return err('BAD_REQUEST', 'formato no soportado: ' + img.media_type);
    system = TICKET_SYSTEM; schema = TICKET_SCHEMA; maxTokens = 4096;
    content = [
      isPdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: data } }
            : { type: 'image', source: { type: 'base64', media_type: img.media_type, data: data } },
      { type: 'text', text: 'Extraé este comprobante.' + (body.hint && body.hint.date ? ' Si la fecha no se lee, usá ' + body.hint.date + '.' : '') }
    ];
  } else if (task === 'parse') {
    if (!body.text) return err('BAD_REQUEST', 'falta text');
    var m = body.meta || {};
    system = PARSE_SYSTEM; schema = PARSE_SCHEMA; maxTokens = 1024;
    content = [{ type: 'text', text:
      'Hoy es ' + (body.today || Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd')) + '.\n' +
      'Cuentas: ' + JSON.stringify(m.accounts || []) + '\n' +
      'Categorías: ' + JSON.stringify(m.cats || {}) + '\n' +
      'Subcategorías por categoría: ' + JSON.stringify(m.subs || {}) + '\n\n' +
      'Mensaje: ' + String(body.text).slice(0, 500) }];
  } else {
    return err('BAD_REQUEST', 'task desconocida: ' + task);
  }

  var payload = {
    model: model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: content }],
    output_config: { effort: effort, format: { type: 'json_schema', schema: schema } },
    fallbacks: 'default'
  };
  var res = callAnthropic(key, payload);
  if (!res.ok) return res;
  return { ok: true, task: task, result: res.result, usage: res.usage, model: res.model };
}

function callAnthropic(key, payload) {
  var r;
  try {
    r = UrlFetchApp.fetch(AI_URL, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      payload: JSON.stringify(payload)
    });
  } catch (x) {
    var msg = String(x && x.message || x);
    return err(/timed out|timeout/i.test(msg) ? 'AI_TIMEOUT' : 'AI_ERROR', msg);
  }
  var code = r.getResponseCode(), txt = r.getContentText();
  var j; try { j = JSON.parse(txt); } catch (x) { j = null; }
  if (code !== 200) return err('AI_ERROR', (j && j.error && j.error.message) || ('HTTP ' + code), txt.slice(0, 500));
  if (j.stop_reason === 'refusal') return err('AI_ERROR', 'el modelo rechazó el pedido', j.stop_details || null);
  if (j.stop_reason === 'max_tokens') return err('AI_ERROR', 'respuesta truncada (max_tokens)');
  var text = '';
  (j.content || []).forEach(function (b) { if (b.type === 'text') text += b.text; });
  var result; try { result = JSON.parse(text); } catch (x) { return err('AI_ERROR', 'la respuesta no es JSON válido', text.slice(0, 500)); }
  return { ok: true, result: result, usage: j.usage || {}, model: j.model || payload.model };
}
