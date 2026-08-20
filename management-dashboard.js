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
function mgmtEquivalentDate(date,year){
  const [,m,d]=(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/)||[];
  if(!m||!d)return'';
  if(m==='02'&&d==='29'){const leap=(year%4===0&&year%100!==0)||year%400===0;return `${year}-02-${leap?'29':'28'}`}
  return `${year}-${m}-${d}`;
}
function mgmtDateMs(date){const [y,m,d]=(date||'').split('-').map(Number);return Date.UTC(y,m-1,d)}
function mgmtDayDiff(start,end){return Math.max(0,Math.round((mgmtDateMs(end)-mgmtDateMs(start))/86400000))}
function mgmtAddDays(start,days){const dt=new Date(mgmtDateMs(start)+Number(days)*86400000);return dt.toISOString().slice(0,10)}
function mgmtFormatDate(date){if(!date)return'';return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))}
function mgmtGroupColor(group){
  const b=window.DropboardBrand||{teal:'#13adb6',deepTeal:'#0b4447',grey:'#949797',dark:'#343941',lightGrey:'#d6d7d9'};
  const g=String(group||'').trim().toLowerCase();
  if(!g||g==='onbekend'||g==='unknown')return b.lightGrey||'#d6d7d9';
  if(g.includes('dropboard'))return b.teal||'#13adb6';
  if(g.includes('scenario navigator')||g==='scenario'||g.includes('navigator'))return b.deepTeal||'#0b4447';
  if(g.includes('simulation')||g.includes('simio')||g.includes('arena')||g.includes('consult'))return b.dark||'#343941';
  if(g.includes('other')||g.includes('overig'))return b.grey||'#949797';
  return b.grey||'#949797';
}
function mgmtTypeColor(type){
  const b=window.DropboardBrand||{teal:'#13adb6',deepTeal:'#0b4447',coral:'#e25e59',grey:'#949797',dark:'#343941',lightGrey:'#d6d7d9'};
  const t=String(type||'').trim().toLowerCase();
  if(!t||t==='onbekend'||t==='unknown')return b.lightGrey||'#d6d7d9';
  if(t.includes('saas'))return b.teal||'#13adb6';
  if(t.includes('maintenance')||t.includes('support'))return b.deepTeal||'#0b4447';
  if(t.includes('config')||t.includes('implement'))return b.dark||'#343941';
  if(t.includes('consult')||t.includes('service'))return b.grey||'#949797';
  if(t.includes('develop')||t.includes('license')||t.includes('software'))return b.coral||'#e25e59';
  return b.lightGrey||'#d6d7d9';
}
function mgmtCustomerMix(rows){
  const totals=new Map(),mix=new Map();
  for(const r of rows){
    const customer=mgmtCustomer(r),group=clean(r.group)||'Onbekend',value=Number(r.revenue)||0;
    totals.set(customer,(totals.get(customer)||0)+value);
    if(!mix.has(customer))mix.set(customer,new Map());
    const gm=mix.get(customer);gm.set(group,(gm.get(group)||0)+value);
  }
  return [...totals.entries()].filter(([,value])=>value>0).map(([customer,value])=>{
    const groups=[...mix.get(customer).entries()].sort((a,b)=>b[1]-a[1]);
    return{customer,value,group:groups[0]?.[0]||'Onbekend'};
  }).sort((a,b)=>b.value-a.value);
}
function mgmtGroupTypeMix(rows){
  const groups=new Map(),typeTotals=new Map();
  for(const r of rows){
    const group=clean(r.group)||'Onbekend',type=clean(r.type)||'Onbekend',value=Number(r.revenue)||0;
    if(!groups.has(group))groups.set(group,new Map());
    const gm=groups.get(group);gm.set(type,(gm.get(type)||0)+value);
    typeTotals.set(type,(typeTotals.get(type)||0)+value);
  }
  return{groups,typeTotals};
}
let mgmtRangeState=null;
function mgmtResolveRange(year,lastAvailable){
  const min=`${year}-01-01`;
  if(!mgmtRangeState||mgmtRangeState.year!==year){mgmtRangeState={year,min,max:lastAvailable,start:min,end:lastAvailable};return mgmtRangeState}
  const wasAtMax=mgmtRangeState.end===mgmtRangeState.max;
  mgmtRangeState.min=min;mgmtRangeState.max=lastAvailable;
  if(mgmtRangeState.start<min)mgmtRangeState.start=min;
  if(mgmtRangeState.start>lastAvailable)mgmtRangeState.start=lastAvailable;
  if(wasAtMax||mgmtRangeState.end>lastAvailable)mgmtRangeState.end=lastAvailable;
  if(mgmtRangeState.end<mgmtRangeState.start)mgmtRangeState.end=mgmtRangeState.start;
  return mgmtRangeState;
}
function mgmtRangeMarkup(range){
  const maxDays=Math.max(1,mgmtDayDiff(range.min,range.max)),startValue=mgmtDayDiff(range.min,range.start),endValue=mgmtDayDiff(range.min,range.end);
  const left=(startValue/maxDays)*100,right=(endValue/maxDays)*100;
  return `<div class="mgmt-date-range card">
    <div class="mgmt-range-head"><div><div class="eyebrow">Date range</div><h3>Analyseperiode</h3><p>Standaard staat deze op het huidige jaar tot en met de laatst beschikbare omzetdatum.</p></div><div class="mgmt-range-actions"><strong id="mgmtRangeLabel">${esc(mgmtFormatDate(range.start))} – ${esc(mgmtFormatDate(range.end))}</strong><button id="mgmtRangeReset" class="secondary" type="button">Dit jaar</button></div></div>
    <div class="mgmt-range-control" style="--range-left:${left}%;--range-right:${right}%">
      <div class="mgmt-range-track"></div><div class="mgmt-range-fill"></div>
      <input id="mgmtRangeStart" class="mgmt-range-input mgmt-range-start" type="range" min="0" max="${maxDays}" value="${startValue}" aria-label="Startdatum">
      <input id="mgmtRangeEnd" class="mgmt-range-input mgmt-range-end" type="range" min="0" max="${maxDays}" value="${endValue}" aria-label="Einddatum">
    </div>
    <div class="mgmt-range-ends"><span>${esc(mgmtFormatDate(range.min))}</span><span>${esc(mgmtFormatDate(range.max))}</span></div>
  </div>`;
}
function mgmtBindRange(range){
  const start=$('mgmtRangeStart'),end=$('mgmtRangeEnd'),label=$('mgmtRangeLabel'),control=document.querySelector('.mgmt-range-control'),reset=$('mgmtRangeReset');
  if(!start||!end||!control)return;
  const max=Number(start.max)||1;
  const sync=(source)=>{
    let sv=Number(start.value),ev=Number(end.value);
    if(sv>ev){if(source===start){ev=sv;end.value=String(ev)}else{sv=ev;start.value=String(sv)}}
    mgmtRangeState.start=mgmtAddDays(range.min,sv);mgmtRangeState.end=mgmtAddDays(range.min,ev);
    control.style.setProperty('--range-left',`${(sv/max)*100}%`);control.style.setProperty('--range-right',`${(ev/max)*100}%`);
    if(label)label.textContent=`${mgmtFormatDate(mgmtRangeState.start)} – ${mgmtFormatDate(mgmtRangeState.end)}`;
  };
  start.oninput=()=>sync(start);end.oninput=()=>sync(end);
  start.onchange=()=>{sync(start);mgmtRender()};end.onchange=()=>{sync(end);mgmtRender()};
  if(reset)reset.onclick=()=>{mgmtRangeState.start=range.min;mgmtRangeState.end=range.max;mgmtRender()};
}
function mgmtRender(){
  const base=mgmtBaseRows(),year=mgmtYear(base),yearRows=base.filter(r=>(r.date||'').startsWith(String(year))),availableDates=yearRows.map(r=>r.date).filter(Boolean).sort();
  document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));
  $('emptyState').classList.add('hidden');$('filterShell').classList.remove('hidden');$('filterShell').classList.add('mgmt-mode');$('quickImport').classList.remove('hidden');$('exportFiltered').classList.remove('hidden');
  $('pageTitle').textContent='Management dashboard';$('pageSubtitle').textContent='Omzetgroei, klanten en productmix voor de gekozen periode.';
  const root=$('managementDashboardView');root.classList.remove('hidden');
  if(!availableDates.length){root.innerHTML='<div class="card">Geen omzetdata beschikbaar voor het meest recente jaar binnen de gekozen filters.</div>';return}

  const lastAvailable=availableDates.at(-1),range=mgmtResolveRange(year,lastAvailable),startDate=range.start,endDate=range.end,previousYear=year-1;
  const previousStart=mgmtEquivalentDate(startDate,previousYear),previousEnd=mgmtEquivalentDate(endDate,previousYear);
  const current=yearRows.filter(r=>r.date>=startDate&&r.date<=endDate),previous=base.filter(r=>(r.date||'').startsWith(String(previousYear))&&r.date>=previousStart&&r.date<=previousEnd);
  const isYtd=startDate===`${year}-01-01`&&endDate===lastAvailable,periodText=isYtd?`${year} YTD`:`${mgmtFormatDate(startDate)} – ${mgmtFormatDate(endDate)}`;
  const prevPeriodText=`${mgmtFormatDate(previousStart)} – ${mgmtFormatDate(previousEnd)}`;
  const curRev=mgmtRevenue(current),prevRev=mgmtRevenue(previous),growth=mgmtGrowth(curRev,prevRev);
  const customers=mgmtAggregate(current,mgmtCustomer),productGroups=mgmtAggregate(current,r=>clean(r.group)||'Onbekend'),previousGroups=mgmtAggregate(previous,r=>clean(r.group)||'Onbekend');
  const customerMix=mgmtCustomerMix(current),products=[...productGroups.entries()].sort((a,b)=>b[1]-a[1]),groupTypeMix=mgmtGroupTypeMix(current);
  const avgCustomer=customers.size?curRev/customers.size:0,topProduct=products[0]||['–',0];
  const groupColors=new Map(products.map(([name])=>[name,mgmtGroupColor(name)]));
  const legendGroups=[...new Set(customerMix.map(x=>x.group))].sort((a,b)=>(productGroups.get(b)||0)-(productGroups.get(a)||0));

  root.innerHTML=`
    ${mgmtRangeMarkup(range)}
    <div class="mgmt-hero card">
      <div><div class="eyebrow">Actual revenue</div><h2>${isYtd?`${year} performance`:'Selected period'}</h2><p>Gerealiseerde omzet van <strong>${esc(mgmtFormatDate(startDate))}</strong> t/m <strong>${esc(mgmtFormatDate(endDate))}</strong>, vergeleken met ${esc(prevPeriodText)}.</p></div>
      <div class="mgmt-period-badge">${esc(periodText)}</div>
    </div>
    <div class="grid mgmt-metrics">
      <div class="metric"><div class="label">Omzet ${isYtd?`${year} YTD`:'geselecteerde periode'}</div><div class="value">${eur(curRev)}</div><div class="sub">${eur(prevRev)} in vergelijkbare periode ${previousYear}</div></div>
      <div class="metric"><div class="label">YoY omzetgroei</div><div class="value ${growth==null?'':growth>=0?'kpi-positive':'kpi-negative'}">${growth==null?'–':mgmtPercent(growth)}</div><div class="sub">Op identieke kalenderperiode</div></div>
      <div class="metric"><div class="label">Klanten met omzet</div><div class="value">${customers.size}</div><div class="sub">Gemiddeld ${eur(avgCustomer)} per klant</div></div>
      <div class="metric"><div class="label">Grootste productgroep</div><div class="value" style="font-size:19px">${esc(topProduct[0])}</div><div class="sub">${eur(topProduct[1])} · ${curRev?mgmtPercent(topProduct[1]/curRev):'–'} van omzet</div></div>
    </div>

    <div class="card">
      <div class="mgmt-card-head"><div><h3>Omzet per kwartaal · ${year} versus ${previousYear}</h3><p>Alleen het deel van ieder kwartaal dat binnen de gekozen date range valt wordt meegenomen.</p></div><span class="mgmt-yoy ${growth==null?'':growth>=0?'kpi-positive':'kpi-negative'}">YoY ${growth==null?'–':mgmtPercent(growth)}</span></div>
      <div id="mgmtQuarterChart" class="mgmt-quarter-chart"></div>
    </div>
    <div class="spacer"></div>

    <div class="mgmt-grid">
      <div class="card">
        <div class="mgmt-card-head"><div><h3>Omzet per klant · ${esc(periodText)}</h3><p>De oppervlakte geeft de klantomzet weer; de kleur geeft de grootste productgroep van die klant aan.</p></div></div>
        <div id="mgmtCustomerTreemap" class="mgmt-treemap"></div>
        <div class="mgmt-product-legend">${legendGroups.map(group=>`<span><i style="background:${groupColors.get(group)||'#949797'}"></i>${esc(group)}</span>`).join('')}</div>
        ${[...customers.values()].some(v=>v<=0)?'<div class="mgmt-note">Klanten met een netto omzet van €0 of lager worden niet in de treemap weergegeven.</div>':''}
      </div>
      <div class="card">
        <div class="mgmt-card-head"><div><h3>Productgroepen & producttypes · ${esc(periodText)}</h3><p>Elke balk is een productgroep; de gestapelde segmenten tonen uit welke producttypes de omzet bestaat.</p></div></div>
        <div id="mgmtProductTypeChart" class="mgmt-product-type-chart"></div>
      </div>
    </div>`;

  mgmtBindRange(range);

  const selectedQs=mgmtSelected('filterQuarter'),allQs=['Q1','Q2','Q3','Q4'],startQ=Number(mgmtQuarter(startDate).slice(1)),endQ=Number(mgmtQuarter(endDate).slice(1));
  const quarters=(selectedQs.length?selectedQs:allQs).filter(q=>{const n=Number(q.slice(1));return n>=startQ&&n<=endQ}).sort();
  const quarterCurrent=quarters.map(q=>mgmtRevenue(current.filter(r=>mgmtQuarter(r.date)===q))),quarterPrevious=quarters.map(q=>mgmtRevenue(previous.filter(r=>mgmtQuarter(r.date)===q)));
  Plotly.newPlot('mgmtQuarterChart',[
    {type:'bar',name:String(previousYear),x:quarters,y:quarterPrevious,text:quarterPrevious.map(v=>v?eur(v):''),texttemplate:'%{text}',textposition:'inside',insidetextanchor:'middle',textfont:{size:11},hovertemplate:`${previousYear} %{x}<br>€%{y:,.0f}<extra></extra>`},
    {type:'bar',name:String(year),x:quarters,y:quarterCurrent,text:quarterCurrent.map(v=>v?eur(v):''),texttemplate:'%{text}',textposition:'inside',insidetextanchor:'middle',textfont:{size:11},hovertemplate:`${year} %{x}<br>€%{y:,.0f}<extra></extra>`}
  ],{barmode:'group',height:350,margin:{l:65,r:20,t:12,b:50},paper_bgcolor:'transparent',plot_bgcolor:'transparent',legend:{orientation:'h',y:-.13},uniformtext:{mode:'hide',minsize:9},xaxis:{type:'category'},yaxis:{tickprefix:'€',tickformat:'~s',zeroline:false}},{displayModeBar:false,responsive:true});

  if(customerMix.length){
    Plotly.newPlot('mgmtCustomerTreemap',[{type:'treemap',labels:customerMix.map(x=>x.customer),parents:customerMix.map(()=>''),values:customerMix.map(x=>x.value),marker:{colors:customerMix.map(x=>groupColors.get(x.group)||'#949797')},customdata:customerMix.map(x=>x.group),textinfo:'label+value+percent root',texttemplate:'<b>%{label}</b><br>€%{value:,.0f}<br>%{percentRoot:.1%}',hovertemplate:'%{label}<br>Productgroep: %{customdata}<br>Omzet: €%{value:,.0f}<br>Aandeel: %{percentRoot:.1%}<extra></extra>',branchvalues:'total'}],{height:490,margin:{l:4,r:4,t:4,b:4},paper_bgcolor:'transparent'},{displayModeBar:false,responsive:true});
  }else $('mgmtCustomerTreemap').innerHTML='<div class="muted">Geen positieve klantomzet voor deze selectie.</div>';

  const groupNames=products.map(([name])=>name),typeNames=[...groupTypeMix.typeTotals.entries()].filter(([,v])=>v!==0).sort((a,b)=>b[1]-a[1]).map(([name])=>name);
  if(groupNames.length&&typeNames.length){
    const traces=typeNames.map(type=>({type:'bar',orientation:'h',name:type,y:groupNames,x:groupNames.map(group=>groupTypeMix.groups.get(group)?.get(type)||0),marker:{color:mgmtTypeColor(type)},hovertemplate:`<b>%{y}</b><br>${esc(type)}: €%{x:,.0f}<extra></extra>`}));
    const maxTotal=Math.max(...products.map(([,v])=>Math.max(0,v)),1);
    const annotations=products.map(([group,value])=>{const prior=previousGroups.get(group)||0,delta=mgmtGrowth(value,prior);return{x:Math.max(0,value)+maxTotal*.02,y:group,text:`${eur(value)}${delta==null?'':` · ${delta>=0?'+':''}${mgmtPercent(delta)} YoY`}`,showarrow:false,xanchor:'left',font:{size:10,color:delta==null?'#777c80':delta>=0?'#0b4447':'#e25e59'}}});
    Plotly.newPlot('mgmtProductTypeChart',traces,{barmode:'stack',height:Math.max(330,groupNames.length*48+120),margin:{l:120,r:125,t:10,b:80},paper_bgcolor:'transparent',plot_bgcolor:'transparent',legend:{orientation:'h',y:-.18,x:0},xaxis:{tickprefix:'€',tickformat:'~s',range:[0,maxTotal*1.28],zeroline:false},yaxis:{autorange:'reversed'},annotations},{displayModeBar:false,responsive:true});
  }else $('mgmtProductTypeChart').innerHTML='<div class="muted">Geen productgroep- of producttypedata voor deze selectie.</div>';
}

const mgmtBaseRender=render;
render=function(){
  if(view==='managementDashboard')return mgmtRender();
  $('filterShell')?.classList.remove('mgmt-mode');
  return mgmtBaseRender();
};
