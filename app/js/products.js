/* ---------- PRODUCTOS: catálogo de dos niveles (genérico+variedad → producto con marca → alias de tickets) ---------- */
// DB.products[] = {id, name, kind, variety, brand, unit, size, aliases[], mergedInto, source, createdAt, updatedAt}
// El alias (normKey de la descripción del ticket) es la fuente de verdad; item.productId es una caché que normalize() re-deriva.

let _pIdx=null;
function productsChanged(p){_pIdx=null;if(p)p.updatedAt=Date.now();}
function activeProducts(){return (DB.products||[]).filter(p=>!p.mergedInto);}
function productById(id){return (DB.products||[]).find(p=>p.id===id)||null;}
function resolveProduct(id){let p=productById(id),n=0;while(p&&p.mergedInto&&n++<10)p=productById(p.mergedInto);return p&&!p.mergedInto?p:null;}
function aliasIndex(){if(_pIdx)return _pIdx;_pIdx=new Map();activeProducts().forEach(p=>(p.aliases||[]).forEach(a=>{if(!_pIdx.has(a))_pIdx.set(a,p.id);}));return _pIdx;}
function kindKey(p){return normKey((p.kind||'')+' '+(p.variety||''));}
function kindLabel(p){return (p.kind||'')+(p.variety?' '+p.variety:'');}
function kindsIndex(){const m=new Map();activeProducts().forEach(p=>{const k=kindKey(p);if(!k)return;let o=m.get(k);if(!o){o={key:k,kind:p.kind,variety:p.variety||'',products:[]};m.set(k,o);}o.products.push(p);});return m;}
function productLabel(p){return p?p.name:'';}

// ---- operaciones (todas persisten) ----
function createProduct(f){const p={id:'p'+Date.now()+Math.floor(Math.random()*900+100),name:(f.name||'').trim()||'Producto',kind:(f.kind||'').trim().toLowerCase(),variety:(f.variety||'').trim().toLowerCase(),brand:(f.brand||'').trim(),unit:f.unit||'u',size:(f.size||'').trim(),aliases:[],mergedInto:null,source:f.source||'manual',createdAt:Date.now(),updatedAt:Date.now()};
  const a0=normKey(p.name);if(a0&&!aliasIndex().has(a0))p.aliases.push(a0);
  (f.aliases||[]).forEach(a=>{a=normKey(a);if(a&&!p.aliases.includes(a)&&!aliasIndex().has(a))p.aliases.push(a);});
  DB.products=DB.products||[];DB.products.push(p);productsChanged(p);return p;}
function updateProduct(id,patch){const p=productById(id);if(!p)return null;['name','brand','size'].forEach(k=>{if(patch[k]!==undefined)p[k]=String(patch[k]).trim();});['kind','variety'].forEach(k=>{if(patch[k]!==undefined)p[k]=String(patch[k]).trim().toLowerCase();});if(patch.unit)p.unit=patch.unit;productsChanged(p);persist();return p;}
function txTouch(t){t.updatedAt=Date.now();}
function forEachItem(fn){DB.tx.forEach(t=>{if(Array.isArray(t.items))t.items.forEach(i=>fn(i,t));});}
// Vincula claves (normKey) a un producto: agrega alias y setea productId en los ítems que tengan esa clave
function linkKeysToProduct(pid,keys,opts){const p=resolveProduct(pid);if(!p)return 0;opts=opts||{};const ks=new Set((keys||[]).map(normKey).filter(Boolean));if(!ks.size)return 0;
  const idx=aliasIndex();ks.forEach(k=>{const other=idx.get(k);if(other&&other!==p.id){const o=productById(other);if(o)o.aliases=o.aliases.filter(a=>a!==k);}if(!p.aliases.includes(k))p.aliases.push(k);});
  let n=0;forEachItem((i,t)=>{if(i.discount)return;const k=i.key||normKey(i.desc);if(ks.has(k)&&i.productId!==p.id){i.productId=p.id;txTouch(t);n++;}});
  productsChanged(p);if(!opts.silent)persist();return n;}
function removeAlias(pid,alias){const p=productById(pid);if(!p)return 0;alias=normKey(alias);p.aliases=(p.aliases||[]).filter(a=>a!==alias);let n=0;forEachItem((i,t)=>{if(i.productId===pid&&(i.key||normKey(i.desc))===alias){delete i.productId;txTouch(t);n++;}});productsChanged(p);persist();return n;}
function unlinkItem(i,t){if(!i.productId)return;const p=productById(i.productId);const k=i.key||normKey(i.desc);if(p)p.aliases=(p.aliases||[]).filter(a=>a!==k);delete i.productId;if(t)txTouch(t);productsChanged(p);}
function mergeProducts(fromId,intoId){const a=productById(fromId),b=resolveProduct(intoId);if(!a||!b||a.id===b.id)return false;
  (a.aliases||[]).forEach(al=>{if(!b.aliases.includes(al))b.aliases.push(al);});a.aliases=[];a.mergedInto=b.id;
  forEachItem((i,t)=>{if(i.productId===a.id){i.productId=b.id;txTouch(t);}});
  if(!b.brand&&a.brand)b.brand=a.brand;if(!b.size&&a.size)b.size=a.size;
  productsChanged(a);productsChanged(b);persist();return true;}
function deleteProduct(pid){const p=productById(pid);if(!p)return;forEachItem((i,t)=>{if(i.productId===pid){delete i.productId;txTouch(t);}});DB.products=DB.products.filter(x=>x.id!==pid&&x.mergedInto!==pid);DB.products.forEach(x=>{if(x.mergedInto===pid)x.mergedInto=null;});productsChanged();persist();}
function renameKind(key,f){activeProducts().forEach(p=>{if(kindKey(p)===key){p.kind=(f.kind||'').trim().toLowerCase();p.variety=(f.variety||'').trim().toLowerCase();productsChanged(p);}});persist();}
// Al guardar un ticket: los ítems vinculados agregan su clave como alias (sin persist: lo hace el ticket)
function commitItemLinks(items){(items||[]).forEach(i=>{if(i.productId&&!i.discount)linkKeysToProduct(i.productId,[i.key||normKey(i.desc)],{silent:true});});}

// ---- tokenización y similitud para descripciones abreviadas de tickets argentinos ----
const P_STOP=new Set(['de','del','la','el','los','las','con','sin','y','en','para','por','c','s','al','un','una','x','kg','oferta','promo','dto','desc','ahorro','bonif','cod','art']);
const P_ABBR={qso:'queso',ques:'queso',qsos:'queso',crem:'cremoso',cremos:'cremoso',lech:'leche',lche:'leche',mant:'manteca',mantec:'manteca',yog:'yogur',yogh:'yogur',yogur:'yogur',gall:'galletitas',gallet:'galletitas',galle:'galletitas',fdeo:'fideos',fid:'fideos',fdos:'fideos',acte:'aceite',aceit:'aceite',azuc:'azucar',az:'azucar',harin:'harina',hna:'harina',jab:'jabon',det:'detergente',deterg:'detergente',desod:'desodorante',pap:'papel',hig:'higienico',serv:'servilletas',gas:'gaseosa',gaseo:'gaseosa',cerv:'cerveza',cvza:'cerveza',vno:'vino',inst:'instantaneo',instant:'instantaneo',sol:'soluble',descr:'descremada',ent:'entera',entr:'entera',choc:'chocolate',chocol:'chocolate',caf:'cafe',tom:'tomate',tomat:'tomate',ceb:'cebolla',pap:'papel',papa:'papa',arr:'arroz',arrz:'arroz',pollo:'pollo',pechu:'pechuga',carn:'carne',jam:'jamon',jamon:'jamon',sals:'salsa',mayo:'mayonesa',mayon:'mayonesa',ketch:'ketchup',mermel:'mermelada',merm:'mermelada',dulce:'dulce',dul:'dulce',sham:'shampoo',shamp:'shampoo',acond:'acondicionador',past:'pasta',dent:'dental',cep:'cepillo',lav:'lavandina',susp:'suavizante',suav:'suavizante',esp:'esponja',bols:'bolsa',pda:'punta del agua',ls:'la serenisima',sancor:'sancor',ilol:'ilolay',ilolay:'ilolay',mlk:'milkaut',milk:'milkaut',hell:'hellmanns',coc:'coca cola',cocacola:'coca cola',pep:'pepsi',quilm:'quilmes',brah:'brahma',stel:'stella artois',andes:'andes',marol:'marolio',arc:'arcor',bagl:'bagley',terrab:'terrabusi',cdl:'ciudad del lago',pani:'panificados',lacteo:'lacteo',lact:'lacteo'};
const P_SIZE_RE=/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|kilos|g|gr|grs|grm|gramos|l|lt|lts|ltr|litro|litros|ml|cc|cm3|cl)\b/g;
const P_PACK_RE=/\bx\s?(\d{1,2})\b|\b(\d{1,2})\s?(u|un|unid|uni|unidades)\b|\bpack\s?(\d{1,2})\b/;
function pTokens(s){
  let t=String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  let size=null;t=t.replace(P_SIZE_RE,(m,n,u)=>{const v=parseFloat(n.replace(',','.'));let base=null;if(/^(kg|kgs|kilo|kilos)$/.test(u))base={n:v*1000,u:'g'};else if(/^(g|gr|grs|grm|gramos)$/.test(u))base={n:v,u:'g'};else if(/^(l|lt|lts|ltr|litro|litros)$/.test(u))base={n:v*1000,u:'ml'};else if(/^(ml|cc|cm3)$/.test(u))base={n:v,u:'ml'};else if(u==='cl')base={n:v*10,u:'ml'};if(base&&!size)size=base;return ' ';});
  let pack=null;t=t.replace(P_PACK_RE,(m,a,b,c,d)=>{pack=parseInt(a||b||d,10)||null;return ' ';});
  const words=[],nums=[];t.replace(/[^a-z0-9ñ ]+/g,' ').split(/\s+/).forEach(w=>{if(!w)return;if(/^\d+$/.test(w)){if(w.length<5)nums.push(w);return;}if(w.length>=5&&/\d/.test(w)&&!/[a-z]{3}/.test(w))return;if(P_STOP.has(w))return;words.push({t:w,w:w.length>=3?1:(w.length===2?0.6:0.3)});});
  return{words,size,pack,nums};
}
function pSkel(s){return s.replace(/[aeiou]/g,'');}
function tokenSim(q,c){if(q===c)return 1;const ex=P_ABBR[q];if(ex){if(ex===c)return 0.95;const et=ex.split(' ');if(et.includes(c))return 0.9;if(c.startsWith(ex))return 0.9;}
  const a=q.length<=c.length?q:c,b=q.length<=c.length?c:q;if(b.startsWith(a)){if(a.length>=3)return 0.9;if(a.length===2)return 0.7;return 0.4;}
  if(q.length>=3&&c.length>=3){const sq=pSkel(q),sc=pSkel(c);if(sq.length>=2&&sc.startsWith(sq))return 0.6;}
  return 0;}
function coverage(A,B){if(!A.words.length)return 0;let s=0,w=0;A.words.forEach(a=>{let best=0;B.words.forEach(b=>{const v=tokenSim(a.t,b.t);if(v>best)best=v;});s+=a.w*best;w+=a.w;});return w?s/w:0;}
function productTokenSets(p){if(p._ts&&p._tsAt===p.updatedAt)return p._ts;const sets=[pTokens([p.name,p.brand,p.kind,p.variety,p.size].filter(Boolean).join(' '))];(p.aliases||[]).forEach(a=>sets.push(pTokens(a)));p._ts=sets;p._tsAt=p.updatedAt;return sets;}
// Puntaje 0..1 de una descripción contra un producto
function scoreDesc(desc,p,unit){const Q=typeof desc==='string'?pTokens(desc):desc;let best=0;
  productTokenSets(p).forEach(C=>{let v=0.7*coverage(Q,C)+0.3*coverage(C,Q);
    if(Q.size&&C.size){v*=(Q.size.u===C.size.u&&Math.abs(Q.size.n-C.size.n)<1)?1.05:0.5;}else if(Q.size||C.size)v*=0.9;
    if(Q.pack&&C.pack&&Q.pack!==C.pack)v*=0.6;
    if(Q.nums.length&&C.nums.length&&!Q.nums.some(n=>C.nums.includes(n)))v*=0.8;
    if(v>best)best=v;});
  if(unit&&p.unit&&unit!==p.unit&&(unit==='kg'||p.unit==='kg'))best*=0.7;
  return Math.min(1,best);}
function rankProducts(q,limit){const Q=pTokens(q);if(!Q.words.length)return [];return activeProducts().map(p=>({p,score:scoreDesc(Q,p)})).filter(x=>x.score>0.2).sort((a,b)=>b.score-a.score).slice(0,limit||20);}
function matchKind(desc){const Q=pTokens(desc);let best=null;kindsIndex().forEach(k=>{const s=0.7*coverage(Q,pTokens(k.kind+' '+k.variety))+0.3*coverage(pTokens(k.kind+' '+k.variety),Q);if(!best||s>best.score)best={kind:k.kind,variety:k.variety,score:s};});return best&&best.score>=0.6?best:null;}
// Para una lista de {desc, unit?} → [{key, status:'exact'|'auto'|'suggest'|'none', productId, score, candidates:[{id,score}]}]
function matchDescs(list){const idx=aliasIndex();const prods=activeProducts();
  return (list||[]).map(d=>{const key=normKey(d.desc);const out={key,status:'none',productId:null,score:0,candidates:[]};
    if(!key)return out;const ex=idx.get(key);if(ex){out.status='exact';out.productId=ex;out.score=1;return out;}
    const Q=pTokens(d.desc);if(!Q.words.length)return out;
    const sc=prods.map(p=>({id:p.id,score:scoreDesc(Q,p,d.unit)})).filter(x=>x.score>=0.35).sort((a,b)=>b.score-a.score).slice(0,3);
    out.candidates=sc;if(!sc.length)return out;out.score=sc[0].score;
    if(sc[0].score>=0.85&&(sc.length<2||sc[1].score<=sc[0].score-0.15)){out.status='auto';out.productId=sc[0].id;}
    else if(sc[0].score>=0.55)out.status='suggest';
    return out;});}
// Ítems sin producto en todo el historial: [{key, desc, n, lastDate, merchants[], unit}]
function unresolvedItemKeys(){const m=new Map();forEachItem((i,t)=>{if(i.discount||i.productId||!(i.amount>0))return;const k=i.key||normKey(i.desc);if(!k)return;let o=m.get(k);if(!o){o={key:k,desc:i.desc,n:0,lastDate:'',merchants:new Set(),unit:i.unit||'u',descs:{}};m.set(k,o);}o.n++;if(t.date>o.lastDate)o.lastDate=t.date;if(t.merchant)o.merchants.add(t.merchant);o.descs[i.desc]=(o.descs[i.desc]||0)+1;});
  return [...m.values()].map(o=>{o.desc=Object.entries(o.descs).sort((a,b)=>b[1]-a[1])[0][0];o.merchants=[...o.merchants];delete o.descs;return o;}).sort((a,b)=>b.n-a.n||b.lastDate.localeCompare(a.lastDate));}
// Catálogo compacto para la IA: todos los kinds + productos relacionados con las descripciones
function buildAiCatalog(descs){const kinds=[...kindsIndex().values()].map(k=>k.kind+(k.variety?' '+k.variety:''));const Qs=descs.map(d=>pTokens(d.desc));
  let prods=activeProducts().map(p=>({p,s:Math.max(0,...Qs.map(Q=>scoreDesc(Q,p)))})).filter(x=>x.s>=0.3).sort((a,b)=>b.s-a.s).slice(0,150).map(x=>x.p);
  const toJ=p=>({id:p.id,name:p.name,kind:p.kind,variety:p.variety||'',brand:p.brand||'',size:p.size||'',unit:p.unit||'u',aliases:(p.aliases||[]).slice().sort((a,b)=>a.length-b.length).slice(0,3)});
  let cat={kinds,products:prods.map(toJ)};if(JSON.stringify(cat).length>30000)cat.products=cat.products.slice(0,80);return cat;}

// ---- precios ----
function priceOf(i,basis){return basis==='list'?(i.listPrice!=null?i.listPrice:i.unitPrice):i.unitPrice;}
// Filas de compra de un producto: [{t, i, date, merchant, price (ARS, basis), list, paid, qty, unit, usd}]
function productPriceRows(pid,basis){const rows=[];forEachItem((i,t)=>{if(i.productId!==pid||i.discount||!(i.amount>0))return;const cur=t.currency||'ARS';const usd=cur==='USD';const pr=priceOf(i,basis||CFG.priceBasis||'paid');
    rows.push({t,i,date:t.date,merchant:t.merchant||stripInst(t.note)||t.account||'—',price:usd?null:pr,raw:pr,list:i.listPrice!=null?i.listPrice:i.unitPrice,paid:i.unitPrice,qty:i.qty||1,unit:i.unit||'u',usd,cur});});
  return rows.sort((a,b)=>b.date.localeCompare(a.date));}
function productStoreSummary(pid,basis){const rows=productPriceRows(pid,basis).filter(r=>r.price>0);const by=new Map();
  rows.forEach(r=>{let o=by.get(r.merchant);if(!o){o={merchant:r.merchant,last:r.price,lastDate:r.date,n:0,min:r.price,sum:0};by.set(r.merchant,o);}o.n++;o.sum+=r.price;if(r.price<o.min)o.min=r.price;});
  return [...by.values()].map(o=>Object.assign(o,{avg:o.sum/o.n})).sort((a,b)=>a.last-b.last);}
// Precio normalizado por kg / l / u a partir de size y pack
function normalizedPrice(p,price){if(!(price>0))return null;const T=pTokens((p.size||'')+' '+(p.name||''));const pack=T.pack||1;if(T.size){const per=price/pack;if(T.size.u==='g')return{v:per/T.size.n*1000,u:'kg'};if(T.size.u==='ml')return{v:per/T.size.n*1000,u:'l'};}
  if(p.unit==='kg')return{v:price,u:'kg'};if(p.unit==='l')return{v:price,u:'l'};if(pack>1)return{v:price/pack,u:'u'};return null;}
function kindComparison(key,basis){const k=kindsIndex().get(key);if(!k)return [];return k.products.map(p=>{const st=productStoreSummary(p.id,basis);const best=st[0]||null;const np=best?normalizedPrice(p,best.last):null;return{p,best,norm:np,stores:st};}).sort((a,b)=>{if(a.norm&&b.norm)return a.norm.v-b.norm.v;if(a.norm)return -1;if(b.norm)return 1;return (a.best?a.best.last:1e18)-(b.best?b.best.last:1e18);});}
