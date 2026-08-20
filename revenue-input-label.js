window.addEventListener('DOMContentLoaded',()=>{
  const button=document.querySelector('#mainNav button[data-view="invoices"]');
  if(!button)return;
  button.addEventListener('click',()=>{
    const title=document.getElementById('pageTitle');
    const subtitle=document.getElementById('pageSubtitle');
    if(title)title.textContent='Revenue input';
    if(subtitle)subtitle.textContent='Beheer gerealiseerde facturen en voeg tags toe voor omzetanalyse.';
  });
});
