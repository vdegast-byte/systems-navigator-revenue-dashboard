(function(){
  if(typeof mgmtRender!=='function'||typeof mgmtBaseRows!=='function')return;

  const baseRender=mgmtRender;
  const baseRowsFn=mgmtBaseRows;
  let rangeState=null;
  let selectedYear=null;

  function dateMs(date){
    const p=String(date||'').split('-').map(Number);
    return p.length===3?Date.UTC(p[0],p[1]-1,p[2]):NaN;
  }
  function dayDiff(start,end){
    const a=dateMs(start),b=dateMs(end);
    return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):0;
  }
  function addDays(start,days){
    const ms=dateMs(start);
    if(!Number.isFinite(ms))return start;
    return new Date(ms+(Number(days)||0)*86400000).toISOString().slice(0,10);
  }
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
  function fmtDate(date){
    if(!date)return'';
    try{return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))}
    catch(e){return date}
  }
  function pct(value){return Number.isFinite(value)?new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:1}).format(value):'–'}
  function growth(current,previous){return previous?((current-previous)/Math.abs(previous)):null}
  function yearsFromRows(rows){return [...new Set(rows.map(r=>Number((r.date||'').slice(0,4))).filter(Boolean))].sort((a,b)=>a-b)}

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

  function resolveRange(year,lastAvailable){
    const min=`${year}-01-01`;
    if(!rangeState||rangeState.year!==year){
      rangeState={year,min,max:lastAvailable,start:min,end:lastAvailable};
      return rangeState;
    }
    const wasAtMax=rangeState.end===rangeState.max;
    rangeState.min=min;
    rangeState.max=lastAvailable;
    if(rangeState.start<min)rangeState.start=min;
    if(rangeState.start>lastAvailable)rangeState.start=lastAvailable;
    if(wasAtMax||rangeState.end>lastAvailable)rangeState.end=lastAvailable;
    if(rangeState.end<rangeState.start)rangeState.end=rangeState.start;
    return rangeState;
  }

  function rangeMarkup(range,years){
    const maxDays=Math.max(1,dayDiff(range.min,range.max));
    const startValue=dayDiff(range.min,range.start);
    const endValue=dayDiff(range.min,range.end);
    const left=(startValue/maxDays)*100;
    const right=(endValue/maxDays)*100;
    const yearIndex=years.indexOf(range.year);
    const hasPrevious=yearIndex>0,hasNext=yearIndex>=0&&yearIndex<years.length-1;
    return `<div class="mgmt-enh-range card">
      <div class="mgmt-enh-range-head">
        <div><div class="eyebrow">Date range</div><h3>Analyseperiode</h3><p>Kies eerst het jaar en verfijn daarna de periode met de twee sliders.</p></div>
        <div class="mgmt-enh-range-actions">
          <div class="mgmt-enh-year-nav">
            <button id="mgmtEnhPrevYear" class="secondary mgmt-enh-year-arrow" type="button" ${hasPrevious?'':'disabled'} aria-label="Vorig jaar">←</button>
            <select id="mgmtEnhYearSelect" class="mgmt-enh-year-select" aria-label="Jaar">${years.map(y=>`<option value="${y}" ${y===range.year?'selected':''}>${y}</option>`).join('')}</select>
            <button id="mgmtEnhNextYear" class="secondary mgmt-enh-year-arrow" type="button" ${hasNext?'':'disabled'} aria-label="Volgend jaar">→</button>
          </div>
          <strong id="mgmtEnhRangeLabel">${esc(fmtDate(range.start))} – ${esc(fmtDate(range.end))}</strong>
          <button id="mgmtEnhRangeReset" class="secondary" type="button">Dit jaar</button>
        </div>
      </div>
      <div id="mgmtEnhRangeControl" class="mgmt-enh-range-control" style="--range-left:${left}%;--range-right:${right}%">
        <div class="mgmt-enh-range-track"></div><div class="mgmt-enh-range-fill"></div>
        <input id="mgmtEnhRangeStart" class="mgmt-enh-range-input" type="range" min="0" max="${maxDays}" value="${startValue}" aria-label="Startdatum">
        <input id="mgmtEnhRangeEnd" class="mgmt-enh-range-input" type="range" min="0" max="${maxDays}" value="${endValue}" aria-label="Einddatum">
      </div>
      <div class="mgmt-enh-range-ends"><span>${esc(fmtDate(range.min))}</span><span>${esc(fmtDate(range.max))}</span></div>
    </div>`;
  }

  function bindRange(range,years,defaultYear){
    const start=$('mgmtEnhRangeStart'),end=$('mgmtEnhRangeEnd'),label=$('mgmtEnhRangeLabel'),control=$('mgmtEnhRangeControl'),reset=$('mgmtEnhRangeReset');
    const prev=$('mgmtEnhPrevYear'),next=$('mgmtEnhNextYear'),yearSelect=$('mgmtEnhYearSelect');
    if(!start||!end||!control)return;
    const max=Number(start.max)||1;
    const sync=(source,rerender)=>{
      let sv=Number(start.value),ev=Number(end.value);
      if(sv>ev){
        if(source===start){ev=sv;end.value=String(ev)}else{sv=ev;start.value=String(sv)}
      }
      rangeState.start=addDays(range.min,sv);
      rangeState.end=addDays(range.min,ev);
      control.style.setProperty('--range-left',`${(sv/max)*100}%`);
      control.style.setProperty('--range-right',`${(ev/max)*100}%`);
      if(label)label.textContent=`${fmtDate(rangeState.start)} – ${fmtDate(rangeState.end)}`;
      if(rerender)mgmtRender();
    };
    const switchYear=(year)=>{
      if(!years.includes(year))return;
      selectedYear=year;
      rangeState=null;
      mgmtRender();
    };
    start.oninput=()=>sync(start,false);
    end.oninput=()=>sync(end,false);
    start.onchange=()=>sync(start,true);
    end.onchange=()=>sync(end,true);
    if(yearSelect)yearSelect.onchange=()=>switchYear(Number(yearSelect.value));
    if(prev)prev.onclick=()=>{const i=years.indexOf(range.year);if(i>0)switchYear(years[i-1])};
    if(next)next.onclick=()=>{const i=years.indexOf(range.year);if(i>=0&&i<years.length-1)switchYear(years[i+1])};
    if(reset)reset.onclick=()=>{selectedYear=defaultYear;rangeState=null;mgmtRender()};
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
      const group=clean(r.group)||'Onbekend';prevTotals.set(group,(prevTotals.get(group)||0)+(Number(r.revenue)||0));
    });
    const groupNames=[...groupTotals.entries()].sort((a,b)=>b[1]-a[1]).map(([g])=>g);
    const typeNames=[...typeTotals.entries()].filter(([,v])=>v!==0).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
    heading.textContent=`Productgroepen & producttypes · ${year}`;
    const p=heading.parentElement?.querySelector('p');
    if(p)p.textContent='Elke balk is een productgroep; de segmenten tonen uit welke producttypes de omzet bestaat.';
    const oldList=card.querySelector('.mgmt-product-list');
    if(oldList)oldList.outerHTML='<div id="mgmtEnhProductTypeChart" class="mgmt-enh-product-chart"></div>';
    else if(!$('mgmtEnhProductTypeChart'))card.insertAdjacentHTML('beforeend','<div id="mgmtEnhProductTypeChart" class="mgmt-enh-product-chart"></div>');
    if(!groupNames.length||!typeNames.length){$('mgmtEnhProductTypeChart').innerHTML='<div class="muted">Geen productgroep- of producttypedata voor deze selectie.</div>';return}
    const traces=typeNames.map(type=>({type:'bar',orientation:'h',name:type,y:groupNames,x:groupNames.map(group=>groups.get(group)?.get(type)||0),marker:{color:typeColor(type)},hovertemplate:`<b>%{y}</b><br>${esc(type)}: €%{x:,.0f}<extra></extra>`}));
    const maxTotal=Math.max(...groupNames.map(g=>Math.max(0,groupTotals.get(g)||0)),1);
    const annotations=groupNames.map(group=>{
      const value=groupTotals.get(group)||0,prior=prevTotals.get(group)||0,delta=growth(value,prior);
      return {x:Math.max(0,value)+maxTotal*.025,y:group,text:`${eur(value)}${delta==null?'':` · ${delta>=0?'+':''}${pct(delta)} YoY`}`,showarrow:false,xanchor:'left',font:{size:10,color:delta==null?'#777c80':delta>=0?'#0b4447':'#e25e59'}};
    });
    try{Plotly.newPlot('mgmtEnhProductTypeChart',traces,{barmode:'stack',height:Math.max(340,groupNames.length*52+130),margin:{l:135,r:135,t:10,b:85},paper_bgcolor:'transparent',plot_bgcolor:'transparent',legend:{orientation:'h',y:-.2,x:0},xaxis:{tickprefix:'€',tickformat:'~s',range:[0,maxTotal*1.3],zeroline:false},yaxis:{autorange:'reversed'},annotations},{displayModeBar:false,responsive:true})}
    catch(e){console.error('Producttype chart failed',e)}
  }

  mgmtRender=function(){
    let rawBase=[];
    try{
      rawBase=baseRowsFn();
      const years=yearsFromRows(rawBase);
      const defaultYear=mgmtYear(rawBase);
      if(!selectedYear||!years.includes(selectedYear))selectedYear=defaultYear;
      const year=selectedYear;
      const yearRows=rawBase.filter(r=>(r.date||'').startsWith(String(year)));
      const dates=yearRows.map(r=>r.date).filter(Boolean).sort();
      if(!dates.length)return baseRender.apply(this,arguments);
      const range=resolveRange(year,dates.at(-1));
      const priorYear=year-1;
      const priorStart=sameDatePriorYear(range.start,priorYear),priorEnd=sameDatePriorYear(range.end,priorYear);
      const currentRows=yearRows.filter(r=>r.date>=range.start&&r.date<=range.end);
      const previousRows=rawBase.filter(r=>(r.date||'').startsWith(String(priorYear))&&r.date>=priorStart&&r.date<=priorEnd);
      const filteredBase=[...currentRows,...previousRows];
      const activeRowsFn=mgmtBaseRows;
      mgmtBaseRows=()=>filteredBase;
      let result;
      try{result=baseRender.apply(this,arguments)}finally{mgmtBaseRows=activeRowsFn}
      const root=$('managementDashboardView');
      if(root){
        root.insertAdjacentHTML('afterbegin',rangeMarkup(range,years));
        bindRange(range,years,defaultYear);
        const hero=root.querySelector('.mgmt-hero p');
        if(hero)hero.innerHTML=`Gerealiseerde omzet van <strong>${esc(fmtDate(range.start))}</strong> t/m <strong>${esc(fmtDate(range.end))}</strong>, vergeleken met dezelfde periode in ${priorYear}.`;
        const badge=root.querySelector('.mgmt-period-badge');
        if(badge)badge.textContent=range.start===`${year}-01-01`&&range.end===range.max?`${year} YTD`:`${fmtDate(range.start)} – ${fmtDate(range.end)}`;
        renderProductTypeChart(currentRows,previousRows,year);
      }
      return result;
    }catch(e){
      console.error('Management enhancements failed; using base dashboard',e);
      try{mgmtBaseRows=baseRowsFn}catch(_){}
      return baseRender.apply(this,arguments);
    }
  };
})();
