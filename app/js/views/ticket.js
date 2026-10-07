/* ---------- TICKET: escanear / cargar ítems ---------- */
// TK = estado del editor. items: [{desc,qty,unit,unitPrice,amount,discount}]
let TK={items:[],merchant:'',date:'',total:null,currency:'ARS',warnings:[],source:'ticket',editId:null,previewUrl:null,pay:'once'};

function openTicket(preset){ // preset opcional: {file} (desde Compartir) | {editId}
  TK={items:[],merchant:'',date:localDate(),total:null,currency:'ARS',warnings:[],source:'ticket',editId:null,previewUrl:null,pay:'once'};
  $('#menu').classList.remove('on');
  $('#tkPick').classList.remove('hidden');$('#tkBusy').classList.add('hidden');$('#tkForm').classList.add('hidden');$('#tkPreview').innerHTML='';
  $('#tkTitle').textContent='Escanear ticket';$('#tkDel').classList.add('hidden');
  $('#ticketScrim').classList.add('on');
  aiInfo().then(i=>{$('#tkAiHint').textContent=i.ai?('IA activa · '+i.model):('Sin IA: '+i.reason+' Podés cargar los ítems a mano.');});
  if(preset&&preset.editId)return tkEdit(preset.editId);
  if(preset&&preset.file){TK.source=preset.source||'share';return tkProcess(preset.file);}
  if(preset&&preset.draft){const d=preset.draft;TK.source=preset.source||'wa';TK.inboxId=INBOX_EDIT;
    TK.items=(d.items||[]).map(i=>({desc:i.desc||'',qty:i.qty||1,unit:i.unit||'u',unitPrice:i.unitPrice!=null?i.unitPrice:(i.unit_price!=null?i.unit_price:null),amount:typeof i.amount==='number'?i.amount:0,discount:!!(i.discount||i.is_discount)}));
    TK.merchant=d.merchant||'';TK.date=d.date||localDate();TK.total=typeof d.amount==='number'?d.amount:null;TK.currency=d.currency||'ARS';TK.warnings=d.warnings||[];
    $('#tkPick').classList.add('hidden');tkShowForm();
    if(d.account)fillAccounts($('#tk-account'),d.account);if(d.category){fill($('#tk-category'),DB.cats.expense,d.category);tkRefreshSub(d.sub);}if(d.note)$('#tk-note').value=d.note;tkRefreshPay();return;}
}
function tkEdit(id){const t=DB.tx.find(x=>x.id===id);if(!t)return;
  TK.editId=id;TK.items=(t.items||[]).map(i=>Object.assign({},i));TK.merchant=t.merchant||'';TK.date=t.date;TK.total=t.amount;TK.currency=t.currency||'ARS';
  $('#tkTitle').textContent='Ítems del movimiento';$('#tkDel').classList.remove('hidden');
  tkShowForm(t);
}
async function tkProcess(file){
  $('#tkPick').classList.add('hidden');$('#tkBusy').classList.remove('hidden');$('#tkBusyTxt').textContent='Leyendo el ticket…';
  try{const info=await aiInfo();
    if(!info.ai){toast('IA no disponible: cargá los ítems a mano');tkManual();return;}
    const r=await aiTicket(file);const res=r.result||{};
    TK.previewUrl=r.previewUrl;
    TK.merchant=res.merchant||'';TK.date=res.date||localDate();TK.currency=res.currency==='USD'?'USD':'ARS';
    TK.total=typeof res.total==='number'?res.total:null;TK.warnings=res.warnings||[];
    TK.items=(res.items||[]).map(i=>({desc:i.desc||'',qty:typeof i.qty==='number'&&i.qty>0?i.qty:1,unit:i.unit||'u',unitPrice:typeof i.unit_price==='number'?i.unit_price:null,amount:typeof i.amount==='number'?i.amount:0,discount:!!i.is_discount}));
    if(res.payment_hint)TK.paymentHint=res.payment_hint;
    if(typeof res.confidence==='number'&&res.confidence<0.5)TK.warnings.unshift('La IA no está segura de esta lectura (confianza '+Math.round(res.confidence*100)+'%). Revisá los números.');
    tkShowForm();
    if(TK.previewUrl)$('#tkPreview').innerHTML='<img src="'+TK.previewUrl+'" alt="ticket">';
  }catch(e){toast(e.message||'No se pudo leer el ticket');tkManual();}
}
function tkManual(){TK.source=TK.editId?TK.source:'manual';$('#tkPick').classList.add('hidden');$('#tkBusy').classList.add('hidden');if(!TK.items.length)TK.items=[{desc:'',qty:1,unit:'u',unitPrice:null,amount:0,discount:false}];tkShowForm();}

function tkShowForm(t){
  $('#tkBusy').classList.add('hidden');$('#tkForm').classList.remove('hidden');
  $('#tk-merchant').value=TK.merchant;$('#tk-date').value=TK.date||localDate();$('#tk-total').value=TK.total==null?'':TK.total;
  $('#tkWarn').innerHTML=TK.warnings.length?TK.warnings.map(w=>'⚠️ '+esc(w)).join('<br>'):'';$('#tkWarn').classList.toggle('hidden',!TK.warnings.length);
  const edit=!!TK.editId;
  $('#tkPayWrap').classList.toggle('hidden',edit);
  if(!edit){
    // cuenta sugerida por payment_hint
    let acc;const hint=normKey(TK.paymentHint||'');
    if(hint){acc=DB.accounts.find(a=>{const n=normKey(a.name);return hint.split(' ').some(h=>h.length>2&&n.includes(h));});
      if(!acc&&/efectivo|contado/.test(hint))acc=DB.accounts.find(a=>a.type==='Efectivo');
      if(!acc&&/visa|master|credito|tarjeta/.test(hint))acc=DB.accounts.find(a=>a.type==='Tarjetas de crédito');}
    fillAccounts($('#tk-account'),acc?acc.name:undefined);
    const nx=ym(new Date(TODAY.getFullYear(),TODAY.getMonth()+1,1));$('#tk-paymonth').value=nx;$('#tk-due').value=nx;$('#tk-inst').value='3';TK.pay='once';
    document.querySelectorAll('#tkPaySeg button').forEach(b=>b.classList.toggle('on',b.dataset.p==='once'));
    const def=defaultCatForTicket(TK.merchant,'');
    fill($('#tk-category'),DB.cats.expense,def.category);tkRefreshSub(def.sub);
    $('#tk-note').value=TK.merchant||'';
    tkRefreshPay();
  }
  tkRenderItems();
}
function tkRefreshSub(s0){const cat=$('#tk-category').value;fill($('#tk-sub'),['—',...(DB.subs[cat]||[])],s0||'—');}
function tkRefreshPay(){const card=isCard($('#tk-account').value);$('#tkCard').classList.toggle('hidden',!card);if(!card)return;$('#tkOnce').classList.toggle('hidden',TK.pay!=='once');$('#tkInst').classList.toggle('hidden',TK.pay!=='inst');}
$('#tk-account').onchange=tkRefreshPay;$('#tk-category').onchange=()=>tkRefreshSub();
document.querySelectorAll('#tkPaySeg button').forEach(b=>b.onclick=()=>{TK.pay=b.dataset.p;document.querySelectorAll('#tkPaySeg button').forEach(x=>x.classList.toggle('on',x===b));tkRefreshPay();});
$('#tk-date').onchange=()=>{const d=new Date($('#tk-date').value+'T12:00:00');if(isNaN(d))return;const nm=ym(new Date(d.getFullYear(),d.getMonth()+1,1));$('#tk-paymonth').value=nm;$('#tk-due').value=nm;};

function tkRenderItems(){
  const box=$('#tkItems');
  box.innerHTML=TK.items.map((i,k)=>'<div class="tkrow'+(i.discount?' disc':'')+'" data-k="'+k+'">'+
    '<input class="tk-desc" value="'+esc(i.desc)+'" placeholder="Ítem">'+
    '<input class="tk-qty" type="number" inputmode="decimal" step="any" value="'+(i.qty==null?1:i.qty)+'" title="Cantidad">'+
    '<input class="tk-amt" type="number" inputmode="decimal" step="any" value="'+(i.amount==null?'':i.amount)+'" placeholder="0" title="Importe">'+
    '<button class="tk-x" title="Quitar">×</button></div>').join('');
  box.querySelectorAll('.tkrow').forEach(row=>{const k=+row.dataset.k;
    row.querySelector('.tk-desc').oninput=e=>{TK.items[k].desc=e.target.value;};
    row.querySelector('.tk-qty').oninput=e=>{TK.items[k].qty=parseFloat(e.target.value)||1;};
    row.querySelector('.tk-amt').oninput=e=>{TK.items[k].amount=parseFloat(e.target.value)||0;TK.items[k].discount=TK.items[k].amount<0;tkSumHint();};
    row.querySelector('.tk-x').onclick=()=>{TK.items.splice(k,1);tkRenderItems();};});
  tkSumHint();
}
function tkSum(){return Math.round(TK.items.reduce((s,i)=>s+(parseFloat(i.amount)||0),0)*100)/100;}
function tkSumHint(){const sum=tkSum(),tot=parseFloat($('#tk-total').value);const el=$('#tkSum');
  if(!TK.items.length){el.innerHTML='';return;}
  if(isNaN(tot)){el.innerHTML='Suma de ítems: <b>'+money(sum,TK.currency)+'</b> · <a href="#" id="tkUseSum">usar como total</a>';}
  else{const diff=Math.round((tot-sum)*100)/100,tol=Math.max(tot*0.005,TK.items.length);
    el.innerHTML=Math.abs(diff)<=tol?('Suma de ítems '+money(sum,TK.currency)+' ✓ coincide con el total'):
      ('<span style="color:var(--warn,#e0bd6a)">Suma de ítems '+money(sum,TK.currency)+' ≠ total '+money(tot,TK.currency)+' (dif. '+money(diff,TK.currency)+')</span> · <a href="#" id="tkUseSum">usar la suma</a>');}
  const a=$('#tkUseSum');if(a)a.onclick=e=>{e.preventDefault();$('#tk-total').value=sum;tkSumHint();};
}
$('#tk-total').oninput=tkSumHint;
$('#tkAdd').onclick=()=>{TK.items.push({desc:'',qty:1,unit:'u',unitPrice:null,amount:0,discount:false});tkRenderItems();const rows=$('#tkItems').querySelectorAll('.tk-desc');rows[rows.length-1].focus();};

$('#tkCam').onclick=()=>$('#tkCamIn').click();$('#tkFile').onclick=()=>$('#tkFileIn').click();$('#tkManual').onclick=tkManual;
$('#tkCamIn').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)tkProcess(f);};
$('#tkFileIn').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)tkProcess(f);};
$('#closeTicket').onclick=()=>$('#ticketScrim').classList.remove('on');$('#ticketScrim').onclick=e=>{if(e.target===$('#ticketScrim'))$('#ticketScrim').classList.remove('on');};
$('#fabTicket').onclick=()=>openTicket();$('#ticketBtn').onclick=()=>openTicket();

function tkCleanItems(){return TK.items.filter(i=>(i.desc||'').trim()||i.amount).map(i=>{const qty=parseFloat(i.qty)||1,amount=Math.round((parseFloat(i.amount)||0)*100)/100;
  return{desc:(i.desc||'').trim()||'Ítem',key:normKey(i.desc),qty,unit:i.unit||'u',unitPrice:i.unitPrice!=null?i.unitPrice:(qty?Math.round(amount/qty*100)/100:null),amount,discount:amount<0||!!i.discount};});}

$('#tkSave').onclick=()=>{
  const items=tkCleanItems();const merchant=$('#tk-merchant').value.trim();const date=$('#tk-date').value||localDate();
  let total=parseFloat($('#tk-total').value);if(isNaN(total)||total<=0){if(items.length){total=tkSum();}if(!total||total<=0){toast('Poné el total');return;}}
  total=Math.round(total*100)/100;
  if(TK.editId){const t=DB.tx.find(x=>x.id===TK.editId);if(!t)return;
    t.items=items;t.merchant=merchant||undefined;if(!t.merchant)delete t.merchant;t.updatedAt=Date.now();
    if(!t.inst){t.amount=total;t.date=date;}
    persist();$('#ticketScrim').classList.remove('on');render();if(detail&&detailRefresh)detailRefresh();toast('Ítems guardados');return;}
  const accName=$('#tk-account').value;if(!accName){toast('Elegí la cuenta');return;}
  const sub=$('#tk-sub').value==='—'?'':$('#tk-sub').value;const category=$('#tk-category').value;
  const note=$('#tk-note').value.trim()||merchant||'ticket';
  const base={type:'expense',account:accName,category,sub,currency:curOf(accName),note,source:TK.source||'ticket',createdAt:Date.now()};if(TK.inboxId)base.inboxId=TK.inboxId;
  if(merchant)base.merchant=merchant;
  const card=isCard(accName);const sid='u'+Date.now();
  if(card&&TK.pay==='inst'){const n=Math.max(2,parseInt($('#tk-inst').value)||2),per=Math.round(total/n*100)/100;const[fy,fm]=$('#tk-due').value.split('-').map(Number);
    for(let i=0;i<n;i++){const pay=new Date(fy,fm-1+i,1);const rec={...base,id:sid+'_'+i,ticketId:sid,date:shiftMonthStr(date,i),amount:per,dueMonth:ym(pay),purchaseDate:date,inst:[i+1,n],note:note+' ('+(i+1)+'/'+n+')'};
      if(i===0&&items.length)rec.items=items;DB.tx.push(rec);}}
  else{const rec={...base,id:sid,date,amount:total};if(items.length)rec.items=items;if(card){rec.dueMonth=$('#tk-paymonth').value;rec.purchaseDate=date;}DB.tx.push(rec);}
  if(TK.inboxId){inboxMarkDone([TK.inboxId],'done');TK.inboxId=null;INBOX_EDIT=null;}
  persist();$('#ticketScrim').classList.remove('on');cur=new Date(+date.slice(0,4),+date.slice(5,7)-1,1);setView('trans');toast('Ticket guardado'+(items.length?' · '+items.length+' ítems':''));
};
$('#tkDel').onclick=()=>{if(!TK.editId)return;const t=DB.tx.find(x=>x.id===TK.editId);if(!t)return;if(!confirm('¿Quitar el detalle de ítems de este movimiento? (el movimiento queda)'))return;delete t.items;t.updatedAt=Date.now();persist();$('#ticketScrim').classList.remove('on');render();toast('Ítems quitados');};
