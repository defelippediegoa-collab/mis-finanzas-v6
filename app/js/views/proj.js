/* ---------- PROYECCION ---------- */
// Capital de arranque de la proyección: mismo criterio que la celda "Capital" de Cuentas.
// Suma los saldos de las cuentas NO ocultas (excluye tarjetas, que son deuda, y las cuentas ocultas/ahorros).
function capitalNow(){let s=0;DB.accounts.forEach(a=>{if(a.includeInTotal===false)return;if(a.type==='Tarjetas de crédito')return;const b=toARS(liveBalance(a.name),a.currency);if(b==null||b<0)return;s+=b;});return s;}
function remActiveIn(r,m){if(r.from&&m<r.from)return false;if(r.freq==='once')return m===r.from;if(r.until&&m>r.until)return false;return true;}
function remAmount(r,m){let amt=r.amount;if(Array.isArray(r.changes)){r.changes.filter(c=>c&&c.from&&c.amount>0).sort((a,b)=>a.from<b.from?-1:1).forEach(c=>{if(m>=c.from)amt=c.amount;});}return amt;}
function renderReminders(){
  $('#remCount').textContent=DB.reminders.length?('('+DB.reminders.length+')'):'';
  $('#reminders').innerHTML=DB.reminders.length?DB.reminders.map(r=>{const freq=r.freq==='monthly'?'cada mes':'una vez';const acc=r.account?(' · '+r.account):'';const ct=r.sub?(' · '+r.sub):(r.category?(' · '+r.category):'');const tg=(r.tags||[]).map(g=>'<span class="tagchip">#'+esc(g)+'</span>').join('');return '<div class="remrow" data-id="'+r.id+'"><div><div class="rn">'+r.name+tg+'</div><div class="rs">'+freq+(r.from?' desde '+r.from:'')+ct+acc+'</div></div><div class="amt '+(r.type==='income'?'pos':'neg')+'">'+(r.type==='income'?'+':'−')+money(r.amount)+'</div></div>';}).join(''):'<div class="empty" style="padding:16px 24px">Sin recordatorios. Agregá el gas, el sueldo o tus suscripciones.</div>';
  document.querySelectorAll('.remrow').forEach(el=>el.onclick=()=>openRem(el.dataset.id));
  renderProjMonths();
}
function pjTreeHTML(kids){
  return Object.entries(kids).sort((a,b)=>b[1].total-a[1].total).map(([key,node])=>{
    const cls=node.type==='income'?'pos':'neg',amt='<span class="pjamt '+cls+'">'+(node.type==='income'?'+':'−')+money(node.total)+'</span>';
    if(Object.keys(node.kids).length){
      const all=node.keys.length>0,done=all&&node.npaid===node.keys.length;
      const chk=all?'<input type="checkbox" class="pjchk pjbchk" data-keys="'+esc(node.keys.join(','))+'"'+(done?' checked':'')+' title="Marcar todo como pago">':'';
      const bamt=done?'<span class="pjamt done">'+(node.type==='income'?'+':'−')+money(0)+'</span>':amt;
      return '<details class="pjbranch'+(done?' done':'')+'"><summary>'+chk+'<span class="rl">'+esc(key)+'</span>'+bamt+'</summary>'+pjTreeHTML(node.kids)+'</details>';}
    const it=node.item,single=node.n===1&&it&&it.key;
    if(single){const done=it.paid?' done':'';const a=it.paid?'<span class="pjamt done">'+(node.type==='income'?'+':'−')+money(it.amt)+'</span>':amt;
      return '<div class="pjleaf'+done+'"><label class="pjck"><input type="checkbox" class="pjchk" data-key="'+esc(it.key)+'"'+(it.paid?' checked':'')+'><span>'+esc(key)+'</span></label>'+a+'</div>';}
    return '<div class="pjleaf"><span>'+esc(key)+'</span>'+amt+'</div>';
  }).join('');
}
function renderProjMonths(){
  const now=capitalNow();$('#pj-now').textContent=money(now);$('#pj-now').className='big '+sgn(now);
  const start=new Date(TODAY.getFullYear(),TODAY.getMonth(),1);let running=now,html='';const series=[];
  for(let i=0;i<7;i++){const dd=new Date(start.getFullYear(),start.getMonth()+i,1),m=ym(dd);const esMesActual=(i===0);
    // vencimientos de tarjeta = cuotas/consumos cuyo MES DE PAGO cae en este mes (las vas corrigiendo vos)
    const futCard=DB.tx.filter(t=>t.type==='expense'&&isCard(t.account)&&payMonthOf(t)===m);
    // resto a futuro (sueldos, préstamos, gastos no-tarjeta)
    const futOther=DB.tx.filter(t=>!isCard(t.account)&&t.type!=='transfer'&&ymOf(t.date)===m&&new Date(t.date+'T12:00:00')>TODAY);
    const rems=DB.reminders.filter(r=>remActiveIn(r,m));
    const items=[
      ...futCard.map(t=>{const nt=((t.note||'').trim()||'—');const usd=(t.currency||'ARS')==='USD';const lab=nt+(t.inst&&!/\(\d+\/\d+\)/.test(nt)?(' ('+t.inst[0]+'/'+t.inst[1]+')'):'')+(usd?' (USD)':'');const key='tx:'+t.id;return {type:'expense',amt:toARS(t.amount,t.currency||'ARS')||0,key:key,paid:!!DB.paid[key],path:['💳 Vencimiento tarjeta', t.account, t.category||'Otros', t.sub||'—', lab]};}),
      ...futOther.map(t=>{const usd=(t.currency||'ARS')==='USD';const key='tx:'+t.id;return {type:t.type,amt:toARS(t.amount,t.currency||'ARS')||0,key:key,paid:!!DB.paid[key],path:[t.category||'Otros', t.sub||'—', ((t.note||'').trim()||'—')+(usd?' (USD)':'')]};}),
      ...rems.map(r=>{const rc=curOf(r.account)||'ARS';const usd=rc==='USD';const key='rem:'+r.id+':'+m;return {type:r.type,amt:toARS(remAmount(r,m),rc)||0,key:key,paid:!!DB.paid[key],path:[r.category||'Recordatorios', r.sub||'—', (r.name||'recordatorio')+' (recordatorio)'+(usd?' (USD)':'')]};})
    ];
    let inc=0,exp=0;items.forEach(it=>{if(it.paid)return;if(it.type==='income')inc+=it.amt;else exp+=it.amt;});running+=inc-exp;
    series.push({short:dd.toLocaleDateString('es-AR',{month:'short'}).replace('.',''),running:running,inc:inc,exp:exp});
    const root={};
    items.forEach(it=>{let node=root;it.path.forEach((key,idx)=>{if(!node[key])node[key]={total:0,type:it.type,kids:{},n:0,item:null,keys:[],npaid:0};if(!it.paid)node[key].total+=it.amt;node[key].n++;if(it.key){node[key].keys.push(it.key);if(it.paid)node[key].npaid++;}if(idx===it.path.length-1)node[key].item=it;node=node[key].kids;});});
    let lines=items.length?('<div class="pjtree">'+pjTreeHTML(root)+'</div>'):'<div class="mline"><span>Sin movimientos proyectados</span><span></span></div>';
    html+='<div class="mcard"><div class="mh"><span class="mn">'+monthName(dd)+(esMesActual?' <span class="mnow">· en curso</span>':'')+'</span><span class="mb '+sgn(running)+'">'+money(running)+'</span></div><div class="mbody"><div class="mc"><div class="ml">Ingresos</div><div class="mv '+sgn(inc)+'">'+money(inc)+'</div></div><div class="mc"><div class="ml">Gastos</div><div class="mv '+sgn(exp)+'">'+money(exp)+'</div></div><div class="mc"><div class="ml">Neto</div><div class="mv '+sgn(inc-exp)+'">'+money(inc-exp)+'</div></div></div>'+lines+'</div>';
  }
  $('#pj-months').innerHTML=html;
  $('#pj-chart').innerHTML=projChart(series);
  document.querySelectorAll('#pj-months .pjchk').forEach(cb=>{
    cb.onclick=e=>e.stopPropagation(); // no abrir/cerrar la rama al tildar
    cb.onchange=()=>{
      const keys=cb.dataset.keys?cb.dataset.keys.split(','):[cb.dataset.key];
      keys.forEach(k=>{if(cb.checked)DB.paid[k]=1;else delete DB.paid[k];});
      const opened=[...document.querySelectorAll('#pj-months details[open]')].map(d=>d.querySelector('summary .rl')?.textContent||'');
      persist();renderProjMonths();
      // reabrir las ramas que estaban abiertas
      document.querySelectorAll('#pj-months details').forEach(d=>{const t=d.querySelector('summary .rl')?.textContent||'';if(opened.includes(t))d.open=true;});
    };
  });
}
function kfmt(n){const a=Math.abs(n);if(a>=1e6)return (n/1e6).toFixed(1).replace('.0','')+'M';if(a>=1e3)return Math.round(n/1e3)+'k';return Math.round(n)+'';}
function projChart(series){
  if(!series.length)return '';
  const W=340,H=150,padX=10,padT=22,padB=20,n=series.length;
  const vals=series.map(s=>s.running);
  const maxV=Math.max(0,...vals),minV=Math.min(0,...vals),range=(maxV-minV)||1;
  const plot=H-padT-padB,gap=(W-2*padX)/n,bw=gap*0.52;
  const yOf=v=>padT+((maxV-v)/range)*plot;const y0=yOf(0);
  let svg='';
  series.forEach((s,i)=>{
    const x=padX+gap*i+(gap-bw)/2,yv=yOf(s.running);
    const top=Math.min(yv,y0),h=Math.max(2,Math.abs(yv-y0));
    const col=s.running>=0?'var(--income)':'var(--expense)';
    svg+='<rect x="'+x.toFixed(1)+'" y="'+top.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3" fill="'+col+'"/>';
    svg+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(s.running>=0?top-5:top+h+11).toFixed(1)+'" font-size="9" fill="var(--muted)" text-anchor="middle">'+kfmt(s.running)+'</text>';
    svg+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-6)+'" font-size="9" fill="var(--muted2)" text-anchor="middle">'+s.short+'</text>';
  });
  svg+='<line x1="'+padX+'" y1="'+y0.toFixed(1)+'" x2="'+(W-padX)+'" y2="'+y0.toFixed(1)+'" stroke="var(--line)" stroke-width="1"/>';
  return '<div style="margin:0 16px 6px;padding:12px 6px 4px;background:var(--bg2);border:1px solid var(--line);border-radius:14px"><div style="font-size:11px;color:var(--muted);padding:0 10px 4px">Capital proyectado (fin de cada mes)</div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">'+svg+'</svg></div>';
}

