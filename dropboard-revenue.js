(function(){
  const baseRenderForDropboard=render;
  const brand=window.DropboardBrand||{teal:'#13adb6',deepTeal:'#0b4447',coral:'#e25e59',grey:'#949797',dark:'#343941',lightGrey:'#d6d7d9'};

  function selected(id){const e=$(id);return e?[...e.selectedOptions].map(o=>o.value):[]}
  function quarter(date){const m=Number((date||'').slice(5,7));return m?`Q${Math.ceil(m/3)}`:''}
  function revenue(rows){return rows.reduce((sum,r)=>sum+(Number(r.revenue)||0),0)}
  function percent(v){return Number.isFinite(v)?new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(v):'–'}
  function growth(current,previous){return previous?((current-previous)/Math.abs(previous)):null}
  function customer(r){return clean(r.customer||r.account||'Onbekend')||'Onbekend'}
  function shiftYear(date,offset){if(!date)return'';const d=new Date(`${date}T12:00:00Z`),m=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()+offset);if(d.getUTCMonth()!==m)d.setUTCDate(0);return d.toISOString().slice(0,10)}
  function typeColor(type){
    const t=String(type||'').trim().toLowerCase();
    if(!t||t==='onbekend'||t==='unknown')return brand.lightGrey;
    if(t.includes('saas'))return brand.teal;
    if(t.includes('maintenance')||t.includes('support'))return brand.deepTeal;
    if(t.includes('config')||t.includes('implement'))return brand.dark;
    if(t.includes('consult')||t.includes('service'))return brand.grey;
    if(t.includes('develop')||t.includes('license')||t.includes('software'))return brand.coral;
    return brand.lightGrey;
  }
  function dimensionColor(i){return [brand.teal,brand.deepTeal,brand.dark,brand.grey,brand.coral,brand.lightGrey][i%6]}

  function dropboardBaseRows(){
    const f=filters(),quarters=selected('filterQuarter');
    return state.rows.filter(r=>{
      if(!/dropboard/i.test(clean(r.group)))return false;
      for(const k of ['company','customer','account','industry','type','country','supplier'])if(f[k]?.length&&!f[k].includes(r[k]))return false;
      if(quarters.length&&!quarters.includes(clean(r.quarter)||quarter(r.date)))return false;
      if(f.q&&!`${r.customer} ${r.account} ${r.invoice} ${r.description}`.toLowerCase().includes(f.q))return false;
      return true;
    });
  }

  function focusPeriod(base){
    const dates=base.map(r=>r.date).filter(Boolean).sort();
    if(!dates.length)return null;
    let start=$('filterStart')?.value||'',end=$('filterEnd')?.value||'';
    const preset=$('filterPreset')?.value||'all';
    const spansYears=start&&end&&start.slice(0,4)!==end.slice(0,4);
    if(preset==='all'||!start||!end||spansYears){
      const max=dates.at(-1),year=max.slice(0,4);start=`${year}-01-01`;end=max;
      return{start,end,label:end.endsWith('-12-31')?year:`${year} YTD`};
    }
    return{start,end,label:`${start} – ${end}`};
  }

  function aggregate(rows,keyFn){const m=new Map();for(const r of rows){const k=keyFn(r)||'Onbekend';m.set(k,(m.get(k)||0)+(Number(r.revenue)||0))}return [...m.entries()].sort((a,b)=>b[1]-a[1])}
  function positiveCustomers(rows){return aggregate(rows,customer).filter(([,v])=>v>0)}
  function plotBase(height=350){return{height,margin:{l:65,r:20,t:15,b:55},paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Muli, Mulish, Segoe UI, Arial, sans-serif',color:'#343941'},xaxis:{gridcolor:'#edf0f1',zeroline:false},yaxis:{gridcolor:'#edf0f1',zeroline:false}}}

  function renderBreakdown(rows,key){
    const chart=$('dropboardBreakdownChart');if(!chart||!window.Plotly)return;
    const keyFns={type:r=>clean(r.type)||'Onbekend',country:r=>clean(r.country)||'Onbekend',industry:r=>clean(r.industry)||'Onbekend',customer,company:r=>clean(r.company)||'Onbekend'};
    const data=aggregate(rows,keyFns[key]||keyFns.type).slice(0,15).reverse();
    const colors=data.map((d,i)=>key==='type'?typeColor(d[0]):dimensionColor(data.length-1-i));
    Plotly.newPlot(chart,[{type:'bar',orientation:'h',x:data.map(x=>x[1]),y:data.map(x=>x[0]),marker:{color:colors},text:data.map(x=>eur(x[1])),textposition:'auto',hovertemplate:'%{y}<br>€%{x:,.0f}<extra></extra>'}],{...plotBase(Math.max(360,data.length*31+85)),margin:{l:155,r:25,t:10,b:50},xaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false}},{displayModeBar:false,responsive:true});
  }

  function renderDashboard(){
    const base=dropboardBaseRows(),focus=focusPeriod(base),root=$('dropboardRevenueView');
    if(!root)return;
    if(!focus){root.innerHTML='<div class="card">Geen Dropboard-omzet beschikbaar binnen de gekozen filters.</div>';return}
    const current=base.filter(r=>r.date>=focus.start&&r.date<=focus.end),prevStart=shiftYear(focus.start,-1),prevEnd=shiftYear(focus.end,-1),previous=base.filter(r=>r.date>=prevStart&&r.date<=prevEnd);
    if(!current.length){root.innerHTML='<div class="card">Geen Dropboard-omzet beschikbaar voor deze periode.</div>';return}

    const total=revenue(current),prior=revenue(previous),yoy=growth(total,prior),recurring=revenue(current.filter(r=>/saas|maintenance/i.test(clean(r.type)))),customers=positiveCustomers(current),previousCustomers=positiveCustomers(previous),countries=new Set(current.map(r=>clean(r.country)).filter(Boolean));
    const types=aggregate(current,r=>clean(r.type)||'Onbekend'),topType=types[0]||['–',0];

    root.innerHTML=`
      <div class="dropboard-revenue-head card"><div><div class="eyebrow">Actual revenue · Dropboard</div><h2>Dropboard inkomsten</h2><p>Gerealiseerde Dropboard-omzet voor <strong>${esc(focus.label)}</strong>, met dezelfde filters als het hoofd-dashboard.</p></div><div class="dropboard-revenue-badge">Productgroep · Dropboard</div></div>
      <div class="grid dropboard-revenue-metrics">
        <div class="metric"><div class="label">Dropboard omzet</div><div class="value">${eur(total)}</div><div class="sub">${eur(prior)} in vergelijkbare periode vorig jaar</div></div>
        <div class="metric"><div class="label">YoY groei</div><div class="value ${yoy==null?'':yoy>=0?'kpi-positive':'kpi-negative'}">${yoy==null?'–':percent(yoy)}</div><div class="sub">Vergelijking op gelijke kalenderperiode</div></div>
        <div class="metric"><div class="label">Klanten met omzet</div><div class="value">${customers.length}</div><div class="sub">${previousCustomers.length} vorig jaar · ${countries.size} landen</div></div>
        <div class="metric"><div class="label">Recurring aandeel</div><div class="value">${total?percent(recurring/total):'–'}</div><div class="sub">SaaS + maintenance · ${eur(recurring)}</div></div>
      </div>

      <div class="card"><div class="dropboard-card-head"><div><h3>Dropboard omzet per kwartaal · producttype</h3><p>Gestapelde omzet per kwartaal, onderverdeeld naar Product Type.</p></div><span class="dropboard-top-type">Grootste type: <strong>${esc(topType[0])}</strong></span></div><div id="dropboardQuarterTypeChart" class="dropboard-main-chart"></div></div>
      <div class="spacer"></div>

      <div class="grid two dropboard-analysis-grid">
        <div class="card"><div class="dropboard-card-head"><div><h3>Omzet uitsplitsing</h3><p>Kies hoe je de Dropboard-omzet wilt analyseren.</p></div><select id="dropboardBreakdown" class="dropboard-breakdown-select"><option value="type">Product Type</option><option value="country">Country</option><option value="industry">Industry</option><option value="customer">Customer</option><option value="company">Company</option></select></div><div id="dropboardBreakdownChart"></div></div>
        <div class="card"><div class="dropboard-card-head"><div><h3>Top Dropboard-klanten</h3><p>Grootste klanten op gerealiseerde Dropboard-omzet.</p></div></div><div id="dropboardCustomerChart"></div></div>
      </div>
      <div class="spacer"></div>

      <div class="grid two dropboard-analysis-grid">
        <div class="card"><div class="dropboard-card-head"><div><h3>Omzet per land</h3><p>Geografische verdeling van gerealiseerde Dropboard-omzet.</p></div></div><div id="dropboardCountryChart"></div></div>
        <div class="card"><div class="dropboard-card-head"><div><h3>Producttype-overzicht</h3><p>Omzet en aandeel binnen Dropboard.</p></div></div><div class="dropboard-type-list">${types.map(([name,value])=>`<div class="dropboard-type-row"><span><i style="background:${typeColor(name)}"></i>${esc(name)}</span><strong>${eur(value)}</strong><small>${total?percent(value/total):'–'}</small></div>`).join('')}</div></div>
      </div>`;

    const qMap=new Map(),typeNames=types.map(([name])=>name);
    current.forEach(r=>{const key=`${(r.date||'').slice(0,4)} ${quarter(r.date)}`,type=clean(r.type)||'Onbekend';if(!qMap.has(key))qMap.set(key,new Map());const m=qMap.get(key);m.set(type,(m.get(type)||0)+(Number(r.revenue)||0))});
    const quarters=[...qMap.keys()].sort();
    const qTraces=typeNames.map(type=>({type:'bar',name:type,x:quarters,y:quarters.map(q=>qMap.get(q)?.get(type)||0),marker:{color:typeColor(type)},hovertemplate:`${esc(type)}<br>%{x}: €%{y:,.0f}<extra></extra>`}));
    Plotly.newPlot('dropboardQuarterTypeChart',qTraces,{...plotBase(390),barmode:'stack',legend:{orientation:'h',y:-.18},xaxis:{type:'category',gridcolor:'#edf0f1'},yaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false}},{displayModeBar:false,responsive:true});

    renderBreakdown(current,'type');
    $('dropboardBreakdown').onchange=e=>renderBreakdown(current,e.target.value);

    const topCustomers=customers.slice(0,12).reverse();
    Plotly.newPlot('dropboardCustomerChart',[{type:'bar',orientation:'h',x:topCustomers.map(x=>x[1]),y:topCustomers.map(x=>x[0]),marker:{color:brand.teal},text:topCustomers.map(x=>eur(x[1])),textposition:'auto',hovertemplate:'%{y}<br>€%{x:,.0f}<extra></extra>'}],{...plotBase(Math.max(360,topCustomers.length*31+85)),margin:{l:160,r:25,t:10,b:50},xaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1'}},{displayModeBar:false,responsive:true});

    const countryData=aggregate(current,r=>clean(r.country)||'Onbekend').slice(0,12).reverse();
    Plotly.newPlot('dropboardCountryChart',[{type:'bar',orientation:'h',x:countryData.map(x=>x[1]),y:countryData.map(x=>x[0]),marker:{color:countryData.map((x,i)=>dimensionColor(i))},text:countryData.map(x=>eur(x[1])),textposition:'auto',hovertemplate:'%{y}<br>€%{x:,.0f}<extra></extra>'}],{...plotBase(Math.max(340,countryData.length*31+85)),margin:{l:125,r:25,t:10,b:50},xaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1'}},{displayModeBar:false,responsive:true});
  }

  render=function(){
    if(view!=='dropboardRevenue')return baseRenderForDropboard();
    document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));
    if(!state.rows.length){$('emptyState').classList.remove('hidden');return}
    $('emptyState').classList.add('hidden');
    $('filterShell').classList.remove('hidden');$('filterShell').classList.remove('mgmt-mode');
    document.querySelector('.year-filter')?.classList.add('hidden');
    $('quickImport').classList.remove('hidden');$('exportFiltered').classList.remove('hidden');
    $('dropboardRevenueView').classList.remove('hidden');renderDashboard();
  };

  window.addEventListener('DOMContentLoaded',()=>{
    const button=document.querySelector('#mainNav button[data-view="dropboardRevenue"]');
    if(button)button.addEventListener('click',()=>{
      $('pageTitle').textContent='Dropboard revenue';
      $('pageSubtitle').textContent='Gerealiseerde Dropboard-omzet uitgesplitst naar producttype, klant, land en industrie.';
    });
  });
})();
