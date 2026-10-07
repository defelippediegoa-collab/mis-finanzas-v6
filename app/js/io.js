/* ---------- menu / io ---------- */
$('#menuBtn').onclick=()=>$('#menu').classList.toggle('on');
document.addEventListener('click',e=>{if(!$('#menu').contains(e.target)&&e.target!==$('#menuBtn'))$('#menu').classList.remove('on');});
function download(name,content,type){const b=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();}
$('#expBtn').onclick=()=>{download('finanzas_backup.json',JSON.stringify(DB),'application/json');$('#menu').classList.remove('on');};
$('#csvBtn').onclick=()=>{const head=['Fecha','Cuenta','Categoria','Subcategoria','Nota','Tipo','Importe','Moneda','Desde','Hacia'];
  const rows=DB.tx.map(t=>t.type==='transfer'?[t.date,'','','',t.note||'','Transferencia',t.amount,t.currency||'ARS',t.from,t.to]:[t.date,t.account,t.category,t.sub,t.note||'',t.type==='income'?'Ingreso':'Gasto',t.amount,t.currency||'ARS','','']);
  const csv=[head,...rows].map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\n');download('finanzas_planilla.csv','\ufeff'+csv,'text/csv');$('#menu').classList.remove('on');};
$('#impBtn').onclick=()=>{$('#fileIn').click();$('#menu').classList.remove('on');};
// Importar acepta el export de la v55 (sin schema), un blob v5 o un array de movimientos. Reemplaza todo, previa confirmación con conteos.
$('#fileIn').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=normalize(JSON.parse(r.result));
    if(!confirm('El archivo tiene '+d.tx.length+' movimientos, '+d.accounts.length+' cuentas y '+d.reminders.length+' recordatorios.\n\n¿Reemplazar los datos actuales ('+DB.tx.length+' movimientos)?'))return;
    DB=d;persist();render();toast(DB.tx.length+' movimientos cargados');}catch(err){toast('No se pudo leer el archivo');}};r.readAsText(f);e.target.value='';};
$('#demoBtn').onclick=()=>{DB=normalize(defaultDB());persist();render();$('#menu').classList.remove('on');toast('Ejemplo cargado');};
$('#wipeBtn').onclick=()=>{if(confirm('¿Borrar todos los datos?')){DB=normalize({tx:[],reminders:[],accounts:JSON.parse(JSON.stringify(DEF_ACCOUNTS))});persist();render();$('#menu').classList.remove('on');toast('Todo borrado');}};

