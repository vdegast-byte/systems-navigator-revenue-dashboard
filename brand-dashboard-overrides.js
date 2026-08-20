(function(){
  if(typeof mgmtRender!=='function')return;
  const originalMgmtRender=mgmtRender;
  const palette=window.DropboardBrand?.palette||['#13adb6','#0b4447','#e25e59','#949797','#343941','#d6d7d9'];

  function brandManagementTreemap(){
    const target=document.getElementById('mgmtCustomerTreemap');
    if(!target||!window.Plotly||!state?.rows?.length)return;
    const base=typeof mgmtBaseRows==='function'?mgmtBaseRows():state.rows;
    const year=typeof mgmtYear==='function'?mgmtYear(base):Math.max(...base.map(r=>Number((r.date||'').slice(0,4))).filter(Boolean));
    const rows=base.filter(r=>(r.date||'').startsWith(String(year)));
    const dates=rows.map(r=>r.date).filter(Boolean).sort();
    if(!dates.length)return;
    const cutoff=dates.at(-1);
    const current=rows.filter(r=>r.date<=cutoff);
    const mix=new Map();
    current.forEach(r=>{
      const customer=typeof mgmtCustomer==='function'?mgmtCustomer(r):(r.customer||r.account||'Onbekend');
      const group=clean(r.group)||'Onbekend';
      const value=Number(r.revenue)||0;
      if(!mix.has(customer))mix.set(customer,new Map());
      const m=mix.get(customer);m.set(group,(m.get(group)||0)+value);
    });
    const groupTotals=new Map();
    current.forEach(r=>{const g=clean(r.group)||'Onbekend';groupTotals.set(g,(groupTotals.get(g)||0)+(Number(r.revenue)||0))});
    const groups=[...groupTotals.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    const groupColors=new Map(groups.map((g,i)=>[g,palette[i%palette.length]]));
    const labels=[],colors=[];
    [...mix.entries()].forEach(([customer,m])=>{
      const total=[...m.values()].reduce((a,b)=>a+b,0);if(total<=0)return;
      const dominant=[...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Onbekend';
      labels.push(customer);colors.push(groupColors.get(dominant)||palette[0]);
    });
    if(labels.length)try{Plotly.restyle(target,{'marker.colors':[colors]});}catch(e){console.debug('Brand treemap restyle skipped',e)}

    const legend=document.querySelector('.mgmt-product-legend');
    if(legend){
      legend.querySelectorAll('span').forEach(item=>{
        const group=(item.textContent||'').trim();
        const swatch=item.querySelector('i');
        if(swatch)swatch.style.background=groupColors.get(group)||palette[0];
      });
    }
  }

  mgmtRender=function(){
    const result=originalMgmtRender.apply(this,arguments);
    setTimeout(brandManagementTreemap,0);
    return result;
  };
})();
