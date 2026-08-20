(function(){
  if(typeof mgmtRender!=='function')return;
  const baseMgmtRender=mgmtRender;

  function refineQuarterChart(){
    const chart=document.getElementById('mgmtQuarterChart');
    if(!chart||!window.Plotly||!chart.data?.length)return;
    try{
      Plotly.restyle(chart,{
        'marker.color':'#ffffff',
        'marker.line.color':'#777c80',
        'marker.line.width':1.8,
        'marker.pattern.shape':'/',
        'marker.pattern.fgcolor':'#777c80',
        'marker.pattern.bgcolor':'#ffffff',
        'marker.pattern.size':14,
        'marker.pattern.solidity':0.74,
        'marker.pattern.fillmode':'replace',
        'textposition':'outside',
        'texttemplate':'<b>%{text}</b>',
        'textfont.color':'#343941',
        'textfont.size':13,
        'cliponaxis':false
      },[0]);
      if(chart.data.length>1){
        Plotly.restyle(chart,{
          'marker.color':'#13adb6',
          'marker.line.color':'#0b4447',
          'marker.line.width':1.1,
          'marker.pattern.shape':'',
          'marker.pattern.fgcolor':'#13adb6',
          'marker.pattern.bgcolor':'#13adb6',
          'marker.pattern.solidity':1,
          'marker.pattern.fillmode':'replace',
          'textposition':'outside',
          'texttemplate':'<b>%{text}</b>',
          'textfont.color':'#0b4447',
          'textfont.size':13,
          'cliponaxis':false
        },[1]);
      }
      Plotly.relayout(chart,{
        'margin.t':48,
        'uniformtext.minsize':12,
        'uniformtext.mode':'show'
      });
    }catch(e){console.debug('Quarter chart refinement skipped',e)}
  }

  function refineCustomerMetric(){
    if(typeof mgmtBaseRows!=='function'||typeof mgmtCustomer!=='function')return;
    const year=Number(document.getElementById('filterYear')?.value);if(!year)return;
    const base=mgmtBaseRows(),currentAll=base.filter(r=>(r.date||'').startsWith(String(year))),dates=currentAll.map(r=>r.date).filter(Boolean).sort();if(!dates.length)return;
    const lastDate=dates.at(-1),priorYear=year-1,priorCutoff=`${priorYear}-${lastDate.slice(5)}`;
    const current=currentAll.filter(r=>r.date<=lastDate),previous=base.filter(r=>(r.date||'').startsWith(String(priorYear))&&r.date<=priorCutoff);
    const positiveCount=rows=>{const m=new Map();rows.forEach(r=>{const k=mgmtCustomer(r);m.set(k,(m.get(k)||0)+(Number(r.revenue)||0))});return [...m.values()].filter(v=>v>0).length};
    const currentCount=positiveCount(current),previousCount=positiveCount(previous),total=current.reduce((s,r)=>s+(Number(r.revenue)||0),0);
    const metric=[...document.querySelectorAll('.mgmt-metrics .metric')].find(card=>(card.querySelector('.label')?.textContent||'').includes('Klanten met omzet'));
    if(!metric)return;
    const value=metric.querySelector('.value'),sub=metric.querySelector('.sub');
    if(value)value.textContent=String(currentCount);
    if(sub)sub.textContent=`${previousCount} in ${priorYear} · gemiddeld ${eur(currentCount?total/currentCount:0)} per klant`;
  }

  mgmtRender=function(){
    const result=baseMgmtRender.apply(this,arguments);
    setTimeout(()=>{refineQuarterChart();refineCustomerMetric()},0);
    return result;
  };

  window.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('#mainNav button').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.view!=='managementDashboard')document.querySelector('.year-filter')?.classList.add('hidden');
    }));
  });
})();
