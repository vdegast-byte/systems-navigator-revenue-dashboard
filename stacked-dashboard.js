function dashboard(rows){
  if(!rows.length){
    $('dashboardView').innerHTML='<div class="card">Geen gegevens binnen de filters.</div>';
    return;
  }

  const total=rows.reduce((s,r)=>s+(Number(r.revenue)||0),0);
  const inv=new Set(rows.map(r=>r.company+'|'+r.invoice)).size;
  const saas=rows.filter(r=>/saas|maintenance/i.test(r.type)).reduce((s,r)=>s+(Number(r.revenue)||0),0);

  const monthSet=new Set();
  const groupTotals=new Map();
  const monthlyByGroup=new Map();

  rows.forEach(r=>{
    const month=(r.date||'').slice(0,7);
    if(!month)return;
    const group=clean(r.group)||'Onbekend';
    const value=Number(r.revenue)||0;
    monthSet.add(month);
    groupTotals.set(group,(groupTotals.get(group)||0)+value);
    if(!monthlyByGroup.has(group))monthlyByGroup.set(group,new Map());
    const byMonth=monthlyByGroup.get(group);
    byMonth.set(month,(byMonth.get(month)||0)+value);
  });

  const months=[...monthSet].sort();
  const groups=[...groupTotals.entries()].sort((a,b)=>b[1]-a[1]).map(([name])=>name);

  $('dashboardView').innerHTML=`
    <div class="grid metrics">
      <div class="metric"><div class="label">Gerealiseerde omzet</div><div class="value">${eur(total)}</div></div>
      <div class="metric"><div class="label">Facturen</div><div class="value">${inv}</div></div>
      <div class="metric"><div class="label">Gem. omzet per factuur</div><div class="value">${eur(inv?total/inv:0)}</div></div>
      <div class="metric"><div class="label">SaaS + maintenance</div><div class="value">${eur(saas)}</div></div>
    </div>
    <div class="card">
      <h3>Omzet per maand · productgroep</h3>
      <p class="hint">Gestapelde maandelijkse omzet. Iedere kleur vertegenwoordigt een productgroep.</p>
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
    x:months,
    y:months.map(month=>monthlyByGroup.get(group).get(month)||0),
    hovertemplate:`${esc(group)}<br>%{x}<br>€%{y:,.0f}<extra></extra>`
  }));

  Plotly.newPlot('monthlyChart',traces,{
    barmode:'relative',
    margin:{l:65,r:20,t:15,b:70},
    height:390,
    paper_bgcolor:'transparent',
    plot_bgcolor:'transparent',
    font:{family:'Inter,system-ui,sans-serif',color:'#445066'},
    xaxis:{type:'category',gridcolor:'#edf0f5',zeroline:false,tickangle:-35},
    yaxis:{gridcolor:'#edf0f5',zeroline:false,tickprefix:'€',tickformat:'~s'},
    legend:{orientation:'h',y:-.28,x:0}
  },{displayModeBar:false,responsive:true});

  bar('customerChart',agg(rows,'customer'));
  bar('productChart',agg(rows,'group'));
}
