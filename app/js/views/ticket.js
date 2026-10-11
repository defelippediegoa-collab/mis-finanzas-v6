/* ---------- TICKET: escanear / cargar ítems ---------- */
// TK = estado del editor. items: [{desc,qty,unit,unitPrice(impreso),amount(impreso),discount,dmode:'spread'|'prev'|'line',cat:{category,sub}|null}]
// Al guardar, los ítems se agrupan por categoría efectiva y el ticket se guarda como UNA PARTE POR CATEGORÍA (movimientos unidos por ticketId).
let TK={items:[],merchant:'',date:'',total:null,currency:'ARS',warnings:[],source:'ticket',editId:null,previewUrl:null,pay:'once'};
function tkReset(){TK={items:[],merchant:'',date:localDate(),total:null,currency:'ARS',warnings:[],source:'ticket',editId:null,editTicketId:null,editParts:null,previewUrl:null,pay:'once',inboxId:null};}

function openTicket(preset){ // preset opcional: {file} (desde Compartir) | {editId} | {draft}
  tkReset();
  $('#menu').classList.remove('on');
  $('#tkPick').classList.remove('hidden');$('#tkBusy').classList.add('hidden');$('#tkForm').classList.add('hidden');$('#tkPreview').innerHTML='';
  $('#tkTitle').textContent='Escanear ticket';$('#tkDel').classList.add('hidden');
  $('#ticketScrim').classList.add('on');
  aiInfo().then(i=>{$('#tkAiHint').textContent=i.ai?('IA activa · '+i.model):('Sin IA: '+i.reason+' Podés cargar los ítems a mano.');});
  if(preset&&preset.editId)return tkEdit(preset.editId);
  if(preset&&preset.file){TK.source=preset.source||'share';return tkProcess(preset.file);}
  if(preset&&preset.draft){const d=preset.draft;TK.source=preset.source||'wa';TK.inboxId=INBOX_EDIT;
    TK.items=(d.items||[]).map(i=>tkItem({desc:i.desc,qty:i.qty,unit:i.unit,unitPrice:i.unitPrice!=null?i.unitPrice:i.unit_price,amount:i.amount,discount:!!(i.discount||i.is_discount)}));
    tkDefaultDiscountModes();
    TK.merchant=d.merchant||'';TK.date=d.date||localDate();TK.total=typeof d.amount==='number'?d.amount:null;TK.currency=d.currency||'ARS';TK.warnings=d.warnings||[];
    $('#tkPick').classList.add('hidden');tkShowForm();tkAutoLink(false);
    if(d.account)fillAccounts($('#tk-account'),d.account);if(d.category){fill($('#tk-category'),DB.cats.expense,d.category);tkRefreshSub(d.sub);}if(d.note)$('#tk-note').value=d.note;tkRefreshPay();return;}
}
function tkItem(o){return{desc:o.desc||'',qty:typeof o.qty==='number'&&o.qty>0?o.qty:1,unit:o.unit||'u',unitPrice:typeof o.unitPrice==='number'?o.unitPrice:null,amount:typeof o.amount==='number'?o.amount:0,discount:!!o.discount,dmode:o.dmode||'line',cat:o.cat||null,pos:o.pos,productId:o.productId||null,_m:null};}
// Vincula los ítems a productos: alias exacto/heurística al instante; IA en segundo plano si está disponible (nunca bloquea Guardar)
async function tkAutoLink(useAi){const rows=TK.items.filter(i=>!i.discount&&!i.productId&&(i.desc||'').trim());if(!rows.length)return;
  const m=matchDescs(rows.map(i=>({desc:i.desc,unit:i.unit})));rows.forEach((i,k)=>{if(m[k].status==='exact'||m[k].status==='auto'){i.productId=m[k].productId;i._m=null;}else i._m=m[k];});
  tkRenderChips();
  if(!useAi)return;const todo=rows.filter(i=>!i.productId);if(!todo.length)return;
  try{const inf=await aiInfo();if(!inf.ai)return;const descs=todo.map((i,k)=>({i:k,desc:i.desc,unit:i.unit,merchant:TK.merchant||''}));const res=await aiProducts(descs,buildAiCatalog(descs));
    (res.results||[]).forEach(x=>{const it=todo[x.i];if(!it||it.productId)return;const conf=x.confidence||0;
      if(x.productId&&productById(x.productId)){if(conf>=0.8)it.productId=x.productId;else it._m={status:'suggest',candidates:[{id:x.productId,score:conf}]};}
      else if(x.new&&x.new.name)it._m={status:'new',nw:x.new,candidates:(it._m&&it._m.candidates)||[],score:conf};});
    tkRenderChips();}catch(e){}}
function tkChipHtml(i){if(i.discount)return'';const p=i.productId?productById(i.productId):null;
  if(p)return '<button class="tkprod set" title="Producto">🏷 '+esc(p.name)+'</button>';
  if(i._m&&i._m.status==='new')return '<button class="tkprod sug" title="Crear producto sugerido por la IA">＋ '+esc(i._m.nw.name)+'?</button>';
  if(i._m&&i._m.candidates&&i._m.candidates.length){const c=productById(i._m.candidates[0].id);if(c)return '<button class="tkprod sug" title="Sugerido: tocá para confirmar">≈ '+esc(c.name)+'?</button>';}
  return '<button class="tkprod" title="Vincular a un producto para seguir su precio">¿producto?</button>';}
function tkRenderChips(){$('#tkItems').querySelectorAll('.tkrow').forEach(row=>{const k=+row.dataset.k;const it=TK.items[k];if(!it||it.discount)return;let el=row.querySelector('.tkprod');const html=tkChipHtml(it);
    if(el){el.outerHTML=html;}else row.querySelector('.tk2').insertAdjacentHTML('beforeend',html);el=row.querySelector('.tkprod');if(el)el.onclick=()=>tkChipClick(k);});}
function tkChipClick(k){const it=TK.items[k];const m=it._m||{};
  if(!it.productId&&m.status==='suggest'&&m.candidates.length&&m.candidates[0].score>=0.7){it.productId=m.candidates[0].id;it._m=null;tkRenderChips();toast('Vinculado · tocá de nuevo para cambiar');return;}
  if(!it.productId&&m.status==='new'){ // la IA propone un producto nuevo: abrir el picker con el formulario prellenado
    openProductPicker({desc:it.desc,unit:it.unit,suggestions:m.candidates,newDefaults:m.nw,alsoCandidates:tkOtherRows(k)}).then(r=>tkApplyPick(k,r));return;}
  openProductPicker({desc:it.desc,unit:it.unit,suggestions:m.candidates||[],currentId:it.productId,alsoCandidates:tkOtherRows(k)}).then(r=>tkApplyPick(k,r));}
function tkOtherRows(k){return TK.items.map((x,j)=>({desc:x.desc,key:'row:'+j,j})).filter(o=>o.j!==k&&!TK.items[o.j].discount&&!TK.items[o.j].productId);}
function tkApplyPick(k,r){if(!r)return;const it=TK.items[k];if(r.unlink){it.productId=null;it._m=null;}else if(r.productId){it.productId=r.productId;it._m=null;(r.alsoKeys||[]).forEach(key=>{const j=+key.slice(4);if(TK.items[j]){TK.items[j].productId=r.productId;TK.items[j]._m=null;}});}
  tkRenderChips();}
// Descuento al final del ticket → repartir; descuento entre ítems → al ítem de arriba. El usuario puede cambiarlo.
function tkDefaultDiscountModes(){const n=TK.items.length;TK.items.forEach((i,k)=>{if(!i.discount||i._modeSet)return;const after=TK.items.slice(k+1).some(x=>!x.discount);i.dmode=after?'prev':'spread';});}

// ---- edición: carga todas las partes del ticket y reconstruye los ítems en su orden original ----
function tkEdit(id){const t=DB.tx.find(x=>x.id===id);if(!t)return;
  const tid=t.ticketId||null;
  const parts=tid?DB.tx.filter(x=>x.ticketId===tid):[t];
  const firsts=parts.filter(x=>!x.inst||x.inst[0]===1); // una por parte (la cuota 1 lleva los ítems)
  const main=firsts.find(x=>!x.ticketPart||x.ticketPart[0]===1)||firsts[0];
  TK.editId=id;TK.editTicketId=tid;TK.editParts=parts;
  const rows=[];
  firsts.forEach(p=>{const isMain=p===main;(p.items||[]).forEach(i=>{
    if(i.discount||i.amount<0){rows.push(tkItem({desc:i.desc,qty:i.qty,unit:i.unit,unitPrice:null,amount:i.amount,discount:true,dmode:'line',pos:i.pos}));return;}
    const printed=Math.round((i.amount+(i.discountAlloc||0))*100)/100;
    rows.push(tkItem({desc:i.desc,qty:i.qty,unit:i.unit,unitPrice:i.listPrice!=null?i.listPrice:i.unitPrice,amount:printed,cat:isMain?null:{category:p.category,sub:p.sub||''},pos:i.pos,productId:i.productId}));});});
  (main.discounts||[]).forEach(d=>{if(d.mode==='line')return;rows.push(tkItem({desc:d.desc,qty:1,unit:'u',amount:-Math.abs(d.amount),discount:true,dmode:d.mode,pos:d.pos}));});
  rows.forEach((r,k)=>{if(r.pos==null)r.pos=1000+k;r._modeSet=true;});rows.sort((a,b)=>a.pos-b.pos);
  TK.items=rows;
  TK.merchant=main.merchant||'';TK.date=main.purchaseDate||main.date;TK.currency=main.currency||'ARS';
  // total del ticket = suma de todas las partes (por cuota × cuotas)
  TK.total=Math.round(parts.reduce((s,p)=>s+p.amount,0)*100)/100; // suma de todas las partes y cuotas
  $('#tkTitle').textContent='Ítems del ticket'+(parts.length>1?' · '+firsts.length+' parte'+(firsts.length>1?'s':'')+(main.inst?' × '+main.inst[1]+' cuotas':''):'');$('#tkDel').classList.remove('hidden');
  tkShowForm(main);tkAutoLink(false);
}
async function tkProcess(file){
  $('#tkPick').classList.add('hidden');$('#tkBusy').classList.remove('hidden');$('#tkBusyTxt').textContent='Leyendo el ticket…';
  try{const info=await aiInfo();
    if(!info.ai){toast('IA no disponible: cargá los ítems a mano');tkManual();return;}
    const r=await aiTicket(file);const res=r.result||{};
    TK.previewUrl=r.previewUrl;
    TK.merchant=res.merchant||'';TK.date=res.date||localDate();TK.currency=res.currency==='USD'?'USD':'ARS';
    TK.total=typeof res.total==='number'?res.total:null;TK.warnings=res.warnings||[];
    TK.items=(res.items||[]).map(i=>tkItem({desc:i.desc,qty:i.qty,unit:i.unit,unitPrice:i.unit_price,amount:i.amount,discount:!!i.is_discount}));
    tkDefaultDiscountModes();
    if(res.payment_hint)TK.paymentHint=res.payment_hint;
    if(typeof res.confidence==='number'&&res.confidence<0.5)TK.warnings.unshift('La IA no está segura de esta lectura (confianza '+Math.round(res.confidence*100)+'%). Revisá los números.');
    tkShowForm();tkAutoLink(true);
    if(TK.previewUrl)$('#tkPreview').innerHTML='<img src="'+TK.previewUrl+'" alt="ticket">';
  }catch(e){toast(e.message||'No se pudo leer el ticket');tkManual();}
}
function tkManual(){TK.source=TK.editId?TK.source:'manual';$('#tkPick').classList.add('hidden');$('#tkBusy').classList.add('hidden');if(!TK.items.length)TK.items=[tkItem({})];tkShowForm();}

function tkShowForm(t){
  $('#tkBusy').classList.add('hidden');$('#tkForm').classList.remove('hidden');
  $('#tk-merchant').value=TK.merchant;$('#tk-date').value=TK.date||localDate();$('#tk-total').value=TK.total==null?'':TK.total;
  $('#tkWarn').innerHTML=TK.warnings.length?TK.warnings.map(w=>'⚠️ '+esc(w)).join('<br>'):'';$('#tkWarn').classList.toggle('hidden',!TK.warnings.length);
  const edit=!!TK.editId;
  $('#tkPayWrap').classList.toggle('hidden',edit);
  if(!edit){
    let acc;const hint=normKey(TK.paymentHint||''); // cuenta sugerida por payment_hint
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
    $('#tkRefWrap').classList.remove('hidden');$('#tk-ref-on').checked=false;$('#tk-ref-fields').classList.add('hidden');fillAccounts($('#tk-ref-acc'),(DB.accounts.find(a=>a.type==='Cuentas')||{}).name);$('#tk-ref-pct').value='';$('#tk-ref-amt').value='';$('#tk-ref-due').value=shiftMonthStr(localDate(),1);
  }else{$('#tkRefWrap').classList.add('hidden');
    fill($('#tk-category'),DB.cats.expense,t.category);tkRefreshSub(t.sub);
    $('#tk-note').value=tkBaseNote(t.note,t);
  }
  tkRenderItems();
}
function tkBaseNote(note,t){let n=stripInst(note||'');if(t&&t.ticketPart&&t.category){const suf=' · '+t.category;if(n.endsWith(suf))n=n.slice(0,-suf.length);}return n.trim();}
function tkRefreshSub(s0){const cat=$('#tk-category').value;fill($('#tk-sub'),['—',...(DB.subs[cat]||[])],s0||'—');}
function tkRefreshPay(){const card=isCard($('#tk-account').value);$('#tkCard').classList.toggle('hidden',!card);if(!card)return;$('#tkOnce').classList.toggle('hidden',TK.pay!=='once');$('#tkInst').classList.toggle('hidden',TK.pay!=='inst');}
$('#tk-account').onchange=tkRefreshPay;$('#tk-category').onchange=()=>{tkRefreshSub();tkRenderItems();};$('#tk-sub').onchange=()=>tkRenderItems();
document.querySelectorAll('#tkPaySeg button').forEach(b=>b.onclick=()=>{TK.pay=b.dataset.p;document.querySelectorAll('#tkPaySeg button').forEach(x=>x.classList.toggle('on',x===b));tkRefreshPay();});
$('#tk-date').onchange=()=>{const d=new Date($('#tk-date').value+'T12:00:00');if(isNaN(d))return;const nm=ym(new Date(d.getFullYear(),d.getMonth()+1,1));$('#tk-paymonth').value=nm;$('#tk-due').value=nm;};

// ---- filas ----
const DMODE_LABEL={spread:'↔ Repartir entre todos los ítems',prev:'↑ Al ítem de arriba',line:'≡ Dejar como línea aparte'};
function tkRenderItems(){
  const box=$('#tkItems');const gcat=$('#tk-category').value,gsub=$('#tk-sub').value==='—'?'':$('#tk-sub').value;
  box.innerHTML=TK.items.map((i,k)=>{
    let line2;
    if(i.discount){line2='<select class="tk-dmode" title="Cómo aplicar el descuento">'+Object.entries(DMODE_LABEL).map(([v,l])=>'<option value="'+v+'"'+(i.dmode===v?' selected':'')+'>'+l+'</option>').join('')+'</select>';}
    else{const c=i.cat;const same=!c||(c.category===gcat&&(c.sub||'')===gsub);line2='<button class="tkcat'+(same?'':' set')+'" title="Categoría de este ítem">'+(same?'= '+esc(gcat)+(gsub?' › '+esc(gsub):''):esc(c.category)+(c.sub?' › '+esc(c.sub):''))+'</button>'+(i.discountAllocPreview?'<span class="tkalloc">−'+money(i.discountAllocPreview,TK.currency)+' dto.</span>':'');}
    return '<div class="tkrow'+(i.discount?' disc':'')+'" data-k="'+k+'">'+
    '<input class="tk-desc" value="'+esc(i.desc)+'" placeholder="Ítem">'+
    '<input class="tk-qty" type="number" inputmode="decimal" step="any" value="'+(i.qty==null?1:i.qty)+'" title="Cantidad">'+
    '<input class="tk-amt" type="number" inputmode="decimal" step="any" value="'+(i.amount==null?'':i.amount)+'" placeholder="0" title="Importe">'+
    '<button class="tk-x" title="Quitar">×</button><div class="tk2">'+line2+'</div></div>';}).join('');
  box.querySelectorAll('.tkrow').forEach(row=>{const k=+row.dataset.k;
    row.querySelector('.tk-desc').oninput=e=>{TK.items[k].desc=e.target.value;};row.querySelector('.tk-desc').onblur=()=>{const it=TK.items[k];if(it&&!it.discount&&!it.productId&&it.desc.trim()){const m=matchDescs([{desc:it.desc,unit:it.unit}])[0];if(m.status==='exact'||m.status==='auto')it.productId=m.productId;else it._m=m;tkRenderChips();}};
    row.querySelector('.tk-qty').oninput=e=>{TK.items[k].qty=parseFloat(e.target.value)||1;};
    row.querySelector('.tk-amt').oninput=e=>{const it=TK.items[k];it.amount=parseFloat(e.target.value)||0;const wasD=it.discount;it.discount=it.amount<0;if(it.discount!==wasD){it._modeSet=false;tkDefaultDiscountModes();tkRenderItems();return;}tkSumHint();};
    row.querySelector('.tk-x').onclick=()=>{TK.items.splice(k,1);tkRenderItems();};
    const dm=row.querySelector('.tk-dmode');if(dm)dm.onchange=()=>{TK.items[k].dmode=dm.value;TK.items[k]._modeSet=true;tkPreviewAlloc();};
    const cb=row.querySelector('.tkcat');if(cb)cb.onclick=()=>openTkCatPicker(k);});
  const hasD=TK.items.some(i=>i.discount);$('#tkDiscBar').classList.toggle('hidden',!hasD);
  tkRenderChips();tkPreviewAlloc();tkSumHint();
}
$('#tkSpreadAll').onclick=e=>{e.preventDefault();TK.items.forEach(i=>{if(i.discount){i.dmode='spread';i._modeSet=true;}});tkRenderItems();};
// Muestra cuánto descuento le toca a cada ítem con los modos actuales
function tkPreviewAlloc(){const eff=tkEffective();const byPos=new Map(eff.items.map(i=>[i._k,i.discountAlloc]));
  $('#tkItems').querySelectorAll('.tkrow').forEach(row=>{const k=+row.dataset.k;const a=byPos.get(k);let el=row.querySelector('.tkalloc');
    if(a>0){if(!el){el=document.createElement('span');el.className='tkalloc';row.querySelector('.tk2').appendChild(el);}el.textContent='−'+money(a,TK.currency)+' dto.';}else if(el)el.remove();});}

// ---- ítems efectivos: aplica descuentos según su modo ----
// Devuelve {items:[{...ítem, amount neto, listPrice, unitPrice, discountAlloc, category?, sub?, pos, _k}], lines:[descuentos que quedan como línea], discounts:[{desc,amount,mode,pos}]}
function tkEffective(){
  const src=TK.items.map((i,k)=>Object.assign({},i,{_k:k,pos:i.pos!=null?i.pos:k}));
  const items=[],lines=[],discounts=[];let spread=0;
  src.forEach((i,k)=>{
    const amt=Math.round((parseFloat(i.amount)||0)*100)/100;
    if(!i.discount){items.push(Object.assign({},i,{printed:amt,amount:amt,alloc:0}));return;}
    const d={desc:(i.desc||'').trim()||'Descuento',amount:Math.round(Math.abs(amt)*100)/100,mode:i.dmode||'line',pos:i.pos};
    if(!d.amount)return;
    if(d.mode==='prev'){const prev=items[items.length-1];if(prev){prev.alloc=Math.round((prev.alloc+d.amount)*100)/100;discounts.push(d);}else{d.mode='spread';spread+=d.amount;discounts.push(d);}}
    else if(d.mode==='spread'){spread+=d.amount;discounts.push(d);}
    else{lines.push(Object.assign({},i,{amount:-d.amount}));discounts.push(d);}
  });
  if(spread>0&&items.length){const base=items.map(i=>Math.max(0,i.printed-i.alloc));const tot=base.reduce((s,v)=>s+v,0);
    let acc=0;items.forEach((i,k)=>{const a=tot>0?Math.round(spread*base[k]/tot*100)/100:Math.round(spread/items.length*100)/100;i.alloc=Math.round((i.alloc+a)*100)/100;acc+=a;});
    const rem=Math.round((spread-acc)*100)/100;if(rem){let bi=0;base.forEach((v,k)=>{if(v>base[bi])bi=k;});items[bi].alloc=Math.round((items[bi].alloc+rem)*100)/100;}}
  const out=items.map(i=>{const qty=parseFloat(i.qty)||1;const amount=Math.round((i.printed-i.alloc)*100)/100;const listPrice=i.unitPrice!=null?i.unitPrice:(qty?Math.round(i.printed/qty*100)/100:null);
    const o={desc:(i.desc||'').trim()||'Ítem',key:normKey(i.desc),qty,unit:i.unit||'u',listPrice,unitPrice:qty?Math.round(amount/qty*100)/100:null,amount,discount:false,pos:i.pos,_k:i._k,discountAlloc:i.alloc||0};
    if(i.cat&&i.cat.category)o.category=i.cat.category,o.sub=i.cat.sub||'';
    if(i.productId)o.productId=i.productId;
    return o;}).filter(i=>i.desc!=='Ítem'||i.amount);
  const outLines=lines.map(i=>({desc:(i.desc||'').trim()||'Descuento',key:normKey(i.desc),qty:1,unit:'u',listPrice:null,unitPrice:null,amount:i.amount,discount:true,pos:i.pos}));
  return{items:out,lines:outLines,discounts};
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
$('#tkAdd').onclick=()=>{TK.items.push(tkItem({}));tkRenderItems();const rows=$('#tkItems').querySelectorAll('.tk-desc');rows[rows.length-1].focus();};

// ---- categoría por ítem ----
let _tkCatK=null;
function openTkCatPicker(k){_tkCatK=k;const it=TK.items[k];const gcat=$('#tk-category').value;
  fill($('#tkc-cat'),DB.cats.expense,it.cat?it.cat.category:gcat);tkcSub(it.cat?it.cat.sub:'');
  $('#tkcItem').textContent=it.desc||'Ítem';
  const others=TK.items.map((x,j)=>({x,j})).filter(o=>o.j!==k&&!o.x.discount);
  $('#tkcOthers').innerHTML=others.length?'<div class="hint" style="margin:8px 0 4px">También aplicar a:</div>'+others.map(o=>'<label class="tkcrow"><input type="checkbox" data-j="'+o.j+'"> '+esc(o.x.desc||'Ítem')+'</label>').join(''):'';
  $('#tkCatScrim').classList.add('on');}
function tkcSub(s0){fill($('#tkc-sub'),['—',...(DB.subs[$('#tkc-cat').value]||[])],s0||'—');}
$('#tkc-cat').onchange=()=>tkcSub();
function tkcApply(cat){const ks=[_tkCatK,...[...$('#tkcOthers').querySelectorAll('input:checked')].map(c=>+c.dataset.j)];ks.forEach(j=>{if(TK.items[j])TK.items[j].cat=cat;});$('#tkCatScrim').classList.remove('on');tkRenderItems();}
$('#tkcOk').onclick=()=>{const sub=$('#tkc-sub').value==='—'?'':$('#tkc-sub').value;tkcApply({category:$('#tkc-cat').value,sub});};
$('#tkcSame').onclick=()=>tkcApply(null);
$('#closeTkCat').onclick=()=>$('#tkCatScrim').classList.remove('on');$('#tkCatScrim').onclick=e=>{if(e.target===$('#tkCatScrim'))$('#tkCatScrim').classList.remove('on');};

$('#tkCam').onclick=()=>$('#tkCamIn').click();$('#tkFile').onclick=()=>$('#tkFileIn').click();$('#tkManual').onclick=tkManual;
$('#tkCamIn').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)tkProcess(f);};
$('#tkFileIn').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)tkProcess(f);};
$('#closeTicket').onclick=()=>$('#ticketScrim').classList.remove('on');$('#ticketScrim').onclick=e=>{if(e.target===$('#ticketScrim'))$('#ticketScrim').classList.remove('on');};
$('#fabTicket').onclick=()=>openTicket();$('#ticketBtn').onclick=()=>openTicket();

// ---- partes: una por (categoría, sub) efectiva; la principal es la del ticket y absorbe líneas y redondeo ----
function tkBuildParts(total,gcat,gsub){
  const eff=tkEffective();const parts=[];const byKey=new Map();
  const get=(c,s)=>{const key=c+'\u0001'+(s||'');let p=byKey.get(key);if(!p){p={category:c,sub:s||'',items:[],amount:0};byKey.set(key,p);parts.push(p);}return p;};
  const main=get(gcat,gsub);
  eff.items.forEach(i=>{const p=i.category?get(i.category,i.sub):main;const o=Object.assign({},i);delete o._k;p.items.push(o);});
  eff.lines.forEach(l=>main.items.push(l));
  parts.forEach(p=>{p.amount=Math.round(p.items.reduce((s,i)=>s+i.amount,0)*100)/100;});
  const sum=Math.round(parts.reduce((s,p)=>s+p.amount,0)*100)/100;
  if(parts.length>1){const diff=Math.round((total-sum)*100)/100;main.amount=Math.round((main.amount+diff)*100)/100;}else main.amount=total;
  parts.sort((a,b)=>(a===main?-1:b===main?1:0));
  return{parts,discounts:eff.discounts};
}

$('#tkSave').onclick=()=>{
  const merchant=$('#tk-merchant').value.trim();const date=$('#tk-date').value||localDate();
  let total=parseFloat($('#tk-total').value);if(isNaN(total)||total<=0){total=tkSum();if(!total||total<=0){toast('Poné el total');return;}}
  total=Math.round(total*100)/100;
  const gcat=$('#tk-category').value,gsub=$('#tk-sub').value==='—'?'':$('#tk-sub').value;
  const note=$('#tk-note').value.trim()||merchant||'ticket';
  const{parts,discounts}=tkBuildParts(total,gcat,gsub);
  if(parts.some(p=>p.amount<0)){toast('Una parte queda con importe negativo: revisá los descuentos');return;}
  let base,sid,n=1,firstDue=null,payMonth=null,card=false,createdAt=Date.now();
  if(TK.editId){ // regenerar las partes del ticket conservando cuenta, cuotas y fecha de compra
    const old=TK.editParts;const m=old.find(x=>!x.ticketPart||x.ticketPart[0]===1)||old[0];
    sid=TK.editTicketId||m.id;card=isCard(m.account);n=m.inst?m.inst[1]:1;firstDue=m.inst?m.dueMonth:null;payMonth=(!m.inst&&m.dueMonth)||null;createdAt=m.createdAt||createdAt;
    base={type:'expense',account:m.account,currency:m.currency||curOf(m.account),note,source:m.source||'ticket',createdAt,updatedAt:Date.now()};
    if(m.tags)base.tags=m.tags;if(m.inboxId)base.inboxId=m.inboxId;if(m.refund)base.refund=m.refund;
    DB.tx=DB.tx.filter(x=>!old.includes(x));
  }else{
    const accName=$('#tk-account').value;if(!accName){toast('Elegí la cuenta');return;}
    card=isCard(accName);sid='u'+Date.now();
    base={type:'expense',account:accName,currency:curOf(accName),note,source:TK.source||'ticket',createdAt};if(TK.inboxId)base.inboxId=TK.inboxId;
    if(card&&TK.pay==='inst'){n=Math.max(2,parseInt($('#tk-inst').value)||2);firstDue=$('#tk-due').value;}else if(card)payMonth=$('#tk-paymonth').value;
  }
  if(merchant)base.merchant=merchant;
  const K=parts.length;
  parts.forEach((p,k)=>{
    const pb={...base,category:p.category,sub:p.sub,ticketId:sid};
    if(K>1){pb.ticketPart=[k+1,K];if(k>0)pb.note=note+' · '+p.category;}
    if(k===0&&discounts.length)pb.discounts=discounts;
    const pid=K>1?sid+'_'+(k+1):sid;
    if(n>1){const per=Math.round(p.amount/n*100)/100;const[fy,fm]=firstDue.split('-').map(Number);
      for(let i=0;i<n;i++){const pay=new Date(fy,fm-1+i,1);const rec={...pb,id:pid+'_'+i,date:shiftMonthStr(date,i),amount:i===n-1?Math.round((p.amount-per*(n-1))*100)/100:per,dueMonth:ym(pay),purchaseDate:date,inst:[i+1,n],note:pb.note+' ('+(i+1)+'/'+n+')'};
        if(i===0&&p.items.length)rec.items=p.items;DB.tx.push(rec);}}
    else{const rec={...pb,id:pid,date,amount:p.amount};if(p.items.length)rec.items=p.items;if(card&&payMonth){rec.dueMonth=payMonth;rec.purchaseDate=date;}DB.tx.push(rec);}
  });
  if(typeof commitItemLinks==='function')commitItemLinks(parts.flatMap(p=>p.items));
  if(!TK.editId&&$('#tk-ref-on').checked){const pct=parseFloat($('#tk-ref-pct').value)||0;let ra=parseFloat($('#tk-ref-amt').value)||0;if(pct>0)ra=Math.round(total*pct/100*100)/100;
    if(ra>0){const main=DB.tx.find(x=>x.ticketId===sid&&(!x.ticketPart||x.ticketPart[0]===1)&&(!x.inst||x.inst[0]===1));if(main)main.refund={pct:pct>0?pct:0,amount:ra,account:$('#tk-ref-acc').value,due:$('#tk-ref-due').value||localDate()};
      createRefundIncome(sid,{amount:ra,account:$('#tk-ref-acc').value,due:$('#tk-ref-due').value||localDate(),note:'Reintegro '+(pct?pct+'% ':'')+(merchant||note)});}}
  if(TK.inboxId){inboxMarkDone([TK.inboxId],'done');TK.inboxId=null;INBOX_EDIT=null;}
  persist();$('#ticketScrim').classList.remove('on');cur=new Date(+date.slice(0,4),+date.slice(5,7)-1,1);
  if(TK.editId){render();if(detail&&detailRefresh)detailRefresh();}else setView('trans');
  const nItems=parts.reduce((s,p)=>s+p.items.filter(i=>!i.discount).length,0);
  toast((TK.editId?'Ticket actualizado':'Ticket guardado')+(nItems?' · '+nItems+' ítems':'')+(K>1?' · '+K+' categorías':''));
};
$('#tkDel').onclick=()=>{if(!TK.editId)return;const parts=TK.editParts||[];if(!parts.length)return;
  if(parts.length>1){if(!confirm('Este ticket tiene '+parts.length+' movimientos (partes o cuotas). ¿Eliminar el ticket completo?'))return;DB.tx=DB.tx.filter(x=>!parts.includes(x));persist();$('#ticketScrim').classList.remove('on');render();toast('Ticket eliminado');return;}
  const t=parts[0];if(!confirm('¿Quitar el detalle de ítems de este movimiento? (el movimiento queda)'))return;delete t.items;delete t.discounts;t.updatedAt=Date.now();persist();$('#ticketScrim').classList.remove('on');render();toast('Ítems quitados');};
