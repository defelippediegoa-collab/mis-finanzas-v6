// Fecha de compra de un movimiento: la real, o reconstruida restando (i−1) meses a la cuota (i/N)
function shiftMonthStr(dstr,k){const y=+dstr.slice(0,4),m=+dstr.slice(5,7),day=+dstr.slice(8,10);
  const tot=y*12+(m-1)+k,y2=Math.floor(tot/12),m2=tot%12;
  const last=new Date(y2,m2+1,0).getDate();const d2=Math.min(day,last);
  return y2+'-'+String(m2+1).padStart(2,'0')+'-'+String(d2).padStart(2,'0');}
function pdOf(t){if(t.purchaseDate)return t.purchaseDate;if(t.inst&&t.inst.length===2)return shiftMonthStr(t.date,-(t.inst[0]-1));return t.date;}
// Deuda total de tarjetas a una fecha dada: compras hechas hasta esa fecha (todas sus cuotas) menos pagos hasta esa fecha
function debtAtARS(D){
  const per={};DB.accounts.forEach(a=>{if(a.type==='Tarjetas de crédito'&&a.includeInTotal!==false)per[a.name]=0;});
  DB.tx.forEach(t=>{
    if(t.type==='expense'&&per[t.account]!=null){if(pdOf(t)<=D)per[t.account]+=t.amount;}
    else if(t.type==='income'&&per[t.account]!=null){if(t.date<=D)per[t.account]-=t.amount;}
    else if(t.type==='transfer'&&per[t.to]!=null){if(t.date<=D)per[t.to]-=(t.amountTo!=null?t.amountTo:t.amount);}
  });
  let s=0;Object.entries(per).forEach(([n,v])=>{s+=toARS(Math.max(0,v),curOf(n))||0;});
  return s;}
function renderCardsView(){  const cards=DB.accounts.filter(a=>a.type==='Tarjetas de crédito'&&a.includeInTotal!==false);
  const months=[];for(let i=0;i<6;i++){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()+i,1);months.push({m:ym(d),lab:d.toLocaleDateString('es-AR',{month:'short'}).replace('.','')});}
  // monto por tarjeta y mes: i=0 vencido neteado, i=1 próximo neteado, i>=2 suma cruda por mes de pago
  const cellVal=(name,i,m)=>{const s=cardSaldos(name);if(i===0)return s.aPagar;if(i===1)return s.restante;
    return DB.tx.filter(t=>t.type==='expense'&&t.account===name&&payMonthOf(t)===m).reduce((s2,t)=>s2+t.amount,0);};
  let totV=0,totP=0;
  let rows='';const colTot=new Array(6).fill(0);
  cards.forEach(a=>{
    let tds='';months.forEach((mo,i)=>{const v=cellVal(a.name,i,mo.m);const ars=toARS(v,a.currency)||0;colTot[i]+=ars;
      tds+='<td '+(v>0?'data-acc="'+esc(a.name)+'" data-m="'+mo.m+'" data-i="'+i+'" data-lab="'+mo.lab+'"':'')+' class="'+(v>0?(i===0?'neg tap':'tap'):'z')+'">'+(v>0?money(v,a.currency):'—')+'</td>';});
    rows+='<tr><th>'+esc(a.name)+'</th>'+tds+'</tr>';
  });
  totV=colTot[0];totP=colTot[1];
  let head='<tr><th></th>';months.forEach((mo,i)=>{head+='<th>'+mo.lab+(i===0?' ·venc':'')+'</th>';});head+='</tr>';
  let totrow='<tr class="tot"><th>Total ARS</th>';colTot.forEach(v=>{totrow+='<td>'+(v>0?money(v):'—')+'</td>';});totrow+='</tr>';
  let h='<div class="acchero"><div class="ahlbl">Vencido · a pagar (todas)</div><div class="big neg">'+money(totV)+'</div>'+
    '<div class="acccells"><div class="acccell"><div class="acl">Próximo venc.</div><div class="acv" style="color:var(--warn)">'+money(totP)+'</div></div>'+
    '<div class="acccell"><div class="acl">Meses siguientes</div><div class="acv">'+money(colTot.slice(2).reduce((a,b)=>a+b,0))+'</div></div></div></div>';
  // ---- Nivel de endeudamiento (evolución de la deuda total) ----
  const hoyStr=localDate(TODAY);
  const dNow=debtAtARS(hoyStr);
  const finMesPasado=new Date(TODAY.getFullYear(),TODAY.getMonth(),0);
  const dPrev=debtAtARS(localDate(finMesPasado));
  const delta=dNow-dPrev;
  const compras=DB.tx.filter(t=>t.type==='expense'&&isCard(t.account)&&ymOf(pdOf(t))===MESACTUAL).reduce((s,t)=>s+(toARS(t.amount,t.currency||'ARS')||0),0);
  const pagosM=DB.tx.filter(t=>((t.type==='transfer'&&isCard(t.to)&&!isCard(t.from))||(t.type==='income'&&isCard(t.account)))&&ymOf(t.date)===MESACTUAL)
    .reduce((s,t)=>s+(toARS(t.type==='transfer'?(t.amountTo!=null?t.amountTo:t.amount):t.amount,curOf(t.type==='transfer'?t.to:t.account))||0),0);
  const dSeries=[];
  for(let i=5;i>=1;i--){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()-i+1,0);dSeries.push({lab:d.toLocaleDateString('es-AR',{month:'short'}).replace('.',''),v:debtAtARS(localDate(d))});}
  dSeries.push({lab:'hoy',v:dNow});
  let dbars='';{const W=340,H=110,padX=10,padT=16,padB=18,n=dSeries.length,max=Math.max(1,...dSeries.map(s=>s.v));
    const gap=(W-2*padX)/n,bw=gap*0.5,plot=H-padT-padB;
    dSeries.forEach((s,i)=>{const x=padX+gap*i+(gap-bw)/2,bh=Math.max(2,s.v/max*plot),y=padT+plot-bh;
      dbars+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="3" fill="'+(i===n-1?'var(--expense)':'rgba(244,117,123,.45)')+'"/>';
      dbars+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(y-4).toFixed(1)+'" font-size="8.5" fill="var(--muted)" text-anchor="middle">'+kfmt(s.v)+'</text>';
      dbars+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-5)+'" font-size="9" fill="var(--muted2)" text-anchor="middle">'+s.lab+'</text>';});
    dbars='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">'+dbars+'</svg>';}
  h+='<div class="pj-sec"><span>Nivel de endeudamiento</span></div>';
  h+='<div class="acchero"><div class="ahlbl">Deuda total hoy (todas las cuotas por pagar)</div><div class="big neg">'+money(dNow)+'</div>'+
    '<div class="'+(delta<=0?'pos':'neg')+'" style="font-weight:700;font-size:13.5px;margin-bottom:2px">'+(delta<=0?'▼ Bajó ':'▲ Subió ')+money(Math.abs(delta))+' desde fin de '+finMesPasado.toLocaleDateString('es-AR',{month:'long'})+'</div>'+
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">Este mes: compras con tarjeta '+money(compras)+' · pagos '+money(pagosM)+'</div>'+dbars+'</div>';
  // ---- Compromisos mensuales: vencimientos de tarjeta + recordatorios de cada mes ----
  const compM=[];
  for(let i=0;i<6;i++){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()+i,1);const m=ym(d);
    const tar=DB.tx.filter(t=>t.type==='expense'&&isCard(t.account)&&payMonthOf(t)===m).reduce((s,t)=>s+(toARS(t.amount,t.currency||'ARS')||0),0);
    const rms=DB.reminders.filter(r=>r.type==='expense'&&remActiveIn(r,m)).reduce((s,r)=>s+(toARS(remAmount(r,m),curOf(r.account))||0),0);
    compM.push({lab:d.toLocaleDateString('es-AR',{month:'long'}),tar:tar,rms:rms,tot:tar+rms});}
  const compMax=Math.max(1,...compM.map(x=>x.tot));
  h+='<div class="pj-sec"><span>Compromisos por mes (tarjetas + recordatorios)</span></div>';
  h+='<div class="catlist" style="margin-bottom:12px">';
  compM.forEach(x=>{
    h+='<div class="catrow" style="cursor:default"><div class="crtop"><span style="text-transform:capitalize">'+x.lab+'</span><span><b class="neg">'+money(x.tot)+'</b></span></div>'+
      '<div class="ds" style="font-size:11px;color:var(--muted);margin-bottom:5px">💳 tarjetas '+money(x.tar)+' · ⏰ recordatorios '+money(x.rms)+'</div>'+
      '<div class="crbar"><i style="width:'+Math.round(x.tot/compMax*100)+'%;background:var(--expense)"></i></div></div>';});
  h+='</div>';
  h+='<div class="pj-sec"><span>Resumen proyectado por tarjeta</span></div>';  h+='<div class="cardtblwrap"><table class="cardtbl">'+head+rows+totrow+'</table></div>';
  // categorías de los consumos pendientes (mes de pago >= mes actual)
  const pend=DB.tx.filter(t=>t.type==='expense'&&isCard(t.account)&&payMonthOf(t)>=MESACTUAL);
  const byCat={};let totC=0;
  pend.forEach(t=>{const ars=toARS(t.amount,t.currency||'ARS')||0;byCat[t.category||'Otros']=(byCat[t.category||'Otros']||0)+ars;totC+=ars;});
  h+='<div class="pj-sec"><span>Categorías de lo que estás pagando</span></div>';
  if(!totC)h+='<div class="empty">No hay consumos de tarjeta pendientes.</div>';
  else{h+='<div class="catlist">';
    Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([c,v])=>{const pct=Math.round(v/totC*100);
      h+='<div class="catrow" data-cat="'+esc(c)+'"><div class="crtop"><span>'+esc(c)+' ›</span><span><b>'+money(v)+'</b> <small>'+pct+'%</small></span></div><div class="crbar"><i style="width:'+pct+'%"></i></div></div>';});
    h+='<div class="debttot" style="padding:12px 18px 20px"><span>Total pendiente</span><span class="neg">'+money(totC)+'</span></div></div>';}
  // proyectado por categoría: valor y % de cada mes (por mes de pago exacto), ordenado por peso total
  const catM={};const catColTot=new Array(6).fill(0);
  DB.tx.forEach(t=>{if(t.type!=='expense'||!isCard(t.account))return;const pm=payMonthOf(t);
    months.forEach((mo,i)=>{if(pm!==mo.m)return;
      const c=t.category||'Otros';const ars=toARS(t.amount,t.currency||'ARS')||0;
      (catM[c]=catM[c]||new Array(6).fill(0))[i]+=ars;catColTot[i]+=ars;});});
  const catRows=Object.entries(catM).map(([c,vals])=>({c:c,vals:vals,tot:vals.reduce((a,b)=>a+b,0)})).sort((a,b)=>b.tot-a.tot);
  if(catRows.length){
    h+='<div class="pj-sec"><span>Proyectado por categoría</span></div>';
    let chead='<tr><th></th>';months.forEach(mo=>{chead+='<th>'+mo.lab+'</th>';});chead+='</tr>';
    let crows='';catRows.forEach((r,idx)=>{
      let tds='';r.vals.forEach((v,i)=>{const pct=catColTot[i]>0?Math.round(v/catColTot[i]*100):0;
        tds+='<td class="'+(v>0?'':'z')+'">'+(v>0?money(v)+'<small>'+pct+'%</small>':'—')+'</td>';});
      crows+='<tr><th><span class="rk">'+(idx+1)+'</span>'+esc(r.c)+'</th>'+tds+'</tr>';});
    let ctot='<tr class="tot"><th>Total ARS</th>';catColTot.forEach(v=>{ctot+='<td>'+(v>0?money(v):'—')+'</td>';});ctot+='</tr>';
    h+='<div class="cardtblwrap"><table class="cardtbl">'+chead+crows+ctot+'</table></div>';
  }
  $('#cardsBody').innerHTML=h;
  document.querySelectorAll('#cardsBody .catrow').forEach(el=>el.onclick=()=>openCardCatDetail(el.dataset.cat));
  document.querySelectorAll('#cardsBody .cardtbl td.tap').forEach(td=>td.onclick=()=>openCardMonthDetail(td.dataset.acc,td.dataset.m,+td.dataset.i,td.dataset.lab));
}
function stripInst(s){return (s||'').replace(/\s*\(\d+\/\d+\)\s*/g,' ').replace(/\s+/g,' ').trim();}
// Detalle de una categoría: subcategorías con "este mes" y "total por vencer"; adentro, compras en cuotas agrupadas
function openCardCatDetail(cat){
  const pend=DB.tx.filter(t=>t.type==='expense'&&isCard(t.account)&&payMonthOf(t)>=MESACTUAL&&(t.category||'Otros')===cat);
  const subs={};
  pend.forEach(t=>{const s=t.sub||'—';(subs[s]=subs[s]||[]).push(t);});
  let grandTot=0;
  const blocks=Object.entries(subs).map(([s,txs])=>{
    const totV=txs.reduce((a,t)=>a+(toARS(t.amount,t.currency||'ARS')||0),0);
    const mesV=txs.filter(t=>payMonthOf(t)===MESACTUAL).reduce((a,t)=>a+(toARS(t.amount,t.currency||'ARS')||0),0);
    grandTot+=totV;
    // compras en cuotas agrupadas + sueltas
    const groups={},singles=[];
    txs.forEach(t=>{
      if(t.inst&&t.inst.length===2){const base=stripInst(t.note)||s;const key=t.account+'|'+base+'|'+t.inst[1]+'|'+t.amount.toFixed(2);
        const g=groups[key]=groups[key]||{name:base,acc:t.account,cur:t.currency||'ARS',N:t.inst[1],per:t.amount,count:0};g.count++;}
      else singles.push(t);});
    const rows=[];
    Object.values(groups).forEach(g=>rows.push({name:g.name,sub:g.acc+' · quedan '+g.count+' de '+g.N+' cuotas · '+money(g.per,g.cur)+'/cuota',ars:toARS(g.per*g.count,g.cur)||0,nat:money(g.per*g.count,g.cur)}));
    singles.forEach(t=>rows.push({name:stripInst(t.note)||s,sub:t.account+' · paga '+payMonthOf(t),ars:toARS(t.amount,t.currency||'ARS')||0,nat:money(t.amount,t.currency||'ARS')}));
    rows.sort((a,b)=>b.ars-a.ars);
    let inner='';rows.forEach(r=>{inner+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(r.name)+'</div><div class="ds">'+esc(r.sub)+'</div></div><div class="damt neg">'+r.nat+'</div></div>';});
    return {s:s,totV:totV,mesV:mesV,inner:inner};
  }).sort((a,b)=>b.totV-a.totV);
  let h='<div class="debtlist">';
  blocks.forEach(b=>{
    h+='<details class="pjbranch subdet"><summary><span class="rl">'+esc(b.s)+'</span><span class="subamts"><small>este mes '+money(b.mesV)+'</small><b class="neg">'+money(b.totV)+'</b></span></summary>'+b.inner+'</details>';
  });
  h+='</div><div class="debttot"><span>Total por vencer</span><span class="neg">'+money(grandTot)+'</span></div>';
  $('#cardDetTitle').textContent=cat;$('#cardDetBody').innerHTML=h;$('#cardDetScrim').classList.add('on');
}
// Detalle de una tarjeta en un mes puntual de la tabla proyectada
function openCardMonthDetail(name,m,i,lab){
  const items=DB.tx.filter(t=>t.type==='expense'&&t.account===name&&(i===0?payMonthOf(t)<=MESACTUAL:payMonthOf(t)===m)).sort((a,b)=>b.amount-a.amount);
  const cur=curOf(name);
  let h='<div class="debtlist">';let tot=0;
  items.forEach(t=>{tot+=t.amount;
    const nm=(stripInst(t.note)||t.sub||t.category||'—')+(t.inst?' ('+t.inst[0]+'/'+t.inst[1]+')':'');
    h+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(nm)+'</div><div class="ds">'+esc(t.category||'Otros')+(t.sub?' · '+esc(t.sub):'')+' · compra '+t.date+'</div></div><div class="damt neg">'+money(t.amount,cur)+'</div></div>';});
  h+='</div><div class="debttot"><span>Total'+(i===0?' (antes de netear pagos)':'')+'</span><span class="neg">'+money(tot,cur)+'</span></div>';
  if(i===0)h+='<div class="hint" style="padding:0 18px 18px">Los pagos que ya hiciste se descuentan del "vencido" que ves en la tabla.</div>';
  $('#cardDetTitle').textContent=name+' · '+lab+(i===0?' (vencido)':'');$('#cardDetBody').innerHTML=h;$('#cardDetScrim').classList.add('on');
}
