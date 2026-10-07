/* ---------- cloud sync (Apps Script v6: blob + token) ---------- */
// Transporte: GET ?action=X&token=T  |  POST text/plain con {action, token, ...} (sin preflight CORS).
// El servidor siempre responde HTTP 200; se decide por j.ok. Errores: {ok:false, code, error}.
function setSyncSt(t){const st=$('#sync-status');if(st)st.textContent=t;}
function syncStatus(){setSyncSt(CFG.syncUrl?('Estado: configurado'+(CFG.syncAuto?' · auto':'')):'Estado: sin configurar');}
function readSyncForm(){CFG.syncUrl=$('#sync-url').value.trim();CFG.syncToken=$('#sync-token').value.trim();CFG.syncAuto=$('#sync-auto').classList.contains('on');saveCfg();}
function openSync(){$('#menu').classList.remove('on');$('#sync-url').value=CFG.syncUrl||'';$('#sync-token').value=CFG.syncToken||'';$('#sync-auto').classList.toggle('on',!!CFG.syncAuto);syncStatus();$('#ai-status').textContent='';$('#syncScrim').classList.add('on');if(CFG.syncUrl)apiPing().then(j=>{if(j&&j.ok)$('#ai-status').textContent='Servidor '+j.version+' · IA '+(j.ai?('activa ('+j.model+')'):'no configurada');else if(j&&j.code==='AUTH')$('#ai-status').textContent='Token inválido';}).catch(()=>{});}
$('#syncBtn').onclick=openSync;
$('#closeSync').onclick=()=>$('#syncScrim').classList.remove('on');$('#syncScrim').onclick=e=>{if(e.target===$('#syncScrim'))$('#syncScrim').classList.remove('on');};
$('#sync-auto').onclick=()=>{const on=!$('#sync-auto').classList.contains('on');$('#sync-auto').classList.toggle('on',on);CFG.syncAuto=on;saveCfg();syncStatus();toast(on?'Sincronización automática activada':'Sincronización automática desactivada');};
$('#syncSaveUrl').onclick=()=>{readSyncForm();syncStatus();toast('Configuración guardada');};

async function apiPost(action,body){const r=await fetch(CFG.syncUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token:CFG.syncToken},body||{}))});return r.json();}
async function apiGet(action,params){const u=new URL(CFG.syncUrl);u.searchParams.set('action',action);u.searchParams.set('token',CFG.syncToken);Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u.toString());return r.json();}
function apiPing(){return apiGet('ping');}
function apiErrMsg(j){if(!j)return 'respuesta vacía';if(j.code==='AUTH')return 'token inválido';return j.error||j.code||'error';}

// Antes de escribir por primera vez verificamos que la URL sea del Apps Script v6 (el script viejo guardaría cualquier cosa que le mandemos).
let _verified=false;
async function ensureServer(silent){if(_verified)return true;try{const j=await apiPing();if(j&&j.ok&&/^gas-6/.test(j.version||'')){_verified=true;return true;}
  if(!silent)toast(j&&j.code==='AUTH'?'Token inválido':'Esa URL no es del Apps Script v6 (ver docs/migration.md)');return false;}
  catch(e){if(!silent)toast('Sin conexión o URL inválida');return false;}}

async function cloudPush(silent,_retry){
  if(silent){if(!CFG.syncUrl)return;}else{readSyncForm();if(!CFG.syncUrl){toast('Pegá primero la URL');return;}}
  if(!silent)setSyncSt('Estado: subiendo…');
  if(!(await ensureServer(silent))){setSyncSt('Estado: servidor no verificado');return;}
  try{const j=await apiPost('blob',{db:DB});
    if(j&&j.ok){setSyncSt('Estado: subido '+new Date().toLocaleString('es-AR'));if(!silent)toast('Datos en la nube ✓');return;}
    if(j&&j.code==='STALE'&&!_retry){ // la nube tiene algo más nuevo: fusionamos y volvemos a subir
      const cj=await apiGet('blob');if(cj&&Array.isArray(cj.tx)){DB=mergeDB(DB,cj);DB.updatedAt=Date.now();Store.save(DB);render();return cloudPush(silent,true);}}
    const m=': '+apiErrMsg(j);setSyncSt('Estado: error'+m);if(!silent)toast('No se pudo subir'+m);}
  catch(e){setSyncSt('Estado: error de conexión ('+(e.message||e)+')');if(!silent)toast('Revisá la URL y que esté publicada para "Cualquier persona"');}}

async function cloudPull(silent){if(!silent)readSyncForm();if(!CFG.syncUrl){if(!silent)toast('Pegá primero la URL');return false;}
  const localTime=DB.updatedAt||0;
  try{const j=await apiGet('blob');
    if(j&&j.ok===false){if(!silent)toast('No se pudo bajar: '+apiErrMsg(j));return false;}
    if(j&&Array.isArray(j.tx)){
      const cloudTime=j.updatedAt||0;
      // PROTECCIÓN anti-borrado: una nube vacía NUNCA pisa datos buenos del teléfono.
      if(j.tx.length===0&&DB.tx.length>0){
        if(silent){if(CFG.syncAuto)cloudPush(true);}
        else toast('La nube está vacía: no piso tus datos. Tocá Subir ▲ para arreglarla.');
        return false;}
      if(silent&&cloudTime<localTime){ // SOLO en automático: no pisar lo nuevo con lo viejo
        if(CFG.syncAuto)cloudPush(true);
        return false;}
      if(silent&&cloudTime===localTime)return true;
      DB=normalize(j);DB.updatedAt=cloudTime;
      Store.save(DB);render();syncStatus();if(!silent)toast(DB.tx.length+' movimientos desde la nube ✓');return true;}
    else if(!silent)toast('La nube está vacía; subí primero');}
  catch(e){if(!silent)toast('Sin conexión o URL inválida');}
  return false;}
$('#syncPush').onclick=()=>cloudPush(false);$('#syncPull').onclick=()=>cloudPull(false);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&CFG.syncUrl&&CFG.syncAuto)cloudPull(true);});
