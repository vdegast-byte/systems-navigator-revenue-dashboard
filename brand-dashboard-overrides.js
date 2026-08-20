(function(){
  if(typeof mgmtRender!=='function')return;
  const originalMgmtRender=mgmtRender;
  const brand=window.DropboardBrand||{
    teal:'#13adb6',deepTeal:'#0b4447',coral:'#e25e59',grey:'#949797',dark:'#343941',lightGrey:'#d6d7d9'
  };

  function productGroupColor(group){
    const g=String(group||'').trim().toLowerCase();
    if(!g||g==='onbekend'||g==='unknown')return brand.lightGrey||'#d6d7d9';
    if(g.includes('dropboard'))return brand.teal||'#13adb6';
    if(g.includes('scenario navigator')||g==='scenario' || g.includes('navigator'))return brand.deepTeal||'#0b4447';
    if(g.includes('simulation')||g.includes('simio')||g.includes('arena')||g.includes('consult'))return brand.dark||'#343941';
    if(g.includes('other')||g.includes('overig'))return brand.grey||'#949797';
    return brand.grey||'#949797';
  }

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

    const colors=[];
    [...mix.entries()].forEach(([customer,m])=>{
      const total=[...m.values()].reduce((a,b)=>a+b,0);if(total<=0)return;
      const dominant=[...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Onbekend';
      colors.push(productGroupColor(dominant));
    });

    if(colors.length)try{Plotly.restyle(target,{'marker.colors':[colors]});}catch(e){console.debug('Brand treemap restyle skipped',e)}

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
