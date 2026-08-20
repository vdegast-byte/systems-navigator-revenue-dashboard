(function(){
  const previousRender=render;

  function selected(id){const e=$(id);return e?[...e.selectedOptions].map(o=>o.value):[]}
  function quarter(date){const m=Number((date||'').slice(5,7));return m?`Q${Math.ceil(m/3)}`:''}
  function canonicalCountry(name){
    const raw=clean(name),key=raw.toLowerCase();
    const aliases={
      'nederland':'Netherlands','the netherlands':'Netherlands','netherlands':'Netherlands',
      'belgie':'Belgium','belgië':'Belgium','belgium':'Belgium',
      'duitsland':'Germany','germany':'Germany',
      'frankrijk':'France','france':'France',
      'verenigd koninkrijk':'United Kingdom','united kingdom':'United Kingdom','uk':'United Kingdom','great britain':'United Kingdom','england':'United Kingdom',
      'verenigde staten':'United States','united states':'United States','united states of america':'United States','usa':'United States','us':'United States','u.s.':'United States','u.s.a.':'United States',
      'noorwegen':'Norway','norway':'Norway',
      'zweden':'Sweden','sweden':'Sweden',
      'finland':'Finland','denmark':'Denmark','denemarken':'Denmark',
      'spanje':'Spain','spain':'Spain','italie':'Italy','italië':'Italy','italy':'Italy',
      'portugal':'Portugal','poland':'Poland','polen':'Poland','switzerland':'Switzerland','zwitserland':'Switzerland','austria':'Austria','oostenrijk':'Austria',
      'bahrain':'Bahrain','singapore':'Singapore','thailand':'Thailand','qatar':'Qatar',
      'uae':'United Arab Emirates','united arab emirates':'United Arab Emirates','verenigde arabische emiraten':'United Arab Emirates',
      'saudi arabia':'Saudi Arabia','saudi-arabia':'Saudi Arabia','saoedi-arabie':'Saudi Arabia','saoedi-arabië':'Saudi Arabia',
      'canada':'Canada','brazil':'Brazil','brazilië':'Brazil','brazilie':'Brazil','mexico':'Mexico','mexico':'Mexico',
      'china':'China','japan':'Japan','south korea':'South Korea','korea':'South Korea','india':'India',
      'australia':'Australia','australië':'Australia','australie':'Australia','new zealand':'New Zealand','nieuw-zeeland':'New Zealand',
      'south africa':'South Africa','zuid-afrika':'South Africa','kenya':'Kenya','egypte':'Egypt','egypt':'Egypt',
      'turkey':'Turkey','türkiye':'Turkey','turkije':'Turkey','greece':'Greece','griekenland':'Greece',
      'ireland':'Ireland','ierland':'Ireland','luxembourg':'Luxembourg','luxemburg':'Luxembourg'
    };
    return aliases[key]||raw;
  }

  function dropboardRowsForCurrentView(){
    const f=filters(),quarters=selected('filterQuarter');
    const base=state.rows.filter(r=>{
      if(clean(r.group).toLowerCase()!=='dropboard')return false;
      for(const k of ['company','customer','account','industry','type','country','supplier'])if(f[k]?.length&&!f[k].includes(r[k]))return false;
      if(quarters.length&&!quarters.includes(clean(r.quarter)||quarter(r.date)))return false;
      if(f.q&&!`${r.customer} ${r.account} ${r.invoice} ${r.description}`.toLowerCase().includes(f.q))return false;
      return true;
    });
    const dates=base.map(r=>r.date).filter(Boolean).sort();
    if(!dates.length)return[];
    let start=$('filterStart')?.value||'',end=$('filterEnd')?.value||'';
    const preset=$('filterPreset')?.value||'all',spansYears=start&&end&&start.slice(0,4)!==end.slice(0,4);
    if(preset==='all'||!start||!end||spansYears){const max=dates.at(-1),year=max.slice(0,4);start=`${year}-01-01`;end=max}
    return base.filter(r=>r.date>=start&&r.date<=end);
  }

  function renderDropboardWorldMap(){
    if(view!=='dropboardRevenue'||!window.Plotly)return;
    const chart=$('dropboardCountryChart');if(!chart)return;
    const rows=dropboardRowsForCurrentView();
    const map=new Map();
    rows.forEach(r=>{const country=canonicalCountry(r.country);if(!country||country.toLowerCase()==='onbekend')return;map.set(country,(map.get(country)||0)+(Number(r.revenue)||0))});
    const data=[...map.entries()].filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]);
    const heading=[...document.querySelectorAll('#dropboardRevenueView .dropboard-card-head h3')].find(h=>(h.textContent||'').trim()==='Omzet per land');
    if(heading){heading.textContent='Dropboard omzet per land';const p=heading.parentElement?.querySelector('p');if(p)p.textContent='Hoe donkerder teal, hoe hoger de gerealiseerde Dropboard-omzet in dat land.'}
    if(!data.length){chart.innerHTML='<div class="muted">Geen landdata beschikbaar voor deze selectie.</div>';return}
    const max=Math.max(...data.map(x=>x[1]),1);
    Plotly.newPlot(chart,[{
      type:'choropleth',
      locations:data.map(x=>x[0]),
      z:data.map(x=>x[1]),
      text:data.map(x=>x[0]),
      locationmode:'country names',
      zmin:0,
      zmax:max,
      colorscale:[
        [0,'#eaf8f8'],
        [0.2,'#c9eeee'],
        [0.4,'#91dadd'],
        [0.6,'#54c6cc'],
        [0.8,'#13adb6'],
        [1,'#0b4447']
      ],
      reversescale:false,
      marker:{line:{color:'#ffffff',width:0.7}},
      colorbar:{title:{text:'Omzet'},tickprefix:'€',tickformat:'~s',thickness:12,len:0.72,outlinewidth:0},
      hovertemplate:'<b>%{text}</b><br>Dropboard omzet: €%{z:,.0f}<extra></extra>'
    }],{
      height:430,
      margin:{l:0,r:0,t:5,b:0},
      paper_bgcolor:'transparent',
      geo:{
        scope:'world',projection:{type:'natural earth'},showframe:false,showcoastlines:false,showcountries:true,countrycolor:'#d6d7d9',showland:true,landcolor:'#f3f4f4',showocean:true,oceancolor:'#ffffff',bgcolor:'transparent'
      },
      font:{family:'Muli, Mulish, Segoe UI, Arial, sans-serif',color:'#343941'}
    },{displayModeBar:false,responsive:true});
  }

  render=function(){
    const result=previousRender.apply(this,arguments);
    if(view==='dropboardRevenue')setTimeout(renderDropboardWorldMap,0);
    return result;
  };
})();
