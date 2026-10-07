// Service worker de Mis Finanzas v6. Subí VERSION en cada deploy: el cache viejo se borra y la app avisa "versión nueva".
const VERSION='6.0.0';
const CACHE='finanzas-'+VERSION;
const ASSETS=['./','./index.html','./manifest.webmanifest','./css/app.css',
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png',
  './js/store.js','./js/helpers.js','./js/views/trans.js','./js/views/stats.js','./js/model.js','./js/views/accounts.js','./js/views/proj.js','./js/views/detail.js','./js/views/panel.js','./js/views/cards.js','./js/nav.js','./js/io.js','./js/views/txform.js','./js/views/accform.js','./js/views/remform.js','./js/views/cats.js','./js/misc.js','./js/sync.js','./js/main.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&x!=='share-inbox').map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const req=e.request;const u=new URL(req.url);
  if(req.method!=='GET'||u.origin!==location.origin)return;
  const nav=req.mode==='navigate';
  e.respondWith(caches.match(req,{ignoreSearch:nav}).then(c=>c||fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;}).catch(()=>nav?caches.match('./index.html'):undefined)));
});
