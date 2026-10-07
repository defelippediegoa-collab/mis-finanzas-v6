/* ---------- ÍTEMS: cuánto gasto por producto (desde tickets) ---------- */
let itemsShowAll=false;
function itemRowsAll(){const out=[];DB.tx.forEach(t=>{if(t.type!=='expense'||!Array.isArray(t.items))return;t.items.forEach(i=>{if(i.discount||!(i.amount>0))return;out.push({t,i,key:i.key||normKey(i.desc),ars:toARS(i.amount,t.currency||'ARS')||0});});});return out;}
function renderItemStats(){
  const m=ym(cur);const by={};
  itemRowsAll().forEach(r=>{if(ymOf(r.t.date)!==m)return;const o=by[r.key]||(by[r.key]={key:r.key,desc:r.i.desc,v:0,n:0});o.v+=r.ars;o.n++;});
  const rows=Object.values(by).sort((a,b)=>b.v-a.v);
  const el=$('#st-items');if(!el)return;
  if(!rows.length){el.innerHTML='';return;}
  const max=rows[0].v,tot=rows.reduce((s,r)=>s+r.v,0);const show=itemsShowAll?rows:rows.slice(0,10);
  let h='<div class="pj-sec"><span>🧾 Ítems del mes <small style="color:var(--muted2)">· '+rows.length+' productos · '+money(tot)+'</small></span></div><div class="catlist" style="margin-bottom:14px">';
  show.forEach(r=>{h+='<div class="catrow" data-key="'+esc(r.key)+'"><div class="crtop"><span>'+esc(r.desc)+(r.n>1?' <small style="color:var(--muted2)">×'+r.n+'</small>':'')+' ›</span><b class="neg">'+money(r.v)+'</b></div><div class="crbar"><i style="width:'+Math.round(r.v/max*100)+'%"></i></div></div>';});
  if(rows.length>10)h+='<div class="hint" style="text-align:center;padding:6px"><a href="#" id="itemsMore">'+(itemsShowAll?'ver menos':'ver los '+rows.length)+'</a></div>';
  h+='</div>';el.innerHTML=h;
  el.querySelectorAll('.catrow').forEach(x=>x.onclick=()=>openItemDetail(x.dataset.key));
  const more=$('#itemsMore');if(more)more.onclick=e=>{e.preventDefault();itemsShowAll=!itemsShowAll;renderItemStats();};
}
function openItemDetail(key){
  const rows=itemRowsAll().filter(r=>r.key===key).sort((a,b)=>b.t.date.localeCompare(a.t.date));
  if(!rows.length)return;
  const desc=rows[0].i.desc;const tot=rows.reduce((s,r)=>s+r.ars,0),qty=rows.reduce((s,r)=>s+(r.i.qty||1),0);
  const unitPrices=rows.filter(r=>r.i.unitPrice>0).map(r=>({d:r.t.date,p:toARS(r.i.unitPrice,r.t.currency||'ARS')||0}));
  const last=unitPrices[0],first=unitPrices[unitPrices.length-1];
  let h='<div class="debtlist">';
  let mrows='';let sum6=0,n6=0;
  for(let i=5;i>=0;i--){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()-i,1);const mm=ym(d);
    const v=rows.filter(r=>ymOf(r.t.date)===mm).reduce((s,r)=>s+r.ars,0);if(v>0){sum6+=v;n6++;}
    mrows+='<div class="finrow"><span style="text-transform:capitalize">'+d.toLocaleDateString('es-AR',{month:'long'})+'</span><span class="'+(v>0?'neg':'')+'" style="'+(v>0?'':'color:var(--muted2)')+'">'+(v>0?money(v):'—')+'</span></div>';}
  h+='<div class="finhead" style="border-top:none;padding-top:8px">Últimos 6 meses · promedio '+money(n6?sum6/n6:0)+'/mes</div>'+mrows;
  h+='<div class="debttot" style="padding:10px 16px"><span>Total histórico ('+rows.length+' compras · '+(Math.round(qty*100)/100)+' '+(rows[0].i.unit||'u')+')</span><span class="neg">'+money(tot)+'</span></div>';
  if(last){h+='<div class="finhead">Precio unitario</div><div class="finrow"><span>Último ('+last.d+')</span><span>'+money(last.p)+'</span></div>';
    if(first&&first.d!==last.d){const var_=first.p?((last.p-first.p)/first.p*100):0;h+='<div class="finrow"><span>Primero registrado ('+first.d+')</span><span>'+money(first.p)+' <small class="'+(var_>0?'neg':'pos')+'">'+(var_>0?'+':'')+var_.toFixed(0)+'%</small></span></div>';}}
  h+='<div class="finhead">Compras</div>';
  rows.slice(0,40).forEach(r=>{h+='<div class="debtrow" data-id="'+esc(r.t.id)+'"><div class="dinfo"><div class="dn">'+esc(r.t.merchant||stripInst(r.t.note)||r.t.account||'—')+'</div><div class="ds">'+r.t.date+' · '+(r.i.qty||1)+' '+(r.i.unit||'u')+(r.i.unitPrice?' × '+money(r.i.unitPrice,r.t.currency||'ARS'):'')+' · '+esc(r.t.account||'')+'</div></div><div class="damt neg">'+money(r.i.amount,r.t.currency||'ARS')+'</div></div>';});
  if(rows.length>40)h+='<div class="ds" style="padding:8px 16px 4px;color:var(--muted2)">…y '+(rows.length-40)+' más</div>';
  h+='</div>';
  $('#cardDetTitle').textContent=desc;$('#cardDetBody').innerHTML=h;$('#cardDetScrim').classList.add('on');
  $('#cardDetBody').querySelectorAll('.debtrow[data-id]').forEach(el=>el.onclick=()=>{$('#cardDetScrim').classList.remove('on');openTicket({editId:el.dataset.id});});
}
