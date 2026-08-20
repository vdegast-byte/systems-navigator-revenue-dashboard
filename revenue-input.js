const riOriginalRecords = records;

records = function(rows){
  if(!rows.length)return[];
  const rawHeaders=rows[0].map(x=>clean(x));
  const revenueIndex=rawHeaders.findIndex(x=>x.toLowerCase()==='revenue (eur)');
  if(revenueIndex<0)throw Error('Kolom Revenue (EUR) is verplicht. Revenue incl VAT (EUR) wordt niet gebruikt als omzetbron.');

  const localAliases={
    'year':'year','quarter':'quarter','company':'company','date':'date','account':'account','customer':'customer',
    'invoice nr':'invoice','invoice no':'invoice','invoice number':'invoice','description':'description',
    'revenue (eur)':'revenue','revenue incl vat (eur)':'incl','country':'country','industry':'industry',
    'product group':'group','product type':'type','supplier':'supplier'
  };
  const h=rawHeaders.map(x=>localAliases[x.toLowerCase()]||x.toLowerCase()),idx={};
  h.forEach((x,i)=>idx[x]=i);
  idx.revenue=revenueIndex;
  if(idx.company==null||idx.date==null)throw Error('Kolommen Company en Date zijn verplicht.');
  const g=(r,k)=>idx[k]==null?'':r[idx[k]];
  return rows.slice(1).map(r=>({
    year:Number(g(r,'year'))||Number(parseDate(g(r,'date')).slice(0,4)),
    quarter:clean(g(r,'quarter')),
    company:clean(g(r,'company')),
    date:parseDate(g(r,'date')),
    account:clean(g(r,'account')),
    customer:clean(g(r,'customer')),
    invoice:clean(g(r,'invoice')),
    description:clean(g(r,'description')),
    revenue:num(r[revenueIndex]),
    incl:num(g(r,'incl')),
    country:clean(g(r,'country')),
    industry:clean(g(r,'industry')),
    group:clean(g(r,'group')),
    type:clean(g(r,'type')),
    supplier:clean(g(r,'supplier'))
  })).filter(r=>r.company&&r.company.toLowerCase()!=='totals'&&(r.invoice||r.date||r.revenue));
};

function riLatestQuarter(){
  const dates=state.rows.map(r=>r.date).filter(Boolean).sort();
  if(!dates.length)return'Geen data';
  const d=dates.at(-1),m=Number(d.slice(5,7)),q=Math.ceil(m/3);
  return `${d.slice(0,4)} Q${q}`;
}
function riTemplate(){
  const headers=['Year','Quarter','Company','Date','Account','Customer','invoice nr','Description','Revenue (EUR)','Revenue incl VAT (EUR)','Country','Industry','Product group','Product Type','Supplier'];
  const example=['2026','Q3','SN','2026-07-01','Account name','Customer name','INV-0001','Omschrijving','10000','12100','Netherlands','Oil and Gas','Dropboard','SaaS',''];
  download(new Blob(['\uFEFF'+headers.join(';')+'\r\n'+example.join(';')+'\r\n'],{type:'text/csv;charset=utf-8'}),'revenue-quarter-template.csv');
}
function riBindImport(){
  const zone=$('riQuarterDropzone'),choose=$('riChooseQuarter'),template=$('riDownloadTemplate');
  if(choose)choose.onclick=()=>$('filePicker').click();
  if(template)template.onclick=riTemplate;
  if(zone){
    ['dragenter','dragover'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.add('drag')}));
    ['dragleave','drop'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove('drag')}));
    zone.ondrop=e=>importFiles([...e.dataTransfer.files]);
  }
}

invoices = function(rows){
  const m=new Map();
  rows.forEach(r=>{const k=r.company+'|'+r.invoice;if(!m.has(k))m.set(k,{...r,revenue:0,industries:new Set(),countries:new Set(),groups:new Set(),types:new Set()});const x=m.get(k);x.revenue+=Number(r.revenue)||0;if(r.industry)x.industries.add(r.industry);if(r.country)x.countries.add(r.country);if(r.group)x.groups.add(r.group);if(r.type)x.types.add(r.type)});
  const a=[...m.values()].sort((x,y)=>y.date.localeCompare(x.date));
  $('invoicesView').innerHTML=`
    <div class="ri-import-card card">
      <div class="ri-import-copy">
        <div class="eyebrow">Quarterly revenue input</div>
        <h3>Nieuw kwartaal toevoegen</h3>
        <p>Upload één Excel- of CSV-bestand met de nieuwe factuurregels. Bij Excel gebruikt de app automatisch tabblad <strong>Combined</strong>. Bestaande regels worden via de dubbele-importcontrole overgeslagen.</p>
        <div class="ri-source-note"><strong>Omzetbron:</strong> uitsluitend <code>Revenue (EUR)</code>. De kolom <code>Revenue incl VAT (EUR)</code> wordt niet gebruikt in omzetberekeningen.</div>
        <div class="ri-import-stats"><span><strong>${state.rows.length}</strong> factuurregels lokaal</span><span><strong>${riLatestQuarter()}</strong> laatste kwartaal</span></div>
      </div>
      <div id="riQuarterDropzone" class="ri-dropzone">
        <strong>Sleep kwartaalbestand hierheen</strong>
        <span>Excel (.xlsx) of CSV</span>
        <div class="ri-actions"><button id="riChooseQuarter" type="button">Bestand kiezen</button><button id="riDownloadTemplate" type="button" class="secondary">CSV-template</button></div>
      </div>
    </div>
    <div class="ri-multiuser-note callout warning"><strong>Testfase:</strong> deze statische versie bewaart de import in de browser van degene die hem uploadt. Een collega kan dit invoerscherm dus gebruiken, maar zijn/haar data wordt nog niet automatisch met jouw browser gedeeld. Voor echte gedeelde kwartaalinvoer is de geplande centrale multi-user database nodig.</div>
    <div class="card">
      <div class="ri-table-head"><div><h3>Factuuroverzicht</h3><p class="hint">De tabel volgt de actieve filters. Industry en Country zijn toegevoegd voor controle en classificatie.</p></div><span>${a.length} facturen</span></div>
      <div class="table-wrap"><table><thead><tr><th>Datum</th><th>Bedrijf</th><th>Factuur</th><th>Klant</th><th>Omzet (EUR)</th><th>Industry</th><th>Country</th><th>Productgroep</th><th>Producttype</th></tr></thead><tbody>${a.slice(0,1000).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.company)}</td><td>${esc(r.invoice)}</td><td>${esc(r.customer||r.account)}</td><td class="num">${eur(r.revenue)}</td><td>${esc([...r.industries].join(', '))}</td><td>${esc([...r.countries].join(', '))}</td><td>${esc([...r.groups].join(', '))}</td><td>${esc([...r.types].join(', '))}</td></tr>`).join('')}</tbody></table></div>
    </div>`;
  riBindImport();
};
