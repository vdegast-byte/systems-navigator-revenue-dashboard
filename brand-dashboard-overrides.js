(function(){
  if(typeof mgmtRender!=='function')return;
  const originalMgmtRender=mgmtRender;
  const brand=window.DropboardBrand||{teal:'#13adb6',deepTeal:'#0b4447',coral:'#e25e59',grey:'#949797',dark:'#343941',lightGrey:'#d6d7d9'};

  function productGroupColor(group){
    const g=String(group||'').trim().toLowerCase();
    if(!g||g==='onbekend'||g==='unknown')return brand.lightGrey||'#d6d7d9';
    if(g.includes('dropboard'))return brand.teal||'#13adb6';
    if(g.includes('scenario navigator')||g==='scenario'||g.includes('navigator'))return brand.deepTeal||'#0b4447';
    if(g.includes('simulation')||g.includes('simio')||g.includes('arena')||g.includes('consult'))return brand.dark||'#343941';
    if(g.includes('other')||g.includes('overig'))return brand.grey||'#949797';
    return brand.grey||'#949797';
  }

  function brandManagementTreemap(){
    const target=document.getElementById('mgmtCustomerTreemap');
    if(!target||!window.Plotly)return;
    const trace=target.data?.[0];
    const groups=Array.isArray(trace?.customdata)?trace.customdata:[];
    if(groups.length){
      const colors=groups.map(productGroupColor);
      try{Plotly.restyle(target,{'marker.colors':[colors]});}
      catch(e){console.debug('Brand treemap restyle skipped',e)}
    }
    const legend=document.querySelector('.mgmt-product-legend');
    if(legend){
      legend.querySelectorAll('span').forEach(item=>{
        const group=(item.textContent||'').trim();
        const swatch=item.querySelector('i');
        if(swatch)swatch.style.background=productGroupColor(group);
      });
    }
  }

  mgmtRender=function(){
    const result=originalMgmtRender.apply(this,arguments);
    setTimeout(brandManagementTreemap,0);
    return result;
  };
})();
