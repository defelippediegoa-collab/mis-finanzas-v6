/* ---------- transaction sheet ---------- */
let fType='expense',fPay='once';
function isCard(n){const a=acct(n);return a&&a.type==='Tarjetas de crédito';}
function openSheet(id,preset){
  editId=id||null;$('#sheetTitle').textContent=id?'Editar movimiento':(preset&&preset.note==='liquidación'?'Pagar tarjeta':'Nuevo movimiento');$('#delTx').classList.toggle('hidden',!id);$('#dupTx').classList.toggle('hidden',!id);
  fillAccounts($('#f-account'));fillAccounts($('#f-to'));
  let t=id?DB.tx.find(x=>x.id===id):null;fType=t?t.type:(preset?preset.type:'expense');fPay='once';
  document.querySelectorAll('#typeSeg button').forEach(b=>b.classList.remove('on','inc','tr'));
  const sb=document.querySelector('#typeSeg button[data-t="'+fType+'"]');sb.classList.add('on');if(fType==='income')sb.classList.add('inc');if(fType==='transfer')sb.classList.add('tr');
  $('#f-amount').value=t?t.amount:(preset&&preset.amount?preset.amount:'');$('#f-date').value=t?t.date:(preset&&preset.date?preset.date:localDate());
  const nx=ym(new Date(TODAY.getFullYear(),TODAY.getMonth()+1,1));$('#f-due').value=nx;$('#f-subfrom').value=nx;$('#f-paymonth').value=nx;$('#f-inst').value='3';
  $('#f-note').value=t&&t.note?t.note:(preset&&preset.note?preset.note:'');
  $('#f-tags').value=t&&t.tags?t.tags.join(', '):(preset&&preset.tags?preset.tags.join(', '):'');
  $('#tag-suggestions').innerHTML=[...new Set(DB.tx.flatMap(x=>x.tags||[]))].sort().map(g=>'<option value="'+esc(g)+'">').join('');
  refreshNoteSuggestions();
  {const w=$('#f-items-wrap');const has=t&&Array.isArray(t.items)&&t.items.length;w.classList.toggle('hidden',!t||t.type!=='expense');
    if(t&&t.type==='expense'){$('#f-items-btn').textContent=has?('🧾 '+t.items.length+' ítems · ver / editar'):'🧾 Agregar detalle de ítems';$('#f-items-btn').onclick=()=>{$('#scrim').classList.remove('on');openTicket({editId:t.id});};}}
  document.querySelectorAll('#paySeg button').forEach(b=>b.classList.toggle('on',b.dataset.p==='once'));
  refreshType();
  const src=t||preset||{};
  if(fType!=='transfer'){fill($('#f-category'),DB.cats[fType==='income'?'income':'expense'],src.category);refreshSub(src.sub);fillAccounts($('#f-account'),src.account);if(fType==='expense'&&isCard(src.account))$('#f-paymonth').value=src.dueMonth||(src.date?ymOf(src.date):nx);}
  if(fType==='transfer'){fillAccounts($('#f-account'),t?t.from:(preset?preset.from:undefined));fillAccounts($('#f-to'),t?t.to:(preset?preset.to:undefined));}
  refreshPayUI();refreshFx();setAmtLabel();$('#scrim').classList.add('on');
}
function refreshType(){const tr=fType==='transfer';$('#f-to-wrap').classList.toggle('hidden',!tr);$('#f-cat-wrap').classList.toggle('hidden',tr);$('#f-sub-wrap').classList.toggle('hidden',tr);$('#f-note-wrap').classList.remove('hidden');$('#f-tags-wrap').classList.remove('hidden');$('#f-acc-lbl').textContent=tr?'Desde':'Cuenta';if(!tr){fill($('#f-category'),DB.cats[fType==='income'?'income':'expense']);refreshSub();}refreshPayUI();refreshFx();}
function refreshPayUI(){const card=fType==='expense'&&isCard($('#f-account').value);$('#payModeWrap').classList.toggle('hidden',!card);if(!card){fPay='once';$('#onceExtra').classList.add('hidden');$('#instExtra').classList.add('hidden');$('#subExtra').classList.add('hidden');return;}$('#onceExtra').classList.toggle('hidden',fPay!=='once');$('#instExtra').classList.toggle('hidden',fPay!=='inst');$('#subExtra').classList.toggle('hidden',fPay!=='sub');}
function refreshSub(s0){const cat=$('#f-category').value;fill($('#f-sub'),['—',...(DB.subs[cat]||[])],s0||'—');}
function setAmtLabel(){const n=parseInt($('#f-inst').value)||1,amt=parseFloat($('#f-amount').value)||0;if(fType==='expense'&&fPay==='inst'){$('#amtLbl').textContent='Importe total';$('#amtHint').classList.remove('hidden');$('#amtHint').textContent=n>1?('= '+money(amt/n)+' por cuota ('+n+')'):'';}else{$('#amtLbl').textContent='Importe';$('#amtHint').classList.add('hidden');}}
function refreshFx(){if(fType!=='transfer'){$('#fxExtra').classList.add('hidden');return;}const fc=curOf($('#f-account').value),tc=curOf($('#f-to').value);const cross=fc&&tc&&fc!==tc;$('#fxExtra').classList.toggle('hidden',!cross);if(cross){if(!$('#f-rate').value)$('#f-rate').value=DB.usdRate;const amt=parseFloat($('#f-amount').value)||0,rate=parseFloat($('#f-rate').value)||DB.usdRate;$('#fxToLbl').textContent='Recibe ('+tc+')';$('#f-amountto').value=money(convertAmt(amt,fc,tc,rate),tc);$('#fxHint').textContent='Cambio de '+fc+' a '+tc+'.';}}
$('#f-amount').oninput=()=>{setAmtLabel();refreshFx();};$('#f-inst').oninput=setAmtLabel;$('#f-rate').oninput=refreshFx;$('#f-category').onchange=()=>refreshSub();
$('#f-account').onchange=()=>{refreshPayUI();refreshFx();};$('#f-to').onchange=refreshFx;
$('#f-date').onchange=()=>{const d=new Date($('#f-date').value+'T12:00:00');if(isNaN(d))return;const nm=ym(new Date(d.getFullYear(),d.getMonth()+1,1));$('#f-paymonth').value=nm;$('#f-due').value=nm;};
$('#fab').onclick=()=>openSheet(null);$('#closeSheet').onclick=()=>$('#scrim').classList.remove('on');$('#scrim').onclick=e=>{if(e.target===$('#scrim'))$('#scrim').classList.remove('on');};
document.querySelectorAll('#typeSeg button').forEach(b=>b.onclick=()=>{fType=b.dataset.t;document.querySelectorAll('#typeSeg button').forEach(x=>x.classList.remove('on','inc','tr'));b.classList.add('on');if(fType==='income')b.classList.add('inc');if(fType==='transfer')b.classList.add('tr');fPay='once';document.querySelectorAll('#paySeg button').forEach(x=>x.classList.toggle('on',x.dataset.p==='once'));refreshType();setAmtLabel();});
document.querySelectorAll('#paySeg button').forEach(b=>b.onclick=()=>{fPay=b.dataset.p;document.querySelectorAll('#paySeg button').forEach(x=>x.classList.toggle('on',x===b));refreshPayUI();setAmtLabel();});
$('#saveTx').onclick=()=>{
  const amt=parseFloat($('#f-amount').value);if(!amt||amt<=0){toast('Poné un importe');return;}const date=$('#f-date').value;
  const tags=$('#f-tags').value.split(',').map(s=>s.trim().toLowerCase().replace(/^#/,'')).filter(Boolean);
  if(editId){const t=DB.tx.find(x=>x.id===editId);const wasHist=t.hist;releaseHist(t);t.amount=amt;t.date=date;t.updatedAt=Date.now();
    if(tags.length)t.tags=tags;else delete t.tags;
    if(fType==='transfer'){t.type='transfer';t.from=$('#f-account').value;t.to=$('#f-to').value;t.currency=curOf(t.from);t.note=$('#f-note').value||'';delete t.account;delete t.category;delete t.sub;}
    else{t.type=fType;t.account=$('#f-account').value;t.category=$('#f-category').value;t.sub=$('#f-sub').value==='—'?'':$('#f-sub').value;t.currency=curOf(t.account);t.note=$('#f-note').value||'';if(fType==='expense'&&isCard(t.account)&&fPay==='once'){t.dueMonth=$('#f-paymonth').value;}else delete t.dueMonth;}
    persist();$('#scrim').classList.remove('on');cur=new Date(+date.slice(0,4),+date.slice(5,7)-1,1);render();if(detail&&detailRefresh)detailRefresh();toast(wasHist?'Actualizado · ahora afecta el saldo':'Actualizado');return;}
  if(fType==='transfer'){const from=$('#f-account').value,to=$('#f-to').value;const fc=curOf(from),tc=curOf(to);
    const rec={id:'u'+Date.now(),date,type:'transfer',from,to,amount:amt,currency:fc,note:$('#f-note').value||'',source:'app',createdAt:Date.now()};if(tags.length)rec.tags=tags;
    if(fc!==tc){const rate=parseFloat($('#f-rate').value)||DB.usdRate;rec.rate=rate;rec.currencyTo=tc;rec.amountTo=convertAmt(amt,fc,tc,rate);}
    DB.tx.push(rec);}
  else{const sub=$('#f-sub').value==='—'?'':$('#f-sub').value;const accName=$('#f-account').value;const card=isCard(accName);const base={type:fType,account:accName,category:$('#f-category').value,sub,currency:curOf(accName),note:$('#f-note').value||'',source:'app',createdAt:Date.now()};if(tags.length)base.tags=tags;
    if(fType==='expense'&&card&&fPay==='inst'){const n=Math.max(2,parseInt($('#f-inst').value)||2),per=Math.round(amt/n*100)/100;const[fy,fm]=$('#f-due').value.split('-').map(Number);const sid='u'+Date.now();
      for(let i=0;i<n;i++){const pay=new Date(fy,fm-1+i,1); // shiftMonthStr no desborda el mes (31/01 + 1 mes = 28/02, no 03/03)
        DB.tx.push({...base,id:sid+'_'+i,date:shiftMonthStr(date,i),amount:per,dueMonth:ym(pay),purchaseDate:date,inst:[i+1,n],note:(base.note?base.note+' ':'')+'('+(i+1)+'/'+n+')'});}}
    else if(fType==='expense'&&card&&fPay==='sub'){DB.reminders.push({id:'r'+Date.now(),type:'expense',name:(sub||$('#f-category').value||'Suscripción'),amount:amt,freq:'monthly',from:$('#f-subfrom').value,until:'',account:accName,category:$('#f-category').value});persist();$('#scrim').classList.remove('on');setView('proj');toast('Suscripción agregada a recordatorios');return;}
    else{const rec={...base,id:'u'+Date.now(),date,amount:amt};if(fType==='expense'&&card){rec.dueMonth=$('#f-paymonth').value;rec.purchaseDate=date;}DB.tx.push(rec);}}
  persist();$('#scrim').classList.remove('on');cur=new Date(+date.slice(0,4),+date.slice(5,7)-1,1);render();toast('Guardado');
};
$('#dupTx').onclick=()=>{const t=DB.tx.find(x=>x.id===editId);if(!t)return;
  const preset={type:t.type,amount:t.amount,note:t.note,account:t.account,category:t.category,sub:t.sub,from:t.from,to:t.to,date:shiftMonthStr(t.date,1),tags:t.tags};
  if(t.dueMonth){const dm=new Date(t.dueMonth+'-01T12:00:00');preset.dueMonth=ym(new Date(dm.getFullYear(),dm.getMonth()+1,1));}
  openSheet(null,preset);toast('Duplicado: revisá y guardá');};
$('#delTx').onclick=()=>{
  if(!editId)return;const t=DB.tx.find(x=>x.id===editId);if(!t){$('#scrim').classList.remove('on');return;}
  const prefix=editId.split('_')[0];
  const series=DB.tx.filter(x=>x.id!==editId&&x.id.split('_')[0]===prefix);
  let delIds=[editId];
  if(t.inst&&series.length){
    if(confirm('Este movimiento es parte de una serie de cuotas. ¿Eliminar TODA la serie ('+(series.length+1)+' cuotas)?\n\nAceptar = toda la serie · Cancelar = elegir solo esta')){
      delIds=[editId,...series.map(x=>x.id)];
    } else if(!confirm('¿Eliminar solo esta cuota?')){return;}
  } else {
    if(!confirm('¿Eliminar este movimiento?'))return;
  }
  DB.tx=DB.tx.filter(x=>!delIds.includes(x.id));persist();$('#scrim').classList.remove('on');
  if(detail&&detailRefresh)detailRefresh();else render();toast(delIds.length>1?delIds.length+' movimientos eliminados':'Eliminado');
};

