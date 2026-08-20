function mgmtSelected(id){const e=$(id);return e?[...e.selectedOptions].map(o=>o.value):[]}
function mgmtQuarter(date){const m=Number((date||'').slice(5,7));return m?`Q${Math.ceil(m/3)}`:''}
function mgmtRevenue(rows){return rows.reduce((s,r)=>s+(Number(r.revenue)||0),0)}
function mgmtPercent(v){return Number.isFinite(v)?new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(v):'–'}
function mgmtGrowth(current,previous){return previous?((current-previous)/Math.abs(previous)):null}
function mgmtCustomer(r){return clean(r.customer||r.account||'Onbekend')||'Onbekend'}
function mgmtBaseRows(){
  const f=filters(),quarters=mgmtSelected('filterQuarter');
  return state.rows.filter(r=>{
    for(const k of ['company','customer','account','industry','group','type','country','supplier'])if(f[k]?.length&&!f[k].includes(r[k]))return false;
    if(quarters.length&&!quarters.includes(clean(r.quarter)||mgmtQuarter(r.date)))return false;
    if(f.q&&!`${r.customer} ${r.account} ${r.invoice} ${r.description}`.toLowerCase().includes(f.q))return false;
    return true;
  });
}
function mgmtAggregate(rows,keyFn){const m=new Map();for(const r of rows){const k=keyFn(r)||'Onbekend';m.set(k,(m.get(k)||0)+(Number(r.revenue)||0))}return m}
function mgmtYear(base){
  const years=[...new Set(base.map(r=>Number((r.date||'').slice(0,4))).filter(Boolean))].sort((a,b)=>a-b);
  const calendar=new Date().getFullYear();return years.includes(calendar)?calendar:(years.at(-1)||calendar);
}
function mgmtEquivalentDate(date,year){return `${year}-${date.slice(5)}`}
function mgmtQuarterRows(base,year,q,cutoff,currentQ){
  return base.filter(r=>{
    if(Number((r.date||'').slice(0,4))!==year||mgmtQuarter(r.date)!==q)return false;
    if(q===currentQ&&cutoff&&r.date>cutoff)return false;
    return true;
  });
}
function mgmtRender(){
  const base=mgmtBaseRows(),year=mgmtYear(base),currentRowsAll=base.filter(r=>(r.date||'').startsWith(String(year))),dates=currentRowsAll.map(r=>r.date).filter(Boolean).sort();
  document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));
  $('emptyState').classList.add('hidden');$('filterShell').classList.remove('hidden');$('filterShell').classList.add('mgmt-mode');$('quickImport').classList.remove('hidden');$('exportFiltered').classList.remove('hidden');
  $('pageTitle').textContent='Management dashboard';$('pageSubtitle').textContent='Dit jaar in één oogopslag: omzetgroei, klanten en productmix.';
  const root=$('managementDashboardView');root.classList.remove('hidden');
  if(!dates.length){root.innerHTML='<div class="card">Geen omzetdata beschikbaar voor het meest recente jaar binnen de gekozen filters.</div>';return}

  const lastDate=dates.at(-1),previousYear=year-1,priorCutoff=mgmtEquivalentDate(lastDate,previousYear),currentQ=mgmtQuarter(lastDate),currentQNo=Number(currentQ.slice(1));
  const selectedQs=mgmtSelected('filterQuarter');
  const quarters=(selectedQs.length?selectedQs:['Q1','Q2','Q3','Q4']).filter(q=>Number(q.slice(1))<=currentQNo).sort();
  const current=currentRowsAll.filter(r=>r.date<=lastDate),previous=base.filter(r=>(r.date||'').startsWith(String(previousYear))&&r.date<=priorCutoff);
  const curRev=mgmtRevenue(current),prevRev=mgmtRevenue(previous),growth=mgmtGrowth(curRev,prevRev);
  const customers=mgmtAggregate(current,mgmtCustomer),productGroups=mgmtAggregate(current,r=>clean(r.group)||'Onbekend'),previousGroups=mgmtAggregate(previous,r=>clean(r.group)||'Onbekend');
  const positiveCustomers=[...customers.entries()].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]),products=[...productGroups.entries()].sort((a,b)=>b[1]-a[1]);
  const avgCustomer=customers.size?curRev/customers.size:0,topProduct=products[0]||['–',0];

  root.innerHTML=`
    <div class="mgmt-hero card">
      <div><div class="eyebrow">Actual revenue</div><h2>${year} performance</h2><p>Gerealiseerde omzet t/m <strong>${esc(lastDate)}</strong>, vergeleken met dezelfde periode in ${previousYear}.</p></div>
      <div class="mgmt-period-badge">${year} YTD · t/m ${esc(lastDate.slice(5))}</div>
    </div>
    <div class="grid mgmt-metrics">
      <div class="metric"><div class="label">Omzet ${year} YTD</div><div class="value">${eur(curRev)}</div><div class="sub">${eur(prevRev)} in dezelfde periode ${previousYear}</div></div>
      <div class="metric"><div class="label">YoY omzetgroei</div><div class="value ${growth==null?'':growth>=0?'kpi-positive':'kpi-negative'}">${growth==null?'–':mgmtPercent(growth)}</div><div class="sub">Op identieke kalenderperiode</div></div>
      <div class="metric"><div class="label">Klanten met omzet</div><div class="value">${customers.size}</div><div class="sub">Gemiddeld ${eur(avgCustomer)} per klant</div></div>
      <div class="metric"><div class="label">Grootste productgroep</div><div class="value" style="font-size:19px">${esc(topProduct[0])}</div><div class="sub">${eur(topProduct[1])} · ${curRev?mgmtPercent(topProduct[1]/curRev):'–'} van omzet</div></div>
    </div>

    <div class="card">
      <div class="mgmt-card-head"><div><h3>Omzet per kwartaal · ${year} versus ${previousYear}</h3><p>Voor het lopende kwartaal wordt dezelfde kalenderperiode van vorig jaar gebruikt.</p></div><span class="mgmt-yoy ${growth==null?'':growth>=0?'kpi-positive':'kpi-negative'}">YTD ${growth==null?'–':mgmtPercent(growth)}</span></div>
      <div id="mgmtQuarterChart" class="mgmt-quarter-chart"></div>
    </div>
    <div class="spacer"></div>

    <div class="mgmt-grid">
      <div class="card">
        <div class="mgmt-card-head"><div><h3>Omzet per klant · ${year} YTD</h3><p>De oppervlakte van ieder vlak is evenredig aan de gerealiseerde omzet van de klant.</p></div></div>
        <div id="mgmtCustomerTreemap" class="mgmt-treemap"></div>
        ${[...customers.values()].some(v=>v<=0)?'<div class="mgmt-note">Klanten met een netto omzet van €0 of lager worden niet in de treemap weergegeven.</div>':''}
      </div>
      <div class="card">
        <div class="mgmt-card-head"><div><h3>Productgroepen · ${year} YTD</h3><p>Omzet, aandeel en verandering ten opzichte van dezelfde periode vorig jaar.</p></div></div>
        <div class="mgmt-product-list">${products.map(([name,value])=>{const prior=previousGroups.get(name)||0,delta=mgmtGrowth(value,prior),share=curRev?value/curRev:0,max=products[0]?.[1]||1;return`<div class="mgmt-product-row"><div><strong>${esc(name)}</strong><div class="bar-bg"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,(value/max)*100))}%"></div></div></div><div class="product-values"><b>${eur(value)}</b><span>${mgmtPercent(share)} van omzet</span></div><div class="${delta==null?'muted':delta>=0?'kpi-positive':'kpi-negative'}">${delta==null?'nieuw':(delta>=0?'+':'')+mgmtPercent(delta)}</div></div>`}).join('')||'<div class="muted">Geen productgroepdata.</div>'}</div>
      </div>
    </div>`;

  const quarterCurrent=[],quarterPrevious=[];
  for(const q of quarters){
    const isCurrent=q===currentQ,cutCurrent=isCurrent?lastDate:null,cutPrevious=isCurrent?priorCutoff:null;
    quarterCurrent.push(mgmtRevenue(mgmtQuarterRows(base,year,q,cutCurrent,currentQ)));
    quarterPrevious.push(mgmtRevenue(mgmtQuarterRows(base,previousYear,q,cutPrevious,currentQ)));
  }
  Plotly.newPlot('mgmtQuarterChart',[
    {type:'bar',name:String(previousYear),x:quarters,y:quarterPrevious,hovertemplate:`${previousYear} %{x}<br>€%{y:,.0f}<extra></extra>`},
    {type:'bar',name:String(year),x:quarters,y:quarterCurrent,hovertemplate:`${year} %{x}<br>€%{y:,.0f}<extra></extra>`}
  ],{barmode:'group',height:350,margin:{l:65,r:20,t:12,b:50},paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Inter,system-ui,sans-serif',color:'#445066'},legend:{orientation:'h',y:-.13},xaxis:{type:'category',gridcolor:'#edf0f5'},yaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f5',zeroline:false}},{displayModeBar:false,responsive:true});

  if(positiveCustomers.length){
    Plotly.newPlot('mgmtCustomerTreemap',[{type:'treemap',labels:positiveCustomers.map(x=>x[0]),parents:positiveCustomers.map(()=>''),values:positiveCustomers.map(x=>x[1]),textinfo:'label+value+percent root',texttemplate:'<b>%{label}</b><br>€%{value:,.0f}<br>%{percentRoot:.1%}',hovertemplate:'%{label}<br>Omzet: €%{value:,.0f}<br>Aandeel: %{percentRoot:.1%}<extra></extra>',branchvalues:'total'}],{height:490,margin:{l:4,r:4,t:4,b:4},paper_bgcolor:'transparent'},{displayModeBar:false,responsive:true});
  }else $('mgmtCustomerTreemap').innerHTML='<div class="muted">Geen positieve klantomzet voor deze selectie.</div>';
}

const mgmtBaseRender=render;
render=function(){
  if(view==='managementDashboard')return mgmtRender();
  $('filterShell')?.classList.remove('mgmt-mode');
  return mgmtBaseRender();
};
