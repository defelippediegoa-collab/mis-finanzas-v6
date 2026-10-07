/* ---------- IA (vía Apps Script action=ai; la clave nunca está en el teléfono) ---------- */
// Estado conocido del servidor: null = no se consultó; {ai:boolean, model}
let _aiInfo=null,_aiInfoAt=0;
async function aiInfo(force){
  if(!CFG.syncUrl)return{ai:false,reason:'Configurá Sincronizar (URL y token) para usar la IA.'};
  if(!force&&_aiInfo&&Date.now()-_aiInfoAt<5*60*1000)return _aiInfo;
  try{const j=await apiPing();if(j&&j.ok){_aiInfo={ai:!!j.ai,model:j.model||'',reason:j.ai?'':'El Apps Script no tiene ANTHROPIC_API_KEY: la IA está apagada.'};}
    else _aiInfo={ai:false,reason:j&&j.code==='AUTH'?'Token inválido.':'No se pudo consultar el servidor.'};}
  catch(e){_aiInfo={ai:false,reason:'Sin conexión.'};}
  _aiInfoAt=Date.now();return _aiInfo;
}
class AiError extends Error{constructor(code,msg){super(msg);this.code=code;}}
async function aiCall(task,body){
  if(!CFG.syncUrl)throw new AiError('NO_SYNC','Configurá Sincronizar para usar la IA');
  let j;try{j=await apiPost('ai',Object.assign({task},body,CFG.aiModel?{model:CFG.aiModel}:{},CFG.aiEffort?{effort:CFG.aiEffort}:{}));}
  catch(e){throw new AiError('NET','Sin conexión con el servidor');}
  if(!j||!j.ok)throw new AiError(j&&j.code||'AI_ERROR',apiErrMsg(j));
  return j;
}
// Ticket: file (File/Blob) → {result, usage, previewUrl}
async function aiTicket(file){
  const p=await fileToAiPayload(file);
  const j=await aiCall('ticket',{image:{media_type:p.media_type,data:p.data},hint:{date:localDate()}});
  return{result:j.result,usage:j.usage,model:j.model,previewUrl:p.previewUrl};
}
// Texto libre → movimiento sugerido
async function aiParse(text){
  const meta={accounts:accountNames(),cats:DB.cats,subs:DB.subs};
  const j=await aiCall('parse',{text,meta,today:localDate()});
  return j.result;
}
