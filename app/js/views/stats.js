/* ---------- ESTADISTICAS ---------- */
function renderStats(){
  const m=ym(cur);
  const inc=DB.tx.filter(t=>t.type==='income'&&ymOf(t.date)===m&&isARS(t));
  const exp=DB.tx.filter(t=>t.type==='expense'&&ymOf(t.date)===m&&isARS(t));
  $('#st-inc').textContent=money(inc.reduce((s,t)=>s+t.amount,0));
  $('#st-exp').textContent=money(exp.reduce((s,t)=>s+t.amount,0));
  const rows=statKind==='income'?inc:exp,by={};
  rows.forEach(t=>{const k=t.category||'otros';by[k]=(by[k]||0)+t.amount;});
  const arr=Object.entries(by).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);
  const total=arr.reduce((s,a)=>s+a.v,0);arr.forEach((a,i)=>a.color=colorFor(a.k,i));
  $('#chart').innerHTML=total?pieSVG(arr,total):'';
  if(!total){$('#legend').innerHTML='<div class="empty">Sin '+(statKind==='income'?'ingresos':'gastos')+' en <b>'+monthName(cur)+'</b>.</div>';renderFlow();return;}
  $('#legend').innerHTML=arr.map(a=>'<div class="leg" data-cat="'+a.k+'"><div class="pct" style="background:'+a.color+'">'+(a.v/total*100).toFixed(0)+'%</div><div class="name">'+a.k+'</div><div class="lv">'+money(a.v)+'</div></div>').join('');
  document.querySelectorAll('#legend .leg').forEach(el=>el.onclick=()=>openCategoryDetail(el.dataset.cat));
  renderFlow();renderTagStats();
}
function renderTagStats(){
  const m=ym(cur);const byTag={};
  DB.tx.forEach(t=>{if(t.type!=='expense'||!t.tags||ymOf(t.date)!==m)return;
    t.tags.forEach(g=>{byTag[g]=(byTag[g]||0)+(toARS(t.amount,t.currency||'ARS')||0);});});
  DB.reminders.forEach(r=>{if(r.type!=='expense'||!r.tags||!remActiveIn(r,m)||DB.paid['rem:'+r.id+':'+m])return;
    r.tags.forEach(g=>{byTag[g]=(byTag[g]||0)+(toARS(remAmount(r,m),curOf(r.account))||0);});});
  const rows=Object.entries(byTag).sort((a,b)=>b[1]-a[1]);
  if(!rows.length){$('#st-tags').innerHTML='';return;}
  const max=rows[0][1];
  let h='<div class="pj-sec"><span>Etiquetas del mes</span></div><div class="catlist" style="margin-bottom:14px">';
  rows.forEach(([g,v])=>{h+='<div class="catrow" data-tag="'+esc(g)+'"><div class="crtop"><span>#'+esc(g)+' ›</span><b class="neg">'+money(v)+'</b></div><div class="crbar"><i style="width:'+Math.round(v/max*100)+'%"></i></div></div>';});
  h+='</div>';
  $('#st-tags').innerHTML=h;
  document.querySelectorAll('#st-tags .catrow').forEach(el=>el.onclick=()=>openTagDetail(el.dataset.tag));
}
function openTagDetail(tag){
  const txs=DB.tx.filter(t=>t.type==='expense'&&t.tags&&t.tags.includes(tag)).sort((a,b)=>b.date.localeCompare(a.date));
  const tot=txs.reduce((s,t)=>s+(toARS(t.amount,t.currency||'ARS')||0),0);
  let h='<div class="debtlist">';
  let mrows='';let sum6=0,n6=0;
  for(let i=5;i>=0;i--){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()-i,1);const mm=ym(d);
    const v=txs.filter(t=>ymOf(t.date)===mm).reduce((s,t)=>s+(toARS(t.amount,t.currency||'ARS')||0),0);
    if(v>0){sum6+=v;n6++;}
    mrows+='<div class="finrow"><span style="text-transform:capitalize">'+d.toLocaleDateString('es-AR',{month:'long'})+'</span><span class="'+(v>0?'neg':'')+'" style="'+(v>0?'':'color:var(--muted2)')+'">'+(v>0?money(v):'—')+'</span></div>';}
  h+='<div class="finhead" style="border-top:none;padding-top:8px">Últimos 6 meses · promedio '+money(n6?sum6/n6:0)+'/mes</div>'+mrows;
  h+='<div class="debttot" style="padding:10px 16px"><span>Total histórico ('+txs.length+' mov.)</span><span class="neg">'+money(tot)+'</span></div>';
  const trems=DB.reminders.filter(r=>r.type==='expense'&&r.tags&&r.tags.includes(tag)&&remActiveIn(r,MESACTUAL));
  if(trems.length){h+='<div class="finhead">⏰ Recordatorios con esta etiqueta</div>';
    trems.forEach(r=>{h+='<div class="finrow"><span>'+esc(r.name)+'</span><span class="neg">'+money(toARS(remAmount(r,MESACTUAL),curOf(r.account))||0)+'<small> /mes'+(DB.paid['rem:'+r.id+':'+MESACTUAL]?' · pagado ✓':'')+'</small></span></div>';});}
  h+='<div class="finhead">Movimientos</div>';
  txs.slice(0,30).forEach(t=>{h+='<div class="debtrow"><div class="dinfo"><div class="dn">'+esc(stripInst(t.note)||t.sub||t.category||'—')+'</div><div class="ds">'+t.date+' · '+esc(t.category||'')+(t.sub?' · '+esc(t.sub):'')+' · '+esc(t.account||'')+'</div></div><div class="damt neg">'+money(t.amount,t.currency||'ARS')+'</div></div>';});
  if(txs.length>30)h+='<div class="ds" style="padding:8px 16px 4px;color:var(--muted2)">…y '+(txs.length-30)+' más (buscá "#'+esc(tag)+'" en Trans.)</div>';
  h+='</div>';
  $('#cardDetTitle').textContent='#'+tag;$('#cardDetBody').innerHTML=h;$('#cardDetScrim').classList.add('on');
}
function renderFlow(){
  const labs=[],incA=[],expA=[];
  for(let i=5;i>=0;i--){const d=new Date(cur.getFullYear(),cur.getMonth()-i,1),mm=ym(d);
    labs.push(d.toLocaleDateString('es-AR',{month:'short'}).replace('.',''));
    incA.push(DB.tx.filter(t=>t.type==='income'&&ymOf(t.date)===mm&&isARS(t)).reduce((s,t)=>s+t.amount,0));
    expA.push(DB.tx.filter(t=>t.type==='expense'&&ymOf(t.date)===mm&&isARS(t)).reduce((s,t)=>s+t.amount,0));}
  const max=Math.max(1,...incA,...expA);
  const W=340,H=140,padX=10,padT=14,padB=20,n=6,gap=(W-2*padX)/n,bw=gap*0.30,plot=H-padT-padB;
  let svg='';
  for(let i=0;i<n;i++){const gx=padX+gap*i+gap*0.12;
    const hi=incA[i]/max*plot,he=expA[i]/max*plot;
    svg+='<rect x="'+gx.toFixed(1)+'" y="'+(padT+plot-hi).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,hi).toFixed(1)+'" rx="2" fill="var(--income)"/>';
    svg+='<rect x="'+(gx+bw+3).toFixed(1)+'" y="'+(padT+plot-he).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,he).toFixed(1)+'" rx="2" fill="var(--expense)"/>';
    svg+='<text x="'+(gx+bw+1.5).toFixed(1)+'" y="'+(H-6)+'" font-size="9" fill="var(--muted2)" text-anchor="middle">'+labs[i]+'</text>';
  }
  svg+='<line x1="'+padX+'" y1="'+(padT+plot)+'" x2="'+(W-padX)+'" y2="'+(padT+plot)+'" stroke="var(--line)" stroke-width="1"/>';
  const inT=incA[5],exT=expA[5],net=inT-exT;
  $('#st-flow').innerHTML='<div style="margin:12px 16px 4px;padding:12px 6px 4px;background:var(--bg2);border:1px solid var(--line);border-radius:14px">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 10px 6px"><span style="font-size:11px;color:var(--muted)">Ingresos vs gastos (6 meses)</span>'+
    '<span style="font-size:11px"><span style="color:var(--income)">■</span> ingresos &nbsp;<span style="color:var(--expense)">■</span> gastos</span></div>'+
    '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">'+svg+'</svg>'+
    '<div style="font-size:11px;color:var(--muted);text-align:center;padding:2px 0 4px">Neto '+monthName(cur)+': <b class="'+sgn(net)+'">'+money(net)+'</b></div></div>';
}
function pieSVG(arr,total){
  const R=120,cx=130,cy=130;let ang=-Math.PI/2,p='';
  arr.forEach(a=>{const f=a.v/total,a2=ang+f*2*Math.PI;
    if(f>=0.9999){p='<circle cx="130" cy="130" r="120" fill="'+a.color+'" stroke="#15171c" stroke-width="2"/>';return;}
    const x1=cx+R*Math.cos(ang),y1=cy+R*Math.sin(ang),x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2),lg=f>0.5?1:0;
    p+='<path d="M130 130 L'+x1+' '+y1+' A120 120 0 '+lg+' 1 '+x2+' '+y2+' Z" fill="'+a.color+'" stroke="#15171c" stroke-width="2"/>';ang=a2;});
  return '<svg width="260" height="260" viewBox="0 0 260 260">'+p+'</svg>';
}
function lineSVG(vals){
  const W=480,H=150,pad=24,max=Math.max(...vals,1),n=vals.length;
  const x=i=>pad+(W-2*pad)*(n<2?0.5:i/(n-1)),y=v=>H-pad-(H-2*pad)*(v/max);
  let pts=vals.map((v,i)=>x(i)+','+y(v)).join(' ');
  let dots=vals.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="4" fill="'+cssv('--accent')+'"/>').join('');
  return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="150"><polyline points="'+pts+'" fill="none" stroke="'+cssv('--accent')+'" stroke-width="2"/>'+dots+'</svg>';
}

