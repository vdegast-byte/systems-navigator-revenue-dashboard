(function(){
  const baseRenderForVtti=render;
  const brand=window.DropboardBrand||{teal:'#13adb6',deepTeal:'#0b4447',coral:'#e25e59',grey:'#949797',dark:'#343941',lightGrey:'#d6d7d9'};
  let productLevel='group';

  const entityOrder=['VTTI','Eurotank Terminal','VTTV','ATT','ATB','ATPC','ETA','ETT'];
  const entityColors={
    'VTTI':brand.teal||'#13adb6',
    'Eurotank Terminal':brand.deepTeal||'#0b4447',
    'VTTV':brand.dark||'#343941',
    'ATT':brand.grey||'#949797',
    'ATB':brand.coral||'#e25e59',
    'ATPC':'#6dcfd1',
    'ETA':'#557d80',
    'ETT':'#b8c7c8'
  };

  function normalizeName(value){
    return clean(value).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function startsEntity(name,alias){return name===alias||name.startsWith(alias+' ')}
  function canonicalEntity(row){
    const values=[normalizeName(row.customer),normalizeName(row.account)].filter(Boolean);
    const checks=[
      ['Eurotank Terminal',['eurotank terminal','euro tank terminal']],
      ['VTTV',['vttv']],['ATT',['att']],['ATB',['atb']],['ATPC',['atpc']],['ETA',['eta']],['ETT',['ett']],['VTTI',['vtti']]
    ];
    for(const [label,aliases] of checks){
      if(values.some(v=>aliases.some(a=>startsEntity(v,a))))return label;
    }
    return null;
  }
  function selected(id){const e=$(id);return e?[...e.selectedOptions].map(o=>o.value):[]}
  function quarter(date){const m=Number((date||'').slice(5,7));return m?`Q${Math.ceil(m/3)}`:''}
  function revenue(rows){return rows.reduce((s,r)=>s+(Number(r.revenue)||0),0)}
  function percent(v){return Number.isFinite(v)?new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(v):'–'}
  function customerFilterMatch(r,f){
    if(f.customer?.length&&!f.customer.includes(r.customer))return false;
    if(f.account?.length&&!f.account.includes(r.account))return false;
    return true;
  }
  function vttiRows(){
    const f=filters(),quarters=selected('filterQuarter');
    return state.rows.filter(r=>{
      const entity=canonicalEntity(r);if(!entity)return false;
      if(f.start&&r.date<f.start)return false;if(f.end&&r.date>f.end)return false;
      for(const k of ['company','industry','group','type','country','supplier'])if(f[k]?.length&&!f[k].includes(r[k]))return false;
      if(!customerFilterMatch(r,f))return false;
      if(quarters.length&&!quarters.includes(clean(r.quarter)||quarter(r.date)))return false;
      if(f.q&&!`${r.customer} ${r.account} ${r.invoice} ${r.description}`.toLowerCase().includes(f.q))return false;
      return true;
    }).map(r=>({...r,_vttiEntity:canonicalEntity(r)}));
  }
  function aggregate(rows,keyFn){const m=new Map();for(const r of rows){const k=keyFn(r)||'Onbekend';m.set(k,(m.get(k)||0)+(Number(r.revenue)||0))}return [...m.entries()].sort((a,b)=>b[1]-a[1])}
  function productName(r){return clean(productLevel==='type'?r.type:r.group)||'Onbekend'}
  function productColor(name,index){
    const n=String(name||'').toLowerCase();
    if(n.includes('dropboard'))return brand.teal||'#13adb6';
    if(n.includes('scenario navigator')||n.includes('navigator'))return brand.deepTeal||'#0b4447';
    if(n.includes('simulation')||n.includes('simio')||n.includes('arena'))return brand.dark||'#343941';
    if(n.includes('saas'))return brand.teal||'#13adb6';
    if(n.includes('maintenance')||n.includes('support'))return brand.deepTeal||'#0b4447';
    if(n.includes('consult')||n.includes('service'))return brand.grey||'#949797';
    if(n.includes('config')||n.includes('implement'))return brand.dark||'#343941';
    if(n.includes('develop')||n.includes('license'))return brand.coral||'#e25e59';
    return [brand.coral||'#e25e59','#6dcfd1','#557d80','#b8c7c8',brand.grey||'#949797'][index%5];
  }
  function plotBase(height=360){return{height,margin:{l:65,r:25,t:18,b:60},paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Muli, Mulish, Segoe UI, Arial, sans-serif',color:'#343941'},xaxis:{gridcolor:'#edf0f1',zeroline:false},yaxis:{gridcolor:'#edf0f1',zeroline:false}}}

  function renderDashboard(){
    const rows=vttiRows(),root=$('vttiRevenueView');if(!root)return;
    if(!rows.length){root.innerHTML='<div class="card">Geen omzetregels gevonden voor VTTI, Eurotank Terminal, VTTV, ATT, ATB, ATPC, ETA of ETT binnen de gekozen filters.</div>';return}

    const years=[...new Set(rows.map(r=>(r.date||'').slice(0,4)).filter(Boolean))].sort();
    const total=revenue(rows),entities=aggregate(rows,r=>r._vttiEntity),products=aggregate(rows,productName),latestYear=years.at(-1),latestRows=rows.filter(r=>(r.date||'').startsWith(latestYear));
    const latestRevenue=revenue(latestRows),topEntity=entities[0]||['–',0],topProduct=products[0]||['–',0];

    root.innerHTML=`
      <div class="vtti-head card">
        <div><div class="eyebrow">Actual revenue · VTTI group</div><h2>VTTI & terminal revenue</h2><p>Omzet voor VTTI, Eurotank Terminal, VTTV, ATT, ATB, ATPC, ETA en ETT op basis van Customer/Account.</p></div>
        <div class="vtti-scope">8 entiteiten</div>
      </div>
      <div class="grid vtti-metrics">
        <div class="metric"><div class="label">Totale omzet selectie</div><div class="value">${eur(total)}</div><div class="sub">${years[0]} – ${latestYear}</div></div>
        <div class="metric"><div class="label">Omzet ${latestYear}</div><div class="value">${eur(latestRevenue)}</div><div class="sub">Laatste jaar binnen de selectie</div></div>
        <div class="metric"><div class="label">Grootste entiteit</div><div class="value vtti-text-value">${esc(topEntity[0])}</div><div class="sub">${eur(topEntity[1])} · ${total?percent(topEntity[1]/total):'–'} van totaal</div></div>
        <div class="metric"><div class="label">Grootste ${productLevel==='type'?'producttype':'productgroep'}</div><div class="value vtti-text-value">${esc(topProduct[0])}</div><div class="sub">${eur(topProduct[1])} · ${total?percent(topProduct[1]/total):'–'} van totaal</div></div>
      </div>

      <div class="card"><div class="vtti-card-head"><div><h3>Omzet per jaar · entiteit</h3><p>Jaarlijkse omzet verdeeld over de VTTI-entiteiten.</p></div></div><div id="vttiEntityYearChart" class="vtti-chart"></div></div>
      <div class="spacer"></div>

      <div class="card"><div class="vtti-card-head"><div><h3>Omzet per jaar · producten</h3><p>Jaaromzet uitgesplitst naar productgroep of producttype.</p></div><div class="vtti-product-toggle"><button type="button" data-vtti-level="group" class="${productLevel==='group'?'active':''}">Productgroep</button><button type="button" data-vtti-level="type" class="${productLevel==='type'?'active':''}">Producttype</button></div></div><div id="vttiProductYearChart" class="vtti-chart"></div></div>
      <div class="spacer"></div>

      <div class="grid two vtti-grid">
        <div class="card"><div class="vtti-card-head"><div><h3>Entiteit × ${productLevel==='type'?'producttype':'productgroep'}</h3><p>Welke producten leveren per terminal of entiteit omzet op?</p></div></div><div id="vttiEntityProductChart" class="vtti-chart tall"></div></div>
        <div class="card"><div class="vtti-card-head"><div><h3>Productmix</h3><p>Totale omzet per ${productLevel==='type'?'producttype':'productgroep'}.</p></div></div><div class="vtti-product-list">${products.map(([name,value],i)=>`<div class="vtti-product-row"><span><i style="background:${productColor(name,i)}"></i>${esc(name)}</span><strong>${eur(value)}</strong><small>${total?percent(value/total):'–'}</small></div>`).join('')}</div></div>
      </div>
      <div class="spacer"></div>

      <div class="card"><div class="vtti-card-head"><div><h3>Omzetmatrix per jaar en entiteit</h3><p>Controle-overzicht van de jaarlijkse omzet per VTTI-entiteit.</p></div></div><div class="table-wrap"><table class="vtti-table"><thead><tr><th>Entiteit</th>${years.map(y=>`<th class="num">${y}</th>`).join('')}<th class="num">Totaal</th></tr></thead><tbody id="vttiMatrixRows"></tbody></table></div></div>
    `;

    document.querySelectorAll('[data-vtti-level]').forEach(b=>b.onclick=()=>{productLevel=b.dataset.vttiLevel;renderDashboard()});

    const entityNames=entityOrder.filter(name=>rows.some(r=>r._vttiEntity===name));
    const entityTraces=entityNames.map(name=>({type:'bar',name,x:years,y:years.map(y=>revenue(rows.filter(r=>r._vttiEntity===name&&(r.date||'').startsWith(y)))),marker:{color:entityColors[name]||brand.grey},hovertemplate:`${esc(name)}<br>%{x}: €%{y:,.0f}<extra></extra>`}));
    Plotly.newPlot('vttiEntityYearChart',entityTraces,{...plotBase(390),barmode:'stack',legend:{orientation:'h',y:-.2},xaxis:{type:'category',gridcolor:'#edf0f1'},yaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false}},{displayModeBar:false,responsive:true});

    const productNames=products.map(([name])=>name);
    const productTraces=productNames.map((name,i)=>({type:'bar',name,x:years,y:years.map(y=>revenue(rows.filter(r=>productName(r)===name&&(r.date||'').startsWith(y)))),marker:{color:productColor(name,i)},hovertemplate:`${esc(name)}<br>%{x}: €%{y:,.0f}<extra></extra>`}));
    Plotly.newPlot('vttiProductYearChart',productTraces,{...plotBase(410),barmode:'stack',legend:{orientation:'h',y:-.24},xaxis:{type:'category',gridcolor:'#edf0f1'},yaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false}},{displayModeBar:false,responsive:true});

    const entityProductTraces=productNames.map((name,i)=>({type:'bar',orientation:'h',name,y:entityNames,x:entityNames.map(entity=>revenue(rows.filter(r=>r._vttiEntity===entity&&productName(r)===name))),marker:{color:productColor(name,i)},hovertemplate:`%{y}<br>${esc(name)}: €%{x:,.0f}<extra></extra>`}));
    Plotly.newPlot('vttiEntityProductChart',entityProductTraces,{...plotBase(Math.max(390,entityNames.length*48+150)),barmode:'stack',margin:{l:125,r:30,t:15,b:85},legend:{orientation:'h',y:-.2},xaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false},yaxis:{autorange:'reversed'}},{displayModeBar:false,responsive:true});

    const matrix=$('vttiMatrixRows');
    if(matrix)matrix.innerHTML=entityNames.map(entity=>{const annual=years.map(y=>revenue(rows.filter(r=>r._vttiEntity===entity&&(r.date||'').startsWith(y))));return`<tr><td><strong>${esc(entity)}</strong></td>${annual.map(v=>`<td class="num">${v?eur(v):'–'}</td>`).join('')}<td class="num"><strong>${eur(annual.reduce((a,b)=>a+b,0))}</strong></td></tr>`}).join('');
  }

  render=function(){
    if(view!=='vttiRevenue')return baseRenderForVtti();
    document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));
    if(!state.rows.length){$('emptyState').classList.remove('hidden');return}
    $('emptyState').classList.add('hidden');
    $('filterShell').classList.remove('hidden');$('filterShell').classList.remove('mgmt-mode');
    document.querySelector('.year-filter')?.classList.add('hidden');
    $('quickImport').classList.remove('hidden');$('exportFiltered').classList.remove('hidden');
    $('vttiRevenueView').classList.remove('hidden');renderDashboard();
  };

  window.addEventListener('DOMContentLoaded',()=>{
    const button=document.querySelector('#mainNav button[data-view="vttiRevenue"]');
    if(button)button.addEventListener('click',()=>{
      // Remove the forced Dropboard-only selection when entering this cross-product customer dashboard.
      const pg=$('filterProductGroup');
      if(pg&&[...pg.selectedOptions].length===1&&clean([...pg.selectedOptions][0].value).toLowerCase()==='dropboard'){
        [...pg.options].forEach(o=>o.selected=false);
        if(typeof syncTrigger==='function')syncTrigger(pg);
        if(typeof updateChips==='function')updateChips();
      }
      $('pageTitle').textContent='VTTI revenue';
      $('pageSubtitle').textContent='Jaarlijkse omzet en productmix voor VTTI en geselecteerde terminal-entiteiten.';
      render();
    });
  });
})();
