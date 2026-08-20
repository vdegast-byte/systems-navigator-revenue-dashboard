const FORECAST_VIEWS=new Set(['dropboardForecast','snForecast','totalForecast']);
let editingRecurringId=null;

function ensureRecurringState(){
  if(!state.recurring)state.recurring={contracts:[],legacy:null,includeBaseline:{dropboard:true,sn:true}};
  if(!Array.isArray(state.recurring.contracts))state.recurring.contracts=[];
  if(!state.recurring.includeBaseline)state.recurring.includeBaseline={dropboard:true,sn:true};
  return state.recurring;
}
function rfYears(){return Array.from({length:10},(_,i)=>2026+i)}
function rfNumber(v){const n=Number(v);return Number.isFinite(n)?n:0}
function rfPct(v){return new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(v||0)}
function rfId(){return'c_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function rfDaysInYear(y){return(new Date(Date.UTC(y+1,0,1))-new Date(Date.UTC(y,0,1)))/86400000}
function rfContractValue(c,year){
  if(c.status==='hold')return 0;
  const start=new Date((c.start||`${year}-01-01`)+'T00:00:00Z');
  const end=new Date((c.end||'2035-12-31')+'T23:59:59Z');
  const ys=new Date(Date.UTC(year,0,1)),ye=new Date(Date.UTC(year,11,31,23,59,59));
  if(end<ys||start>ye)return 0;
  const a=start>ys?start:ys,b=end<ye?end:ye;
  const days=Math.max(0,(b-a)/86400000+1);
  const indexYears=Math.max(0,year-start.getUTCFullYear());
  return rfNumber(c.annualValue)*(days/rfDaysInYear(year))*Math.pow(1+rfNumber(c.indexPct)/100,indexYears);
}
function rfContractSum(product,year){return ensureRecurringState().contracts.filter(c=>c.product===product).reduce((s,c)=>s+rfContractValue(c,year),0)}
function rfMapSum(map,year){return map&&map[String(year)]!=null?rfNumber(map[String(year)]):0}
function rfLegacyProduct(product,year){
  const r=ensureRecurringState(),l=r.legacy;if(!l)return{existing:0,baseline:0};
  const block=product==='dropboard'?l.dropboard:l.sn;
  if(!block)return{existing:0,baseline:0};
  const existing=(block.contracts||[]).reduce((s,c)=>s+rfMapSum(c.values,year),0);
  const baseline=r.includeBaseline[product]?rfMapSum(block.baseline,year):0;
  return{existing,baseline};
}
function rfProductTotal(product,year){const x=rfLegacyProduct(product,year);return x.existing+x.baseline+rfContractSum(product,year)}
function rfMaintenance(year){return rfMapSum(ensureRecurringState().legacy?.maintenance,year)}
function rfNonRecurring(key,year){return rfMapSum(ensureRecurringState().legacy?.nonRecurring?.[key],year)}
function rfRecurringTotal(year){return rfProductTotal('dropboard',year)+rfProductTotal('sn',year)+rfMaintenance(year)}
function rfCompanyTotal(year){return rfRecurringTotal(year)+rfNonRecurring('services',year)+rfNonRecurring('consultancy',year)+rfNonRecurring('other',year)}

async function rfSheetRows(file,sheetName){
  const z=await JSZip.loadAsync(await file.arrayBuffer()),p=new DOMParser();
  const wbxml=p.parseFromString(await z.file('xl/workbook.xml').async('string'),'application/xml');
  const relxml=p.parseFromString(await z.file('xl/_rels/workbook.xml.rels').async('string'),'application/xml');
  const rels={};relxml.querySelectorAll('Relationship').forEach(r=>rels[r.getAttribute('Id')]=r.getAttribute('Target'));
  const sheets=[...wbxml.querySelectorAll('sheet')].map(s=>({name:s.getAttribute('name'),id:s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')}));
  const sh=sheets.find(s=>s.name.toLowerCase()===sheetName.toLowerCase());if(!sh)throw Error(`Tabblad ${sheetName} niet gevonden.`);
  let t=rels[sh.id];t=t.startsWith('/')?t.slice(1):(t.startsWith('xl/')?t:'xl/'+t.replace(/^\.\//,''));
  const ss=[];if(z.file('xl/sharedStrings.xml')){const sx=p.parseFromString(await z.file('xl/sharedStrings.xml').async('string'),'application/xml');sx.querySelectorAll('si').forEach(si=>ss.push([...si.querySelectorAll('t')].map(x=>x.textContent||'').join('')))}
  const xml=p.parseFromString(await z.file(t).async('string'),'application/xml'),rows=[];
  for(const rr of xml.querySelectorAll('sheetData > row')){const a=[];for(const c of rr.querySelectorAll(':scope > c')){const ref=c.getAttribute('r')||'A1',letters=(ref.match(/[A-Z]+/)||['A'])[0];let i=0;for(const ch of letters)i=i*26+ch.charCodeAt(0)-64;i--;const type=c.getAttribute('t'),v=c.querySelector(':scope > v');let val='';if(type==='s'&&v)val=ss[Number(v.textContent)]??'';else if(type==='inlineStr')val=[...c.querySelectorAll('is t')].map(x=>x.textContent||'').join('');else if(v){const q=v.textContent,n=Number(q);val=q!==''&&Number.isFinite(n)?n:q}a[i]=val}rows.push(a)}
  return rows;
}
function rfYearColumns(row){const out=[];(row||[]).forEach((v,i)=>{const y=Number(v);if(y>=2020&&y<=2040)out.push([i,y])});return out}
function rfValuesFromRow(row,cols){const o={};for(const[i,y]of cols)o[String(y)]=rfNumber(row[i]);return o}
function rfFindRow(rows,label,start=0){const q=label.toLowerCase();for(let i=start;i<rows.length;i++){if(clean(rows[i]?.[1]).toLowerCase()===q)return i}return-1}
function rfFindContains(rows,label,start=0){const q=label.toLowerCase();for(let i=start;i<rows.length;i++){if(clean(rows[i]?.[1]).toLowerCase().includes(q))return i}return-1}
function rfParseProduct(rows,sectionName){
  let yr=-1;for(let i=0;i<rows.length;i++){if(rfYearColumns(rows[i]).length>=8){yr=i;break}}if(yr<0)throw Error(`Geen jaarkolommen in ${sectionName}.`);
  const cols=rfYearColumns(rows[yr]),contracts=[];let baseline={};
  for(let i=yr+1;i<rows.length;i++){
    const name=clean(rows[i]?.[1]);if(!name)continue;const lower=name.toLowerCase();
    if(lower==='new customers'){baseline=rfValuesFromRow(rows[i],cols);continue}
    if(lower==='total'||lower==='sites live'||lower==='mrr')break;
    if(lower.includes('simio + arena'))break;
    const values=rfValuesFromRow(rows[i],cols);if(Object.values(values).some(v=>v!==0))contracts.push({name,values});
  }
  return{years:cols.map(x=>x[1]),contracts,baseline};
}
function rfParseMaintenance(rows){
  const header=rfFindContains(rows,'simio + arena software maintenance');if(header<0)return{};const cols=rfYearColumns(rows[header]);
  for(let i=header+1;i<rows.length;i++){const n=clean(rows[i]?.[1]).toLowerCase();if(n==='total')return rfValuesFromRow(rows[i],cols)}return{};
}
function rfParseTotal(rows){
  let cols=[];for(const r of rows){const c=rfYearColumns(r);if(c.length>=8){cols=c;break}}
  const categories={services:'Dropboard services',consultancy:'Consultancy',other:'Other'},out={};
  for(const[k,label]of Object.entries(categories)){const i=rfFindRow(rows,label);out[k]=i>=0?rfValuesFromRow(rows[i],cols):{}}
  const factorRow=rfFindRow(rows,'Recurring revenue factor'),consultRow=rfFindRow(rows,'Consultancy revenue factor');
  const firstNum=row=>{for(const v of row||[]){if(typeof v==='number'&&Number.isFinite(v))return v}return null};
  return{nonRecurring:out,recurringFactor:factorRow>=0?firstNum(rows[factorRow]):null,consultancyFactor:consultRow>=0?firstNum(rows[consultRow]):null};
}
function rfFindInflation(rows){const i=rfFindRow(rows,'Inflation per year');if(i<0)return.03;for(const v of rows[i])if(typeof v==='number'&&v>0&&v<1)return v;return.03}
async function rfImportWorkbook(file){
  const[dbRows,snRows,totalRows]=await Promise.all([rfSheetRows(file,'Dropboard SAAS'),rfSheetRows(file,'SN SAAS'),rfSheetRows(file,'Total')]);
  const t=rfParseTotal(totalRows),r=ensureRecurringState();
  r.legacy={sourceName:file.name,importedAt:new Date().toISOString(),dropboard:rfParseProduct(dbRows,'Dropboard SAAS'),sn:rfParseProduct(snRows,'SN SAAS'),maintenance:rfParseMaintenance(snRows),nonRecurring:t.nonRecurring,assumptions:{inflation:rfFindInflation(dbRows),recurringFactor:t.recurringFactor??5,consultancyFactor:t.consultancyFactor??1}};
  await save();rfRenderCurrent();alert('Recurring revenue spreadsheet is lokaal geïmporteerd.');
}

function rfInputForm(product){
  const r=ensureRecurringState(),edit=editingRecurringId?r.contracts.find(c=>c.id===editingRecurringId&&c.product===product):null;
  const inflation=(r.legacy?.assumptions?.inflation??.03)*100;
  return`<div class="rf-form card"><div class="rf-form-head"><div><h3>${edit?'Contract wijzigen':'Nieuw klantcontract toevoegen'}</h3><p class="hint">De jaarlijkse fee wordt pro-rata over de contractperiode verdeeld en per kalenderjaar geïndexeerd.</p></div>${edit?'<button type="button" class="secondary" id="rfCancelEdit">Annuleren</button>':''}</div><form id="rfContractForm" class="rf-grid-form">
  <label>Klant / contract<input required name="customer" value="${esc(edit?.customer||'')}" placeholder="Bijv. Nieuwe terminal"></label>
  <label>Startdatum<input required type="date" name="start" value="${esc(edit?.start||'')}"></label>
  <label>Einddatum<input type="date" name="end" value="${esc(edit?.end||'')}" placeholder="optioneel"></label>
  <label>Jaarlijkse SaaS fee (€)<input required type="number" min="0" step="0.01" name="annualValue" value="${edit?.annualValue??''}" placeholder="50000"></label>
  <label>Jaarlijkse indexatie (%)<input type="number" step="0.1" name="indexPct" value="${edit?.indexPct??(inflation*100/100)}"></label>
  <label>Status<select name="status"><option value="active" ${edit?.status!=='hold'?'selected':''}>Actief / verwacht</option><option value="hold" ${edit?.status==='hold'?'selected':''}>On hold (niet meetellen)</option></select></label>
  <label class="rf-notes">Notitie<input name="notes" value="${esc(edit?.notes||'')}" placeholder="modules, sites, bijzonderheden"></label>
  <button type="submit">${edit?'Opslaan':'Contract toevoegen'}</button></form></div>`;
}
function rfProductSeries(product){return rfYears().map(y=>{const l=rfLegacyProduct(product,y);return{year:y,existing:l.existing,baseline:l.baseline,added:rfContractSum(product,y),total:l.existing+l.baseline+rfContractSum(product,y)}})}
function rfProductDashboard(product){
  const isDb=product==='dropboard',r=ensureRecurringState(),block=r.legacy?.[product],series=rfProductSeries(product),title=isDb?'Dropboard SaaS':'Scenario Navigator SaaS',thisYear=2026;
  const cur=series.find(x=>x.year===thisYear),next=series.find(x=>x.year===thisYear+1),growth=cur?.total?((next.total-cur.total)/cur.total):0,user=r.contracts.filter(c=>c.product===product);
  const source=r.legacy?`Bron: ${esc(r.legacy.sourceName)} · lokaal geïmporteerd`:'Nog geen recurring revenue spreadsheet geïmporteerd';
  const baselineLabel=isDb?'Dropboard “New customers”':'SN “New customers”';
  return`<div class="rf-top card"><div><div class="eyebrow">Recurring contract forecast</div><h2>${title}</h2><p>${source}</p></div><button id="rfImport" type="button">Recurring Excel importeren</button></div>
  <div class="grid rf-metrics"><div class="metric"><div class="label">Forecast 2026</div><div class="value">${eur(cur?.total||0)}</div><div class="sub">Bestaand + baseline + nieuwe contracten</div></div><div class="metric"><div class="label">Forecast 2027</div><div class="value">${eur(next?.total||0)}</div><div class="sub ${growth>=0?'kpi-positive':'kpi-negative'}">${growth>=0?'+':''}${rfPct(growth)} versus 2026</div></div><div class="metric"><div class="label">Toegevoegde contracten</div><div class="value">${user.length}</div><div class="sub">Lokaal in deze browser</div></div><div class="metric"><div class="label">Nieuwe contracten 2026</div><div class="value">${eur(rfContractSum(product,2026))}</div><div class="sub">Bovenop de Excel-baseline</div></div></div>
  <div class="rf-baseline card"><label class="rf-switch"><input id="rfBaselineToggle" type="checkbox" ${r.includeBaseline[product]?'checked':''}><span>Neem bestaande ${esc(baselineLabel)}-aanname uit Excel mee</span></label><p class="hint">Zet dit uit wanneer concrete nieuwe contracten de generieke groeiaanname vervangen, om dubbel tellen te voorkomen.</p></div>
  <div class="card"><h3>Meerjarige omzetverwachting</h3><p class="hint">Bestaande contractforecast uit Excel, generieke new-customer aanname en door jou toegevoegde contracten.</p><div id="rfProductChart" class="chart tall"></div></div><div class="spacer"></div>
  ${rfInputForm(product)}<div class="spacer"></div>
  <div class="card"><h3>Nieuwe / aangepaste contracten</h3><div class="table-wrap"><table><thead><tr><th>Klant</th><th>Periode</th><th>Jaarfee</th><th>Indexatie</th><th>Status</th><th>2026</th><th>2027</th><th></th></tr></thead><tbody>${user.map(c=>`<tr><td>${esc(c.customer)}</td><td>${esc(c.start)} → ${esc(c.end||'doorlopend')}</td><td class="num">${eur(c.annualValue)}</td><td class="num">${rfNumber(c.indexPct).toFixed(1)}%</td><td>${c.status==='hold'?'On hold':'Actief'}</td><td class="num">${eur(rfContractValue(c,2026))}</td><td class="num">${eur(rfContractValue(c,2027))}</td><td><button class="rf-link" data-edit-contract="${c.id}">Wijzig</button><button class="rf-link danger-text" data-delete-contract="${c.id}">Verwijder</button></td></tr>`).join('')||'<tr><td colspan="8" class="muted">Nog geen nieuwe contracten ingevoerd.</td></tr>'}</tbody></table></div></div><div class="spacer"></div>
  <div class="card"><h3>Jaaroverzicht</h3><div class="table-wrap"><table><thead><tr><th>Jaar</th><th>Bestaande contracten</th><th>New customers baseline</th><th>Toegevoegd</th><th>Totaal</th></tr></thead><tbody>${series.map(x=>`<tr><td>${x.year}</td><td class="num">${eur(x.existing)}</td><td class="num">${eur(x.baseline)}</td><td class="num">${eur(x.added)}</td><td class="num"><strong>${eur(x.total)}</strong></td></tr>`).join('')}</tbody></table></div></div>`;
}
function rfBindProduct(product){
  $('rfImport').onclick=()=>$('forecastPicker').click();$('rfBaselineToggle').onchange=e=>{ensureRecurringState().includeBaseline[product]=e.target.checked;save().then(rfRenderCurrent)};
  const form=$('rfContractForm');form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),obj={id:editingRecurringId||rfId(),product,customer:clean(f.get('customer')),start:String(f.get('start')||''),end:String(f.get('end')||''),annualValue:rfNumber(f.get('annualValue')),indexPct:rfNumber(f.get('indexPct')),status:String(f.get('status')||'active'),notes:clean(f.get('notes')),createdAt:new Date().toISOString()};if(obj.end&&obj.end<obj.start){alert('Einddatum ligt vóór de startdatum.');return}const r=ensureRecurringState(),i=r.contracts.findIndex(c=>c.id===obj.id);if(i>=0)r.contracts[i]=obj;else r.contracts.push(obj);editingRecurringId=null;await save();rfRenderCurrent()};
  if($('rfCancelEdit'))$('rfCancelEdit').onclick=()=>{editingRecurringId=null;rfRenderCurrent()};
  document.querySelectorAll('[data-edit-contract]').forEach(b=>b.onclick=()=>{editingRecurringId=b.dataset.editContract;rfRenderCurrent();setTimeout(()=>$('rfContractForm')?.scrollIntoView({behavior:'smooth',block:'center'}),20)});
  document.querySelectorAll('[data-delete-contract]').forEach(b=>b.onclick=async()=>{if(confirm('Dit contract verwijderen?')){const r=ensureRecurringState();r.contracts=r.contracts.filter(c=>c.id!==b.dataset.deleteContract);await save();rfRenderCurrent()}});
  const s=rfProductSeries(product);Plotly.newPlot('rfProductChart',[{type:'bar',name:'Bestaande contracten',x:s.map(x=>x.year),y:s.map(x=>x.existing)},{type:'bar',name:'New customers baseline',x:s.map(x=>x.year),y:s.map(x=>x.baseline)},{type:'bar',name:'Toegevoegde contracten',x:s.map(x=>x.year),y:s.map(x=>x.added)}],{barmode:'stack',height:430,margin:{l:65,r:20,t:15,b:65},paper_bgcolor:'transparent',plot_bgcolor:'transparent',legend:{orientation:'h',y:-.18},yaxis:{tickprefix:'€',tickformat:',.0f',gridcolor:'#edf0f5'},xaxis:{type:'category'}},{displayModeBar:false,responsive:true});
}
function rfCagr(a,b,n){return a>0&&b>0?Math.pow(b/a,1/n)-1:0}
function rfTotalDashboard(){
  const r=ensureRecurringState(),years=rfYears(),rows=years.map(y=>({year:y,dropboard:rfProductTotal('dropboard',y),sn:rfProductTotal('sn',y),maintenance:rfMaintenance(y),services:rfNonRecurring('services',y),consultancy:rfNonRecurring('consultancy',y),other:rfNonRecurring('other',y),recurring:rfRecurringTotal(y),total:rfCompanyTotal(y)}));
  const y26=rows[0],y30=rows.find(x=>x.year===2030),cagr=rfCagr(y26?.total||0,y30?.total||0,4),share=y26?.total?y26.recurring/y26.total:0,newImpact=rfContractSum('dropboard',2026)+rfContractSum('sn',2026),factor=r.legacy?.assumptions?.recurringFactor??5,consultFactor=r.legacy?.assumptions?.consultancyFactor??1;
  return`<div class="rf-top card"><div><div class="eyebrow">Consolidated forecast</div><h2>Totale omzetverwachting</h2><p>${r.legacy?`Gebaseerd op ${esc(r.legacy.sourceName)} plus lokaal toegevoegde contracten.`:'Importeer de recurring revenue spreadsheet om de bestaande Total-forecast over te nemen.'}</p></div><button id="rfImport" type="button">Recurring Excel importeren</button></div>
  <div class="grid rf-metrics"><div class="metric"><div class="label">Totale omzet 2026</div><div class="value">${eur(y26?.total||0)}</div><div class="sub">Recurring + services + consultancy</div></div><div class="metric"><div class="label">Recurring revenue 2026</div><div class="value">${eur(y26?.recurring||0)}</div><div class="sub">${rfPct(share)} van totale omzet</div></div><div class="metric"><div class="label">Totale omzet 2030</div><div class="value">${eur(y30?.total||0)}</div><div class="sub">CAGR 2026–2030: ${rfPct(cagr)}</div></div><div class="metric"><div class="label">Impact nieuwe contracten 2026</div><div class="value">${eur(newImpact)}</div><div class="sub">Dropboard + SN SaaS</div></div></div>
  <div class="card"><h3>Omzetverwachting per inkomstenstroom</h3><p class="hint">Deze chart volgt de consolidatie uit het tabblad Total. Toegevoegde SaaS-contracten worden direct meegenomen.</p><div id="rfTotalChart" class="chart tall"></div></div><div class="spacer"></div>
  <div class="grid two"><div class="card"><h3>Recurring revenue ontwikkeling</h3><div id="rfRecurringChart" class="chart"></div></div><div class="card"><h3>Model assumptions uit Excel</h3><div class="rf-assumption"><span>Recurring revenue factor</span><strong>${factor}x</strong></div><div class="rf-assumption"><span>Consultancy revenue factor</span><strong>${consultFactor}x</strong></div><div class="rf-assumption"><span>Default indexatie</span><strong>${rfPct(r.legacy?.assumptions?.inflation??.03)}</strong></div><p class="hint">Deze waarden worden alleen als referentie uit het spreadsheet gelezen; nieuwe contracten hebben hun eigen indexatieveld.</p></div></div><div class="spacer"></div>
  <div class="card"><h3>Jaaroverzicht totale forecast</h3><div class="table-wrap"><table><thead><tr><th>Jaar</th><th>Dropboard</th><th>SN SaaS</th><th>Arena/Simio</th><th>Recurring totaal</th><th>Dropboard services</th><th>Consultancy</th><th>Other</th><th>Totale omzet</th><th>MRR</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.year}</td><td class="num">${eur(x.dropboard)}</td><td class="num">${eur(x.sn)}</td><td class="num">${eur(x.maintenance)}</td><td class="num"><strong>${eur(x.recurring)}</strong></td><td class="num">${eur(x.services)}</td><td class="num">${eur(x.consultancy)}</td><td class="num">${eur(x.other)}</td><td class="num"><strong>${eur(x.total)}</strong></td><td class="num">${eur(x.recurring/12)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function rfBindTotal(){
  $('rfImport').onclick=()=>$('forecastPicker').click();const years=rfYears(),r=ensureRecurringState();
  const traces=[['Dropboard','dropboard'],['SN SaaS','sn'],['Arena/Simio maintenance','maintenance'],['Dropboard services','services'],['Consultancy','consultancy'],['Other','other']].map(([name,k])=>({type:'bar',name,x:years,y:years.map(y=>k==='dropboard'?rfProductTotal('dropboard',y):k==='sn'?rfProductTotal('sn',y):k==='maintenance'?rfMaintenance(y):rfNonRecurring(k,y))}));traces.push({type:'scatter',mode:'lines+markers',name:'Totale omzet',x:years,y:years.map(rfCompanyTotal),line:{width:3}});
  Plotly.newPlot('rfTotalChart',traces,{barmode:'stack',height:450,margin:{l:65,r:20,t:15,b:80},paper_bgcolor:'transparent',plot_bgcolor:'transparent',legend:{orientation:'h',y:-.22},yaxis:{tickprefix:'€',tickformat:',.0f',gridcolor:'#edf0f5'},xaxis:{type:'category'}},{displayModeBar:false,responsive:true});
  Plotly.newPlot('rfRecurringChart',[{type:'bar',name:'Dropboard',x:years,y:years.map(y=>rfProductTotal('dropboard',y))},{type:'bar',name:'SN SaaS',x:years,y:years.map(y=>rfProductTotal('sn',y))},{type:'bar',name:'Arena/Simio',x:years,y:years.map(rfMaintenance)}],{barmode:'stack',height:340,margin:{l:65,r:20,t:15,b:70},paper_bgcolor:'transparent',plot_bgcolor:'transparent',legend:{orientation:'h',y:-.2},yaxis:{tickprefix:'€',tickformat:',.0f',gridcolor:'#edf0f5'},xaxis:{type:'category'}},{displayModeBar:false,responsive:true});
}
function rfRenderCurrent(){render()}
function rfRenderView(){
  ensureRecurringState();document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));$('emptyState').classList.add('hidden');$('filterShell').classList.add('hidden');$('quickImport').classList.add('hidden');$('exportFiltered').classList.add('hidden');
  editingRecurringId=FORECAST_VIEWS.has(view)?editingRecurringId:null;
  if(view==='dropboardForecast'){$('pageTitle').textContent='Dropboard SaaS forecast';$('pageSubtitle').textContent='Beheer recurring contracten en analyseer de meerjarige Dropboard omzetverwachting.';$('dropboardForecastView').classList.remove('hidden');$('dropboardForecastView').innerHTML=rfProductDashboard('dropboard');rfBindProduct('dropboard')}
  if(view==='snForecast'){$('pageTitle').textContent='SN SaaS forecast';$('pageSubtitle').textContent='Beheer Scenario Navigator SaaS-contracten en de meerjarige omzetverwachting.';$('snForecastView').classList.remove('hidden');$('snForecastView').innerHTML=rfProductDashboard('sn');rfBindProduct('sn')}
  if(view==='totalForecast'){$('pageTitle').textContent='Total forecast';$('pageSubtitle').textContent='Geconsolideerde omzetverwachting op basis van recurring revenue, services en consultancy.';$('totalForecastView').classList.remove('hidden');$('totalForecastView').innerHTML=rfTotalDashboard();rfBindTotal()}
}
const rfBaseRender=render;
render=function(){if(FORECAST_VIEWS.has(view))return rfRenderView();$('filterShell').classList.remove('hidden');$('quickImport').classList.remove('hidden');$('exportFiltered').classList.remove('hidden');return rfBaseRender()};

window.addEventListener('DOMContentLoaded',()=>{
  ensureRecurringState();const picker=$('forecastPicker');picker.onchange=async e=>{if(e.target.files[0]){try{await rfImportWorkbook(e.target.files[0])}catch(err){console.error(err);alert('Importeren mislukt: '+err.message)}e.target.value=''}};
});
