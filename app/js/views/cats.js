/* ---------- category manager ---------- */
$('#catsBtn').onclick=()=>{$('#menu').classList.remove('on');mgrKind='expense';openCatMgr();};
function openCatMgr(){document.querySelectorAll('#mgrTabs button').forEach(b=>b.classList.toggle('on',b.dataset.k===mgrKind));renderCatList();$('#catScrim').classList.add('on');}
document.querySelectorAll('#mgrTabs button').forEach(b=>b.onclick=()=>{mgrKind=b.dataset.k;document.querySelectorAll('#mgrTabs button').forEach(x=>x.classList.toggle('on',x===b));renderCatList();});
function renderCatList(){const cats=DB.cats[mgrKind];$('#catList').innerHTML=cats.map(c=>'<div class="chip"><span>'+c+'</span><button class="cx" data-c="'+c+'">×</button></div>').join('');
  document.querySelectorAll('#catList .cx').forEach(b=>b.onclick=()=>{if(confirm('¿Borrar categoría "'+b.dataset.c+'"?')){DB.cats[mgrKind]=DB.cats[mgrKind].filter(x=>x!==b.dataset.c);delete DB.subs[b.dataset.c];persist();renderCatList();}});
  fill($('#subCatSel'),cats,mgrSubCat&&cats.includes(mgrSubCat)?mgrSubCat:cats[0]);mgrSubCat=$('#subCatSel').value;renderSubList();}
$('#subCatSel').onchange=()=>{mgrSubCat=$('#subCatSel').value;renderSubList();};
function renderSubList(){const subs=DB.subs[mgrSubCat]||[];$('#subList').innerHTML=subs.length?subs.map(s=>'<div class="chip"><span>'+s+'</span><button class="cx" data-s="'+s+'">×</button></div>').join(''):'<div class="empty" style="padding:14px">Sin subcategorías</div>';
  document.querySelectorAll('#subList .cx').forEach(b=>b.onclick=()=>{DB.subs[mgrSubCat]=DB.subs[mgrSubCat].filter(x=>x!==b.dataset.s);persist();renderSubList();});}
$('#addCat').onclick=()=>{const v=$('#newCat').value.trim();if(!v)return;if(!DB.cats[mgrKind].includes(v)){DB.cats[mgrKind].push(v);DB.subs[v]=DB.subs[v]||[];}persist();$('#newCat').value='';renderCatList();};
$('#addSub').onclick=()=>{const v=$('#newSub').value.trim();if(!v||!mgrSubCat)return;DB.subs[mgrSubCat]=DB.subs[mgrSubCat]||[];if(!DB.subs[mgrSubCat].includes(v))DB.subs[mgrSubCat].push(v);persist();$('#newSub').value='';renderSubList();};
$('#closeCat').onclick=()=>{$('#catScrim').classList.remove('on');render();};

