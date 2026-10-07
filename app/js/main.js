/* ---------- boot ---------- */
if(DB._migratedFromV4){delete DB._migratedFromV4;setTimeout(()=>toast('Datos migrados desde la versión anterior ✓'),600);}
Store.save(DB);setView('trans');
$('#greetDate').textContent=new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
$('#verLbl').textContent='Versión v'+APP_VERSION;
if(CFG.syncUrl&&CFG.syncAuto)cloudPull(true);
// Si la app quedó abierta y cambió el día, recargamos para que "hoy" y los meses actuales no queden congelados.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&localDate()!==BOOT_DATE)location.reload();});
// Service worker con aviso de versión nueva (el usuario decide cuándo actualizar).
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){
  navigator.serviceWorker.register('sw.js').then(reg=>{
    const offer=()=>{const w=reg.waiting;if(!w)return;const bar=$('#updBar');bar.classList.remove('hidden');bar.onclick=()=>{bar.classList.add('hidden');w.postMessage('SKIP_WAITING');};};
    if(reg.waiting)offer();
    reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)offer();});});
  }).catch(()=>{});
  let _reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(_reloading)return;_reloading=true;location.reload();});
}
