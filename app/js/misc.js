/* ---------- dollar rate ---------- */
function openRate(){$('#rateNow').textContent=money(DB.usdRate||1000)+' / US$';$('#rateMeta').textContent=DB.rateInfo||'Cargado manualmente';$('#rateInput').value=DB.usdRate||'';$('#rateScrim').classList.add('on');$('#menu').classList.remove('on');}
$('#rateBtn').onclick=openRate;
$('#closeRate').onclick=()=>$('#rateScrim').classList.remove('on');$('#rateScrim').onclick=e=>{if(e.target===$('#rateScrim'))$('#rateScrim').classList.remove('on');};
$('#rateSave').onclick=()=>{const v=parseFloat($('#rateInput').value);if(!v||v<=0){toast('Poné un valor');return;}DB.usdRate=v;DB.rateInfo='Cargado manualmente';persist();openRate();render();toast('Tipo de cambio guardado');};
$('#rateFetch').onclick=async()=>{toast('Consultando Banco Nación...');try{const r=await fetch('https://dolarapi.com/v1/dolares/oficial');const j=await r.json();const v=j.venta||j.compra;if(v){DB.usdRate=v;DB.rateInfo='Banco Nación · '+new Date().toLocaleDateString('es-AR');persist();openRate();render();toast('Actualizado: '+money(v));}else toast('No se obtuvo la cotización');}catch(e){toast('Sin conexión; cargalo manual');}};

/* ---------- reminders shortcut ---------- */
$('#remindersBtn').onclick=()=>{$('#menu').classList.remove('on');setView('proj');toast('Tus recordatorios');};
$('#pasteRemBtn').onclick=()=>{$('#menu').classList.remove('on');$('#paste-text').value='';$('#pasteScrim').classList.add('on');};
$('#closePaste').onclick=()=>$('#pasteScrim').classList.remove('on');
$('#pasteScrim').onclick=e=>{if(e.target===$('#pasteScrim'))$('#pasteScrim').classList.remove('on');};
$('#addPaste').onclick=()=>{
  let raw=$('#paste-text').value.trim();if(!raw){toast('Pegá el código primero');return;}
  let data;try{data=JSON.parse(raw);}catch(e){toast('El código no es válido, copialo completo de Claude');return;}
  let rems=[];
  if(Array.isArray(data))rems=data;
  else if(data&&typeof data==='object'){
    if(Array.isArray(data.reminders))rems=data.reminders;
    else if(data.name)rems=[data];
  }
  const nextM=ym(new Date(TODAY.getFullYear(),TODAY.getMonth()+1,1));let nR=0;
  rems.forEach(r=>{if(!r||!r.name||!(parseFloat(r.amount)>0))return;
    const obj={id:'r'+Date.now()+'_'+(nR++),type:(r.type==='income'?'income':'expense'),name:String(r.name),amount:parseFloat(r.amount),freq:(r.freq==='once'?'once':'monthly'),from:r.from||nextM,until:r.until||'',account:r.account||'',category:r.category||'',sub:r.sub||''};
    if(Array.isArray(r.changes))obj.changes=r.changes.filter(c=>c&&c.from&&parseFloat(c.amount)>0).map(c=>({from:c.from,amount:parseFloat(c.amount)}));
    DB.reminders.push(obj);});
  if(!nR){toast('No encontré recordatorios válidos');return;}
  persist();$('#pasteScrim').classList.remove('on');setView('proj');toast(nR+(nR===1?' recordatorio agregado':' recordatorios agregados'));
};

