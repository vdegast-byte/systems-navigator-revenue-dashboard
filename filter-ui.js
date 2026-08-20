const filterSelectIds=['filterCompany','filterCustomer','filterProductGroup','filterProductType','filterAccount','filterIndustry','filterCountry','filterSupplier'];
let topFiltersReady=false;

function latestDataDate(){const dates=(state.rows||[]).map(r=>r.date).filter(Boolean).sort();return dates.length?dates[dates.length-1]:new Date().toISOString().slice(0,10)}
function earliestDataDate(){const dates=(state.rows||[]).map(r=>r.date).filter(Boolean).sort();return dates.length?dates[0]:''}
function iso(d){return d.toISOString().slice(0,10)}
function dataRange(){return {min:earliestDataDate(),max:latestDataDate()}}

function applyPreset(value){
  const end=new Date(latestDataDate()+'T12:00:00');let start='',finish=iso(end);
  if(value==='all')({min:start,max:finish}=dataRange());
  if(value==='ytd')start=`${end.getFullYear()}-01-01`;
  if(value==='previous'){start=`${end.getFullYear()-1}-01-01`;finish=`${end.getFullYear()-1}-12-31`}
  if(value==='last12'){const d=new Date(end);d.setMonth(d.getMonth()-11);d.setDate(1);start=iso(d)}
  if(value==='custom'){$('advancedFilters').classList.remove('hidden');$('moreFilters').setAttribute('aria-expanded','true');return}
  $('filterStart').value=start;$('filterEnd').value=finish;render();syncFilterUI();
}
function inferPreset(){
  const s=$('filterStart').value,e=$('filterEnd').value,{min,max}=dataRange();if(s===min&&e===max)return'all';
  const end=new Date(max+'T12:00:00');if(s===`${end.getFullYear()}-01-01`&&e===max)return'ytd';
  if(s===`${end.getFullYear()-1}-01-01`&&e===`${end.getFullYear()-1}-12-31`)return'previous';return'custom';
}

function closePopovers(except){document.querySelectorAll('.filter-popover').forEach(p=>{if(p!==except)p.remove()})}
function selectedValues(select){return[...select.selectedOptions].map(o=>o.value)}
function triggerText(select){const values=selectedValues(select),placeholder=select.dataset.placeholder||'Alle';if(!values.length)return placeholder;if(values.length===1)return values[0];return`${values.length} geselecteerd`}
function ensureTrigger(select){let trigger=select.parentElement.querySelector('.filter-trigger');if(trigger)return trigger;trigger=document.createElement('button');trigger.type='button';trigger.className='filter-trigger';trigger.innerHTML='<span class="trigger-value"></span><span class="trigger-arrow">⌄</span>';select.insertAdjacentElement('afterend',trigger);trigger.addEventListener('click',e=>{e.stopPropagation();openPopover(select)});return trigger}
function syncTrigger(select){const t=ensureTrigger(select),v=t.querySelector('.trigger-value'),selected=selectedValues(select);v.textContent=triggerText(select);t.classList.toggle('has-value',selected.length>0);t.title=selected.length?selected.join(', '):(select.dataset.placeholder||'Alle')}

function openPopover(select){
  const existing=select.parentElement.querySelector('.filter-popover');if(existing){existing.remove();return}closePopovers();
  const pop=document.createElement('div');pop.className='filter-popover';const search=document.createElement('input');search.type='search';search.className='filter-popover-search';search.placeholder=`Zoek ${String(select.dataset.label||'filter').toLowerCase()}...`;const list=document.createElement('div');list.className='filter-options';pop.append(search,list);select.parentElement.appendChild(pop);
  const paint=()=>{const q=search.value.toLowerCase();const options=[...select.options].filter(o=>!q||o.text.toLowerCase().includes(q));list.innerHTML='';if(!options.length){list.innerHTML='<div class="filter-popover-empty">Geen resultaten</div>';return}options.forEach(o=>{const label=document.createElement('label');label.className='filter-option';const cb=document.createElement('input');cb.type='checkbox';cb.checked=o.selected;const text=document.createElement('span');text.textContent=o.text;label.append(cb,text);cb.addEventListener('change',()=>{o.selected=cb.checked;select.dispatchEvent(new Event('change',{bubbles:true}));syncTrigger(select);updateChips()});list.appendChild(label)})};search.addEventListener('input',paint);pop.addEventListener('click',e=>e.stopPropagation());paint();search.focus();
}
function clearSelectValue(id,value){const s=$(id);[...s.options].forEach(o=>{if(o.value===value)o.selected=false});s.dispatchEvent(new Event('change',{bubbles:true}));syncTrigger(s)}

function updateChips(){
  const box=$('activeFilters'),chips=[];for(const id of filterSelectIds){const s=$(id),label=s.dataset.label||'';for(const v of selectedValues(s))chips.push({text:`${label}: ${v}`,remove:()=>clearSelectValue(id,v)})}
  const q=$('filterSearch').value.trim();if(q)chips.push({text:`Zoeken: ${q}`,remove:()=>{$('filterSearch').value='';$('filterSearch').dispatchEvent(new Event('input',{bubbles:true}))}});
  const preset=inferPreset();$('filterPreset').value=preset;if(preset==='custom'&&($('filterStart').value||$('filterEnd').value)){const s=$('filterStart').value||'…',e=$('filterEnd').value||'…';chips.unshift({text:`Periode: ${s} – ${e}`,remove:()=>applyPreset('all')})}
  box.innerHTML='';if(!chips.length){box.classList.add('hidden');$('clearFilters').classList.add('inactive');return}box.classList.remove('hidden');$('clearFilters').classList.remove('inactive');const l=document.createElement('span');l.className='active-filter-label';l.textContent='Actief:';box.appendChild(l);chips.forEach(c=>{const chip=document.createElement('span');chip.className='active-chip';const text=document.createElement('span');text.textContent=c.text;const x=document.createElement('button');x.type='button';x.setAttribute('aria-label',`${c.text} verwijderen`);x.textContent='×';x.onclick=c.remove;chip.append(text,x);box.appendChild(chip)})
}
function syncFilterUI(){filterSelectIds.forEach(id=>syncTrigger($(id)));updateChips()}
function resetTopFilters(){filterSelectIds.forEach(id=>{const s=$(id);[...s.options].forEach(o=>o.selected=false);syncTrigger(s)});$('filterSearch').value='';applyPreset('all');$('advancedFilters').classList.add('hidden');$('moreFilters').setAttribute('aria-expanded','false');updateChips()}

function initTopFilters(){
  if(topFiltersReady)return;topFiltersReady=true;filterSelectIds.forEach(id=>syncTrigger($(id)));
  $('filterPreset').addEventListener('change',e=>applyPreset(e.target.value));
  $('moreFilters').onclick=()=>{const panel=$('advancedFilters'),open=panel.classList.toggle('hidden')===false;$('moreFilters').setAttribute('aria-expanded',String(open))};
  $('clearFilters').onclick=resetTopFilters;
  $('filterStart').addEventListener('change',()=>{$('filterPreset').value=inferPreset();updateChips()});$('filterEnd').addEventListener('change',()=>{$('filterPreset').value=inferPreset();updateChips()});$('filterSearch').addEventListener('input',updateChips);
  filterSelectIds.forEach(id=>$(id).addEventListener('change',()=>{syncTrigger($(id));updateChips()}));document.addEventListener('click',()=>closePopovers());syncFilterUI();
}

window.addEventListener('DOMContentLoaded',()=>{
  const waitForApp=()=>{const appReady=typeof render==='function'&&typeof state!=='undefined'&&$('clearFilters')&&$('filterStart');if(appReady){setTimeout(initTopFilters,120)}else setTimeout(waitForApp,50)};waitForApp();
});
