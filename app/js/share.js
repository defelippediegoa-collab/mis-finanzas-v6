/* ---------- Compartir a la app (Web Share Target) ---------- */
// El SW intercepta el POST a ./share-target, guarda el archivo/texto en el cache 'share-inbox' y redirige a ./?share=1
async function handleShare(){
  const u=new URL(location.href);if(u.searchParams.get('share')!=='1')return;
  history.replaceState(null,'',u.pathname);
  try{const c=await caches.open('share-inbox');
    const metaR=await c.match('./shared-meta'),fileR=await c.match('./shared-file');
    const meta=metaR?await metaR.json():{};let file=null;
    if(fileR){const b=await fileR.blob();const name=decodeURIComponent(fileR.headers.get('X-File-Name')||'compartido');file=new File([b],name,{type:fileR.headers.get('Content-Type')||b.type||''});}
    await c.delete('./shared-meta');await c.delete('./shared-file');
    if(file){openTicket({file,source:'share'});return;}
    const text=(meta.text||'').trim();if(text)shareText(text);
  }catch(e){toast('No se pudo leer lo compartido');}
}
// Texto compartido (ej. desde WhatsApp): con IA se interpreta; sin IA va a la nota del formulario.
async function shareText(text){
  const info=await aiInfo();
  if(info.ai){toast('Interpretando…');
    try{const r=await aiParse(text);
      openSheet(null,{type:r.type||'expense',amount:r.amount||'',account:r.account||undefined,category:r.category||undefined,sub:r.sub||undefined,note:r.note||text.slice(0,80),date:r.date||localDate()});
      if(r.missing&&r.missing.length)setTimeout(()=>toast('Completá: '+r.missing.join(', ')),300);return;}
    catch(e){}}
  openSheet(null,{type:'expense',note:text.slice(0,80)});
}
