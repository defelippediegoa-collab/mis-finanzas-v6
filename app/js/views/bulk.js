/* ---------- EDICIÓN MASIVA (supervisada): filtrar, seleccionar varios, cambiar un campo a todos ---------- */
const BK={sel:new Set(),rows:[],undo:null,action:'category'};
const BK_MAX_ROWS=300;
function openBulk(){$('#menu').classList.remove('on');BK.sel.clear();
  const m=ym(cur);$('#bk-from').value=m;$('#bk-to').value=m;
  fill($('#bk-type'),['Todos','Gastos','Ingresos','Transferencias'],'Todos');
  fillAccounts($('#bk-account'),'(todas)','(todas)');
  fill($('#bk-cat'),['(todas)','(sin categoría)',...DB.cats.expense,...DB.cats.income],'(todas)');
  bkFillSub();fill($('#bk-source'),['(todos)','app','ticket','wa','share','manual','import'],'(todos)');
  $('#bk-q').value='';$('#bk-tag').value='';
  fill($('#bk-action'),['Cambiar categoría','Cambiar subcategoría','Cambiar cuenta','Agregar etiqueta','Quitar etiqueta'],'Cambiar categoría');
  bkActionUI();bkRun();$('#bulkScrim').classList.add('on');}
function bkFillSub(){const c=$('#bk-cat').value;const subs=(c&&!c.startsWith('(')&&DB.subs[c])||[];fill($('#bk-sub'),['(todas)','(sin sub)',...subs],'(todas)');}
$('#bk-cat').onchange=()=>{bkFillSub();bkRun();};
['#bk-from','#bk-to','#bk-type','#bk-account','#bk-sub','#bk-source'].forEach(s=>$(s).onchange=bkRun);
$('#bk-q').oninput=bkRun;$('#bk-tag').oninput=bkRun;
function bkFilter(){
  const from=$('#bk-from').value||'0000-00',to=$('#bk-to').value||'9999-99';
  const ty={'Todos':null,'Gastos':'expense','Ingresos':'income','Transferencias':'transfer'}[$('#bk-type').value];
  const acc=$('#bk-account').value,cat=$('#bk-cat').value,sub=$('#bk-sub').value,src=$('#bk-source').value;
  const q=normKey($('#bk-q').value),tag=normKey($('#bk-tag').value);
  return DB.tx.filter(t=>{const m=ymOf(t.date);if(m<from||m>to)return false;if(ty&&t.type!==ty)return false;
    if(acc!=='(todas)'&&t.account!==acc&&t.from!==acc&&t.to!==acc)return false;
    if(cat==='(sin categoría)'){if(t.type==='transfer'||t.category)return false;}else if(cat!=='(todas)'&&t.category!==cat)return false;
    if(sub==='(sin sub)'){if(t.type==='transfer'||t.sub)return false;}else if(sub!=='(todas)'&&t.sub!==sub)return false;
    if(src!=='(todos)'&&(t.source||'')!==src)return false;
    if(tag&&!(t.tags||[]).some(g=>normKey(g).includes(tag)))return false;
    if(q&&!(normKey(t.note).includes(q)||normKey(t.merchant).includes(q)||normKey(t.account).includes(q)||normKey(t.category).includes(q)||normKey(t.sub).includes(q)))return false;
    return true;}).sort((a,b)=>b.date.localeCompare(a.date));
}
function bkRun(){BK.rows=bkFilter();const ids=new Set(BK.rows.map(t=>t.id));[...BK.sel].forEach(id=>{if(!ids.has(id))BK.sel.delete(id);});bkRenderList();}
function bkRenderList(){
  const rows=BK.rows;const tot=rows.reduce((s,t)=>s+(t.type==='expense'?toARS(t.amount,t.currency||'ARS'):0),0);
  $('#bk-count').innerHTML='<b>'+rows.length+'</b> movimientos · gastos '+money(tot)+(rows.length>BK_MAX_ROWS?' · se muestran '+BK_MAX_ROWS:'');
  const show=rows.slice(0,BK_MAX_ROWS);
  $('#bk-list').innerHTML=show.map(t=>{const on=BK.sel.has(t.id);const nm=t.type==='transfer'?((t.from||'')+' → '+(t.to||'')):(t.merchant||stripInst(t.note)||t.sub||t.category||'—');
    const sub=t.date.slice(5)+' · '+(t.type==='transfer'?'transferencia':(esc(t.account||'')+' · '+esc(t.category||'sin cat.')+(t.sub?' › '+esc(t.sub):'')))+((t.tags||[]).length?' · #'+t.tags.join(' #'):'')+(t.inst?' · cuota '+t.inst[0]+'/'+t.inst[1]+' <a href="#" class="bk-serie" data-id="'+esc(t.id)+'">serie</a>':'');
    return '<label class="bkrow'+(on?' on':'')+'" data-id="'+esc(t.id)+'"><input type="checkbox"'+(on?' checked':'')+'><div class="bki"><div class="bkn">'+esc(nm)+'</div><div class="bks">'+sub+'</div></div><div class="bka '+(t.type==='income'?'pos':(t.type==='expense'?'neg':''))+'">'+money(t.amount,t.currency||'ARS')+'</div></label>';}).join('')||'<div class="empty" style="padding:20px">Nada con esos filtros.</div>';
  $('#bk-list').querySelectorAll('.bkrow input').forEach(cb=>cb.onchange=()=>{const id=cb.closest('.bkrow').dataset.id;if(cb.checked)BK.sel.add(id);else BK.sel.delete(id);cb.closest('.bkrow').classList.toggle('on',cb.checked);bkSelUI();});
  $('#bk-list').querySelectorAll('.bk-serie').forEach(a=>a.onclick=e=>{e.preventDefault();e.stopPropagation();const prefix=a.dataset.id.split('_')[0];DB.tx.forEach(t=>{if(t.id.split('_')[0]===prefix)BK.sel.add(t.id);});bkRenderList();});
  bkSelUI();
}
function bkSelUI(){const n=BK.sel.size;$('#bk-selcount').textContent=n?(n+' seleccionado'+(n>1?'s':'')):'nada seleccionado';$('#bk-actions').classList.toggle('hidden',!n);bkPreview();}
$('#bk-all').onclick=()=>{BK.rows.slice(0,BK_MAX_ROWS).forEach(t=>BK.sel.add(t.id));bkRenderList();};
$('#bk-none').onclick=()=>{BK.sel.clear();bkRenderList();};
$('#bk-invert').onclick=()=>{BK.rows.slice(0,BK_MAX_ROWS).forEach(t=>{if(BK.sel.has(t.id))BK.sel.delete(t.id);else BK.sel.add(t.id);});bkRenderList();};
$('#bk-action').onchange=()=>{bkActionUI();};
function bkActionUI(){const a=$('#bk-action').value;BK.action=a;
  $('#bk-a-cat').classList.toggle('hidden',a!=='Cambiar categoría');$('#bk-a-sub').classList.toggle('hidden',!(a==='Cambiar categoría'||a==='Cambiar subcategoría'));
  $('#bk-a-acc').classList.toggle('hidden',a!=='Cambiar cuenta');$('#bk-a-tag').classList.toggle('hidden',!(a==='Agregar etiqueta'||a==='Quitar etiqueta'));
  $('#bk-remember-wrap').classList.toggle('hidden',a!=='Cambiar categoría');
  if(a==='Cambiar categoría'){fill($('#bk-new-cat'),[...DB.cats.expense,...DB.cats.income]);bkNewSub();}
  if(a==='Cambiar subcategoría'){const sel=[...BK.sel].map(id=>DB.tx.find(t=>t.id===id)).filter(Boolean);const cats=[...new Set(sel.map(t=>t.category).filter(Boolean))];fill($('#bk-new-sub'),['—',...(cats.length===1?(DB.subs[cats[0]]||[]):[])]);$('#bk-sub-hint').textContent=cats.length===1?'':'Seleccioná movimientos de una sola categoría para elegir subcategoría.';}
  if(a==='Cambiar cuenta')fillAccounts($('#bk-new-acc'));
  $('#bk-tag-sugg').innerHTML=[...new Set(DB.tx.flatMap(x=>x.tags||[]))].sort().map(g=>'<option value="'+esc(g)+'">').join('');
  bkPreview();}
function bkNewSub(){const c=$('#bk-new-cat').value;fill($('#bk-new-sub'),['—',...(DB.subs[c]||[])]);$('#bk-sub-hint').textContent='';}
$('#bk-new-cat').onchange=()=>{bkNewSub();bkPreview();};$('#bk-new-sub').onchange=bkPreview;$('#bk-new-acc').onchange=bkPreview;$('#bk-new-tag').oninput=bkPreview;
function bkSelected(){return [...BK.sel].map(id=>DB.tx.find(t=>t.id===id)).filter(Boolean);}
function bkPlan(){const sel=bkSelected();const a=BK.action;const plan={ok:true,msg:'',apply:null,touched:[]};if(!sel.length){plan.ok=false;return plan;}
  if(a==='Cambiar categoría'){const cat=$('#bk-new-cat').value,sub=$('#bk-new-sub').value==='—'?'':$('#bk-new-sub').value;const tgt=sel.filter(t=>t.type!=='transfer');
    const kinds=new Set(tgt.map(t=>DB.cats.income.includes(cat)?(t.type==='income'?'ok':'bad'):(t.type==='expense'?'ok':'bad')));
    if(kinds.has('bad')){plan.ok=false;plan.msg='La categoría "'+cat+'" no es del tipo de todos los movimientos seleccionados.';return plan;}
    const from=[...new Set(tgt.map(t=>(t.category||'sin cat.')+(t.sub?' › '+t.sub:'')))];
    plan.msg=tgt.length+' movimiento'+(tgt.length>1?'s':'')+': '+(from.length<=3?from.join(', '):from.length+' combinaciones')+' → <b>'+esc(cat)+(sub?' › '+esc(sub):'')+'</b>'+(sel.length>tgt.length?' (las transferencias se saltean)':'');
    plan.touched=tgt;plan.apply=()=>tgt.forEach(t=>{t.category=cat;t.sub=sub;});plan.learn={category:cat,sub};}
  else if(a==='Cambiar subcategoría'){const tgt=sel.filter(t=>t.type!=='transfer');const cats=[...new Set(tgt.map(t=>t.category))];
    if(cats.length!==1){plan.ok=false;plan.msg='Seleccioná movimientos de una sola categoría.';return plan;}
    const sub=$('#bk-new-sub').value==='—'?'':$('#bk-new-sub').value;plan.msg=tgt.length+' movimientos de '+esc(cats[0])+' → sub <b>'+(esc(sub)||'(ninguna)')+'</b>';plan.touched=tgt;plan.apply=()=>tgt.forEach(t=>{t.sub=sub;});}
  else if(a==='Cambiar cuenta'){const acc=$('#bk-new-acc').value;const tgt=sel.filter(t=>t.type!=='transfer');if(!tgt.length){plan.ok=false;plan.msg='Las transferencias se editan una por una.';return plan;}
    const cur=curOf(acc);const bad=tgt.filter(t=>(t.currency||'ARS')!==cur);if(bad.length){plan.ok=false;plan.msg='Hay '+bad.length+' movimiento'+(bad.length>1?'s':'')+' en otra moneda que la cuenta "'+esc(acc)+'" ('+cur+'). Cambialos aparte.';return plan;}
    const card=isCard(acc);plan.msg=tgt.length+' movimientos → cuenta <b>'+esc(acc)+'</b>'+(card?' (tarjeta: se conserva el mes de pago si ya tenían)':'');plan.touched=tgt;
    plan.apply=()=>tgt.forEach(t=>{t.account=acc;t.currency=cur;if(t.type==='expense'&&card){if(!t.dueMonth){const d=new Date(t.date+'T12:00:00');t.dueMonth=ym(new Date(d.getFullYear(),d.getMonth()+1,1));t.purchaseDate=t.purchaseDate||t.date;}}else{delete t.dueMonth;delete t.purchaseDate;}});}
  else{const tag=normKey($('#bk-new-tag').value).replace(/\s+/g,'-');if(!tag){plan.ok=false;plan.msg='Escribí la etiqueta.';return plan;}
    if(a==='Agregar etiqueta'){const tgt=sel.filter(t=>!(t.tags||[]).includes(tag));plan.msg='Agregar <b>#'+esc(tag)+'</b> a '+tgt.length+' movimientos';plan.touched=tgt;plan.apply=()=>tgt.forEach(t=>{t.tags=[...(t.tags||[]),tag];});}
    else{const tgt=sel.filter(t=>(t.tags||[]).includes(tag));plan.msg='Quitar <b>#'+esc(tag)+'</b> de '+tgt.length+' movimientos';plan.touched=tgt;plan.apply=()=>tgt.forEach(t=>{t.tags=t.tags.filter(g=>g!==tag);if(!t.tags.length)delete t.tags;});}}
  if(!plan.touched.length){plan.ok=false;plan.msg=plan.msg||'Nada para cambiar.';}
  return plan;}
function bkPreview(){const p=bkPlan();const el=$('#bk-preview');el.innerHTML=p.msg||'';el.classList.toggle('bad',!p.ok);$('#bk-apply').disabled=!p.ok;
  if(BK.action==='Cambiar categoría'){const sel=bkSelected();const keys=[...new Set(sel.map(t=>normKey(t.merchant)||normKey(stripInst(t.note))).filter(Boolean))];let sug=keys.length===1?keys[0]:'';
    if(!sug&&keys.length>1){const common=keys[0].split(' ').filter(w=>w.length>2&&keys.every(k=>k.split(' ').includes(w)));sug=common.join(' ');} // palabras comunes a todas las notas ("coto")
    $('#bk-remember-txt').value=sug;}}
$('#bk-apply').onclick=()=>{const p=bkPlan();if(!p.ok)return;
  BK.undo=p.touched.map(t=>JSON.parse(JSON.stringify(t)));
  p.apply();const now=Date.now();p.touched.forEach(t=>{t.updatedAt=now;});
  if(p.learn&&$('#bk-remember').checked){const m=$('#bk-remember-txt').value.trim();if(m.length>=3){const kind=bkSelected().some(t=>t.merchant)?'merchant':'note';upsertRule(kind,m,p.learn.category,p.learn.sub,'learned');toast('Regla guardada: "'+m+'" → '+p.learn.category);}}
  $('#bk-remember').checked=false;
  persist();$('#bk-undo').classList.remove('hidden');BK.sel.clear();bkRun();render();toast(p.touched.length+' movimientos actualizados');};
$('#bk-undo').onclick=()=>{if(!BK.undo)return;const by=new Map(BK.undo.map(t=>[t.id,t]));DB.tx.forEach((t,i)=>{const o=by.get(t.id);if(o)DB.tx[i]=o;});const n=BK.undo.length;BK.undo=null;$('#bk-undo').classList.add('hidden');persist();bkRun();render();toast('Deshecho: '+n+' movimientos restaurados');};
$('#bulkBtn').onclick=openBulk;$('#closeBulk').onclick=()=>$('#bulkScrim').classList.remove('on');
