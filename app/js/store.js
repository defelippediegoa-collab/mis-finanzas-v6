/* ---------- storage ---------- */
// v6: los datos viven en fin_db_v5 (se sincronizan); la configuración del dispositivo en fin_cfg_v5 (nunca viaja).
const APP_VERSION='6.0.0';
const KEY='fin_db_v5',KEY_V4='fin_db_v4',CFG_KEY='fin_cfg_v5';
const DEF_CFG={syncUrl:'',syncToken:'',syncAuto:false,aiModel:'',aiEffort:'low',inboxDoneQueue:[],lastInboxPoll:0};
const CFG=(()=>{try{return Object.assign({},DEF_CFG,JSON.parse(localStorage.getItem(CFG_KEY)||'{}'));}catch(e){return Object.assign({},DEF_CFG);}})();
function saveCfg(){try{localStorage.setItem(CFG_KEY,JSON.stringify(CFG));}catch(e){}}
const Store={_m:null,
  load(){try{const v=localStorage.getItem(KEY);if(v)return JSON.parse(v);
      const v4=localStorage.getItem(KEY_V4);if(v4){const d=JSON.parse(v4);d._migratedFromV4=true;return d;}return null;}catch(e){return this._m;}},
  save(d){try{localStorage.setItem(KEY,JSON.stringify(d));}catch(e){this._m=d;}}};
// Clave normalizada para agrupar ítems/comercios/reglas: minúsculas, sin acentos ni símbolos.
function normKey(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();}
const DEF_CATS={expense:['Gastos Fijos','Gastos Variables','Gastos Discresionales','🎁 Regalos','otros'],income:['Salario','💵 Dinero extra','Por Devoluciones','Otro']};
const DEF_SUBS={'Gastos Fijos':['Alquiler','Seguros','Servicios','Colegio','Suscripciones','Telecentro','Telefonia'],'Gastos Variables':['Supermercado','Nafta','Gimnasio','Gastos Meli','Comida trabajo','Salud','Ropa','Peaje'],'Gastos Discresionales':['Arreglos Casa','Delivery','Cerveza','Tecnologia','Juntada','varios'],'🎁 Regalos':['Cumples jardin','Papa','Dani'],'otros':[],'Salario':[],'💵 Dinero extra':['Modo CashBack'],'Por Devoluciones':[],'Otro':[]};
const DEF_ACCOUNTS=[
  {name:'Efectivo Casa',type:'Efectivo',currency:'ARS',initial:0,desc:''},
  {name:'Bco Credicoop',type:'Cuentas',currency:'ARS',initial:0,desc:''},
  {name:'MercadoPago',type:'Cuentas',currency:'ARS',initial:0,desc:''},
  {name:'Santander',type:'Cuentas',currency:'ARS',initial:0,desc:''},
  {name:'Santander visa',type:'Tarjetas de crédito',currency:'ARS',initial:0,desc:'',cierre:25,venc:10},
  {name:'Nacion MasterCard',type:'Tarjetas de crédito',currency:'ARS',initial:0,desc:'',cierre:20,venc:5},
  {name:'Credicoop cabal',type:'Tarjetas de crédito',currency:'ARS',initial:0,desc:'',cierre:28,venc:13},
  {name:'Casa USD',type:'Ahorros',currency:'USD',initial:650,desc:'',includeInTotal:false}
];
const DEMO_TX=[
  {id:'d1',date:'2026-06-27',type:'income',account:'Bco Credicoop',category:'Salario',sub:'',amount:3498737,currency:'ARS',note:''},
  {id:'d2',date:'2026-06-27',type:'expense',account:'MercadoPago',category:'Gastos Variables',sub:'Supermercado',amount:12362.5,currency:'ARS',note:''},
  {id:'d3',date:'2026-06-26',type:'expense',account:'Credicoop cabal',category:'Gastos Variables',sub:'Nafta',amount:53804,currency:'ARS',note:''},
  {id:'d4',date:'2026-06-26',type:'transfer',from:'Bco Credicoop',to:'MercadoPago',amount:5000,currency:'ARS',note:''},
  {id:'d5a',date:'2026-06-15',type:'expense',account:'Nacion MasterCard',category:'Gastos Discresionales',sub:'Ropa',amount:11000,currency:'ARS',note:'Prenda',purchaseDate:'2026-06-15',dueMonth:'2026-07',inst:[1,3]},
  {id:'d5b',date:'2026-07-15',type:'expense',account:'Nacion MasterCard',category:'Gastos Discresionales',sub:'Ropa',amount:11000,currency:'ARS',note:'Prenda',purchaseDate:'2026-06-15',dueMonth:'2026-08',inst:[2,3]},
  {id:'d5c',date:'2026-08-15',type:'expense',account:'Nacion MasterCard',category:'Gastos Discresionales',sub:'Ropa',amount:11000,currency:'ARS',note:'Prenda',purchaseDate:'2026-06-15',dueMonth:'2026-09',inst:[3,3]},
  {id:'d9',date:'2026-06-23',type:'expense',account:'Santander visa',category:'Gastos Variables',sub:'Ropa',amount:32000,currency:'ARS',note:'Campera',purchaseDate:'2026-06-23',dueMonth:'2026-07'}
];
const DEMO_REM=[
  {id:'r1',type:'expense',name:'Gas',amount:59000,freq:'monthly',from:'2026-07',until:'',account:'',category:'Gastos Fijos'},
  {id:'r2',type:'income',name:'Sueldo',amount:3100000,freq:'monthly',from:'2026-07',until:'',account:'Bco Credicoop',category:'Salario'},
  {id:'r3',type:'expense',name:'Netflix',amount:14559,freq:'monthly',from:'2026-06',until:'',account:'Santander visa',category:'Gastos Fijos'}
];
function defaultDB(){return{tx:DEMO_TX.slice(),reminders:DEMO_REM.slice(),accounts:JSON.parse(JSON.stringify(DEF_ACCOUNTS)),currencies:['ARS','USD'],usdRate:1000,rateInfo:'',cats:JSON.parse(JSON.stringify(DEF_CATS)),subs:JSON.parse(JSON.stringify(DEF_SUBS))};}
function typeForName(n){const l=n.toLowerCase();if(/usd|dólar|dolar/.test(l))return'Ahorros';if(/visa|master|cabal|tarjeta|credito|crédito/.test(l)&&!/débito|debito/.test(l))return'Tarjetas de crédito';if(/efectivo|billetera/.test(l))return'Efectivo';return'Cuentas';}
// normalize(d, opts): acepta un blob v4 (v55), un export v55, un blob v5 o un array de movimientos.
// opts.takeSync: si el blob trae syncUrl/syncAuto (v4) y el dispositivo no tiene config, la adopta.
function normalize(d,opts){opts=opts||{};
  if(Array.isArray(d))d={tx:d};
  const fresh=!d.accounts; // solo una base nueva recibe las cuentas de ejemplo (antes reaparecían al borrarlas)
  d.tx=d.tx||[];d.reminders=d.reminders||[];d.currencies=d.currencies||['ARS','USD'];
  if(typeof d.usdRate!=='number')d.usdRate=1000;d.rateInfo=d.rateInfo||'';
  if(d.syncUrl!==undefined||d.syncAuto!==undefined){
    if(opts.takeSync&&d.syncUrl&&!CFG.syncUrl){CFG.syncUrl=d.syncUrl;CFG.syncAuto=!!d.syncAuto;saveCfg();}
    delete d.syncUrl;delete d.syncAuto;}
  d.updatedAt=d.updatedAt||0;d.paid=d.paid||{};d.schema=5;d.rules=Array.isArray(d.rules)?d.rules:[];
  d.cats=d.cats||JSON.parse(JSON.stringify(DEF_CATS));d.subs=d.subs||JSON.parse(JSON.stringify(DEF_SUBS));
  d.accounts=d.accounts||[];
  const known=new Set(d.accounts.map(a=>a.name));
  const seen=new Set();
  d.tx.forEach(t=>[t.account,t.from,t.to].forEach(a=>{if(a)seen.add(a);}));
  if(fresh)DEF_ACCOUNTS.forEach(a=>{if(!known.has(a.name)){d.accounts.push(JSON.parse(JSON.stringify(a)));known.add(a.name);}});
  seen.forEach(a=>{if(!known.has(a)){const ty=typeForName(a);d.accounts.push({name:a,type:ty,currency:/usd/i.test(a)?'USD':'ARS',initial:0,desc:'',includeInTotal:true});known.add(a);}});
  d.accounts.forEach(a=>{if(a.includeInTotal===undefined)a.includeInTotal=true;});
  d.tx.forEach(t=>{if(t.type==='transfer')return;const b=t.type==='income'?'income':'expense';
    if(t.category&&!d.cats[b].includes(t.category))d.cats[b].push(t.category);
    if(t.category){d.subs[t.category]=d.subs[t.category]||[];if(t.sub&&!d.subs[t.category].includes(t.sub))d.subs[t.category].push(t.sub);}});
  d.tx.forEach(t=>{if(Array.isArray(t.items))t.items.forEach(i=>{if(!i.key)i.key=normKey(i.desc);if(typeof i.qty!=='number')i.qty=1;});});
  return d;
}
// Fusión por id cuando la nube tiene datos más nuevos que los nuestros (STALE): no se pierde nada de ningún lado.
// Mismo id en ambos → gana el que tenga updatedAt mayor (si no hay, el local). Lo borrado en un lado puede volver; es el precio de no perder datos.
function mergeDB(local,cloud){
  const out=normalize(JSON.parse(JSON.stringify(cloud)));
  const byId=new Map(out.tx.map(t=>[t.id,t]));
  local.tx.forEach(t=>{const c=byId.get(t.id);if(!c)out.tx.push(t);else if((t.updatedAt||0)>=(c.updatedAt||0))Object.assign(c,t);});
  const rById=new Map(out.reminders.map(r=>[r.id,r]));local.reminders.forEach(r=>{if(!rById.has(r.id))out.reminders.push(r);});
  const aByN=new Map(out.accounts.map(a=>[a.name,a]));local.accounts.forEach(a=>{if(!aByN.has(a.name))out.accounts.push(a);});
  ['expense','income'].forEach(k=>local.cats[k].forEach(c=>{if(!out.cats[k].includes(c))out.cats[k].push(c);}));
  Object.keys(local.subs).forEach(c=>{out.subs[c]=out.subs[c]||[];local.subs[c].forEach(s=>{if(!out.subs[c].includes(s))out.subs[c].push(s);});});
  Object.assign(out.paid,local.paid);
  const ruleIds=new Set(out.rules.map(r=>r.id));local.rules.forEach(r=>{if(!ruleIds.has(r.id))out.rules.push(r);});
  return normalize(out);
}
/* group/type */
const TYPE_GROUP={'Efectivo':'Efectivo','Cuentas':'Cuentas','Tarjetas de débito':'Cuentas','Tarjeta prepago':'Cuentas','Tarjetas de crédito':'Tarjetas de crédito','Ahorros':'Ahorros','Inversiones':'Inversiones','Préstamo':'Préstamos','Otros':'Otras'};
const GROUP_ORDER=['Efectivo','Cuentas','Tarjetas de crédito','Ahorros','Inversiones','Préstamos','Otras'];
const CAT_COLOR={'Salario':'--c1','💵 Dinero extra':'--c2','Por Devoluciones':'--c3','Otro':'--c4','Gastos Fijos':'--c1','Gastos Variables':'--c2','Gastos Discresionales':'--c3','🎁 Regalos':'--c4','otros':'--c5'};
const PALETTE=['--c1','--c2','--c3','--c4','--c5','--c6','--c7'];

