/* ---------- BANDEJA (Inbox): movimientos que llegan desde WhatsApp ---------- */
let INBOX=[];let INBOX_EDIT=null; // id del item que se está revisando en un formulario
async function pollInbox(force){
  if(!CFG.syncUrl||!CFG.syncToken)return;
  if(!force&&Date.now()-(CFG.lastInboxPoll||0)<60000){flushInboxDone();return;}
  try{const j=await apiGet('inbox',{status:'pending'});if(j&&j.ok){INBOX=j.items||[];CFG.lastInboxPoll=Date.now();saveCfg();renderInboxBar();}}catch(e){}
  flushInboxDone();
}
function renderInboxBar(){const bar=$('#inboxBar');if(!bar)return;const n=INBOX.length;bar.classList.toggle('hidden',!n);
  if(n)bar.innerHTML='📥 <b>'+n+'</b> movimiento'+(n>1?'s':'')+' desde WhatsApp para revisar ›';}
function inboxSummary(it){const d=it.draft||{};const em=d.type==='income'?'💰':(d.type==='transfer'?'🔁':'💸');
  const amt=typeof d.amount==='number'?money(d.amount,d.currency||'ARS'):'sin importe';
  const where=d.type==='transfer'?((d.from||'?')+' → '+(d.to||'?')):(d.account||'sin cuenta');
  const cat=d.category?(d.category+(d.sub?' › '+d.sub:'')):'sin categoría';
  return{em,amt,where,cat,note:d.note||d.merchant||'',date:d.date||'',items:Array.isArray(d.items)?d.items.length:0,when:it.createdAt?new Date(it.createdAt).toLocaleString('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''};}
function openInbox(){$('#menu').classList.remove('on');renderInboxList();$('#inboxScrim').classList.add('on');pollInbox(true).then(renderInboxList);}
function renderInboxList(){const box=$('#inboxList');
  if(!INBOX.length){box.innerHTML='<div class="empty" style="padding:24px 18px">No hay movimientos pendientes.</div>';return;}
  box.innerHTML=INBOX.map(it=>{const s=inboxSummary(it);return '<div class="ibrow" data-id="'+esc(it.id)+'"><div class="ibtop"><span>'+s.em+' <b>'+s.amt+'</b> · '+esc(s.where)+'</span><small>'+esc(s.when)+'</small></div>'+
    '<div class="ibsub">'+esc(s.cat)+(s.note?' · '+esc(s.note):'')+(s.date?' · '+s.date:'')+(s.items?' · 🧾 '+s.items+' ítems':'')+(it.complete===false?' · <i>incompleto</i>':'')+'</div>'+
    '<div class="ibbtns"><button class="ib-ok">Revisar y guardar</button><button class="ib-no">Descartar</button></div></div>';}).join('');
  box.querySelectorAll('.ibrow').forEach(row=>{const id=row.dataset.id;row.querySelector('.ib-ok').onclick=()=>inboxReview(id);row.querySelector('.ib-no').onclick=()=>{if(confirm('¿Descartar este movimiento de WhatsApp?'))inboxMarkDone([id],'discarded').then(renderInboxList);};});
}
function inboxReview(id){const it=INBOX.find(x=>x.id===id);if(!it)return;const d=it.draft||{};
  $('#inboxScrim').classList.remove('on');INBOX_EDIT=id;
  if(Array.isArray(d.items)&&d.items.length){openTicket({draft:d,source:'wa'});return;}
  openSheet(null,{type:d.type||'expense',amount:d.amount||'',account:d.account||undefined,category:d.category||undefined,sub:d.sub||undefined,note:d.note||'',date:d.date||localDate(),from:d.from,to:d.to,dueMonth:d.dueMonth,tags:d.tags});
  if(d.type!=='transfer'&&d.inst&&d.inst[1]>1&&isCard(d.account||'')){const b=document.querySelector('#paySeg button[data-p="inst"]');if(b){b.click();$('#f-inst').value=d.inst[1];setAmtLabel();}}
}
async function inboxMarkDone(ids,status){
  INBOX=INBOX.filter(x=>!ids.includes(x.id));renderInboxBar();
  CFG.inboxDoneQueue=(CFG.inboxDoneQueue||[]).concat(ids.map(id=>({id,status})));saveCfg();
  await flushInboxDone();
}
async function flushInboxDone(){
  const q=CFG.inboxDoneQueue||[];if(!q.length||!CFG.syncUrl)return;
  const by={};q.forEach(x=>{(by[x.status]=by[x.status]||[]).push(x.id);});
  for(const st of Object.keys(by)){try{const j=await apiPost('inboxDone',{ids:by[st],status:st});
    if(j&&j.ok){CFG.inboxDoneQueue=(CFG.inboxDoneQueue||[]).filter(x=>!(x.status===st&&by[st].includes(x.id)));saveCfg();}}catch(e){}}
}
$('#inboxBar').onclick=openInbox;$('#inboxBtn').onclick=openInbox;
$('#closeInbox').onclick=()=>$('#inboxScrim').classList.remove('on');$('#inboxScrim').onclick=e=>{if(e.target===$('#inboxScrim'))$('#inboxScrim').classList.remove('on');};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollInbox(false);});
