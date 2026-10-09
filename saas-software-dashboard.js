(function(){
  const baseRenderForSoftware=render;
  const brand=window.DropboardBrand||{teal:'#13adb6',deepTeal:'#0b4447',coral:'#e25e59',grey:'#949797',dark:'#343941',lightGrey:'#d6d7d9'};
  let selectedYear=null;

  function rowYear(r){return Number(r.year)||Number((r.date||'').slice(0,4))||0}
  function rowCategory(r){
    const t=clean(r.type).toLowerCase();
    if(t==='saas')return 'SaaS';
    if(['maintenance','new license','lease','support'].includes(t))return 'Software';
    return 'Other';
  }
  function revenue(rows){return rows.reduce((sum,r)=>sum+(Number(r.revenue)||0),0)}
  function pct(value){return Number.isFinite(value)?new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(value):'–'}
  function yoy(now,prev){return prev?((now-prev)/Math.abs(prev)):null}
  function signedPct(value){if(value==null||!Number.isFinite(value))return '–';return `${value>0?'+':''}${new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(value)}`}
  function deltaClass(value){return value==null?'neutral':value>0?'positive':value<0?'negative':'neutral'}
  function fmtDate(iso){if(!iso)return'';const d=new Date(iso+'T12:00:00');return new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'short',year:'numeric'}).format(d)}
  function selected(id){const e=$(id);return e?[...e.selectedOptions].map(o=>o.value):[]}

  function scopedRows(){
    const f=filters();
    const quarters=selected('filterQuarter');
    return state.rows.filter(r=>{
      for(const k of ['company','customer','account','industry','group','type','country','supplier']){
        if(f[k]?.length&&!f[k].includes(r[k]))return false;
      }
      if(quarters.length&&!quarters.includes(clean(r.quarter)))return false;
      if(f.q&&!`${r.customer} ${r.account} ${r.invoice} ${r.description}`.toLowerCase().includes(f.q))return false;
      return true;
    });
  }

  function comparisonRows(rows,year){
    const current=rows.filter(r=>rowYear(r)===year);
    const prevYear=year-1;
    const allYears=[...new Set(rows.map(rowYear).filter(Boolean))].sort((a,b)=>a-b);
    const latestYear=allYears.at(-1)||year;
    const latestDate=current.map(r=>r.date).filter(Boolean).sort().at(-1)||'';
    const isPartial=year===latestYear&&latestDate&&latestDate.slice(5)!=='12-31';
    let previous=rows.filter(r=>rowYear(r)===prevYear);
    if(isPartial){
      const cutoff=latestDate.slice(5);
      previous=previous.filter(r=>(r.date||'').slice(5)<=cutoff);
    }
    return {current,previous,prevYear,latestDate,isPartial};
  }

  function metrics(rows){
    const total=revenue(rows);
    const saas=revenue(rows.filter(r=>rowCategory(r)==='SaaS'));
    const software=revenue(rows.filter(r=>rowCategory(r)==='Software'));
    const combined=saas+software;
    return {total,saas,software,combined,share:total?combined/total:0,other:total-combined};
  }

  function plotLayout(height=370){
    return {height,margin:{l:70,r:25,t:20,b:65},paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Muli, Mulish, Segoe UI, Arial, sans-serif',color:'#343941'},xaxis:{gridcolor:'#edf0f1',zeroline:false},yaxis:{gridcolor:'#edf0f1',zeroline:false}};
  }

  function productMix(rows){
    const map=new Map();
    rows.filter(r=>rowCategory(r)!=='Other').forEach(r=>{
      const name=clean(r.group)||'Onbekend';
      const item=map.get(name)||{saas:0,software:0,total:0};
      const value=Number(r.revenue)||0;
      if(rowCategory(r)==='SaaS')item.saas+=value;else item.software+=value;
      item.total+=value;map.set(name,item);
    });
    return [...map.entries()].sort((a,b)=>b[1].total-a[1].total);
  }

  function renderDashboard(){
    const root=$('saasSoftwareView');if(!root)return;
    const rows=scopedRows();
    const years=[...new Set(rows.map(rowYear).filter(Boolean))].sort((a,b)=>a-b);
    if(!years.length){root.innerHTML='<div class="card">Geen omzetgegevens beschikbaar binnen de gekozen filters.</div>';return}
    if(!selectedYear||!years.includes(selectedYear))selectedYear=years.at(-1);

    const cmp=comparisonRows(rows,selectedYear);
    const cur=metrics(cmp.current),prev=metrics(cmp.previous);
    const combinedGrowth=yoy(cur.combined,prev.combined),totalGrowth=yoy(cur.total,prev.total),shareDelta=cur.share-prev.share;
    const currentLabel=cmp.isPartial?`${selectedYear} YTD`:`FY ${selectedYear}`;
    const previousLabel=cmp.isPartial?`${cmp.prevYear} same period`:`FY ${cmp.prevYear}`;

    root.innerHTML=`
      <div class="card ss-head">
        <div><div class="eyebrow">Actual revenue · revenue quality</div><h2>SaaS & software revenue</h2><p>Hoeveel van de totale omzet komt uit SaaS en software, en hoe ontwikkelt dit zich ten opzichte van het vorige boekjaar?</p></div>
        <label class="ss-year-control"><span>Financial year</span><select id="ssYear">${years.map(y=>`<option value="${y}" ${y===selectedYear?'selected':''}>${y}</option>`).join('')}</select></label>
      </div>
      ${cmp.isPartial?`<div class="callout ss-period-note"><strong>Vergelijkingsbasis:</strong> ${currentLabel} t/m ${fmtDate(cmp.latestDate)} wordt vergeleken met dezelfde periode in ${cmp.prevYear}, zodat de YoY-vergelijking niet met een volledig vorig jaar wordt vertekend.</div>`:''}

      <div class="grid ss-metrics">
        <div class="metric"><div class="label">Totale omzet · ${currentLabel}</div><div class="value">${eur(cur.total)}</div><div class="sub ${deltaClass(totalGrowth)}">${signedPct(totalGrowth)} vs ${previousLabel} · ${eur(prev.total)}</div></div>
        <div class="metric"><div class="label">SaaS omzet</div><div class="value">${eur(cur.saas)}</div><div class="sub">${cur.total?pct(cur.saas/cur.total):'–'} van totaal · vorig jaar ${eur(prev.saas)}</div></div>
        <div class="metric"><div class="label">Software omzet</div><div class="value">${eur(cur.software)}</div><div class="sub">${cur.total?pct(cur.software/cur.total):'–'} van totaal · vorig jaar ${eur(prev.software)}</div></div>
        <div class="metric ss-highlight"><div class="label">SaaS + software aandeel</div><div class="value">${pct(cur.share)}</div><div class="sub ${deltaClass(shareDelta)}">${shareDelta>0?'+':''}${(shareDelta*100).toFixed(1)} pp vs ${previousLabel} · omzet ${eur(cur.combined)}</div></div>
      </div>

      <div class="grid two ss-grid">
        <div class="card"><div class="ss-card-head"><div><h3>Omzetmix · ${currentLabel} vs ${previousLabel}</h3><p>SaaS en software als onderdeel van de totale omzet.</p></div></div><div id="ssMixChart"></div></div>
        <div class="card"><div class="ss-card-head"><div><h3>YoY ontwikkeling</h3><p>Groei van totale omzet en SaaS + software omzet.</p></div></div>
          <div class="ss-yoy-panel">
            <div><span>Totale omzet</span><strong class="${deltaClass(totalGrowth)}">${signedPct(totalGrowth)}</strong><small>${eur(prev.total)} → ${eur(cur.total)}</small></div>
            <div><span>SaaS + software</span><strong class="${deltaClass(combinedGrowth)}">${signedPct(combinedGrowth)}</strong><small>${eur(prev.combined)} → ${eur(cur.combined)}</small></div>
            <div><span>Aandeel van totaal</span><strong class="${deltaClass(shareDelta)}">${shareDelta>0?'+':''}${(shareDelta*100).toFixed(1)} pp</strong><small>${pct(prev.share)} → ${pct(cur.share)}</small></div>
          </div>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="card"><div class="ss-card-head"><div><h3>Historische omzetmix</h3><p>SaaS, software en overige omzet per boekjaar.</p></div></div><div id="ssTrendChart"></div></div>
      <div class="spacer"></div>

      <div class="grid two ss-grid">
        <div class="card"><div class="ss-card-head"><div><h3>SaaS & software per productgroep · ${currentLabel}</h3><p>Welke producten leveren de SaaS- en softwareomzet?</p></div></div><div id="ssProductChart"></div></div>
        <div class="card ss-definition"><h3>Definitie</h3><p>Deze analyse gebruikt de bestaande <strong>Product Type</strong>-tags uit de factuurdata.</p><div class="ss-def-row"><i class="ss-dot saas"></i><div><strong>SaaS</strong><span>Product Type = SaaS (inclusief schrijfvariant “Saas”).</span></div></div><div class="ss-def-row"><i class="ss-dot software"></i><div><strong>Software</strong><span>Maintenance, New License, Lease en Support.</span></div></div><div class="ss-def-row"><i class="ss-dot other"></i><div><strong>Overig</strong><span>Consultancy, Modelling, Development, Configuration, Training, Expenses en andere services.</span></div></div><p class="hint">Development en configuration zijn bewust niet als softwareomzet geclassificeerd. Als je die wel wilt meenemen, kan de definitie eenvoudig worden aangepast.</p></div>
      </div>
    `;

    $('ssYear').onchange=e=>{selectedYear=Number(e.target.value);renderDashboard()};

    const x=[previousLabel,currentLabel];
    const traces=[
      {type:'bar',name:'SaaS',x,y:[prev.saas,cur.saas],marker:{color:brand.teal||'#13adb6'},hovertemplate:'%{x}<br>SaaS: €%{y:,.0f}<extra></extra>'},
      {type:'bar',name:'Software',x,y:[prev.software,cur.software],marker:{color:brand.deepTeal||'#0b4447'},hovertemplate:'%{x}<br>Software: €%{y:,.0f}<extra></extra>'},
      {type:'bar',name:'Overig',x,y:[prev.other,cur.other],marker:{color:brand.lightGrey||'#d6d7d9'},hovertemplate:'%{x}<br>Overig: €%{y:,.0f}<extra></extra>'}
    ];
    Plotly.newPlot('ssMixChart',traces,{...plotLayout(380),barmode:'stack',legend:{orientation:'h',y:-.18},yaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false},xaxis:{type:'category',gridcolor:'#edf0f1'}},{displayModeBar:false,responsive:true});

    const annual=years.map(y=>({year:y,...metrics(rows.filter(r=>rowYear(r)===y))}));
    const annualTraces=[
      {type:'bar',name:'SaaS',x:annual.map(a=>String(a.year)),y:annual.map(a=>a.saas),marker:{color:brand.teal||'#13adb6'}},
      {type:'bar',name:'Software',x:annual.map(a=>String(a.year)),y:annual.map(a=>a.software),marker:{color:brand.deepTeal||'#0b4447'}},
      {type:'bar',name:'Overig',x:annual.map(a=>String(a.year)),y:annual.map(a=>a.other),marker:{color:brand.lightGrey||'#d6d7d9'}}
    ];
    Plotly.newPlot('ssTrendChart',annualTraces,{...plotLayout(410),barmode:'stack',legend:{orientation:'h',y:-.2},yaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false},xaxis:{type:'category',gridcolor:'#edf0f1'}},{displayModeBar:false,responsive:true});

    const mix=productMix(cmp.current).slice(0,12).reverse();
    Plotly.newPlot('ssProductChart',[
      {type:'bar',orientation:'h',name:'SaaS',y:mix.map(([name])=>name),x:mix.map(([,v])=>v.saas),marker:{color:brand.teal||'#13adb6'},hovertemplate:'%{y}<br>SaaS: €%{x:,.0f}<extra></extra>'},
      {type:'bar',orientation:'h',name:'Software',y:mix.map(([name])=>name),x:mix.map(([,v])=>v.software),marker:{color:brand.deepTeal||'#0b4447'},hovertemplate:'%{y}<br>Software: €%{x:,.0f}<extra></extra>'}
    ],{...plotLayout(Math.max(370,mix.length*38+130)),barmode:'stack',margin:{l:145,r:25,t:15,b:65},legend:{orientation:'h',y:-.16},xaxis:{tickprefix:'€',tickformat:'~s',gridcolor:'#edf0f1',zeroline:false},yaxis:{gridcolor:'transparent'}},{displayModeBar:false,responsive:true});
  }

  render=function(){
    const shell=$('filterShell');
    if(view!=='saasSoftware'){
      shell?.classList.remove('ss-mode');
      return baseRenderForSoftware.apply(this,arguments);
    }
    document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));
    if(!state.rows.length){$('emptyState').classList.remove('hidden');return}
    $('emptyState').classList.add('hidden');
    shell?.classList.remove('hidden');shell?.classList.remove('mgmt-mode');shell?.classList.add('ss-mode');
    document.querySelector('.year-filter')?.classList.add('hidden');
    $('quickImport')?.classList.remove('hidden');$('exportFiltered')?.classList.remove('hidden');
    $('saasSoftwareView').classList.remove('hidden');renderDashboard();
  };

  window.addEventListener('DOMContentLoaded',()=>{
    const button=document.querySelector('#mainNav button[data-view="saasSoftware"]');
    if(button)button.addEventListener('click',()=>{
      $('pageTitle').textContent='SaaS & software mix';
      $('pageSubtitle').textContent='Aandeel SaaS en software in de totale omzet en vergelijking met het vorige boekjaar.';
      render();
    });
  });
})();
