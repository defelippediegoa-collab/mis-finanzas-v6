/* ---------- balances ---------- */
function effects(name,filter){let s=0;DB.tx.forEach(t=>{if(t.hist)return;if(filter&&!filter(t))return;
  if(t.type==='income'&&t.account===name)s+=t.amount;
  else if(t.type==='expense'&&t.account===name)s-=t.amount;
  else if(t.type==='transfer'){if(t.to===name)s+=(t.amountTo!=null?t.amountTo:t.amount);if(t.from===name)s-=t.amount;}});return s;}
function toARS(b,c){return c==='ARS'?b:(c==='USD'?b*(DB.usdRate||1000):null);}
function convertAmt(amount,fromCur,toCur,rate){if(fromCur===toCur)return amount;if(fromCur==='ARS'&&toCur==='USD')return Math.round(amount/rate*100)/100;if(fromCur==='USD'&&toCur==='ARS')return Math.round(amount*rate*100)/100;return amount;}
function liveBalance(name){const a=acct(name);const init=a?(a.initial||0):0;return init+effects(name,t=>new Date(t.date+'T12:00:00')<=TODAY);}
// Cuando se edita un movimiento importado (histórico), lo "soltamos" de la foto inicial:
// devolvemos su efecto al saldo inicial de las cuentas comunes y lo marcamos como vivo,
// para que de ahí en más cuente en el saldo. El saldo solo se mueve por lo que cambie el usuario.
function releaseHist(t){
  if(!t||!t.hist)return;
  const adj=(n,d)=>{if(!n||isCard(n))return;const a=acct(n);if(a)a.initial=(a.initial||0)+d;};
  if(t.type==='expense')adj(t.account,t.amount);
  else if(t.type==='income')adj(t.account,-t.amount);
  else if(t.type==='transfer'){adj(t.from,t.amount);adj(t.to,-(t.amountTo!=null?t.amountTo:t.amount));}
  t.hist=false;
}
function totalOwed(name){const a=acct(name);
  if(a&&a.type==='Tarjetas de crédito'){const s=cardSaldos(name);return -(s.aPagar+s.restante);}
  const init=a?(a.initial||0):0;return init+effects(name);} // all dates incl future
const MESACTUAL=ym(TODAY);
const MESPROX=ym(new Date(TODAY.getFullYear(),TODAY.getMonth()+1,1));
function payMonthOf(t){return t.dueMonth||ymOf(t.date);}
// Recordatorios de gasto del mes que todavía no están tildados como pagos (mismo tilde que la proyección).
function unpaidRems(month){return DB.reminders.filter(r=>r.type==='expense'&&remActiveIn(r,month)&&!DB.paid['rem:'+r.id+':'+month]);}
function remDebtARS(month){return unpaidRems(month).reduce((s,r)=>s+(toARS(remAmount(r,month),curOf(r.account))||0),0);}
// TARJETAS — "a pagar este mes" = todo lo NO pagado con mes de pago <= mes actual (incluye vencidos de meses anteriores).
// "próximo vencimiento" = lo que vence el mes que viene. Rota solo el 1º de cada mes (MESACTUAL/MESPROX salen de hoy).
// Los pagos (transferencias a la tarjeta) netean arrancando por lo más viejo. Las cuotas más a futuro no figuran acá (van en la proyección).
function cardSaldos(name){
  let le=0,nx=0,pay=0;
  DB.tx.forEach(t=>{
    if(t.type==='expense'&&t.account===name){const pm=payMonthOf(t);if(pm<=MESACTUAL)le+=t.amount;else if(pm===MESPROX)nx+=t.amount;}
    else if(t.type==='income'&&t.account===name)pay+=t.amount;
    else if(t.type==='transfer'&&t.to===name)pay+=(t.amountTo!=null?t.amountTo:t.amount);
    else if(t.type==='transfer'&&t.from===name){const pm=ymOf(t.date);if(pm<=MESACTUAL)le+=t.amount;else if(pm===MESPROX)nx+=t.amount;}
  });
  const aPagar=Math.max(0,le-pay);
  const leftover=Math.max(0,pay-le);
  const restante=Math.max(0,nx-leftover);
  return {aPagar:aPagar,restante:restante};
}

