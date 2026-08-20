function dashboard(rows){
  if(!rows.length){
    $('dashboardView').innerHTML='<div class="card">Geen gegevens binnen de filters.</div>';
    return;
  }

  const total=rows.reduce((s,r)=>s+(Number(r.revenue)||0),0);
  const inv=new Set(rows.map(r=>r.company+'|'+r.invoice)).size;
  const saas=rows.filter(r=>/saas|maintenance/i.test(r.type)).reduce((s,r)=>s+(Number(r.revenue)||0),0);

  const quarterSet=new Set();
  const groupTotals=new Map();
  const quarterlyByGroup=new Map();

  rows.forEach(r=>{
    const date=r.date||'';
    const year=date.slice(0,4)||String(r.year||'');
    if(!year)return;
    let quarter=clean(r.quarter).toUpperCase();
    if(!/^Q[1-4]$/.test(quarter)){
      const month=Number(date.slice(5,7));
      if(!month)return;
      quarter='Q'+Math.ceil(month/3);
    }
    const period=`${year} ${quarter}`;
    const group=clean(r.group)||'Onbekend';
    const value=Number(r.revenue)||0;
    quarterSet.add(period);
    groupTotals.set(group,(groupTotals.get(group)||0)+value);
    if(!quarterlyByGroup.has(group))quarterlyByGroup.set(group,new Map());
    const byQuarter=quarterlyByGroup.get(group);
    byQuarter.set(period,(byQuarter.get(period)||0)+value);
  });

  const quarterOrder=q=>{
    const m=q.match(/^(\d{4}) Q([1-4])$/);
    return m?Number(m[1])*10+Number(m[2]):0;
  };
  const quarters=[...quarterSet].sort((a,b)=>quarterOrder(a)-quarterOrder(b));
  const groups=[...groupTotals.entries()].sort((a,b)=>b[1]-a[1]).map(([name])=>name);

  $('dashboardView').innerHTML=`
    <div class="grid metrics">
      <div class="metric"><div class="label">Gerealiseerde omzet</div><div class="value">${eur(total)}</div></div>
      <div class="metric"><div class="label">Facturen</div><div class="value">${inv}</div></div>
      <div class="metric"><div class="label">Gem. omzet per factuur</div><div class="value">${eur(inv?total/inv:0)}</div></div>
      <div class="metric"><div class="label">SaaS + maintenance</div><div class="value">${eur(saas)}</div></div>
    </div>
    <div class="card">
      <h3>Omzet per kwartaal · productgroep</h3>
      <p class="hint">Gestapelde kwartaalomzet. Iedere kleur vertegenwoordigt een productgroep.</p>
      <div id="monthlyChart"></div>
    </div>
    <div class="spacer"></div>
    <div class="grid two">
      <div class="card"><h3>Top klanten</h3><div id="customerChart"></div></div>
      <div class="card"><h3>Productgroepen</h3><div id="productChart"></div></div>
    </div>`;

  const traces=groups.map(group=>({
    type:'bar',
    name:group,
    x:quarters,
    y:quarters.map(quarter=>quarterlyByGroup.get(group).get(quarter)||0),
    hovertemplate:`${esc(group)}<br>%{x}<br>€%{y:,.0f}<extra></extra>`
  }));

  Plotly.newPlot('monthlyChart',traces,{
    barmode:'relative',
    margin:{l:65,r:20,t:15,b:70},
    height:390,
    paper_bgcolor:'transparent',
    plot_bgcolor:'transparent',
    font:{family:'Inter,system-ui,sans-serif',color:'#445066'},
    xaxis:{type:'category',gridcolor:'#edf0f5',zeroline:false,tickangle:-25},
    yaxis:{gridcolor:'#edf0f5',zeroline:false,tickprefix:'€',tickformat:'~s'},
    legend:{orientation:'h',y:-.28,x:0}
  },{displayModeBar:false,responsive:true});

  bar('customerChart',agg(rows,'customer'));
  bar('productChart',agg(rows,'group'));
}
