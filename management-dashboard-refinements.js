(function(){
  if(typeof mgmtRender!=='function')return;
  const baseMgmtRender=mgmtRender;

  function refineQuarterChart(){
    const chart=document.getElementById('mgmtQuarterChart');
    if(!chart||!window.Plotly||!chart.data?.length)return;
    try{
      Plotly.restyle(chart,{
        'marker.color':'#ffffff',
        'marker.line.color':'#949797',
        'marker.line.width':1.5,
        'marker.pattern.shape':'/',
        'marker.pattern.fgcolor':'#949797',
        'marker.pattern.bgcolor':'#ffffff',
        'marker.pattern.size':10,
        'marker.pattern.solidity':0.52,
        'marker.pattern.fillmode':'replace',
        'textfont.color':'#343941'
      },[0]);
      if(chart.data.length>1){
        Plotly.restyle(chart,{
          'marker.color':'#13adb6',
          'marker.line.color':'#0b4447',
          'marker.line.width':1,
          'marker.pattern.shape':'',
          'marker.pattern.fgcolor':'#13adb6',
          'marker.pattern.bgcolor':'#13adb6',
          'marker.pattern.solidity':1,
          'marker.pattern.fillmode':'replace',
          'textfont.color':'#ffffff'
        },[1]);
      }
    }catch(e){console.debug('Quarter chart refinement skipped',e)}
  }

  mgmtRender=function(){
    const result=baseMgmtRender.apply(this,arguments);
    setTimeout(refineQuarterChart,0);
    return result;
  };

  window.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('#mainNav button').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.view!=='managementDashboard')document.querySelector('.year-filter')?.classList.add('hidden');
    }));
  });
})();
