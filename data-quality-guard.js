(function(){
  // Protect analytics against malformed historical rows that exist in the source workbook.
  // A valid SN/SNC invoice number may be numeric or alphanumeric, but it should never be a
  // floating-point number such as 4293394611.4011102. Those rows are corrupted source rows.
  function malformedInvoice(row){
    const invoice=clean(row?.invoice);
    return /^\d+\.\d+$/.test(invoice) && !/^\d+\.0+$/.test(invoice);
  }

  function validRevenueRow(row){
    return !!row && !malformedInvoice(row);
  }

  function analyticsKey(row){
    if(typeof id==='function')return id(row);
    return [row.company,row.invoice,row.date,row.customer,row.description,row.revenue,row.group,row.type]
      .map(clean).join('|');
  }

  function cleanAnalyticsRows(rows){
    const seen=new Set();
    const output=[];
    let malformed=0,duplicates=0;
    for(const row of rows||[]){
      if(!validRevenueRow(row)){malformed++;continue}
      const key=analyticsKey(row);
      if(seen.has(key)){duplicates++;continue}
      seen.add(key);output.push(row);
    }
    return {rows:output,malformed,duplicates};
  }

  window.isAnalyticsRevenueRow=validRevenueRow;
  window.cleanAnalyticsRevenueRows=rows=>cleanAnalyticsRows(rows).rows;

  // Do not import malformed source records in future uploads.
  if(typeof records==='function'){
    const baseRecords=records;
    records=function(rows){
      return cleanAnalyticsRows(baseRecords(rows)).rows;
    };
  }

  // Keep exports and the standard dashboard aligned with the audited analytics dataset.
  if(typeof filtered==='function'){
    const baseFiltered=filtered;
    filtered=function(){return cleanAnalyticsRows(baseFiltered()).rows};
  }

  // Existing browser databases may already contain bad/duplicate records from earlier tests.
  // Filter them only while rendering analytics; the original local data is left untouched so it
  // can still be inspected or backed up.
  if(typeof render==='function'){
    const baseRender=render;
    const auditedViews=new Set(['dashboard','managementDashboard','dropboardRevenue','vttiRevenue','saas','analysis']);
    render=function(){
      if(!auditedViews.has(view))return baseRender.apply(this,arguments);
      const original=state.rows;
      const audit=cleanAnalyticsRows(original);
      state.rows=audit.rows;
      let result;
      try{result=baseRender.apply(this,arguments)}finally{state.rows=original}

      if(view==='vttiRevenue'&&(audit.malformed||audit.duplicates)){
        const root=document.getElementById('vttiRevenueView');
        const head=root?.querySelector('.vtti-head');
        if(root&&!root.querySelector('.vtti-data-quality-note')){
          const note=document.createElement('div');
          note.className='callout warning vtti-data-quality-note';
          const parts=[];
          if(audit.malformed)parts.push(`${audit.malformed} ongeldige historische factuurregel${audit.malformed===1?'':'s'}`);
          if(audit.duplicates)parts.push(`${audit.duplicates} exacte dubbele regel${audit.duplicates===1?'':'s'}`);
          note.innerHTML=`<strong>Datacontrole:</strong> ${parts.join(' en ')} zijn niet meegenomen in de omzetanalyse. De lokale brondata is niet verwijderd.`;
          if(head)head.insertAdjacentElement('afterend',note);else root.prepend(note);
        }
      }
      return result;
    };
  }

  // The VTTI page is a historical account dashboard. When entering it, start with the full
  // available history and no customer/account/quarter restriction carried over from another view.
  // Users can immediately apply those filters again after the page has opened.
  window.addEventListener('DOMContentLoaded',()=>{
    const button=document.querySelector('#mainNav button[data-view="vttiRevenue"]');
    if(!button)return;
    button.addEventListener('click',()=>{
      const dates=(state.rows||[]).map(r=>r.date).filter(Boolean).sort();
      if(dates.length){
        const start=document.getElementById('filterStart');
        const end=document.getElementById('filterEnd');
        const preset=document.getElementById('filterPreset');
        if(start)start.value=dates[0];
        if(end)end.value=dates[dates.length-1];
        if(preset)preset.value='all';
      }

      ['filterCustomer','filterAccount','filterQuarter'].forEach(id=>{
        const select=document.getElementById(id);
        if(!select)return;
        [...select.options].forEach(option=>option.selected=false);
        if(typeof syncTrigger==='function')syncTrigger(select);
      });
      if(typeof updateChips==='function')updateChips();
    },{capture:true});
  });
})();
