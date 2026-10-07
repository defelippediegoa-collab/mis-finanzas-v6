/* ---------- reminder sheet ---------- */
let rType='expense';
function openRem(id){remEditId=id||null;$('#remTitle').textContent=id?'Editar recordatorio':'Nuevo recordatorio';$('#delRem').classList.toggle('hidden',!id);
  const r=id?DB.reminders.find(x=>x.id===id):null;rType=r?r.type:'expense';
  document.querySelectorAll('#remTypeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.t===rType));
  fill($('#r-category'),['—',...DB.cats[rType==='income'?'income':'expense']],r?r.category:'—');
  refreshRemSub(r&&r.sub?r.sub:'—');
  $('#r-name').value=r?r.name:'';$('#r-amount').value=r?r.amount:'';$('#r-freq').value=r?r.freq:'monthly';
  $('#r-from').value=r&&r.from?r.from:ym(new Date(TODAY.getFullYear(),TODAY.getMonth()+1,1));$('#r-until').value=r&&r.until?r.until:'';
  fillAccounts($('#r-account'),r&&r.account?r.account:'— sin cuenta —','— sin cuenta —');
  $('#r-tags').value=r&&r.tags?r.tags.join(', '):'';
  $('#tag-suggestions').innerHTML=[...new Set([...DB.tx.flatMap(x=>x.tags||[]),...DB.reminders.flatMap(x=>x.tags||[])])].sort().map(g=>'<option value="'+esc(g)+'">').join('');
  remChanges=(r&&Array.isArray(r.changes))?r.changes.map(c=>({from:c.from||'',amount:c.amount||''})):[];renderRemChanges();
  $('#remScrim').classList.add('on');}
let remChanges=[];
function renderRemChanges(){const box=$('#r-changes');box.innerHTML=remChanges.map((c,i)=>'<div class="row2" style="padding:0 0 6px;gap:8px"><input type="month" data-i="'+i+'" data-k="from" value="'+(c.from||'')+'" style="flex:1"><input type="number" data-i="'+i+'" data-k="amount" value="'+(c.amount||'')+'" placeholder="nuevo importe" style="flex:1"><button type="button" data-del="'+i+'" class="chip cx" style="border:1px solid var(--line);border-radius:8px">×</button></div>').join('');
  box.querySelectorAll('input').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.i,k=inp.dataset.k;remChanges[i][k]=k==='amount'?(parseFloat(inp.value)||''):inp.value;});
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{remChanges.splice(+b.dataset.del,1);renderRemChanges();});}
$('#addChange').onclick=()=>{remChanges.push({from:'',amount:''});renderRemChanges();};
function refreshRemSub(sel){const cat=$('#r-category').value;const list=(cat&&cat!=='—'&&DB.subs[cat])?DB.subs[cat]:[];fill($('#r-sub'),['—',...list],sel||'—');}
$('#r-category').onchange=()=>refreshRemSub('—');
document.querySelectorAll('#remTypeSeg button').forEach(b=>b.onclick=()=>{rType=b.dataset.t;document.querySelectorAll('#remTypeSeg button').forEach(x=>x.classList.toggle('on',x===b));fill($('#r-category'),['—',...DB.cats[rType==='income'?'income':'expense']]);refreshRemSub('—');});
$('#addRem').onclick=()=>openRem(null);$('#closeRem').onclick=()=>$('#remScrim').classList.remove('on');$('#remScrim').onclick=e=>{if(e.target===$('#remScrim'))$('#remScrim').classList.remove('on');};
$('#saveRem').onclick=()=>{const name=$('#r-name').value.trim(),amt=parseFloat($('#r-amount').value);if(!name){toast('Poné un nombre');return;}if(!amt||amt<=0){toast('Poné un importe');return;}
  const acc=$('#r-account').value==='— sin cuenta —'?'':$('#r-account').value;const cat=$('#r-category').value==='—'?'':$('#r-category').value;const sub=$('#r-sub').value==='—'?'':$('#r-sub').value;
  const obj={type:rType,name,amount:amt,freq:$('#r-freq').value,from:$('#r-from').value,until:$('#r-until').value,account:acc,category:cat,sub};
  const rtags=$('#r-tags').value.split(',').map(s=>s.trim().toLowerCase().replace(/^#/,'')).filter(Boolean);
  if(rtags.length)obj.tags=rtags;
  const ch=remChanges.filter(c=>c.from&&parseFloat(c.amount)>0).map(c=>({from:c.from,amount:parseFloat(c.amount)}));obj.changes=ch;
  if(remEditId){const rr=DB.reminders.find(x=>x.id===remEditId);Object.assign(rr,obj);if(!rtags.length)delete rr.tags;}else{obj.id='r'+Date.now();DB.reminders.push(obj);}
  persist();$('#remScrim').classList.remove('on');renderReminders();toast('Guardado');};
$('#delRem').onclick=()=>{if(remEditId&&confirm('¿Eliminar recordatorio?')){DB.reminders=DB.reminders.filter(x=>x.id!==remEditId);persist();$('#remScrim').classList.remove('on');renderReminders();toast('Eliminado');}};

