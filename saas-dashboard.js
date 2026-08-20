let saasMode='saas';

function saasCustomer(r){return clean(r.customer||r.account||'Onbekend')||'Onbekend'}
function saasTypeMatch(r){const t=clean(r.type).toLowerCase();return t==='saas'||(saasMode==='recurring'&&t==='maintenance')}
function selectedMulti(id){const e=$(id);return e?[...e.selectedOptions].map(o=>o.value):[]}
function inDateRange(r,start,end){return(!start||r.date>=start)&&(!end||r.date<=end)}
function shiftYear(value,offset){if(!value)return'';const d=new Date(value+'T12:00:00Z');const m=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()+offset);if(d.getUTCMonth()!==m)d.setUTCDate(0);return d.toISOString().slice(0,10)}
function pct(v){return Number.isFinite(v)?new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(v):'–'}
function deltaPct(current,previous){return previous?((current-previous)/Math.abs(previous)):null}

function saasBaseRows(){
  const f=filters();
  const quarters=selectedMulti('filterQuarter');
  return state.rows.filter(r=>{
    for(const k of ['company','customer','account','industry','group','country','supplier'])if(f[k]?.length&&!f[k].includes(r[k]))return false;
    if(quarters.length&&!quarters.includes(clean(r.quarter)))return false;
    if(f.q&&!`${r.customer} ${r.account} ${r.invoice} ${r.description}`.toLowerCase().includes(f.q))return false;
    return true;
  });
}

function saasFocus(base){
  let start=$('filterStart').value,end=$('filterEnd').value;
  const saasDates=base.filter(saasTypeMatch).map(r=>r.date).filter(Boolean).sort();
  if(!saasDates.length)return{start,end,label:'Geselecteerde periode'};
  const min=saasDates[0],max=saasDates[saasDates.length-1];
  const spansYears=start&&end&&start.slice(0,4)!==end.slice(0,4);
  const preset=$('filterPreset')?.value||'custom';
  if(preset==='all'||(!start&&!end)||spansYears){
    const y=max.slice(0,4);start=`${y}-01-01`;end=max;
    const full=end.endsWith('-12-31');
    return{start,end,label:full?y:`${y} YTD`};
  }
  return{start:start||min,end:end||max,label:`${start||min} – ${end||max}`};
}

function revenue(rows){return rows.reduce((s,r)=>s+(Number(r.revenue)||0),0)}
function customerRevenue(rows){const m=new Map();for(const r of rows){const k=saasCustomer(r);m.set(k,(m.get(k)||0)+(Number(r.revenue)||0))}return m}
function groupRevenue(rows,key){const m=new Map();for(const r of rows){const k=clean(r[key])||'Onbekend';m.set(k,(m.get(k)||0)+(Number(r.revenue)||0))}return [...m.entries()].sort((a,b)=>b[1]-a[1])}
function plotBase(height=340){return{margin:{l:60,r:20,t:18,b:55},height,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Inter,system-ui,sans-serif',color:'#445066'},xaxis:{gridcolor:'#edf0f5',zeroline:false},yaxis:{gridcolor:'#edf0f5',zeroline:false}}}

function saasCustomerMovements(current,previous){
  const c=customerRevenue(current),p=customerRevenue(previous),names=new Set([...c.keys(),...p.keys()]),out=[];
  for(const name of names){
    const cv=c.get(name)||0,pv=p.get(name)||0;let status='Bestaand';
    if(cv>0&&!pv)status='Nieuw';else if(!cv&&pv>0)status='Verloren';else if(pv&&cv>pv*1.05)status='Groei';else if(pv&&cv<pv*.95)status='Daling';
    out.push({name,current:cv,previous:pv,delta:cv-pv,status});
  }
  return out.sort((a,b)=>Math.max(b.current,b.previous)-Math.max(a.current,a.previous));
}

function saasDashboard(){
  const base=saasBaseRows();
  const focus=saasFocus(base);
  const prev={start:shiftYear(focus.start,-1),end:shiftYear(focus.end,-1)};
  const allRecurring=base.filter(saasTypeMatch);
  const current=allRecurring.filter(r=>inDateRange(r,focus.start,focus.end));
  const previous=allRecurring.filter(r=>inDateRange(r,prev.start,prev.end));
  const allCurrentRevenue=base.filter(r=>inDateRange(r,focus.start,focus.end)).reduce((s,r)=>s+(Number(r.revenue)||0),0);
  const curRev=revenue(current),prevRev=revenue(previous),growth=deltaPct(curRev,prevRev);
  const curCustomers=customerRevenue(current),prevCustomers=customerRevenue(previous);
  const top5=[...curCustomers.values()].sort((a,b)=>b-a).slice(0,5).reduce((a,b)=>a+b,0);
  const concentration=curRev?top5/curRev:null,share=allCurrentRevenue?curRev/allCurrentRevenue:null;
  const retained=[...prevCustomers.keys()].filter(k=>curCustomers.has(k)).length;
  const newCustomers=[...curCustomers.keys()].filter(k=>!prevCustomers.has(k)).length;
  const lostCustomers=[...prevCustomers.keys()].filter(k=>!curCustomers.has(k)).length;
  const logoRetention=prevCustomers.size?retained/prevCustomers.size:null;
  const modeTitle=saasMode==='saas'?'SaaS':'SaaS + Maintenance';

  $('saasView').innerHTML=`
    <div class="saas-head card">
      <div>
        <div class="eyebrow">Recurring revenue analyse</div>
        <h2>${modeTitle}</h2>
        <p>Focusperiode <strong>${esc(focus.label)}</strong> · vergelijking met ${esc(prev.start)} – ${esc(prev.end)}</p>
      </div>
      <div class="saas-mode" role="group" aria-label="SaaS omzetbasis">
        <button type="button" data-saas-mode="saas" class="${saasMode==='saas'?'active':''}">Alleen SaaS</button>
        <button type="button" data-saas-mode="recurring" class="${saasMode==='recurring'?'active':''}">+ Maintenance</button>
      </div>
    </div>

    <div class="grid saas-metrics">
      <div class="metric saas-metric"><div class="label">${modeTitle} omzet · ${esc(focus.label)}</div><div class="value">${eur(curRev)}</div><div class="sub">Vorige vergelijkbare periode: ${eur(prevRev)}</div></div>
      <div class="metric saas-metric"><div class="label">YoY groei</div><div class="value ${growth==null?'':growth>=0?'kpi-positive':'kpi-negative'}">${growth==null?'–':pct(growth)}</div><div class="sub">Vergelijking op gelijke kalenderperiode</div></div>
      <div class="metric saas-metric"><div class="label">SaaS klanten</div><div class="value">${curCustomers.size}</div><div class="sub">Gemiddeld ${eur(curCustomers.size?curRev/curCustomers.size:0)} per klant</div></div>
      <div class="metric saas-metric"><div class="label">Aandeel totale omzet</div><div class="value">${share==null?'–':pct(share)}</div><div class="sub">Binnen dezelfde filters en periode</div></div>
      <div class="metric saas-metric"><div class="label">Top-5 concentratie</div><div class="value">${concentration==null?'–':pct(concentration)}</div><div class="sub">Aandeel van de 5 grootste SaaS-klanten</div></div>
    </div>

    <div class="grid saas-retention">
      <div class="mini-kpi"><span>Logo retention</span><strong>${logoRetention==null?'–':pct(logoRetention)}</strong><small>${retained} van ${prevCustomers.size} klanten behouden</small></div>
      <div class="mini-kpi"><span>Nieuwe klanten</span><strong>${newCustomers}</strong><small>Niet aanwezig in vergelijkingsperiode</small></div>
      <div class="mini-kpi"><span>Verloren klanten</span><strong>${lostCustomers}</strong><small>Wel aanwezig in vergelijkingsperiode</small></div>
    </div>

    <div class="grid two saas-chart-grid">
      <div class="card"><h3>Recurring omzetontwikkeling</h3><p class="hint">Jaaromzet op basis van factuurregels; bij een geselecteerd kwartaal wordt hetzelfde kwartaal per jaar vergeleken.</p><div id="saasTrend" class="chart"></div></div>
      <div class="card"><h3>Productmix · ${esc(focus.label)}</h3><p class="hint">Verdeling van SaaS-omzet over productgroepen.</p><div id="saasMix" class="chart"></div></div>
    </div>
    <div class="spacer"></div>
    <div class="grid two saas-chart-grid">
      <div class="card"><h3>Top SaaS-klanten · ${esc(focus.label)}</h3><p class="hint">Grootste klanten op gerealiseerde recurring omzet.</p><div id="saasCustomers" class="chart tall"></div></div>
      <div class="card"><h3>Klantontwikkeling</h3><p class="hint">Omzetverandering ten opzichte van dezelfde periode een jaar eerder.</p><div class="table-wrap saas-table"><table><thead><tr><th>Klant</th><th>Status</th><th>Vorig</th><th>Huidig</th><th>Δ</th></tr></thead><tbody id="saasMovementRows"></tbody></table></div></div>
    </div>

    <div class="saas-definition callout"><strong>Waarom hier nog geen ARR/MRR staat:</strong> de huidige factuurdata bevat wel Product Type = SaaS, maar nog geen contractfrequentie, start/einddatum of annualisatie. Daardoor zouden ARR en MRR op basis van factuurmomenten misleidend kunnen zijn. Met die contractvelden kunnen we dit later zuiver toevoegen.</div>`;

  document.querySelectorAll('[data-saas-mode]').forEach(b=>b.onclick=()=>{saasMode=b.dataset.saasMode;saasDashboard()});

  const yearGroups=new Map();for(const r of allRecurring){const y=(r.date||'').slice(0,4);if(!y)continue;const g=clean(r.group)||'Onbekend';if(!yearGroups.has(g))yearGroups.set(g,new Map());const m=yearGroups.get(g);m.set(y,(m.get(y)||0)+(Number(r.revenue)||0))}
  const years=[...new Set(allRecurring.map(r=>(r.date||'').slice(0,4)).filter(Boolean))].sort();
  const traces=[...yearGroups.entries()].map(([g,m])=>({type:'bar',name:g,x:years,y:years.map(y=>m.get(y)||0),hovertemplate:`${esc(g)}<br>%{x}: €%{y:,.0f}<extra></extra>`}));
  Plotly.newPlot('saasTrend',traces,{...plotBase(350),barmode:'stack',legend:{orientation:'h',y:-.22},xaxis:{...plotBase().xaxis,type:'category'}},{displayModeBar:false,responsive:true});

  const mix=groupRevenue(current,'group');
  Plotly.newPlot('saasMix',[{type:'pie',labels:mix.map(x=>x[0]),values:mix.map(x=>x[1]),hole:.58,textinfo:'percent',hovertemplate:'%{label}<br>€%{value:,.0f}<br>%{percent}<extra></extra>'}],{height:350,margin:{l:15,r:15,t:15,b:15},paper_bgcolor:'transparent',showlegend:true,legend:{orientation:'h',y:-.08}},{displayModeBar:false,responsive:true});

  const top=[...curCustomers.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).reverse();
  Plotly.newPlot('saasCustomers',[{type:'bar',orientation:'h',x:top.map(x=>x[1]),y:top.map(x=>x[0]),hovertemplate:'%{y}<br>€%{x:,.0f}<extra></extra>'}],{...plotBase(430),margin:{l:160,r:20,t:18,b:45}},{displayModeBar:false,responsive:true});

  const moves=saasCustomerMovements(current,previous).slice(0,18);
  $('saasMovementRows').innerHTML=moves.map(x=>`<tr><td>${esc(x.name)}</td><td><span class="movement ${x.status.toLowerCase()}">${x.status}</span></td><td class="num">${eur(x.previous)}</td><td class="num">${eur(x.current)}</td><td class="num ${x.delta>=0?'kpi-positive':'kpi-negative'}">${x.delta>=0?'+':''}${eur(x.delta)}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Geen klantdata voor deze selectie.</td></tr>';
}

const baseRenderForSaas=render;
render=function(){
  if(view!=='saas')return baseRenderForSaas();
  document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));
  if(!state.rows.length){$('emptyState').classList.remove('hidden');return}
  $('emptyState').classList.add('hidden');$('saasView').classList.remove('hidden');saasDashboard();
};

window.addEventListener('DOMContentLoaded',()=>{
  const button=document.querySelector('#mainNav button[data-view="saas"]');
  if(button)button.addEventListener('click',()=>{
    $('pageTitle').textContent='SaaS analyse';
    $('pageSubtitle').textContent='Groei, productmix, klantconcentratie en behoud van recurring omzet.';
  });
});
