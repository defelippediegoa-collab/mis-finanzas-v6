/* ---------- PRÉSTAMOS recibidos: cuenta de deuda + transferencia de entrada + recordatorio de cuotas ---------- */
// DB.loans[] = {id, name, lender, account (cuenta tipo Préstamo), received, currency, inAccount, date, totalToRepay, n, cuota, interestTotal, firstMonth, payFrom, reminderId, txId, createdAt}
// Pago de una cuota = transferencia payFrom → account (capital) + gasto de interés (Gastos Fijos › Intereses), ambos con loanId y loanCuota.
function loanById(id){return (DB.loans||[]).find(l=>l.id===id)||null;}
function loanAccounts(){return DB.accounts.filter(a=>a.type==='Préstamo'&&a.includeInTotal!==false);}
function isLoanAcct(n){const a=acct(n);return !!a&&a.type==='Préstamo';}
function interestCategory(){if(DB.cats.expense.includes('Gastos Fijos')){DB.subs['Gastos Fijos']=DB.subs['Gastos Fijos']||[];if(!DB.subs['Gastos Fijos'].includes('Intereses'))DB.subs['Gastos Fijos'].push('Intereses');return{category:'Gastos Fijos',sub:'Intereses'};}
  if(!DB.cats.expense.includes('Préstamos'))DB.cats.expense.push('Préstamos');DB.subs['Préstamos']=DB.subs['Préstamos']||[];if(!DB.subs['Préstamos'].includes('Intereses'))DB.subs['Préstamos'].push('Intereses');return{category:'Préstamos',sub:'Intereses'};}
// Cronograma: [{k, month, cuota, interest, capital}]
function loanSchedule(l){const out=[];const n=l.n||1;const cuota=Math.round(l.totalToRepay/n*100)/100,intr=Math.round((l.interestTotal||0)/n*100)/100;
  for(let k=0;k<n;k++){const last=k===n-1;const c=last?Math.round((l.totalToRepay-cuota*(n-1))*100)/100:cuota;const i=last?Math.round(((l.interestTotal||0)-intr*(n-1))*100)/100:intr;out.push({k,month:shiftMonthStr(l.firstMonth+'-01',k).slice(0,7),cuota:c,interest:i,capital:Math.round((c-i)*100)/100});}
  return out;}
function loanPaidCuotas(l){const ks=new Set();DB.tx.forEach(t=>{if(t.loanId===l.id&&t.loanCuota!=null&&t.type==='transfer')ks.add(t.loanCuota);});return ks;}
function loanStatus(l){const a=acct(l.account);const bal=a?(a.initial||0)+effects(l.account):0;const paid=loanPaidCuotas(l);const sch=loanSchedule(l);
  const interestPaid=DB.tx.filter(t=>t.loanId===l.id&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const next=sch.find(s=>!paid.has(s.k))||null;
  return{remaining:Math.max(0,-bal),paid:paid.size,n:sch.length,next,interestPaid,sch,paidSet:paid,done:paid.size>=sch.length};}
// Flujos de préstamos de un mes (ARS): recibido, capital devuelto, interés pagado
function loanFlowsARS(m){let recv=0,repaid=0,interest=0;DB.tx.forEach(t=>{if(t.pending||t.hist||ymOf(t.date)!==m)return;
  if(t.type==='transfer'){if(isLoanAcct(t.from)&&!isLoanAcct(t.to))recv+=toARS(t.amountTo!=null?t.amountTo:t.amount,curOf(t.to))||0;else if(isLoanAcct(t.to)&&!isLoanAcct(t.from))repaid+=toARS(t.amount,curOf(t.from))||0;}
  else if(t.type==='expense'&&t.loanId)interest+=toARS(t.amount,t.currency||'ARS')||0;});return{recv,repaid,interest};}
// Deuda de préstamos a una fecha (ARS)
function loansDebtAtARS(D){let s=0;loanAccounts().forEach(a=>{const b=(a.initial||0)+effects(a.name,t=>t.date<=D);if(b<0)s+=toARS(-b,a.currency)||0;});return s;}

// ---- alta ----
function openLoanForm(){$('#menu').classList.remove('on');$('#l-name').value='';$('#l-lender').value='';$('#l-received').value='';$('#l-total').value='';$('#l-n').value='12';$('#l-date').value=localDate();
  $('#l-first').value=ym(new Date(TODAY.getFullYear(),TODAY.getMonth()+1,1));fillAccounts($('#l-in'));fillAccounts($('#l-pay'));loanHint();$('#loanScrim').classList.add('on');}
function loanHint(){const r=parseFloat($('#l-received').value)||0,t=parseFloat($('#l-total').value)||0,n=parseInt($('#l-n').value)||1;const el=$('#loanHint');
  if(!r||!t){el.textContent='';return;}const i=t-r;el.innerHTML='Cuota '+money(t/n)+' × '+n+' · interés total <b class="'+(i>0?'neg':'pos')+'">'+money(i)+'</b> ('+(r?(i/r*100).toFixed(1):0)+' % sobre lo recibido)'+(i<0?' · ⚠️ devolvés menos de lo que recibiste':'');}
['#l-received','#l-total','#l-n'].forEach(s=>$(s).oninput=loanHint);
$('#closeLoan').onclick=()=>$('#loanScrim').classList.remove('on');$('#loanScrim').onclick=e=>{if(e.target===$('#loanScrim'))$('#loanScrim').classList.remove('on');};
$('#loanBtn').onclick=openLoanForm;
$('#saveLoan').onclick=()=>{
  const name=$('#l-name').value.trim();if(!name){toast('Poné un nombre');return;}
  const received=parseFloat($('#l-received').value),total=parseFloat($('#l-total').value),n=parseInt($('#l-n').value);
  if(!(received>0)){toast('Poné lo que recibiste');return;}if(!(total>0)){toast('Poné el total a devolver');return;}if(!(n>=1&&n<=120)){toast('Cuotas entre 1 y 120');return;}
  const inAccount=$('#l-in').value,payFrom=$('#l-pay').value,date=$('#l-date').value||localDate(),firstMonth=$('#l-first').value;if(!firstMonth){toast('Poné el mes de la primera cuota');return;}
  const currency=curOf(inAccount);let accName='Préstamo '+name;let k=2;while(acct(accName))accName='Préstamo '+name+' '+(k++);
  DB.accounts.push({name:accName,type:'Préstamo',currency,initial:0,desc:$('#l-lender').value.trim(),includeInTotal:true});
  const id='ln'+Date.now();
  const tx={id:'u'+Date.now(),date,type:'transfer',from:accName,to:inAccount,amount:received,currency,note:'Préstamo '+name+' (recibido)',loanId:id,source:'app',createdAt:Date.now()};DB.tx.push(tx);
  const sch=loanSchedule({totalToRepay:total,n,interestTotal:total-received,firstMonth});
  const rem={id:'r'+Date.now(),kind:'loan',loanId:id,type:'expense',name:'Cuota préstamo '+name,amount:sch[0].cuota,freq:n>1?'monthly':'once',from:firstMonth,until:n>1?sch[n-1].month:'',account:payFrom,category:'Préstamos',sub:'',changes:[]};DB.reminders.push(rem);
  DB.loans=DB.loans||[];DB.loans.push({id,name,lender:$('#l-lender').value.trim(),account:accName,received,currency,inAccount,date,totalToRepay:total,n,cuota:sch[0].cuota,interestTotal:Math.round((total-received)*100)/100,firstMonth,payFrom,reminderId:rem.id,txId:tx.id,createdAt:Date.now()});
  persist();$('#loanScrim').classList.remove('on');render();toast('Préstamo creado · '+money(received,currency)+' en '+inAccount);
};

// ---- sección en Tarjetas ----
function loansSectionHtml(){const loans=DB.loans||[];let h='<div class="pj-sec"><span>Préstamos</span><small><a href="#" id="loanNew">+ nuevo</a></small></div>';
  if(!loans.length)return h+'<div class="hint" style="padding:0 16px 14px;color:var(--muted)">Sin préstamos. Cuando recibas plata prestada, cargala acá: no cuenta como ingreso y queda como deuda con sus cuotas.</div>';
  h+='<div class="catlist" style="margin-bottom:12px">';
  loans.forEach(l=>{const st=loanStatus(l);const pct=l.totalToRepay?Math.min(100,Math.round((st.paid/st.n)*100)):0;
    h+='<div class="catrow" data-loan="'+esc(l.id)+'"><div class="crtop"><span>'+esc(l.name)+(l.lender?' <small style="color:var(--muted2)">· '+esc(l.lender)+'</small>':'')+' ›</span><b class="'+(st.remaining>0?'neg':'pos')+'">'+(st.done?'saldado ✓':money(st.remaining,l.currency))+'</b></div>'+
      '<div class="ds" style="font-size:11px;color:var(--muted);margin-bottom:5px">'+st.paid+'/'+st.n+' cuotas'+(st.next?' · próxima '+st.next.month+' '+money(st.next.cuota,l.currency):'')+' · interés pagado '+money(st.interestPaid,l.currency)+'</div>'+
      '<div class="crbar"><i style="width:'+pct+'%;background:var(--income)"></i></div></div>';});
  return h+'</div>';}
function bindLoansSection(){const a=$('#loanNew');if(a)a.onclick=e=>{e.preventDefault();openLoanForm();};document.querySelectorAll('.catrow[data-loan]').forEach(el=>el.onclick=()=>openLoanDetail(el.dataset.loan));}

// ---- detalle y pago de cuotas ----
function openLoanDetail(id){const l=loanById(id);if(!l)return;const st=loanStatus(l);const c=l.currency;
  let h='<div class="debtlist"><div class="finhead" style="border-top:none;padding-top:8px">Recibiste '+money(l.received,c)+' el '+l.date+' en '+esc(l.inAccount)+' · devolvés '+money(l.totalToRepay,c)+' en '+l.n+' cuota'+(l.n>1?'s':'')+' · interés '+money(l.interestTotal,c)+'</div>';
  h+='<div class="debttot" style="padding:10px 16px"><span>Capital que falta devolver</span><span class="'+(st.remaining>0?'neg':'pos')+'">'+money(st.remaining,c)+'</span></div>';
  h+='<div class="finrow"><span>Cuotas pagadas</span><span>'+st.paid+' / '+st.n+'</span></div><div class="finrow"><span>Interés pagado</span><span>'+money(st.interestPaid,c)+'</span></div>';
  if(st.next)h+='<div style="padding:10px 16px"><button class="save" id="loanPay" style="margin:0;width:100%">Registrar cuota '+(st.next.k+1)+' · '+money(st.next.cuota,c)+' ('+st.next.month+')</button><div class="hint" style="margin-top:6px">Crea la transferencia de capital '+money(st.next.capital,c)+' desde '+esc(l.payFrom)+' y el gasto de interés '+money(st.next.interest,c)+'.</div></div>';
  h+='<div class="finhead">Cronograma</div>';
  st.sch.forEach(s=>{const paid=st.paidSet.has(s.k);h+='<div class="finrow"><span>'+(paid?'✓ ':'')+(s.k+1)+' · '+s.month+'<small style="color:var(--muted2)"> capital '+money(s.capital,c)+' + interés '+money(s.interest,c)+'</small></span><span class="'+(paid?'pos':'')+'" style="'+(paid?'':'color:var(--muted)')+'">'+money(s.cuota,c)+'</span></div>';});
  h+='<div style="padding:12px 16px;display:flex;gap:8px"><button class="editbtn" id="loanEdit" style="margin:0;flex:1">Editar</button><button class="editbtn" id="loanDel" style="margin:0;flex:1;color:var(--expense)">Eliminar</button></div></div>';
  $('#cardDetTitle').textContent='🏦 '+l.name;$('#cardDetBody').innerHTML=h;$('#cardDetScrim').classList.add('on');
  const pb=$('#loanPay');if(pb)pb.onclick=()=>{registerLoanCuota(l,st.next);openLoanDetail(id);};
  $('#loanEdit').onclick=()=>{const name=prompt('Nombre',l.name);if(name===null)return;const lender=prompt('Quién presta',l.lender||'');if(lender===null)return;const payFrom=prompt('Cuenta desde la que pagás (nombre exacto)',l.payFrom);if(payFrom===null)return;
    if(!acct(payFrom)){toast('No existe la cuenta "'+payFrom+'"');return;}l.name=name.trim()||l.name;l.lender=lender.trim();l.payFrom=payFrom;const r=DB.reminders.find(x=>x.id===l.reminderId);if(r){r.name='Cuota préstamo '+l.name;r.account=payFrom;}persist();openLoanDetail(id);render();};
  $('#loanDel').onclick=()=>{const movs=DB.tx.filter(t=>t.loanId===l.id||t.from===l.account||t.to===l.account||t.account===l.account);
    if(!confirm('¿Eliminar el préstamo "'+l.name+'"? Se borran su recordatorio y '+movs.length+' movimiento'+(movs.length!==1?'s':'')+' (recibido, cuotas e intereses) y la cuenta "'+l.account+'".'))return;
    DB.tx=DB.tx.filter(t=>!movs.includes(t));DB.reminders=DB.reminders.filter(r=>r.id!==l.reminderId);Object.keys(DB.paid).forEach(k=>{if(k.startsWith('rem:'+l.reminderId+':'))delete DB.paid[k];});
    DB.accounts=DB.accounts.filter(a=>a.name!==l.account);DB.loans=DB.loans.filter(x=>x.id!==l.id);persist();$('#cardDetScrim').classList.remove('on');render();toast('Préstamo eliminado');};
}
function registerLoanCuota(l,s){if(!s)return;const date=localDate();const c=l.currency;const ic=interestCategory();const ts=Date.now();
  DB.tx.push({id:'u'+ts+'_c'+s.k,date,type:'transfer',from:l.payFrom,to:l.account,amount:s.capital,currency:curOf(l.payFrom),note:'Cuota '+(s.k+1)+'/'+l.n+' préstamo '+l.name+' (capital)',loanId:l.id,loanCuota:s.k,source:'app',createdAt:ts});
  if(s.interest>0)DB.tx.push({id:'u'+ts+'_i'+s.k,date,type:'expense',account:l.payFrom,category:ic.category,sub:ic.sub,amount:s.interest,currency:curOf(l.payFrom),note:'Cuota '+(s.k+1)+'/'+l.n+' préstamo '+l.name+' (interés)',loanId:l.id,loanCuota:s.k,source:'app',createdAt:ts});
  DB.paid['rem:'+l.reminderId+':'+s.month]=1;persist();render();toast('Cuota '+(s.k+1)+' registrada');}
