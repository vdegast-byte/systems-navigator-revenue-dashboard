(function(){
  if(typeof mgmtRender!=='function'||typeof mgmtBaseRows!=='function')return;

  const baseRender=mgmtRender;
  const baseRowsFn=mgmtBaseRows;
  let selectedYear=null;

  function sameDatePriorYear(date,year){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return'';
    let month=m[2],day=m[3];
    if(month==='02'&&day==='29'){
      const leap=(year%4===0&&year%100!==0)||year%400===0;
      if(!leap)day='28';
    }
    return `${year}-${month}-${day}`;
  }
  function pct(value){return Number.isFinite(value)?new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(value):'–'}
  function growth(current,previous){return previous?((current-previous)/Math.abs(previous)):null}
  function revenue(rows){return rows.reduce((sum,r)=>sum+(Number(r.revenue)||0),0)}

  function typeColor(type){
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

  function availableYears(rows){
    return [...new Set(rows.map(r=>Number((r.date||'').slice(0,4))).filter(Boolean))].sort((a,b)=>b-a);
  }

  function resolveSelectedYear(rows){
    const years=availableYears(rows);
    if(!years.length)return null;
    const select=$('filterYear');
    const selectedFromUi=Number(select?.value);
    if(selectedFromUi&&years.includes(selectedFromUi))selectedYear=selectedFromUi;
    const calendar=new Date().getFullYear();
    if(selectedYear&&years.includes(selectedYear))return selectedYear;
    selectedYear=years.includes(calendar)?calendar:years[0];
    return selectedYear;
  }

  function renderTopYearFilter(years,year){
    const field=document.querySelector('.year-filter');
    const select=$('filterYear');
    if(!field||!select)return;
    field.classList.remove('hidden');
    select.innerHTML=years.map(y=>`<option value="${y}"${y===year?' selected':''}>${y}</option>`).join('');
    select.value=String(year);
    select.onchange=()=>{selectedYear=Number(select.value);mgmtRender()};
  }

  function updateCustomerMetric(root,currentRows,previousRows,previousYear){
    if(!root)return;
    const metric=[...root.querySelectorAll('.mgmt-metrics .metric')].find(card=>(card.querySelector('.label')?.textContent||'').includes('Klanten met omzet'));
    if(!metric)return;
    const currentCustomers=new Set(currentRows.map(r=>mgmtCustomer(r)).filter(Boolean));
    const previousCustomers=new Set(previousRows.map(r=>mgmtCustomer(r)).filter(Boolean));
    const avg=currentCustomers.size?revenue(currentRows)/currentCustomers.size:0;
    const value=metric.querySelector('.value');
    const sub=metric.querySelector('.sub');
    if(value)value.textContent=String(currentCustomers.size);
    if(sub)sub.textContent=`${previousCustomers.size} in ${previousYear} · gemiddeld ${eur(avg)} per klant`;
  }

  function hatchQuarterChart(){
    const chart=$('mgmtQuarterChart');
    if(!chart||!window.Plotly||!chart.data?.length)return;
    const previousStyle={
      'marker.color':'#ffffff',
      'marker.line.color':'#949797',
      'marker.line.width':1.2,
      'marker.pattern.shape':'/',
      'marker.pattern.fgcolor':'#949797',
      'marker.pattern.bgcolor':'#ffffff',
      'marker.pattern.size':8,
      'marker.pattern.solidity':0.22,
      'marker.pattern.fillmode':'replace',
      'textfont.color':'#343941'
    };
    const currentStyle={
      'marker.color':'#f4fbfb',
      'marker.line.color':'#13adb6',
      'marker.line.width':1.2,
      'marker.pattern.shape':'\\',
      'marker.pattern.fgcolor':'#13adb6',
      'marker.pattern.bgcolor':'#f4fbfb',
      'marker.pattern.size':8,
      'marker.pattern.solidity':0.24,
      'marker.pattern.fillmode':'replace',
      'textfont.color':'#343941'
    };
    try{
      Plotly.restyle(chart,previousStyle,[0]);
      if(chart.data.length>1)Plotly.restyle(chart,currentStyle,[1]);
    }catch(e){console.debug('Quarter hatch styling skipped',e)}
  }

  function renderProductTypeChart(currentRows,previousRows,year){
    const root=$('managementDashboardView');
    if(!root||!window.Plotly)return;
    const heading=[...root.querySelectorAll('.mgmt-card-head h3')].find(h=>(h.textContent||'').trim().startsWith('Productgroepen'));
    if(!heading)return;
    const card=heading.closest('.card');
    if(!card)return;

    const groups=new Map(),groupTotals=new Map(),prevTotals=new Map(),typeTotals=new Map();
    currentRows.forEach(r=>{
      const group=clean(r.group)||'Onbekend',type=clean(r.type)||'Onbekend',value=Number(r.revenue)||0;
      if(!groups.has(group))groups.set(group,new Map());
      const gm=groups.get(group);gm.set(type,(gm.get(type)||0)+value);
      groupTotals.set(group,(groupTotals.get(group)||0)+value);
      typeTotals.set(type,(typeTotals.get(type)||0)+value);
    });
    previousRows.forEach(r=>{
      const group=clean(r.group)||'Onbekend';
      prevTotals.set(group,(prevTotals.get(group)||0)+(Number(r.revenue)||0));
    });

    const groupNames=[...groupTotals.entries()].sort((a,b)=>b[1]-a[1]).map(([g])=>g);
    const typeNames=[...typeTotals.entries()].filter(([,v])=>v!==0).sort((a,b)=>b[1]-a[1]).map(([t])=>t);

    heading.textContent=`Productgroepen & producttypes · ${year} YTD`;
    const p=heading.parentElement?.querySelector('p');
    if(p)p.textContent='Elke balk is een productgroep; de segmenten tonen uit welke producttypes de omzet bestaat.';

    const oldList=card.querySelector('.mgmt-product-list');
    if(oldList)oldList.outerHTML='<div id="mgmtEnhProductTypeChart" class="mgmt-enh-product-chart"></div>';
    else if(!$('mgmtEnhProductTypeChart'))card.insertAdjacentHTML('beforeend','<div id="mgmtEnhProductTypeChart" class="mgmt-enh-product-chart"></div>');

    const chart=$('mgmtEnhProductTypeChart');
    if(!chart)return;
    if(!groupNames.length||!typeNames.length){chart.innerHTML='<div class="muted">Geen productgroep- of producttypedata voor deze selectie.</div>';return}

    const traces=typeNames.map(type=>({
      type:'bar',orientation:'h',name:type,y:groupNames,
      x:groupNames.map(group=>groups.get(group)?.get(type)||0),
      marker:{color:typeColor(type)},
      hovertemplate:`<b>%{y}</b><br>${esc(type)}: €%{x:,.0f}<extra></extra>`
    }));
    const maxTotal=Math.max(...groupNames.map(g=>Math.max(0,groupTotals.get(g)||0)),1);
    const annotations=groupNames.map(group=>{
      const value=groupTotals.get(group)||0,prior=prevTotals.get(group)||0,delta=growth(value,prior);
      return {x:Math.max(0,value)+maxTotal*.025,y:group,text:`${eur(value)}${delta==null?'':` · ${delta>=0?'+':''}${pct(delta)} YoY`}`,showarrow:false,xanchor:'left',font:{size:10,color:delta==null?'#777c80':delta>=0?'#0b4447':'#e25e59'}};
    });

    try{
      Plotly.newPlot('mgmtEnhProductTypeChart',traces,{barmode:'stack',height:Math.max(340,groupNames.length*52+130),margin:{l:135,r:135,t:10,b:85},paper_bgcolor:'transparent',plot_bgcolor:'transparent',legend:{orientation:'h',y:-.2,x:0},xaxis:{tickprefix:'€',tickformat:'~s',range:[0,maxTotal*1.3],zeroline:false},yaxis:{autorange:'reversed'},annotations},{displayModeBar:false,responsive:true});
    }catch(e){console.error('Producttype chart failed',e)}
  }

  mgmtRender=function(){
    try{
      const rawBase=baseRowsFn();
      const years=availableYears(rawBase);
      const year=resolveSelectedYear(rawBase);
      if(!year)return baseRender.apply(this,arguments);

      renderTopYearFilter(years,year);
      const yearRows=rawBase.filter(r=>(r.date||'').startsWith(String(year)));
      const dates=yearRows.map(r=>r.date).filter(Boolean).sort();
      if(!dates.length)return baseRender.apply(this,arguments);

      const lastDate=dates.at(-1),priorYear=year-1,priorCutoff=sameDatePriorYear(lastDate,priorYear);
      const currentRows=yearRows.filter(r=>r.date<=lastDate);
      const previousRows=rawBase.filter(r=>(r.date||'').startsWith(String(priorYear))&&r.date<=priorCutoff);
      const filteredBase=[...currentRows,...previousRows];

      const activeRowsFn=mgmtBaseRows;
      mgmtBaseRows=()=>filteredBase;
      let result;
      try{result=baseRender.apply(this,arguments)}finally{mgmtBaseRows=activeRowsFn}

      const root=$('managementDashboardView');
      if(root){
        const heroBadge=root.querySelector('.mgmt-period-badge');
        if(heroBadge)heroBadge.textContent=`${year} YTD · t/m ${lastDate.slice(5)}`;
        updateCustomerMetric(root,currentRows,previousRows,priorYear);
        hatchQuarterChart();
        renderProductTypeChart(currentRows,previousRows,year);
      }
      return result;
    }catch(e){
      console.error('Management dashboard enhancement failed; using base dashboard',e);
      try{mgmtBaseRows=baseRowsFn}catch(_){}
      return baseRender.apply(this,arguments);
    }
  };
})();
