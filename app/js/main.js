/* ---------- boot ---------- */
if(DB._migratedFromV4){delete DB._migratedFromV4;setTimeout(()=>toast('Datos migrados desde la versión anterior ✓'),600);}
Store.save(DB);setView('trans');
$('#greetDate').textContent=new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
$('#verLbl').textContent='Versión v'+APP_VERSION;
if(CFG.syncUrl&&CFG.syncAuto)cloudPull(true);
pollInbox(true);handleShare();
// Si la app quedó abierta y cambió el día, recargamos para que "hoy" y los meses actuales no queden congelados.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&localDate()!==BOOT_DATE)location.reload();});
// Service worker con aviso de versión nueva (el usuario decide cuándo actualizar).
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){
  navigator.serviceWorker.register('sw.js').then(reg=>{
    const offer=()=>{const w=reg.waiting;if(!w)return;const bar=$('#updBar');bar.classList.remove('hidden');bar.onclick=()=>{bar.classList.add('hidden');w.postMessage('SKIP_WAITING');};};
    // Si la versión nueva se descubrió mientras arrancábamos, ya está en reg.installing: la vigilamos igual.
    const watch=w=>{if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offer();});};
    if(reg.waiting)offer();watch(reg.installing);
    reg.addEventListener('updatefound',()=>watch(reg.installing));
    reg.update().catch(()=>{});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{});});
    // Tocar "Versión vX" en el menú busca la actualización a mano
    const vl=$('#verLbl');vl.style.cursor='pointer';vl.title='Buscar actualización';
    vl.onclick=async()=>{vl.textContent='Buscando actualización…';try{await reg.update();}catch(e){}
      setTimeout(()=>{if(reg.waiting){offer();vl.textContent='Versión v'+APP_VERSION+' · hay una nueva ↑';}else if(reg.installing){vl.textContent='Descargando versión nueva…';watch(reg.installing);}else{vl.textContent='Versión v'+APP_VERSION+' · es la última';setTimeout(()=>{vl.textContent='Versión v'+APP_VERSION;},2500);}},1500);};
  }).catch(()=>{});
  let _reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(_reloading)return;_reloading=true;location.reload();});
}
