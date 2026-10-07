/* ---------- account sheet ---------- */
function renderCurPick(){$('#ac-cur').innerHTML=DB.currencies.map(c=>'<button data-c="'+c+'" class="'+(c===acCur?'on':'')+'">'+(c==='ARS'?'$':c==='USD'?'US$':c)+'</button>').join('')+'<button data-add="1">+</button>';
  document.querySelectorAll('#ac-cur button').forEach(b=>b.onclick=()=>{if(b.dataset.add){const c=prompt('Código de la moneda (ej: EUR, BRL):');if(c){const cc=c.trim().toUpperCase();if(cc&&!DB.currencies.includes(cc)){DB.currencies.push(cc);acCur=cc;}}}else acCur=b.dataset.c;renderCurPick();});}
function openAcc(name){
  accEditName=name||null;$('#accTitle').textContent=name?'Editar cuenta':'Nueva cuenta';$('#delAcc').classList.toggle('hidden',!name);
  const a=name?acct(name):null;$('#ac-type').value=a?a.type:'Cuentas';$('#ac-name').value=a?a.name:'';$('#ac-initial').value=a?(a.initial||0):'';$('#ac-desc').value=a?(a.desc||''):'';
  acCur=a?a.currency:'ARS';renderCurPick();
  $('#ac-include').classList.toggle('on',!a||a.includeInTotal!==false);
  toggleCardExtra();$('#accScrim').classList.add('on');
}
$('#ac-include').onclick=()=>$('#ac-include').classList.toggle('on');
function toggleCardExtra(){const card=$('#ac-type').value==='Tarjetas de crédito';$('#ac-cardextra').classList.toggle('hidden',!card);$('#ac-initial-wrap').classList.toggle('hidden',card);}
$('#ac-type').onchange=toggleCardExtra;
$('#newAccBtn').onclick=()=>{$('#menu').classList.remove('on');openAcc(null);};
$('#closeAcc').onclick=()=>$('#accScrim').classList.remove('on');$('#accScrim').onclick=e=>{if(e.target===$('#accScrim'))$('#accScrim').classList.remove('on');};
$('#saveAcc').onclick=()=>{
  const name=$('#ac-name').value.trim();if(!name){toast('Poné un nombre');return;}
  const obj={name,type:$('#ac-type').value,currency:acCur,initial:parseFloat($('#ac-initial').value)||0,desc:$('#ac-desc').value.trim(),includeInTotal:$('#ac-include').classList.contains('on')};
  if(obj.type==='Tarjetas de crédito'){obj.initial=0;}
  if(accEditName){const a=acct(accEditName);if(accEditName!==name){DB.tx.forEach(t=>{if(t.account===accEditName)t.account=name;if(t.from===accEditName)t.from=name;if(t.to===accEditName)t.to=name;});DB.reminders.forEach(r=>{if(r.account===accEditName)r.account=name;});}Object.assign(a,obj);}
  else{if(acct(name)){toast('Ya existe esa cuenta');return;}DB.accounts.push(obj);}
  persist();$('#accScrim').classList.remove('on');if(detail)closeDetail();setView('acc');toast('Cuenta guardada');
};
$('#delAcc').onclick=()=>{if(accEditName&&confirm('¿Eliminar la cuenta? (sus movimientos quedan)')){DB.accounts=DB.accounts.filter(a=>a.name!==accEditName);persist();$('#accScrim').classList.remove('on');if(detail)closeDetail();setView('acc');toast('Cuenta eliminada');}};

