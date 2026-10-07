/* ---------- TRANSACCIONES ---------- */
function txMatch(t,q){const hay=[t.note,t.category,t.sub,t.account,t.from,t.to,String(t.amount),(t.tags||[]).map(g=>'#'+g).join(' '),(t.tags||[]).join(' ')].filter(Boolean).join(' ').toLowerCase();return q.split(/\s+/).every(w=>hay.includes(w));}
function renderDiario(){
  const q=(txQuery||'').trim().toLowerCase();
  const list=q?DB.tx.filter(t=>txMatch(t,q)).sort((a,b)=>b.date.localeCompare(a.date))
              :DB.tx.filter(t=>ymOf(t.date)===ym(cur)).sort((a,b)=>b.date.localeCompare(a.date));
  let inc=0,exp=0;
  if(q){list.forEach(t=>{if(!isARS(t))return;if(t.type==='income')inc+=t.amount;else if(t.type==='expense')exp+=t.amount;});}
  else{
    const mtx=DB.tx.filter(t=>ymOf(t.date)===ym(cur));
    mtx.forEach(t=>{if(!isARS(t))return;
      if(t.type==='income'&&!isCard(t.account))inc+=t.amount;
      else if(homeMode==='mes'){ // consumido en el mes: tarjeta + efectivo/débito
        if(t.type==='expense')exp+=t.amount;
      } else { // caja: plata que salió de cuentas: gastos no-tarjeta + pagos de tarjeta
        if(t.type==='expense'&&!isCard(t.account))exp+=t.amount;
        else if(t.type==='transfer'&&isCard(t.to)&&!isCard(t.from))exp+=t.amount;
      }});
  }
  let rem=q?0:remDebtARS(ym(cur));
  if(!q&&homeMode==='caja'&&ym(cur)===ym(TODAY)){ // en caja, sumar lo que falta pagar de tarjetas (ya neteado con pagos hechos)
    DB.accounts.forEach(a=>{if(a.type!=='Tarjetas de crédito'||a.includeInTotal===false)return;rem+=toARS(cardSaldos(a.name).aPagar,a.currency)||0;});
  }
  $('#s-inc').textContent=money(inc);$('#s-exp').textContent=money(exp);
  $('#s-rem').textContent=money(rem);$('#s-rem-cell').classList.toggle('hidden',!!q);
  $('#s-rem-lbl').textContent=(!q&&homeMode==='caja')?'Compromisos':'Recordatorios';
  $('#s-exp-lbl').textContent=(!q&&homeMode==='caja')?'Salidas':'Gastos';
  $('#bmMes').classList.toggle('on',homeMode==='mes');$('#bmCaja').classList.toggle('on',homeMode==='caja');
  $('#s-bal').textContent=money(inc-exp-rem);$('#s-bal').className='big '+sgn(inc-exp-rem);
  const dEl=$('#s-daily');const esMesHoy=!q&&ym(cur)===ym(TODAY);
  if(esMesHoy){
    const dim=new Date(TODAY.getFullYear(),TODAY.getMonth()+1,0).getDate();
    const dias=dim-TODAY.getDate()+1;
    const dispo=inc-exp-rem;const per=dispo>0?dispo/dias:0;
    const pct=inc>0?Math.min(100,Math.round((exp+rem)/inc*100)):0;
    if(per>0){dEl.innerHTML='<div class="dlbl">Podés gastar por día</div><div class="dval pos">'+money(per)+'</div><div class="dsub">'+dias+' día'+(dias===1?'':'s')+' restante'+(dias===1?'':'s')+' del mes · comprometido '+pct+'%</div><div class="dbar"><i style="width:'+pct+'%"></i></div>';dEl.classList.remove('hidden');}
    else dEl.classList.add('hidden');
  } else dEl.classList.add('hidden');
  // ---- ¿Cómo se financió el mes? (déficit = deuda nueva + retiros de ahorro + uso de caja previa) ----
  const fEl=$('#finmes');
  if(q){fEl.innerHTML='';}
  else{
    const m2=ym(cur);const isHid=n=>{const a=acct(n);return a&&a.includeInTotal===false;};
    const isOper=n=>{const a=acct(n);return a&&a.includeInTotal!==false&&a.type!=='Tarjetas de crédito';};
    let I2=0,C2=0,compras=0,pagos=0,deAh=0,aAh=0;
    DB.tx.forEach(t=>{if(ymOf(t.date)!==m2)return;const cu=t.currency||'ARS';const ars=toARS(t.amount,cu)||0;
      if(t.type==='income'&&!isCard(t.account)){I2+=ars;if(isHid(t.account))aAh+=ars;}
      else if(t.type==='expense'){C2+=ars;if(isCard(t.account))compras+=ars;else if(isHid(t.account))deAh+=ars;}
      else if(t.type==='transfer'){const amtTo=t.amountTo!=null?t.amountTo:t.amount;const vTo=toARS(amtTo,curOf(t.to))||0;
        if(isCard(t.to)&&!isCard(t.from)){pagos+=vTo;if(isHid(t.from))deAh+=vTo;}
        if(isHid(t.from)&&isOper(t.to))deAh+=vTo;
        if(isOper(t.from)&&isHid(t.to))aAh+=ars;}});
    const deuda=compras-pagos,ahorro=deAh-aAh;
    let res,inner;
    const row=(ico,lbl,v,posTxt,negTxt)=>{if(Math.abs(v)<0.5)return '';
      return '<div class="finrow"><span>'+ico+' '+lbl+'</span><span class="'+(v>0?'neg':'pos')+'">'+(v>0?'+':'−')+money(Math.abs(v))+' <small>'+(v>0?posTxt:negTxt)+'</small></span></div>';};
    if(homeMode==='caja'){
      // CAJA: salidas reales = gastos cash + pagos de tarjeta. La deuda nueva no mueve caja.
      const salidas=(C2-compras)+pagos;res=I2-salidas;
      const cajaC=(salidas-I2)-ahorro;
      const ctx='<div style="padding:2px 16px 4px;font-size:11px;color:var(--muted2)">💳 Además compraste con tarjeta '+money(compras)+' que todavía no salió de caja (deuda a pagar después).</div>';
      if(res<-0.5){
        inner='<div class="finhead">Salió <b class="neg">'+money(-res)+'</b> más de lo que ingresó. Se cubrió con:</div>'+
          row('🐷','Ahorros',ahorro,'sacaste de ahorros','mandaste a ahorros')+
          row('💰','Caja acumulada',cajaC,'bajó la plata de tus cuentas','subió la plata de tus cuentas')+(compras>0.5?ctx:'');
      } else {
        inner='<div class="finhead">Ingresó <b class="pos">'+money(res)+'</b> más de lo que salió. Destino:</div>'+
          row('🐷','Ahorros',ahorro,'sacaste de ahorros','mandaste a ahorros')+
          row('💰','Caja acumulada',cajaC,'bajó la plata de tus cuentas','subió la plata de tus cuentas')+(compras>0.5?ctx:'');
      }
    } else {
      res=I2-C2;const caja=(C2-I2)-deuda-ahorro;
      if(res<-0.5){
        inner='<div class="finhead">El déficit de <b class="neg">'+money(-res)+'</b> se cubrió con:</div>'+
          row('💳','Deuda nueva (tarjetas/préstamos)',deuda,'te endeudaste','bajaste deuda (le destinaste plata)')+
          row('🐷','Ahorros',ahorro,'sacaste de ahorros','mandaste a ahorros')+
          row('💰','Caja acumulada',caja,'bajó la plata de tus cuentas','subió la plata de tus cuentas');
      } else {
        inner='<div class="finhead">Superávit de <b class="pos">'+money(res)+'</b>. Destino:</div>'+
          row('💳','Deuda (tarjetas/préstamos)',deuda,'sumaste deuda igual','bajaste deuda')+
          row('🐷','Ahorros',ahorro,'sacaste de ahorros','mandaste a ahorros')+
          row('💰','Caja acumulada',caja,'bajó la plata de tus cuentas','subió la plata de tus cuentas');
      }
    }
    const remNote=rem>0?'<div style="padding:0 16px 12px;font-size:11px;color:var(--muted2)">Analiza solo movimientos reales. El balance de arriba además resta '+(homeMode==='caja'?'compromisos':'recordatorios')+' pendientes ('+money(rem)+').</div>':'';
    fEl.innerHTML='<details class="fincard"><summary>¿Cómo se financió '+(homeMode==='caja'?'la caja de ':'')+monthName(cur).split(' ')[0]+'? <span class="'+sgn(res)+'">'+(res>=0?'+':'−')+money(Math.abs(res))+'</span></summary>'+inner+remNote+'</details>';
  }
  const enTarjeta=t=>t.type==='transfer'?(isCard(t.from)||isCard(t.to)):isCard(t.account);
  const flist=txFilter==='all'?list:list.filter(t=>txFilter==='card'?enTarjeta(t):!enTarjeta(t));
  ['tfCard','tfCash','tfAll'].forEach(id=>$('#'+id).classList.toggle('on',(id==='tfCard'&&txFilter==='card')||(id==='tfCash'&&txFilter==='cash')||(id==='tfAll'&&txFilter==='all')));
  if(!flist.length){$('#diario').innerHTML=q?'<div class="empty">Sin resultados para <b>'+esc(txQuery)+'</b>.</div>':'<div class="empty">No hay movimientos'+(txFilter!=='all'?' con ese filtro':'')+' en <b>'+monthName(cur)+'</b>.'+(txFilter==='all'?'<br>Tocá <b>+</b> para agregar uno.':'')+'</div>';return;}
  $('#diario').innerHTML=(q?'<div class="searchinfo">'+flist.length+(flist.length===1?' resultado':' resultados')+' en todos los meses</div>':'')+dayGroups(flist);bindTx('#diario');
}
function dayGroups(list){
  const days={};list.forEach(t=>(days[t.date]=days[t.date]||[]).push(t));
  const dows=['dom','lun','mar','mié','jue','vie','sáb'];let html='';
  Object.keys(days).sort((a,b)=>b.localeCompare(a)).forEach(d=>{
    const dt=new Date(d+'T12:00:00');let di=0,de=0;
    days[d].forEach(t=>{if(!isARS(t))return;if(t.type==='income')di+=t.amount;else if(t.type==='expense')de+=t.amount;});
    html+='<div class="day"><div class="dayhead"><div class="left"><span class="dnum">'+dt.getDate()+'</span><span class="dow">'+dows[dt.getDay()]+'</span><span class="dm">'+String(dt.getMonth()+1).padStart(2,'0')+'.'+dt.getFullYear()+'</span></div><div class="tot">'+(di?'<span class="pos">'+money(di)+'</span>':'')+(de?'<span class="neg">'+money(de)+'</span>':'')+'</div></div>';
    days[d].forEach(t=>html+=txRow(t));html+='</div>';
  });
  return html;
}
function bindTx(scope){document.querySelectorAll(scope+' .tx').forEach(el=>el.onclick=()=>openSheet(el.dataset.id));
  document.querySelectorAll(scope+' .tagchip').forEach(ch=>ch.onclick=e=>{e.stopPropagation();openTagDetail(ch.dataset.tag);});}
function txRow(t){
  let cn,sn,mid,amt,cls,c=t.currency||'ARS';
  if(t.type==='transfer'){cn='Transferencia';sn='';mid=t.from+' → '+t.to;amt=money(t.amount,c);cls='';}
  else{cn=t.category||'';sn=t.sub||'';mid=t.account||'';amt=money(t.amount,c);cls=t.type==='income'?'pos':'neg';}
  let b='';if(t.inst)b+='<span class="badge">'+t.inst[0]+'/'+t.inst[1]+'</span>';if(t.dueMonth)b+='<span class="badge future">paga '+t.dueMonth+'</span>';
  (t.tags||[]).forEach(g=>b+='<span class="tagchip" data-tag="'+esc(g)+'">#'+esc(g)+'</span>');
  return '<div class="tx" data-id="'+t.id+'"><div class="cat"><div class="cn">'+cn+'</div><div class="sn">'+(sn||'&nbsp;')+'</div></div><div class="mid"><span class="midtx">'+mid+'</span>'+b+'</div><div class="amt '+cls+'">'+amt+'</div></div>';
}

