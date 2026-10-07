/* ---------- reglas locales comercio/nota → categoría (se crean solo cuando Diego pide "recordar") ---------- */
// rule: {id, kind:'merchant'|'note', match (normKey, substring), category, sub, hits, createdAt, source}
function ruleFor(merchant,note){
  const m=normKey(merchant),n=normKey(note);
  let best=null;
  (DB.rules||[]).forEach(r=>{if(!r||!r.match)return;const hay=r.kind==='merchant'?m:n;if(!hay||!hay.includes(r.match))return;
    if(!best||r.match.length>best.match.length)best=r;});
  return best;
}
function upsertRule(kind,match,category,sub,source){
  match=normKey(match);if(!match||match.length<3||!category)return null;
  DB.rules=DB.rules||[];
  let r=DB.rules.find(x=>x.kind===kind&&x.match===match);
  if(r){r.category=category;r.sub=sub||'';r.updatedAt=Date.now();}
  else{r={id:'rl'+Date.now()+Math.floor(Math.random()*1000),kind,match,category,sub:sub||'',hits:0,createdAt:Date.now(),source:source||'learned'};DB.rules.push(r);}
  return r;
}
function deleteRule(id){DB.rules=(DB.rules||[]).filter(r=>r.id!==id);}
// Categoría por defecto para un ticket: regla → "Gastos Variables › Supermercado" si existe → primera categoría de gasto
function defaultCatForTicket(merchant,note){
  const r=ruleFor(merchant,note);if(r){r.hits=(r.hits||0)+1;return{category:r.category,sub:r.sub||''};}
  const cats=DB.cats.expense||[];
  if(cats.includes('Gastos Variables')&&(DB.subs['Gastos Variables']||[]).includes('Supermercado'))return{category:'Gastos Variables',sub:'Supermercado'};
  return{category:cats[0]||'otros',sub:''};
}
