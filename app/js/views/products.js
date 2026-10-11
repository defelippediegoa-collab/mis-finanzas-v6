/* ---------- PRODUCTOS Y PRECIOS: pantalla, detalle, comparación por tipo, picker, vinculación masiva ---------- */
let prodQuery='';
function openProductsView(){$('#menu').classList.remove('on');prodQuery='';renderProductsList();
  showDetail('🏷️ Productos y precios');['panel','cards'].forEach(id=>$('#view-'+id).classList.add('hidden'));detailRefresh=renderProductsList;}
function fmtP(v,cur){return money(v,cur||'ARS');}
function prodLastInfo(p){const st=productStoreSummary(p.id);if(!st.length)return null;const rows=productPriceRows(p.id);const last=rows[0];const prev=rows.find(r=>r.price>0&&r.date<last.date&&r.merchant===last.merchant);
  return{last,st,trend:prev&&last.price?(last.price-prev.price)/prev.price:null};}
function renderProductsList(){
  const q=normKey(prodQuery);const unresolved=unresolvedItemKeys();
  let prods=activeProducts();if(q)prods=rankProducts(prodQuery,200).map(x=>x.p).concat(prods.filter(p=>normKey(p.name).includes(q)||normKey(p.brand).includes(q)||normKey(p.kind).includes(q))).filter((p,i,a)=>a.indexOf(p)===i);
  const kinds=new Map();prods.forEach(p=>{const k=kindKey(p)||'(sin tipo)';let o=kinds.get(k);if(!o){o={key:k,label:p.kind||'(sin tipo)',products:[]};kinds.set(k,o);}o.products.push(p);});
  let h='<div class="prodtop"><input id="prodSearch" placeholder="Buscar producto, marca o tipo…" value="'+esc(prodQuery)+'">';
  if(unresolved.length)h+='<div class="inboxbar" id="prodLinkBar" style="margin:10px 0 0">🏷️ <b>'+unresolved.length+'</b> ítem'+(unresolved.length>1?'s':'')+' de tickets sin producto · vincular ›</div>';
  h+='</div>';
  if(!prods.length){h+='<div class="empty" style="padding:24px 18px">'+(q?'Nada con "'+esc(prodQuery)+'".':'Todavía no hay productos. Se crean desde los ítems de un ticket (tocá "¿producto?") o con "vincular".')+'</div>';}
  [...kinds.values()].sort((a,b)=>a.label.localeCompare(b.label,'es')).forEach(k=>{
    h+='<div class="pj-sec pkind" data-key="'+esc(k.key)+'"><span>'+esc(k.label)+' <small style="color:var(--muted2)">· '+k.products.length+'</small></span>'+(k.products.length>1?'<small class="pkcmp">comparar ›</small>':'')+'</div><div class="catlist">';
    k.products.sort((a,b)=>(a.variety||'').localeCompare(b.variety||'','es')||a.name.localeCompare(b.name,'es')).forEach(p=>{const li=prodLastInfo(p);
      h+='<div class="prow" data-id="'+esc(p.id)+'"><div class="pri"><div class="prn">'+esc(p.name)+'</div><div class="prs">'+esc([p.variety,p.brand,p.size].filter(Boolean).join(' · ')||'sin marca')+(li?' · '+li.st.length+' comercio'+(li.st.length>1?'s':''):'')+'</div></div>'+
        (li?'<div class="prp"><b>'+(li.last.usd?'US$ '+li.last.raw:fmtP(li.last.price))+'</b><small>'+esc(li.last.merchant)+' · '+li.last.date.slice(5)+(li.trend!=null&&Math.abs(li.trend)>=0.005?' <span class="'+(li.trend>0?'neg':'pos')+'">'+(li.trend>0?'▲':'▼')+Math.abs(li.trend*100).toFixed(0)+'%</span>':'')+'</small></div>':'<div class="prp"><small>sin compras</small></div>')+'</div>';});
    h+='</div>';});
  $('#detailBody').innerHTML=h;
  const si=$('#prodSearch');si.oninput=()=>{prodQuery=si.value;const pos=si.selectionStart;renderProductsList();const s2=$('#prodSearch');s2.focus();s2.setSelectionRange(pos,pos);};
  const lb=$('#prodLinkBar');if(lb)lb.onclick=openProductLink;
  $('#detailBody').querySelectorAll('.prow').forEach(r=>r.onclick=()=>openProductDetail(r.dataset.id));
  $('#detailBody').querySelectorAll('.pkcmp').forEach(c=>c.onclick=e=>{e.stopPropagation();openKindDetail(c.closest('.pkind').dataset.key);});
}

// ---- gráfico multi-serie con eje de tiempo ----
function multiLineSVG(series,opts){opts=opts||{};const W=opts.W||480,H=opts.H||170,pl=44,pr=10,pt=12,pb=22;
  const pts=series.flatMap(s=>s.pts);if(!pts.length)return '';
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);let x0=Math.min(...xs),x1=Math.max(...xs);if(x1-x0<86400000*7){x0-=86400000*7;x1+=86400000*7;}
  const ymax=Math.max(...ys)*1.08||1;const X=x=>pl+(W-pl-pr)*((x-x0)/(x1-x0||1)),Y=y=>pt+(H-pt-pb)*(1-y/ymax);
  let svg='';[0.25,0.5,0.75,1].forEach(f=>{const y=Y(ymax*f/1.08);svg+='<line x1="'+pl+'" y1="'+y.toFixed(1)+'" x2="'+(W-pr)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1"/><text x="'+(pl-4)+'" y="'+(y+3).toFixed(1)+'" font-size="9" fill="var(--muted2)" text-anchor="end">'+kfmt(ymax*f/1.08)+'</text>';});
  series.forEach(s=>{const sp=s.pts.slice().sort((a,b)=>a.x-b.x);svg+='<polyline points="'+sp.map(p=>X(p.x).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="2"/>';sp.forEach(p=>{svg+='<circle cx="'+X(p.x).toFixed(1)+'" cy="'+Y(p.y).toFixed(1)+'" r="3.5" fill="'+s.color+'"><title>'+esc(s.name)+' · '+new Date(p.x).toLocaleDateString('es-AR')+' · '+money(p.y)+'</title></circle>';});});
  const lab=x=>new Date(x).toLocaleDateString('es-AR',{day:'numeric',month:'short'}).replace('.','');
  svg+='<text x="'+pl+'" y="'+(H-6)+'" font-size="9" fill="var(--muted2)">'+lab(x0)+'</text><text x="'+(W-pr)+'" y="'+(H-6)+'" font-size="9" fill="var(--muted2)" text-anchor="end">'+lab(x1)+'</text>';
  const legend=series.map(s=>'<span style="color:'+s.color+'">■</span> '+esc(s.name)).join(' &nbsp;');
  return '<div style="font-size:11px;padding:0 6px 4px">'+legend+'</div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">'+svg+'</svg>';}

// ---- detalle de producto ----
let prodRange=12;
function openProductDetail(pid){const p=resolveProduct(pid);if(!p){toast('Producto no encontrado');return;}
  const basis=CFG.priceBasis||'paid';const rows=productPriceRows(pid,basis);const st=productStoreSummary(pid,basis);
  let h='<div class="debtlist">';
  h+='<div class="finrow" style="flex-direction:column;align-items:flex-start;gap:4px"><div style="font-size:12px;color:var(--muted)">'+esc(kindLabel(p)||'sin tipo')+(p.brand?' · '+esc(p.brand):'')+(p.size?' · '+esc(p.size):'')+' · por '+esc(p.unit||'u')+'</div>'+
    '<div class="pacts"><button data-a="rename">Renombrar</button><button data-a="meta">Tipo / marca</button><button data-a="merge">Fusionar en…</button><button data-a="del" style="color:var(--expense)">Eliminar</button></div></div>';
  // más barato en
  const recent=st.filter(s=>(Date.parse(s.lastDate)>=Date.now()-90*86400000));
  if(st.length){h+='<div class="finhead">Más barato en <small style="float:right;font-weight:400;color:var(--muted)">precio '+(basis==='list'?'de lista':'pagado')+' · <a href="#" id="pdBasis">ver '+(basis==='list'?'pagado':'de lista')+'</a></small></div>';
    if(recent.length>1){const a=recent[0],b=recent[1];const pct=b.last?((b.last-a.last)/b.last*100):0;h+='<div class="hint" style="padding:4px 16px 6px">Más barato en <b>'+esc(a.merchant)+'</b> ('+fmtP(a.last)+(pct>=1?', '+pct.toFixed(0)+' % menos que '+esc(b.merchant):'')+')</div>';}
    st.forEach((s,i)=>{const old=!recent.includes(s);h+='<div class="finrow"><span>'+(i===0&&!old?'✓ ':'')+esc(s.merchant)+' <small style="color:var(--muted2)">'+s.n+' compra'+(s.n>1?'s':'')+(old?' · desactualizado':'')+'</small></span><span><b>'+fmtP(s.last)+'</b> <small style="color:var(--muted2)">'+s.lastDate.slice(5)+' · mín '+fmtP(s.min)+' · prom '+fmtP(s.avg)+'</small></span></div>';});}
  // gráfico
  const since=prodRange?Date.now()-prodRange*30.4*86400000:0;const byM=new Map();
  rows.filter(r=>r.price>0&&Date.parse(r.date)>=since).forEach(r=>{let s=byM.get(r.merchant);if(!s){s={name:r.merchant,color:cssv(PALETTE[byM.size%PALETTE.length]),pts:[]};byM.set(r.merchant,s);}s.pts.push({x:Date.parse(r.date+'T12:00:00'),y:r.price});});
  if(byM.size){h+='<div class="finhead">Evolución <small style="float:right;font-weight:400">'+[6,12,0].map(r=>'<a href="#" class="pdRange'+(r===prodRange?' on':'')+'" data-r="'+r+'">'+(r?r+' m':'todo')+'</a>').join(' · ')+'</small></div><div style="padding:6px 10px">'+multiLineSVG([...byM.values()])+'</div>';}
  // historial
  h+='<div class="finhead">Compras ('+rows.length+')</div>';
  rows.slice(0,60).forEach(r=>{const diff=r.list!=null&&r.paid!=null&&Math.abs(r.list-r.paid)>=0.01;
    h+='<div class="debtrow" data-id="'+esc(r.t.id)+'"><div class="dinfo"><div class="dn">'+esc(r.merchant)+' <small style="color:var(--muted2)">'+r.date+'</small></div><div class="ds">'+r.qty+' '+esc(r.unit)+(diff?' · lista '+money(r.list,r.cur)+' → pagado '+money(r.paid,r.cur)+' (−'+((1-r.paid/r.list)*100).toFixed(0)+'%)':'')+'</div></div><div class="damt">'+(r.usd?'US$ '+r.raw:fmtP(r.raw))+'<small style="display:block;color:var(--muted2);font-weight:400">por '+esc(r.unit)+'</small></div></div>';});
  if(rows.length>60)h+='<div class="ds" style="padding:8px 16px 4px;color:var(--muted2)">…y '+(rows.length-60)+' más</div>';
  // alias
  h+='<div class="finhead">Cómo aparece en los tickets</div><div style="padding:6px 16px 14px">'+((p.aliases||[]).map(a=>'<span class="tagchip pal" data-a="'+esc(a)+'">'+esc(a)+' <b>×</b></span>').join(' ')||'<span class="hint">sin alias</span>')+'</div>';
  h+='</div>';
  $('#cardDetTitle').textContent=p.name;$('#cardDetBody').innerHTML=h;$('#cardDetScrim').classList.add('on');
  const body=$('#cardDetBody');
  body.querySelectorAll('.debtrow[data-id]').forEach(el=>el.onclick=()=>{$('#cardDetScrim').classList.remove('on');openTicket({editId:el.dataset.id});});
  const pb=$('#pdBasis');if(pb)pb.onclick=e=>{e.preventDefault();CFG.priceBasis=basis==='list'?'paid':'list';saveCfg();openProductDetail(pid);};
  body.querySelectorAll('.pdRange').forEach(a=>a.onclick=e=>{e.preventDefault();prodRange=+a.dataset.r;openProductDetail(pid);});
  body.querySelectorAll('.pal').forEach(c=>c.onclick=()=>{const n=rows.filter(r=>(r.i.key||normKey(r.i.desc))===c.dataset.a).length;if(!confirm('¿Quitar el alias "'+c.dataset.a+'"? '+(n?n+' compra'+(n>1?'s':'')+' queda'+(n>1?'n':'')+' sin producto.':'')))return;removeAlias(pid,c.dataset.a);openProductDetail(pid);if(detail)renderProductsList();});
  body.querySelectorAll('.pacts button').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
    if(a==='rename'){$('#cardDetScrim').classList.remove('on');openProductEdit(pid).then(()=>{openProductDetail(pid);if(detail)renderProductsList();});}
    else if(a==='meta'){$('#cardDetScrim').classList.remove('on');openProductEdit(pid).then(()=>{openProductDetail(pid);if(detail)renderProductsList();});}
    else if(a==='merge'){$('#cardDetScrim').classList.remove('on');openProductPicker({desc:p.name,title:'Fusionar "'+p.name+'" en…',excludeId:pid,noCreate:true}).then(r=>{if(r&&r.productId){mergeProducts(pid,r.productId);toast('Fusionado');openProductDetail(r.productId);}else openProductDetail(pid);if(detail)renderProductsList();});}
    else if(a==='del'){if(rows.length&&!confirm('Este producto tiene '+rows.length+' compras. Se van a quedar sin producto (podés volver a vincularlas). ¿Eliminar igual?'))return;if(!rows.length&&!confirm('¿Eliminar el producto?'))return;deleteProduct(pid);$('#cardDetScrim').classList.remove('on');toast('Producto eliminado');if(detail)renderProductsList();}});
}

// ---- comparación por tipo (mismo genérico, distintas marcas) ----
function openKindDetail(key,variety){const k=kindsIndex().get(key);if(!k)return;const basis=CFG.priceBasis||'paid';const cmp=kindComparison(key,basis,variety);
  const vLabel=variety!=null?((k.products.find(p=>varKey(p)===variety)||{}).variety||'(sin variedad)'):null;
  const sp=kindSpendByMonth(key,variety);const mNow=ym(cur);let h='<div class="debtlist">';
  h+='<div class="debttot" style="padding:10px 16px;border-top:none"><span>Gastado en '+esc(k.kind)+(vLabel?' › '+esc(vLabel):'')+' · '+monthName(cur)+'</span><span class="neg">'+money(sp[mNow]||0)+'</span></div>';
  let s6=0,n6=0,mrows='';for(let i=5;i>=0;i--){const d=new Date(cur.getFullYear(),cur.getMonth()-i,1);const mm=ym(d);const v=sp[mm]||0;if(v>0){s6+=v;n6++;}mrows+='<div class="finrow"><span style="text-transform:capitalize">'+d.toLocaleDateString('es-AR',{month:'long'})+'</span><span class="'+(v>0?'neg':'')+'" style="'+(v>0?'':'color:var(--muted2)')+'">'+(v>0?money(v):'—')+'</span></div>';}
  const tot=Object.values(sp).reduce((a,b)=>a+b,0);
  h+='<div class="finhead">Últimos 6 meses · promedio '+money(n6?s6/n6:0)+'/mes · total histórico '+money(tot)+'</div>'+mrows;
  if(variety==null){const vs=kindSpendByVariety(key,mNow);if(vs.length){h+='<div class="finhead">Por variedad · '+monthName(cur)+'</div>';const vmax=vs[0].v;
      vs.forEach(x=>{h+='<div class="catrow" data-var="'+esc(x.variety)+'" style="padding:8px 16px"><div class="crtop"><span>'+esc(x.label)+' <small style="color:var(--muted2)">×'+x.n+'</small> ›</span><b class="neg">'+money(x.v)+'</b></div><div class="crbar"><i style="width:'+Math.round(x.v/vmax*100)+'%"></i></div></div>';});}}
  h+='<div class="finhead">'+(variety!=null?'Por marca':'Productos')+' · precio '+(basis==='list'?'de lista':'pagado')+' normalizado'+(variety==null&&cmp.length>1?' <small style="font-weight:400;color:var(--muted)">(compará dentro de una variedad)</small>':'')+'</div>';
  let lastVar=null;
  cmp.forEach((c,i)=>{if(variety==null){const vk=varKey(c.p);if(vk!==lastVar){lastVar=vk;h+='<div class="ds" style="padding:8px 16px 2px;color:var(--accent);font-size:12px">'+esc(c.p.variety||'(sin variedad)')+'</div>';}}
    h+='<div class="debtrow" data-id="'+esc(c.p.id)+'"><div class="dinfo"><div class="dn">'+(i===0&&c.norm?'✓ ':'')+esc(c.p.name)+'</div><div class="ds">'+esc([c.p.variety,c.p.brand,c.p.size].filter(Boolean).join(' · ')||'sin marca')+(c.best?' · '+esc(c.best.merchant)+' '+c.best.lastDate.slice(5):'')+'</div></div><div class="damt">'+(c.norm?fmtP(c.norm.v)+'<small style="display:block;color:var(--muted2);font-weight:400">por '+c.norm.u+'</small>':(c.best?fmtP(c.best.last)+'<small style="display:block;color:var(--muted2);font-weight:400">(sin tamaño)</small>':'<small>sin compras</small>'))+'</div></div>';});
  const series=cmp.filter(c=>c.stores.length).map((c,i)=>({name:c.p.brand||c.p.name,color:cssv(PALETTE[i%PALETTE.length]),pts:productPriceRows(c.p.id,basis).filter(r=>r.price>0).map(r=>({x:Date.parse(r.date+'T12:00:00'),y:r.price}))})).filter(s=>s.pts.length);
  if(variety!=null&&series.length)h+='<div class="finhead">Evolución por marca (precio por '+esc(cmp[0].p.unit||'u')+')</div><div style="padding:6px 10px">'+multiLineSVG(series)+'</div>';
  h+='<div style="padding:10px 16px"><button class="editbtn" id="kdRename" style="margin:0;width:100%">Renombrar tipo</button></div></div>';
  $('#cardDetTitle').textContent=k.kind+(vLabel?' › '+vLabel:'');$('#cardDetBody').innerHTML=h;$('#cardDetScrim').classList.add('on');
  $('#cardDetBody').querySelectorAll('.debtrow[data-id]').forEach(el=>el.onclick=()=>openProductDetail(el.dataset.id));
  $('#cardDetBody').querySelectorAll('.catrow[data-var]').forEach(el=>el.onclick=()=>openKindDetail(key,el.dataset.var));
  $('#kdRename').onclick=()=>{const kind=prompt('Nuevo nombre del tipo (se aplica a sus '+k.products.length+' productos)',k.kind);if(kind===null||!kind.trim())return;renameKind(key,{kind});$('#cardDetScrim').classList.remove('on');renderProductsList();};
}

// ---- formulario de edición de un producto (nombre, tipo, variedad, marca, tamaño, unidad) ----
let _pe=null;
function openProductEdit(pid){const p=productById(pid);return new Promise(res=>{if(!p){res(false);return;}_pe={pid,res};
  $('#pe-name').value=p.name;$('#pe-size').value=p.size||'';$('#pe-unit').value=p.unit||'u';comboFillAll('pe',p);
  $('#prodEditScrim').classList.add('on');});}
function peDone(ok){const d=_pe;_pe=null;$('#prodEditScrim').classList.remove('on');if(d)d.res(ok);}
$('#peOk').onclick=()=>{if(!_pe)return;const name=$('#pe-name').value.trim();if(!name){toast('Poné un nombre');return;}
  updateProduct(_pe.pid,{name,kind:comboVal('pe','kind'),variety:comboVal('pe','variety'),brand:comboVal('pe','brand'),size:$('#pe-size').value,unit:$('#pe-unit').value});toast('Producto actualizado');peDone(true);};
$('#closePE').onclick=()=>peDone(false);$('#prodEditScrim').onclick=e=>{if(e.target===$('#prodEditScrim'))peDone(false);};

// ---- combos (select con valores existentes + "Nuevo…") para tipo / variedad / marca ----
const COMBO_NEW='__new__';
function comboSet(pre,field,values,current){const sel=$('#'+pre+'-'+field+'-sel'),inp=$('#'+pre+'-'+field);const cur=(current||'').trim();
  const vals=[...new Set(values.filter(Boolean))];if(cur&&!vals.some(v=>v.toLowerCase()===cur.toLowerCase()))vals.push(cur);vals.sort((a,b)=>a.localeCompare(b,'es'));
  sel.innerHTML='<option value="">— sin '+(field==='kind'?'tipo':field==='variety'?'variedad':'marca')+' —</option>'+vals.map(v=>'<option value="'+esc(v)+'"'+(v.toLowerCase()===cur.toLowerCase()?' selected':'')+'>'+esc(v)+'</option>').join('')+'<option value="'+COMBO_NEW+'">＋ Nuevo…</option>';
  inp.value='';inp.classList.add('hidden');
  sel.onchange=()=>{const isNew=sel.value===COMBO_NEW;inp.classList.toggle('hidden',!isNew);if(isNew){inp.value='';setTimeout(()=>inp.focus(),30);}if(field==='kind')comboVarietyFor(pre);};}
function comboVal(pre,field){const sel=$('#'+pre+'-'+field+'-sel');return sel.value===COMBO_NEW?$('#'+pre+'-'+field).value.trim():sel.value;}
function varietiesOf(kind){const k=normKey(kind);return [...new Set(activeProducts().filter(p=>!k||kindKey(p)===k).map(p=>p.variety).filter(Boolean))];}
function brandsAll(){return [...new Set(activeProducts().map(p=>p.brand).filter(Boolean))];}
// Al cambiar el tipo, la variedad muestra solo las de ese tipo (todas si el tipo es nuevo o vacío)
function comboVarietyFor(pre){const kind=comboVal(pre,'kind');const cur=comboVal(pre,'variety');const vals=varietiesOf(kind);const keep=vals.length?(vals.some(v=>v.toLowerCase()===cur.toLowerCase())?cur:''):cur;comboSet(pre,'variety',vals.length?vals:varietiesOf(''),keep);}
function comboFillAll(pre,p){comboSet(pre,'kind',kindNames(),p.kind);const vals=varietiesOf(p.kind);comboSet(pre,'variety',vals.length?vals:varietiesOf(''),p.variety);comboSet(pre,'brand',brandsAll(),p.brand);}

// ---- picker: elegir o crear producto para una descripción ----
let _pp=null;
function openProductPicker(opts){opts=opts||{};return new Promise(res=>{_pp={opts,res};
  $('#ppTitle').textContent=opts.title||'Producto para "'+(opts.desc||'')+'"';
  const q=$('#ppSearch');q.value=opts.query!=null?opts.query:(opts.desc||'');
  $('#ppCreate').classList.add('hidden');$('#ppCreateBtn').classList.toggle('hidden',!!opts.noCreate);$('#ppUnlink').classList.toggle('hidden',!opts.currentId);
  ppRender();$('#prodPickScrim').classList.add('on');setTimeout(()=>q.focus(),50);});}
function ppDone(r){const d=_pp;_pp=null;$('#prodPickScrim').classList.remove('on');if(d)d.res(r);}
function ppRender(){if(!_pp)return;const o=_pp.opts;const q=$('#ppSearch').value;const seen=new Set();let h='';
  const row=(p,tag)=>{if(seen.has(p.id)||p.id===o.excludeId)return'';seen.add(p.id);const li=prodLastInfo(p);return '<div class="prow" data-id="'+esc(p.id)+'"><div class="pri"><div class="prn">'+esc(p.name)+(p.id===o.currentId?' <small style="color:var(--accent)">(actual)</small>':'')+'</div><div class="prs">'+esc([kindLabel(p),p.brand,p.size].filter(Boolean).join(' · '))+'</div></div><div class="prp">'+(tag?'<small class="pptag">'+tag+'</small>':'')+(li?'<b>'+fmtP(li.last.price||0)+'</b>':'')+'</div></div>';};
  (o.suggestions||[]).forEach(c=>{const p=productById(c.id);if(p)h+=row(p,'≈ '+Math.round(c.score*100)+'%');});
  rankProducts(q,25).forEach(x=>{h+=row(x.p);});
  if(!h)h='<div class="empty" style="padding:16px 18px">No hay productos parecidos.'+(o.noCreate?'':' Creá uno con el botón de abajo.')+'</div>';
  $('#ppList').innerHTML=h;$('#ppList').querySelectorAll('.prow').forEach(r=>r.onclick=()=>ppPick(r.dataset.id));}
function ppPick(pid){const o=_pp.opts;const also=[];if(o.alsoCandidates){o.alsoCandidates.forEach(c=>{const p=productById(pid);if(p&&scoreDesc(c.desc,p)>=0.75)also.push(c.key);});}ppDone({productId:pid,alsoKeys:also});}
$('#ppSearch').oninput=ppRender;
$('#ppCreateBtn').onclick=()=>{const o=_pp.opts;const f=$('#ppCreate');f.classList.remove('hidden');const d=o.desc||$('#ppSearch').value;const mk=suggestTaxonomy(d);const T=pTokens(d);
  $('#pp-name').value=o.newDefaults&&o.newDefaults.name||ppTitleCase(d);comboFillAll('pp',{kind:o.newDefaults&&o.newDefaults.kind||mk.kind,variety:o.newDefaults&&o.newDefaults.variety||mk.variety,brand:o.newDefaults&&o.newDefaults.brand||''});
  $('#pp-size').value=o.newDefaults&&o.newDefaults.size||(T.size?(T.size.u==='g'?(T.size.n>=1000?(T.size.n/1000)+' kg':T.size.n+' g'):(T.size.n>=1000?(T.size.n/1000)+' l':T.size.n+' ml'))+(T.pack?' x'+T.pack:''):(T.pack?'x'+T.pack:''));
  $('#pp-unit').value=o.newDefaults&&o.newDefaults.unit||o.unit||'u';
  $('#pp-name').focus();};
function ppTitleCase(s){const t=normKey(s).split(' ').map(w=>P_ABBR[w]||w).join(' ');return t.replace(/(^|\s)\S/g,c=>c.toUpperCase());}
$('#ppCreateOk').onclick=()=>{const name=$('#pp-name').value.trim();if(!name){toast('Poné un nombre');return;}const o=_pp.opts;
  const p=createProduct({name,kind:comboVal('pp','kind'),variety:comboVal('pp','variety'),brand:comboVal('pp','brand'),size:$('#pp-size').value,unit:$('#pp-unit').value,source:'manual'});
  ppPick(p.id);};
$('#ppUnlink').onclick=()=>ppDone({productId:null,unlink:true});
$('#closePP').onclick=()=>ppDone(null);$('#prodPickScrim').onclick=e=>{if(e.target===$('#prodPickScrim'))ppDone(null);};

// ---- vinculación masiva de ítems sin producto ----
let PL={rows:[]};
function openProductLink(){$('#menu').classList.remove('on');const un=unresolvedItemKeys();const m=matchDescs(un.map(u=>({desc:u.desc,unit:u.unit})));
  PL.rows=un.map((u,i)=>({...u,m:m[i],sel:m[i].status==='auto'||m[i].status==='exact',pid:m[i].productId,nw:null}));
  plRender();$('#prodLinkScrim').classList.add('on');aiInfo().then(inf=>$('#plAi').classList.toggle('hidden',!inf.ai));}
function plRender(){const box=$('#plList');if(!PL.rows.length){box.innerHTML='<div class="empty" style="padding:20px 18px">Todos los ítems tienen producto 🎉</div>';$('#plApply').disabled=true;return;}
  box.innerHTML=PL.rows.map((r,i)=>{const p=r.pid?productById(r.pid):null;let st;
    if(r.nw)st='<span class="pltag new">nuevo</span> '+esc(r.nw.name)+' <small>'+esc([r.nw.kind,r.nw.brand].filter(Boolean).join(' · '))+'</small>';
    else if(p)st=(r.m.status==='auto'||r.m.status==='exact'?'<span class="pltag ok">auto</span> ':'')+esc(p.name);
    else if(r.m.candidates.length)st='<select class="pl-sel" data-i="'+i+'"><option value="">— elegir —</option>'+r.m.candidates.map(c=>{const cp=productById(c.id);return cp?'<option value="'+esc(c.id)+'">≈ '+esc(cp.name)+' ('+Math.round(c.score*100)+'%)</option>':'';}).join('')+'</select>';
    else st='<span class="hint">sin parecidos</span>';
    return '<div class="plrow'+(r.sel?' on':'')+'" data-i="'+i+'"><input type="checkbox" class="pl-cb"'+(r.sel?' checked':'')+'><div class="pli"><div class="pln">'+esc(r.desc)+' <small style="color:var(--muted2)">×'+r.n+(r.merchants.length?' · '+esc(r.merchants.slice(0,2).join(', ')):'')+'</small></div><div class="pls">'+st+'</div></div><button class="pl-pick" title="Elegir o crear">…</button></div>';}).join('');
  box.querySelectorAll('.plrow').forEach(row=>{const i=+row.dataset.i;const r=PL.rows[i];
    row.querySelector('.pl-cb').onchange=e=>{r.sel=e.target.checked;row.classList.toggle('on',r.sel);plCount();};
    const sel=row.querySelector('.pl-sel');if(sel)sel.onchange=()=>{r.pid=sel.value||null;r.nw=null;r.sel=!!r.pid;plRender();};
    row.querySelector('.pl-pick').onclick=()=>{$('#prodLinkScrim').classList.remove('on');openProductPicker({desc:r.desc,unit:r.unit,suggestions:r.m.candidates,currentId:r.pid}).then(res=>{$('#prodLinkScrim').classList.add('on');if(res&&res.productId){r.pid=res.productId;r.nw=null;r.sel=true;}plRender();});};});
  plCount();}
function plCount(){const n=PL.rows.filter(r=>r.sel&&(r.pid||r.nw)).length;$('#plApply').textContent='Aplicar ('+n+')';$('#plApply').disabled=!n;}
$('#plAi').onclick=async()=>{const todo=PL.rows.filter(r=>!r.pid&&!r.nw);if(!todo.length){toast('Nada para completar');return;}
  $('#plAi').disabled=true;const B=60;let done=0;
  try{for(let s=0;s<todo.length;s+=B){const batch=todo.slice(s,s+B);$('#plAi').textContent='✨ IA · lote '+(Math.floor(s/B)+1)+'/'+Math.ceil(todo.length/B);
      const descs=batch.map((r,i)=>({i,desc:r.desc,unit:r.unit,merchant:r.merchants[0]||''}));const res=await aiProducts(descs,buildAiCatalog(descs));
      (res.results||[]).forEach(x=>{const r=batch[x.i];if(!r)return;const conf=x.confidence||0;
        if(x.productId&&productById(x.productId)){r.pid=x.productId;r.nw=null;r.sel=conf>=0.5;}
        else if(x.new&&x.new.name){r.nw=x.new;r.pid=null;r.sel=conf>=0.5;}
        done++;});
      plRender();}
    toast('IA: '+done+' ítems completados');}
  catch(e){toast('IA: '+(e.message||'error'));}
  $('#plAi').disabled=false;$('#plAi').textContent='✨ Completar con IA';};
$('#plApply').onclick=()=>{const rows=PL.rows.filter(r=>r.sel&&(r.pid||r.nw));if(!rows.length)return;
  const created=new Map();let linked=0;
  rows.forEach(r=>{let pid=r.pid;
    if(!pid&&r.nw){const nk=normKey(r.nw.name);const ex=aliasIndex().get(nk)||[...created.entries()].find(([k])=>k===nk)?.[1]||activeProducts().find(p=>normKey(p.name)===nk)?.id;
      if(ex)pid=ex;else{const p=createProduct({name:r.nw.name,kind:r.nw.kind,variety:r.nw.variety,brand:r.nw.brand,size:r.nw.size,unit:r.nw.unit||r.unit,source:'ai'});created.set(nk,p.id);pid=p.id;}}
    if(pid){linked+=linkKeysToProduct(pid,[r.key],{silent:true});}});
  persist();toast(linked+' compras vinculadas'+(created.size?' · '+created.size+' productos nuevos':''));
  openProductLink();if(detail)renderProductsList();};
$('#closePL').onclick=()=>$('#prodLinkScrim').classList.remove('on');$('#prodLinkScrim').onclick=e=>{if(e.target===$('#prodLinkScrim'))$('#prodLinkScrim').classList.remove('on');};
$('#productsBtn').onclick=openProductsView;
