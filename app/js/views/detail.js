/* ---------- DETAIL: account ---------- */
function showDetail(title){detail=true;$('#hdrMonth').classList.add('hidden');$('#hdrBack').classList.remove('hidden');$('#backTitle').textContent=title;
  ['trans','stats','acc','proj'].forEach(id=>$('#view-'+id).classList.add('hidden'));$('#view-detail').classList.remove('hidden');}
function closeDetail(){detail=null;detailRefresh=null;$('#hdrBack').classList.add('hidden');$('#hdrMonth').classList.remove('hidden');$('#view-detail').classList.add('hidden');setView(view);}
$('#backBtn').onclick=closeDetail;
let detMonth=null,detCardMode='gasto';
function openAccountDetail(name){
  const a=acct(name);const isCard=a&&a.type==='Tarjetas de crédito';const c=a?a.currency:'ARS';
  if(!detMonth)detMonth=new Date(TODAY.getFullYear(),TODAY.getMonth(),1);
  const m=ym(detMonth);
  const useVenc=isCard&&detCardMode==='venc';
  const inMonth=t=>(useVenc&&t.type==='expense'&&t.account===name)?payMonthOf(t)===m:ymOf(t.date)===m;
  const list=DB.tx.filter(t=>(t.account===name||t.from===name||t.to===name)&&inMonth(t)).sort((x,y)=>y.date.localeCompare(x.date));
  let dep=0,ret=0;
  list.forEach(t=>{if(t.type==='income'&&t.account===name)dep+=t.amount;else if(t.type==='expense'&&t.account===name)ret+=t.amount;else if(t.type==='transfer'){if(t.to===name)dep+=(t.amountTo!=null?t.amountTo:t.amount);if(t.from===name)ret+=t.amount;}});
  let h='';
  if(isCard){const s=cardSaldos(name);const tot=-totalOwed(name);
    h+='<div class="dhero"><div class="dl">'+name+' · deuda total</div><div class="dv neg">'+money(tot,c)+'</div>'+
      '<div style="display:flex;gap:18px;margin-top:10px">'+
      '<div><div class="dl">Vencido · a pagar</div><div style="font-weight:700;color:var(--expense)">'+money(s.aPagar,c)+'</div></div>'+
      '<div><div class="dl">Próximo vencimiento</div><div style="font-weight:700;color:var(--expense)">'+money(s.restante,c)+'</div></div></div></div>';
    h+='<div class="editbtn" id="payCardBtn" style="background:var(--accent);color:#fff;border:none">Pagar tarjeta (liquidación)</div>';
  } else {const b=liveBalance(name);h+='<div class="dhero"><div class="dl">'+name+(a?(' · '+a.type):'')+'</div><div class="dv '+sgn(b)+'">'+money(b,c)+'</div></div>';}
  h+='<div class="editbtn" id="editAccBtn">Editar cuenta</div>';
  if(isCard)h+='<div class="cardmode"><button class="cm'+(detCardMode==='gasto'?' on':'')+'" id="cmGasto">Mes de gasto</button><button class="cm'+(detCardMode==='venc'?' on':'')+'" id="cmVenc">Mes de vencimiento</button></div>';
  h+='<div class="detnav"><button id="detPrev">‹</button><span>'+monthName(detMonth)+(useVenc?' · venc.':'')+'</span><button id="detNext">›</button></div>';
  h+='<div class="detsum"><div><small>Depósito</small><div class="sv pos">'+money(dep,c)+'</div></div><div><small>Retiro</small><div class="sv neg">'+money(ret,c)+'</div></div><div><small>Balance</small><div class="sv '+sgn(dep-ret)+'">'+money(dep-ret,c)+'</div></div></div>';
  h+=list.length?dayGroups(list):'<div class="empty" style="padding:22px">Sin movimientos en '+monthName(detMonth)+'.</div>';
  $('#detailBody').innerHTML=h;showDetail(name);detailRefresh=()=>openAccountDetail(name);
  $('#editAccBtn').onclick=()=>openAcc(name);
  if(isCard)$('#payCardBtn').onclick=()=>payCard(name);
  if(isCard){$('#cmGasto').onclick=()=>{detCardMode='gasto';openAccountDetail(name);};$('#cmVenc').onclick=()=>{detCardMode='venc';openAccountDetail(name);};}
  $('#detPrev').onclick=()=>{detMonth=new Date(detMonth.getFullYear(),detMonth.getMonth()-1,1);openAccountDetail(name);};
  $('#detNext').onclick=()=>{detMonth=new Date(detMonth.getFullYear(),detMonth.getMonth()+1,1);openAccountDetail(name);};
  bindTx('#detailBody');
}
function payCard(name){const s=cardSaldos(name);const amt=s.aPagar||totalOwed(name);
  const from=DB.accounts.find(x=>(x.type==='Cuentas'||x.type==='Efectivo')&&x.currency===curOf(name));
  openSheet(null,{type:'transfer',to:name,from:from?from.name:'',amount:amt,note:'liquidación'});}
/* ---------- DETAIL: category ---------- */
function openCategoryDetail(cat){
  const m=ym(cur);const rows=DB.tx.filter(t=>t.type===statKind&&t.category===cat&&ymOf(t.date)===m&&isARS(t));
  const total=rows.reduce((s,t)=>s+t.amount,0);
  const by={};rows.forEach(t=>{const k=t.sub||'(sin subcategoría)';by[k]=(by[k]||0)+t.amount;});
  const arr=Object.entries(by).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);
  // trend last 6 months
  const vals=[],labs=[];for(let i=5;i>=0;i--){const d=new Date(cur.getFullYear(),cur.getMonth()-i,1);const mm=ym(d);labs.push(d.toLocaleDateString('es-AR',{month:'short'}).replace('.',''));vals.push(DB.tx.filter(t=>t.type===statKind&&t.category===cat&&ymOf(t.date)===mm&&isARS(t)).reduce((s,t)=>s+t.amount,0));}
  let h='<div class="dhero"><div class="dl">'+cat+' · '+monthName(cur)+'</div><div class="dv">'+money(total)+'</div></div>';
  h+=arr.map(a=>'<div class="subrow"><div class="sp">'+(total?(a.v/total*100).toFixed(0)+'%':'-')+'</div><div class="snm">'+a.k+'</div><div class="svv">'+money(a.v)+'</div></div>').join('');
  h+='<div style="padding:14px 16px 4px">'+lineSVG(vals)+'</div><div style="display:flex;justify-content:space-between;padding:0 24px 10px;color:var(--muted);font-size:11px">'+labs.map(l=>'<span>'+l+'</span>').join('')+'</div>';
  h+=rows.length?dayGroups(rows):'';
  $('#detailBody').innerHTML=h;showDetail(cat);bindTx('#detailBody');detailRefresh=()=>openCategoryDetail(cat);
}

