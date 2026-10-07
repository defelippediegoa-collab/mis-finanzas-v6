/* ---------- dispatch ---------- */
function render(){$('#curM').textContent=monthName(cur);if(view==='trans')renderDiario();else if(view==='stats')renderStats();else if(view==='acc')renderAccounts();else if(view==='proj')renderReminders();else if(view==='cards')renderCardsView();else if(view==='panel')renderPanel();}
/* ---------- PANEL (tablero) ---------- */
let panelMode=localStorage.getItem('fin_panel_mode')||'caja';
let panelStyle=localStorage.getItem('fin_panel_style')||'cards';
function pcard(cls,ico,lbl,val,valCls,sub,id){return '<div class="pcard '+cls+'"'+(id?' id="'+id+'" style="cursor:pointer"':'')+'><div class="pcl">'+lbl+' <span class="pci">'+ico+'</span></div><div class="pcv '+(valCls||'')+'">'+val+'</div>'+(sub?'<div class="pcs">'+sub+'</div>':'')+'</div>';}
function renderPanel(){
  $('#pmCaja').classList.toggle('on',panelMode==='caja');$('#pmMes').classList.toggle('on',panelMode==='mes');
  const m=ym(cur);
  const isHid=n=>{const a=acct(n);return a&&a.includeInTotal===false;};
  const isOper=n=>{const a=acct(n);return a&&a.includeInTotal!==false&&a.type!=='Tarjetas de crédito';};
  let I=0,C=0,compras=0,pagos=0,deAh=0,aAh=0;
  DB.tx.forEach(t=>{if(ymOf(t.date)!==m)return;const cu=t.currency||'ARS';const ars=toARS(t.amount,cu)||0;
    if(t.type==='income'&&!isCard(t.account)){I+=ars;if(isHid(t.account))aAh+=ars;}
    else if(t.type==='expense'){C+=ars;if(isCard(t.account))compras+=ars;else if(isHid(t.account))deAh+=ars;}
    else if(t.type==='transfer'){const amtTo=t.amountTo!=null?t.amountTo:t.amount;const vTo=toARS(amtTo,curOf(t.to))||0;
      if(isCard(t.to)&&!isCard(t.from)){pagos+=vTo;if(isHid(t.from))deAh+=vTo;}
      if(isHid(t.from)&&isOper(t.to))deAh+=vTo;
      if(isOper(t.from)&&isHid(t.to))aAh+=ars;}});
  const cash=C-compras;
  const remPend=remDebtARS(m);
  let venc=0;DB.accounts.forEach(a=>{if(a.type!=='Tarjetas de crédito'||a.includeInTotal===false)return;venc+=toARS(cardSaldos(a.name).aPagar,a.currency)||0;});
  let h='<div class="panelgrid">';
  $('#psCards').classList.toggle('on',panelStyle==='cards');$('#psDet').classList.toggle('on',panelStyle==='det');
  if(panelStyle==='det'){
    // ---- VISTA DETALLE: estado de cuenta en cascada ----
    const D0=new Date(cur.getFullYear(),cur.getMonth(),1);
    let ini=0;DB.accounts.forEach(a=>{if(a.includeInTotal===false||a.type==='Tarjetas de crédito')return;const b=toARS((a.initial||0)+effects(a.name,t=>new Date(t.date+'T12:00:00')<D0),a.currency);if(b==null||b<0)return;ini+=b;});
    const ahNeto=deAh-aAh;
    const esHoy=ym(cur)===ym(TODAY);
    const stRow=(lbl,pref,v,cls,sub)=>'<div class="strow"><span>'+lbl+(sub?'<small>'+sub+'</small>':'')+'</span><span class="'+(cls||'')+'">'+pref+money(Math.abs(v))+'</span></div>';
    const stTot=(lbl,v,sub)=>'<div class="strow strong"><span>'+lbl+(sub?'<small>'+sub+'</small>':'')+'</span><span class="'+sgn(v)+'">'+money(v)+'</span></div>';
    const ingProy=DB.reminders.filter(r=>r.type==='income'&&remActiveIn(r,ym(cur))&&!DB.paid['rem:'+r.id+':'+ym(cur)]).reduce((s2,r)=>s2+(toARS(remAmount(r,ym(cur)),curOf(r.account))||0),0);
    let hidT=0;DB.accounts.forEach(a=>{if(a.includeInTotal!==false)return;const raw=a.type==='Tarjetas de crédito'?-cardSaldos(a.name).aPagar:liveBalance(a.name);const b=toARS(raw,a.currency);if(b!=null)hidT+=b;});
    const hidCard='<div class="stcard" style="margin-top:10px"><div class="strow strong"><span>🔒 Cuentas ocultas (ahorros, en pesos)</span><span class="'+sgn(hidT)+'">'+money(hidT)+'</span></div></div>';
    let s='';
    if(panelMode==='caja'){
      const esFut=ym(cur)>ym(TODAY);
      let vencM=0;if(esFut)DB.tx.forEach(t=>{if(t.type==='expense'&&isCard(t.account)&&payMonthOf(t)===ym(cur))vencM+=toARS(t.amount,t.currency||'ARS')||0;});
      const calc=ini+I+ahNeto-pagos-cash-vencM;
      const real=esHoy?capitalNow():null;
      const dif=real!=null?(real-calc):null;
      s='<div class="stcard">';
      s+=stRow('Saldo inicial del mes',(ini>=0?'+':'−'),ini,sgn(ini),esFut?'proyectado con los movimientos ya cargados':'');
      s+=stRow('Ingresos del mes','+',I,'pos');
      s+=stRow('Transferencias con ahorros (neto)',(ahNeto>=0?'+':'−'),ahNeto,ahNeto>=0?'pos':'neg','sacaste '+money(deAh)+' · mandaste '+money(aAh));
      s+=stRow('Pagos a tarjetas (liquidaciones)','−',pagos,'neg');
      if(esFut)s+=stRow('Vencimientos de tarjeta a liquidar','−',vencM,'neg','cuotas y consumos con mes de pago '+monthName(cur).split(' ')[0]);
      s+=stRow('Gastos del mes (contado)','−',cash,'neg');
      s+=stTot('BALANCE DE CAJA DEL MES',calc,real!=null?('saldo real hoy: '+money(real)+(Math.abs(dif)>1?' · diferencia '+(dif>=0?'+':'−')+money(Math.abs(dif))+' (tocá Balance de caja en vista tarjetas para conciliar)':' ✓ coincide')):'saldo teórico al cierre del mes');
      s+=stRow('Recordatorios no ejecutados','−',remPend,'warnc');
      s+=stRow('Ingresos proyectados (recordatorios)','+',ingProy,'pos');
      s+=stTot('BALANCE DE CAJA PROYECTADO',calc-remPend+ingProy);
      s+='</div>'+hidCard;
    } else {
      const prevM=ym(new Date(cur.getFullYear(),cur.getMonth()-1,1));
      let prevCompras=0;DB.tx.forEach(t=>{if(t.type==='expense'&&isCard(t.account)&&ymOf(t.date)===prevM)prevCompras+=toARS(t.amount,t.currency||'ARS')||0;});
      const d=compras-prevCompras;
      const bal=I-cash-remPend-compras;
      s='<div class="stcard">';
      s+=stRow('Ingresos del mes','+',I,'pos');
      s+=stRow('Gastos del mes (contado)','−',cash,'neg');
      s+=stRow('Recordatorios no ejecutados','−',remPend,'warnc');
      s+=stRow('Gastos con tarjeta del mes','−',compras,'neg','mes pasado (lo que liquidás ahora): '+money(prevCompras)+' · '+(d>=0?'▲ +':'▼ −')+money(Math.abs(d)));
      s+=stTot('BALANCE DEL MES',bal);
      s+=stRow('Ingresos proyectados (recordatorios)','+',ingProy,'pos');
      s+=stTot('BALANCE DEL MES PROYECTADO',bal+ingProy);
      s+='</div>'+hidCard;
    }
    $('#panelBody').innerHTML=s;
    return;
  }
  if(panelMode==='caja'){
    const salidas=cash+pagos;const bal=I-salidas;const balCon=bal+deAh-aAh;
    let subSaldo='disponible en tus cuentas';
    if(ym(cur)===ym(TODAY)){
      const D=new Date(cur.getFullYear(),cur.getMonth(),1);let ini=0;
      DB.accounts.forEach(a=>{if(a.includeInTotal===false||a.type==='Tarjetas de crédito')return;const b=toARS((a.initial||0)+effects(a.name,t=>new Date(t.date+'T12:00:00')<D),a.currency);if(b==null||b<0)return;ini+=b;});
      const varReal=capitalNow()-ini;
      subSaldo='el 1° tenías '+money(ini)+' → variación real <b class="'+sgn(varReal)+'">'+(varReal>=0?'+':'−')+money(Math.abs(varReal))+'</b>';
    }
    h+=pcard('pc-violet','👛','SALDO ACTUAL',money(capitalNow()),'',subSaldo,'pdSaldo');
    const ahNeto=deAh-aAh;
    const subIng=(deAh>0||aAh>0)?('🐷 '+(ahNeto>=0?'desahorraste ':'ahorraste ')+'<b>'+money(Math.abs(ahNeto))+'</b> neto (sacaste '+money(deAh)+' · mandaste '+money(aAh)+') — no suma al balance'):'';
    h+=pcard('pc-green','📈','INGRESOS DEL MES',money(I),'pos',subIng,'pdIng');
    h+=pcard('pc-red','📉','GASTOS DEL MES',money(cash),'neg','en efectivo / cuentas','pdGasCash');
    h+=pcard('pc-blue','💳','PAGADO DE TARJETA',money(pagos),'','vencimientos que ya pagaste','pdPag');
    h+=pcard('pc-amber','⏰','RECORDATORIOS PEND.',money(remPend),'','del mes, sin tildar','pdRem');
    h+=pcard(bal>=0?'pc-green':'pc-red','🧮','BALANCE DE CAJA',money(bal),sgn(bal),((deAh>0||aAh>0)?('con mov. de ahorros: <b class="'+sgn(balCon)+'">'+(balCon>=0?'+':'−')+money(Math.abs(balCon))+'</b> en tus cuentas'):'ingresos − salidas del mes')+' · tocá para conciliar','cajaBalCard');
  } else {
    const bal=I-C-remPend;
    h+=pcard(bal>=0?'pc-green':'pc-red','🧮','BALANCE DEL MES',money(bal),sgn(bal),'ingresos − gastos − record. pend.','pdBalMes');
    h+=pcard('pc-green','📈','INGRESOS DEL MES',money(I),'pos','','pdIng');
    h+=pcard('pc-red','📉','GASTOS DEL MES',money(C),'neg','💳 '+money(compras)+' · 💵 '+money(cash),'pdGasTodo');
    h+=pcard('pc-blue','💳','CONSUMO TARJETA',money(compras),'','de este mes, se paga después','pdComp');
    h+=pcard('pc-amber','📅','VENCIDO HOY',money(venc),'','tarjetas por pagar (neteado)','pdVenc');
    h+=pcard('pc-amber','⏰','RECORDATORIOS PEND.',money(remPend),'','del mes, sin tildar','pdRem');
  }
  h+='</div>';
  $('#panelBody').innerHTML=h;
  const cb=$('#cajaBalCard');if(cb)cb.onclick=openCajaConcil;
  [['pdSaldo','saldo'],['pdIng','ing'],['pdGasCash','gascash'],['pdGasTodo','gastodo'],['pdPag','pag'],['pdRem','rem'],['pdComp','comp'],['pdVenc','venc'],['pdBalMes','balmes']].forEach(([id,k])=>{const el=$('#'+id);if(el)el.onclick=()=>openPanelDetail(k);});
}
// Detalle de cada cuadro del panel: de dónde salen los números
function openPanelDetail(kind){
  const m=ym(cur);
  const isHidN=n=>{const a=acct(n);return a&&a.includeInTotal===false;};
  const isOperN=n=>{const a=acct(n);return a&&a.includeInTotal!==false&&a.type!=='Tarjetas de crédito';};
  const mtx=DB.tx.filter(t=>ymOf(t.date)===m);
  const trow=(t,cls,extra)=>'<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(stripInst(t.note)||t.sub||t.category||(t.type==='transfer'?'transferencia':'—'))+(t.inst?' ('+t.inst[0]+'/'+t.inst[1]+')':'')+'</div><div class="ds">'+t.date+' · '+esc(t.type==='transfer'?(t.from+' → '+t.to):(t.account||''))+(t.category&&t.type!=='transfer'?' · '+esc(t.category):'')+(extra||'')+'</div></div><div class="damt '+cls+'">'+money(t.amount,t.currency||'ARS')+'</div></div>';
  let title='',h='',tot=0;
  const listOut=(rows,cls)=>{let s='<div class="debtlist">';rows.slice(0,50).forEach(t=>{s+=trow(t,cls);tot+=(toARS(t.amount,t.currency||'ARS')||0);});s+='</div>';if(rows.length>50)s+='<div class="ds" style="padding:8px 16px;color:var(--muted2)">…y '+(rows.length-50)+' más</div>';return s;};
  if(kind==='saldo'){
    title='Saldo actual · por cuenta';h='<div class="debtlist">';let tp=0;
    DB.accounts.filter(a=>isOperN(a.name)).map(a=>({a:a,b:toARS(liveBalance(a.name),a.currency)||0,nat:liveBalance(a.name)})).sort((x,y)=>y.b-x.b).forEach(x=>{if(x.b>0)tp+=x.b;
      h+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(x.a.name)+'</div><div class="ds">'+esc(x.a.type)+(x.a.currency!=='ARS'?' · '+money(x.nat,x.a.currency)+' → pesos':'')+'</div></div><div class="damt '+sgn(x.b)+'">'+money(x.b)+'</div></div>';});
    h+='</div><div class="debttot"><span>Total (solo saldos positivos)</span><span>'+money(tp)+'</span></div><div class="ds" style="padding:0 16px 14px;color:var(--muted2)">Las cuentas ocultas no entran acá (van en su total aparte en Cuentas).</div>';
  }
  else if(kind==='ing'){
    title='Ingresos de '+monthName(cur).split(' ')[0];
    const rows=mtx.filter(t=>t.type==='income'&&!isCard(t.account)).sort((a,b)=>b.amount-a.amount);
    h=listOut(rows,'pos')+'<div class="debttot"><span>Total ingresos</span><span class="pos">'+money(tot)+'</span></div>';
    const ah=mtx.filter(t=>t.type==='transfer'&&((isHidN(t.from)&&isOperN(t.to))||(isOperN(t.from)&&isHidN(t.to))));
    if(ah.length){h+='<div class="finhead">🐷 Movimientos con ahorros (no suman al balance)</div>';
      ah.forEach(t=>{const saca=isHidN(t.from);h+='<div class="finrow"><span>'+t.date+' · '+esc(t.from)+' → '+esc(t.to)+'</span><span class="'+(saca?'pos':'neg')+'">'+(saca?'+':'−')+money(t.amountTo!=null&&saca?t.amountTo:t.amount)+'</span></div>';});}
  }
  else if(kind==='gascash'){
    title='Gastos contado · '+monthName(cur).split(' ')[0];
    const rows=mtx.filter(t=>t.type==='expense'&&!isCard(t.account)).sort((a,b)=>b.amount-a.amount);
    h=listOut(rows,'neg')+'<div class="debttot"><span>Total contado</span><span class="neg">'+money(tot)+'</span></div>';
  }
  else if(kind==='gastodo'){
    title='Gastos del mes (todos) · '+monthName(cur).split(' ')[0];
    const rows=mtx.filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount);
    h=listOut(rows,'neg')+'<div class="debttot"><span>Total gastos</span><span class="neg">'+money(tot)+'</span></div>';
  }
  else if(kind==='comp'){
    title='Consumos con tarjeta · '+monthName(cur).split(' ')[0];
    const rows=mtx.filter(t=>t.type==='expense'&&isCard(t.account)).sort((a,b)=>b.amount-a.amount);
    h=listOut(rows,'neg')+'<div class="debttot"><span>Total tarjeta</span><span class="neg">'+money(tot)+'</span></div>';
  }
  else if(kind==='pag'){
    title='Pagos de tarjeta · '+monthName(cur).split(' ')[0];
    const rows=mtx.filter(t=>t.type==='transfer'&&isCard(t.to)&&!isCard(t.from)).sort((a,b)=>b.amount-a.amount);
    h=listOut(rows,'')+'<div class="debttot"><span>Total pagado</span><span>'+money(tot)+'</span></div>';
  }
  else if(kind==='rem'){
    title='Recordatorios pendientes · '+monthName(cur).split(' ')[0];
    const rows=unpaidRems(m);let t2=0;h='<div class="debtlist">';
    rows.forEach(r=>{const v=toARS(remAmount(r,m),curOf(r.account))||0;t2+=v;
      h+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(r.name)+'</div><div class="ds">'+(r.category?esc(r.category):'')+(r.account?' · '+esc(r.account):'')+'</div></div><div class="damt" style="color:var(--warn)">'+money(v)+'</div></div>';});
    h+='</div><div class="debttot"><span>Total pendiente</span><span style="color:var(--warn)">'+money(t2)+'</span></div>';
    if(!rows.length)h='<div class="empty" style="padding:22px">Sin recordatorios pendientes este mes.</div>';
  }
  else if(kind==='venc'){
    title='Vencido hoy · por tarjeta';h='<div class="debtlist">';let t3=0;
    DB.accounts.filter(a=>a.type==='Tarjetas de crédito'&&a.includeInTotal!==false).map(a=>({a:a,s:cardSaldos(a.name)})).filter(x=>x.s.aPagar>0).sort((x,y)=>(toARS(y.s.aPagar,y.a.currency)||0)-(toARS(x.s.aPagar,x.a.currency)||0)).forEach(x=>{const v=toARS(x.s.aPagar,x.a.currency)||0;t3+=v;
      h+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(x.a.name)+'</div><div class="ds">próximo (no suma): '+money(x.s.restante,x.a.currency)+'</div></div><div class="damt neg">'+money(x.s.aPagar,x.a.currency)+'</div></div>';});
    h+='</div><div class="debttot"><span>Total vencido</span><span class="neg">'+money(t3)+'</span></div>';
  }
  else if(kind==='balmes'){
    title='Balance del mes · fórmula';
    let I=0,C=0;mtx.forEach(t=>{const cu=t.currency||'ARS';if(t.type==='income'&&!isCard(t.account))I+=toARS(t.amount,cu)||0;else if(t.type==='expense')C+=toARS(t.amount,cu)||0;});
    const rp=remDebtARS(m);
    h='<div class="finrow" style="padding-top:12px"><span>Ingresos</span><span class="pos">+'+money(I)+'</span></div>'+
      '<div class="finrow"><span>Gastos (tarjeta + contado)</span><span class="neg">−'+money(C)+'</span></div>'+
      '<div class="finrow"><span>Recordatorios pendientes</span><span style="color:var(--warn)">−'+money(rp)+'</span></div>'+
      '<div class="finrow" style="border-top:1px solid var(--line);padding-top:9px"><span><b>Balance del mes</b></span><span class="'+sgn(I-C-rp)+'"><b>'+money(I-C-rp)+'</b></span></div>'+
      '<div class="ds" style="padding:6px 16px 14px;color:var(--muted2)">Tocá Gastos, Ingresos o Recordatorios para ver cada lista.</div>';
  }
  $('#cardDetTitle').textContent=title;$('#cardDetBody').innerHTML=h+'<div style="height:10px"></div>';$('#cardDetScrim').classList.add('on');
}
// Conciliación: por qué la variación real de tus cuentas difiere del balance de flujos
function openCajaConcil(){
  const m=ym(cur);
  const isHidN=n=>{const a=acct(n);return a&&a.includeInTotal===false;};
  const isOperN=n=>{const a=acct(n);return a&&a.includeInTotal!==false&&a.type!=='Tarjetas de crédito';};
  let I=0,cash=0,pagos=0,deAh=0,aAh=0,gOc=0,iOc=0;const gOcRows=[],iOcRows=[],fxN=[];
  DB.tx.forEach(t=>{if(ymOf(t.date)!==m)return;const cu=t.currency||'ARS';const ars=toARS(t.amount,cu)||0;
    if(t.type==='income'&&!isCard(t.account)){I+=ars;if(isHidN(t.account)){iOc+=ars;iOcRows.push(t);aAh+=ars;}}
    else if(t.type==='expense'&&!isCard(t.account)){cash+=ars;if(isHidN(t.account)){gOc+=ars;gOcRows.push(t);deAh+=ars;}}
    else if(t.type==='transfer'){const amtTo=t.amountTo!=null?t.amountTo:t.amount;const vTo=toARS(amtTo,curOf(t.to))||0;
      if(isCard(t.to)&&!isCard(t.from)){pagos+=vTo;if(isHidN(t.from))deAh+=vTo;}
      if(isHidN(t.from)&&isOperN(t.to))deAh+=vTo;
      if(isOperN(t.from)&&isHidN(t.to))aAh+=ars;
      if((curOf(t.from)||'ARS')!==(curOf(t.to)||'ARS'))fxN.push(t);}});
  const balCon=I-cash-pagos+deAh-aAh;
  let h='';
  if(ym(cur)!==ym(TODAY)){
    h='<div class="finhead" style="border-top:none">La conciliación por saldos solo está disponible para el mes en curso.</div>';
  } else {
    const D0=new Date(cur.getFullYear(),cur.getMonth(),1);
    let ini=0,fin=0;
    DB.accounts.forEach(a=>{if(!isOperN(a.name))return;
      const b0=toARS((a.initial||0)+effects(a.name,t=>new Date(t.date+'T12:00:00')<D0),a.currency);
      const b1=toARS(liveBalance(a.name),a.currency);
      if(b0!=null&&b0>0)ini+=b0;if(b1!=null&&b1>0)fin+=b1;});
    const varReal=fin-ini,diff=varReal-balCon,resto=diff;
    h='<div class="finhead" style="border-top:none;padding-top:8px">Dos formas de medir el mes:</div>'+
      '<div class="finrow"><span>Variación real de tus cuentas</span><span class="'+sgn(varReal)+'">'+(varReal>=0?'+':'−')+money(Math.abs(varReal))+'</span></div>'+
      '<div class="finrow"><span>Balance de flujos (con ahorros)</span><span class="'+sgn(balCon)+'">'+(balCon>=0?'+':'−')+money(Math.abs(balCon))+'</span></div>'+
      '<div class="finrow" style="border-top:1px solid var(--line);padding-top:9px"><span><b>Diferencia a explicar</b></span><span><b>'+(diff>=0?'+':'−')+money(Math.abs(diff))+'</b></span></div>';
    if(gOc>0){h+='<div class="finhead">🙈 Gastos pagados desde cuentas ocultas ('+money(gOc)+') — ya integrados como desahorro:</div>';
      gOcRows.forEach(t=>{h+='<div class="finrow"><span>'+esc(stripInst(t.note)||t.sub||t.category||'—')+' <small style="color:var(--muted2)">'+esc(t.account)+' · '+t.date+'</small></span><span class="neg">'+money(t.amount,t.currency||'ARS')+'</span></div>';});}
    if(iOc>0){h+='<div class="finhead">Ingresos cobrados en cuentas ocultas ('+money(iOc)+') — ya integrados como ahorro:</div>';
      iOcRows.forEach(t=>{h+='<div class="finrow"><span>'+esc(t.note||t.category||'ingreso')+' <small style="color:var(--muted2)">'+esc(t.account)+' · '+t.date+'</small></span><span class="pos">'+money(t.amount,t.currency||'ARS')+'</span></div>';});}
    if(Math.abs(resto)>1)h+='<div class="finhead">Diferencia restante: <b>'+(resto>=0?'+':'−')+money(Math.abs(resto))+'</b> — típicamente conversiones de dólar valuadas al cambio de hoy'+(fxN.length?' ('+fxN.length+' transferencias con cambio de moneda este mes)':'')+', cuentas en negativo, o algún movimiento mal cargado (revisá cuenta de origen/destino).</div>';
    if(Math.abs(resto)<=1)h+='<div class="finhead">✓ Todo conciliado.</div>';
  }
  $('#cardDetTitle').textContent='Conciliación de caja · '+monthName(cur).split(' ')[0];
  $('#cardDetBody').innerHTML=h+'<div style="height:14px"></div>';
  $('#cardDetScrim').classList.add('on');
}
$('#pmCaja').onclick=()=>{panelMode='caja';localStorage.setItem('fin_panel_mode','caja');renderPanel();};
$('#pmMes').onclick=()=>{panelMode='mes';localStorage.setItem('fin_panel_mode','mes');renderPanel();};
$('#psCards').onclick=()=>{panelStyle='cards';localStorage.setItem('fin_panel_style','cards');renderPanel();};
$('#psDet').onclick=()=>{panelStyle='det';localStorage.setItem('fin_panel_style','det');renderPanel();};
