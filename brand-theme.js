window.DropboardBrand={
  teal:'#13adb6',
  dark:'#343941',
  deepTeal:'#0b4447',
  coral:'#e25e59',
  grey:'#949797',
  lightGrey:'#d6d7d9',
  palette:['#13adb6','#0b4447','#e25e59','#949797','#343941','#d6d7d9']
};

(function applyDropboardPlotlyTheme(){
  if(!window.Plotly||window.Plotly.__dropboardThemeApplied)return;
  const original=window.Plotly.newPlot.bind(window.Plotly);
  const brand=window.DropboardBrand;
  const fontFamily='Muli, Mulish, Segoe UI, Arial, sans-serif';
  const axisDefaults={
    gridcolor:'#eceeee',
    zerolinecolor:'#d6d7d9',
    linecolor:'#d6d7d9',
    tickcolor:'#d6d7d9',
    tickfont:{color:'#777c80',family:fontFamily}
  };
  function mergeAxis(base,custom){
    return {...base,...(custom||{}),tickfont:{...base.tickfont,...((custom||{}).tickfont||{})}};
  }
  window.Plotly.newPlot=function(gd,data,layout,config){
    const themed={
      colorway:brand.palette,
      paper_bgcolor:'transparent',
      plot_bgcolor:'transparent',
      font:{family:fontFamily,color:brand.dark},
      xaxis:mergeAxis(axisDefaults,layout?.xaxis),
      yaxis:mergeAxis(axisDefaults,layout?.yaxis),
      legend:{font:{family:fontFamily,color:brand.dark},...(layout?.legend||{})},
      ...(layout||{})
    };
    themed.font={family:fontFamily,color:brand.dark,...((layout||{}).font||{})};
    themed.xaxis=mergeAxis(axisDefaults,(layout||{}).xaxis);
    themed.yaxis=mergeAxis(axisDefaults,(layout||{}).yaxis);
    themed.legend={font:{family:fontFamily,color:brand.dark},...((layout||{}).legend||{})};
    return original(gd,data,themed,config);
  };
  window.Plotly.__dropboardThemeApplied=true;
})();
