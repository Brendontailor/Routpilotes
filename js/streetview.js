function setStreetViewMode(active,renderNow=true) {
  if(active&&identifyPointMode){if(typeof cancelAnnotatePoint==='function')cancelAnnotatePoint(false);setIdentifyPointMode(false,false);}
  if(active&&typeof closeLayers==='function')closeLayers(false);
  if(active&&typeof closeTools==='function')closeTools(false);
  streetViewMode=Boolean(active&&map);
  $('streetViewButton').setAttribute('aria-pressed',String(streetViewMode));
  $('streetViewHint').hidden=!streetViewMode;
  $('streetViewStatus').textContent=streetViewMode?'Agora clique em uma rua':'Clique ou arraste o técnico';
  document.querySelector('.map-canvas').classList.toggle('street-view-active',streetViewMode);
  if(renderNow&&typeof renderDesktopShell==='function')renderDesktopShell();
}
function streetViewUrl(latlng) {
  const viewpoint=`${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(viewpoint)}`;
}
function openStreetViewAt(latlng) {
  const url=streetViewUrl(latlng);
  setStreetViewMode(false);
  window.open(url,'_blank','noopener,noreferrer');
}
function initStreetViewLauncher() {
  const button=$('streetViewButton'),mapNode=$('map');
  if(!map){button.disabled=true;$('streetViewStatus').textContent='Mapa indisponível';return;}
  button.addEventListener('click',()=>setStreetViewMode(!streetViewMode));
  $('streetViewCancel').addEventListener('click',()=>setStreetViewMode(false));
  button.addEventListener('dragstart',event=>{
    setStreetViewMode(true);
    event.dataTransfer.effectAllowed='copy';
    event.dataTransfer.setData('text/plain','routepilot-street-view');
  });
  mapNode.addEventListener('dragover',event=>{if(streetViewMode){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
  mapNode.addEventListener('drop',event=>{
    if(!streetViewMode)return;
    event.preventDefault();event.stopPropagation();
    const rect=mapNode.getBoundingClientRect();
    openStreetViewAt(map.containerPointToLatLng(L.point(event.clientX-rect.left,event.clientY-rect.top)));
  });
  mapNode.addEventListener('click',event=>{
    if(!streetViewMode)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const rect=mapNode.getBoundingClientRect();
    openStreetViewAt(map.containerPointToLatLng(L.point(event.clientX-rect.left,event.clientY-rect.top)));
  },true);
}
