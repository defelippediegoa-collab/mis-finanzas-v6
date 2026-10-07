/* ---------- CUENTAS ---------- */
function renderAccounts(){
  // groups
  const groups={};DB.accounts.forEach(a=>{const g=TYPE_GROUP[a.type]||'Otras';(groups[g]=groups[g]||[]).push(a);});
  let capA=0,debtA=0,hidA=0;
  DB.accounts.forEach(a=>{const raw=a.type==='Tarjetas de crédito'?-cardSaldos(a.name).aPagar:liveBalance(a.name);const b=toARS(raw,a.currency);if(b==null)return;if(a.includeInTotal===false){hidA+=b;return;}if(b>=0)capA+=b;else debtA+=b;});
  debtA-=remDebtARS(MESACTUAL);
  $('#a-cap').textContent=money(capA);$('#a-debt').textContent=money(Math.abs(debtA));$('#a-bal').textContent=money(capA+debtA);$('#a-bal').className='big '+sgn(capA+debtA);
  const hw=$('#a-hidden-wrap');if(hidA!==0){hw.classList.remove('hidden');$('#a-hidden').textContent=money(hidA);$('#a-hidden').className=sgn(hidA);}else hw.classList.add('hidden');
  let html='';
  GROUP_ORDER.forEach(g=>{const accs=groups[g];if(!accs)return;
    if(g==='Tarjetas de crédito'){
      let tp=0,tr=0;accs.forEach(a=>{if(a.includeInTotal===false)return;const s=cardSaldos(a.name);tp+=toARS(s.aPagar,a.currency)||0;tr+=toARS(s.restante,a.currency)||0;});
      html+='<div class="grp"><div class="gh cards"><span>'+g+'</span><div class="twocol"><div class="c"><small>Vencido · a pagar</small><span class="'+dz(tp)+'">'+money(tp)+'</span></div><div class="c"><small>Próximo vencimiento</small><span class="'+dz(tr)+'">'+money(tr)+'</span></div></div></div>';
      accs.forEach(a=>{const s=cardSaldos(a.name);html+='<div class="arow" data-acc="'+a.name+'"><span class="an">'+a.name+'</span><div class="twocol"><span class="av '+dz(s.aPagar)+' v">'+money(s.aPagar,a.currency)+'</span><span class="av '+dz(s.restante)+' v">'+money(s.restante,a.currency)+'</span></div></div>';});
      html+='</div>';
    }else{
      const gt={};accs.forEach(a=>{gt[a.currency]=(gt[a.currency]||0)+liveBalance(a.name);});
      const gtStr=Object.entries(gt).map(([c,v])=>'<span class="'+sgn(v)+'">'+money(v,c)+'</span>').join(' · ');
      html+='<div class="grp"><div class="gh"><span>'+g+'</span><span>'+gtStr+'</span></div>';
      accs.sort((a,b)=>liveBalance(b.name)-liveBalance(a.name)).forEach(a=>{const b=liveBalance(a.name);html+='<div class="arow" data-acc="'+a.name+'"><span class="an">'+a.name+'</span><span class="av '+sgn(b)+'">'+money(b,a.currency)+'</span></div>';});
      html+='</div>';
    }
  });
  $('#accounts').innerHTML=html;
  document.querySelectorAll('#accounts .arow').forEach(el=>el.onclick=()=>{detMonth=new Date(TODAY.getFullYear(),TODAY.getMonth(),1);openAccountDetail(el.dataset.acc);});
}

