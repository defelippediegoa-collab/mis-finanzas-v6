function setView(v){view=v;detail=null;txQuery='';{const ts=$('#txSearch');if(ts){ts.value='';$('#txSearchClear').classList.add('hidden');}}$('#hdrBack').classList.add('hidden');$('#hdrMonth').classList.remove('hidden');$('#view-detail').classList.add('hidden');
  document.querySelectorAll('.nav .n').forEach(n=>n.classList.toggle('on',n.dataset.v===v));
  ['trans','stats','acc','proj','cards','panel'].forEach(id=>$('#view-'+id).classList.toggle('hidden',id!==v));render();}
document.querySelectorAll('.nav .n').forEach(n=>n.onclick=()=>setView(n.dataset.v));
$('#prevM').onclick=()=>{cur=new Date(cur.getFullYear(),cur.getMonth()-1,1);render();};
$('#nextM').onclick=()=>{cur=new Date(cur.getFullYear(),cur.getMonth()+1,1);render();};
$('#tab-inc').onclick=()=>{statKind='income';$('#tab-inc').classList.add('on');$('#tab-exp').classList.remove('on');renderStats();};
$('#tab-exp').onclick=()=>{statKind='expense';$('#tab-exp').classList.add('on');$('#tab-inc').classList.remove('on');renderStats();};
$('#txSearch').oninput=e=>{txQuery=e.target.value;$('#txSearchClear').classList.toggle('hidden',!txQuery);renderDiario();};
$('#txSearchClear').onclick=()=>{txQuery='';$('#txSearch').value='';$('#txSearchClear').classList.add('hidden');renderDiario();$('#txSearch').focus();};
$('#bmMes').onclick=()=>{homeMode='mes';localStorage.setItem('fin_home_mode','mes');renderDiario();};
$('#bmCaja').onclick=()=>{homeMode='caja';localStorage.setItem('fin_home_mode','caja');renderDiario();};
$('#tfCard').onclick=()=>{txFilter='card';renderDiario();};
$('#tfCash').onclick=()=>{txFilter='cash';renderDiario();};
$('#tfAll').onclick=()=>{txFilter='all';renderDiario();};
function showDebtBreakdown(){
  const rows=[];let tot=0;
  DB.accounts.forEach(a=>{if(a.includeInTotal===false)return;
    const isC=a.type==='Tarjetas de crédito';let raw,sub='';
    if(isC){const s=cardSaldos(a.name);raw=-s.aPagar;sub='Liquidación este mes'+(s.restante>0?' · Próximo (no suma) '+money(s.restante,a.currency):'');}
    else raw=liveBalance(a.name);
    const ars=toARS(raw,a.currency);
    if(ars==null||ars>=0)return;tot+=ars;
    rows.push({name:a.name,cur:a.currency,ars:ars,native:raw,sub:sub});});
  rows.sort((x,y)=>x.ars-y.ars);
  const rem=unpaidRems(MESACTUAL).map(r=>({name:(r.name||'recordatorio'),cur:curOf(r.account),ars:toARS(remAmount(r,MESACTUAL),curOf(r.account))||0})).filter(r=>r.ars>0).sort((x,y)=>y.ars-x.ars);
  rem.forEach(r=>tot-=r.ars);
  let h;
  if(!rows.length&&!rem.length)h='<div class="empty" style="padding:24px">No tenés deudas registradas.</div>';
  else{h='<div class="debtlist">';rows.forEach(r=>{h+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(r.name)+'</div>'+(r.sub?'<div class="ds">'+r.sub+'</div>':'')+(r.cur!=='ARS'?'<div class="ds">'+money(Math.abs(r.native),r.cur)+' → pesos</div>':'')+'</div><div class="damt neg">'+money(Math.abs(r.ars))+'</div></div>';});
    if(rem.length){h+='<div class="debtsub">Recordatorios del mes (impagos)</div>';rem.forEach(r=>{h+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(r.name)+'</div>'+(r.cur!=='ARS'?'<div class="ds">en pesos</div>':'')+'</div><div class="damt neg">'+money(r.ars)+'</div></div>';});}
    h+='</div><div class="debttot"><span>Total a deber</span><span class="neg">'+money(Math.abs(tot))+'</span></div>';}
  $('#debtBody').innerHTML=h;$('#debtScrim').classList.add('on');
}
$('#a-debt-cell').onclick=showDebtBreakdown;
$('#closeDebt').onclick=()=>$('#debtScrim').classList.remove('on');
$('#closeCardDet').onclick=()=>$('#cardDetScrim').classList.remove('on');
$('#cardDetScrim').onclick=e=>{if(e.target===$('#cardDetScrim'))$('#cardDetScrim').classList.remove('on');};
$('#remToggle').onclick=e=>{if(e.target.closest('#addRem'))return;const r=$('#reminders');const open=r.classList.toggle('hidden')===false;$('#remCaret').textContent=open?'▾':'▸';};
$('#debtScrim').onclick=e=>{if(e.target===$('#debtScrim'))$('#debtScrim').classList.remove('on');};

