/* ---------- state ---------- */
let DB=normalize(Store.load()||defaultDB(),{takeSync:true});
// Fecha local 'YYYY-MM-DD' (toISOString usaba UTC y después de las 21 h daba el día siguiente).
function localDate(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
const BOOT_DATE=localDate();
let view='trans',cur=(()=>{const d=new Date();d.setDate(1);d.setHours(12,0,0,0);return d;})(),statKind='income',editId=null,remEditId=null,accEditName=null,mgrKind='expense',mgrSubCat=null,detail=null,acCur='ARS',txQuery='',homeMode=localStorage.getItem('fin_home_mode')||'mes',txFilter='all';
const TODAY=(()=>{const d=new Date();d.setHours(23,59,59,999);return d;})();
let detailRefresh=null;

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
function curPrefix(c){return c==='ARS'?'$ ':(c==='USD'?'US$ ':c+' ');}
function money(n,c){c=c||'ARS';return(n<0?'-':'')+curPrefix(c)+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function sgn(n){return Math.abs(n)<0.005?'zero':(n>0?'pos':'neg');}
function dz(n){return Math.abs(n)<0.005?'zero':'neg';}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function refreshNoteSuggestions(){const seen=new Set();DB.tx.forEach(t=>{const n=(t.note||'').trim();if(n)seen.add(n);});const list=[...seen].sort((a,b)=>a.localeCompare(b,'es'));const dl=$('#note-suggestions');if(dl)dl.innerHTML=list.map(n=>'<option value="'+esc(n)+'"></option>').join('');}
function ym(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function ymOf(s){return s.slice(0,7);}
function monthName(d){return d.toLocaleDateString('es-AR',{month:'short',year:'numeric'}).replace('.','');}
function cssv(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function colorFor(c,i){return cssv(CAT_COLOR[c]||PALETTE[i%PALETTE.length]);}
let _pushT=null;
function persist(){DB.updatedAt=Date.now();Store.save(DB);if(CFG.syncUrl&&CFG.syncAuto){clearTimeout(_pushT);_pushT=setTimeout(()=>cloudPush(true),2500);}}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),1800);}
function acct(n){return DB.accounts.find(a=>a.name===n);}
function curOf(n){const a=acct(n);return a?a.currency:'ARS';}
function accountNames(){return DB.accounts.map(a=>a.name);}
function fill(sel,opts,sel0){sel.innerHTML=opts.map(o=>'<option'+(o===sel0?' selected':'')+'>'+o+'</option>').join('');}
// Cuentas agrupadas por origen en los desplegables
function fillAccounts(sel,sel0,extraFirst){
  const order=['Efectivo','Cuentas','Tarjetas de débito','Tarjetas de crédito','Ahorros','Inversiones','Otros'];
  const lab={'Efectivo':'💵 Efectivo','Cuentas':'🏦 Bancos / Cuentas','Tarjetas de débito':'💳 Tarjetas de débito','Tarjetas de crédito':'💳 Tarjetas de crédito','Ahorros':'🐷 Ahorros','Inversiones':'📈 Inversiones','Otros':'📦 Otros'};
  sel.innerHTML='';
  if(extraFirst){const o=document.createElement('option');o.value=extraFirst;o.textContent=extraFirst;if(sel0===extraFirst||!sel0)o.selected=true;sel.appendChild(o);}
  const types=[...order.filter(t=>DB.accounts.some(a=>a.type===t)),...[...new Set(DB.accounts.map(a=>a.type))].filter(t=>!order.includes(t))];
  types.forEach(ty=>{const accs=DB.accounts.filter(a=>a.type===ty);if(!accs.length)return;
    const og=document.createElement('optgroup');og.label=lab[ty]||ty;
    accs.forEach(a=>{const o=document.createElement('option');o.value=a.name;o.textContent=a.name;if(a.name===sel0)o.selected=true;og.appendChild(o);});
    sel.appendChild(og);});
}
function isARS(t){return (t.currency||'ARS')==='ARS';}

