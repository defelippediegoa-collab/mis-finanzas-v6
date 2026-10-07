// Service worker de Mis Finanzas v6. Subí VERSION en cada deploy: el cache viejo se borra y la app avisa "versión nueva".
const VERSION='6.2.0';
const CACHE='finanzas-'+VERSION;
const ASSETS=['./','./index.html','./manifest.webmanifest','./css/app.css',
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png',
  './js/store.js','./js/helpers.js','./js/views/trans.js','./js/views/stats.js','./js/model.js','./js/views/accounts.js','./js/views/proj.js','./js/views/detail.js','./js/views/panel.js','./js/views/cards.js','./js/nav.js','./js/io.js','./js/views/txform.js','./js/views/accform.js','./js/views/remform.js','./js/views/cats.js','./js/misc.js','./js/sync.js','./js/image.js','./js/ai.js','./js/rules.js','./js/views/ticket.js','./js/views/items.js','./js/views/inbox.js','./js/share.js','./js/main.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&x!=='share-inbox').map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const req=e.request;const u=new URL(req.url);
  if(req.method==='POST'&&u.origin===location.origin&&u.pathname.endsWith('/share-target')){ // Web Share Target
    e.respondWith((async()=>{try{const fd=await req.formData();const file=fd.get('files');const text=fd.get('text')||fd.get('title')||fd.get('url')||'';
      const c=await caches.open('share-inbox');
      if(file&&file.size)await c.put('./shared-file',new Response(file,{headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name||'compartido')}}));
      await c.put('./shared-meta',new Response(JSON.stringify({text:String(text),hasFile:!!(file&&file.size),at:Date.now()}),{headers:{'Content-Type':'application/json'}}));
    }catch(x){}return Response.redirect('./?share=1',303);})());return;}
  if(req.method!=='GET'||u.origin!==location.origin)return;
  const nav=req.mode==='navigate';
  e.respondWith(caches.match(req,{ignoreSearch:nav}).then(c=>c||fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;}).catch(()=>nav?caches.match('./index.html'):undefined)));
});
