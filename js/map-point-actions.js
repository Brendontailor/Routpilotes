function mapPointMenuHtml(lat,lng) {
  const area=analyzeCoordinates(lat,lng);
  const place=area.region?`${area.region.name} · ${cityName(area.region.city)}`:'Fora das regiões cadastradas';
  return `<div class="map-point-menu"><small>PONTO NO MAPA</small><b>${esc(place)}</b><span>${lat.toFixed(6)}, ${lng.toFixed(6)}</span><div class="map-point-menu-actions"><button type="button" data-action="focusMapCoordinates" data-lat="${lat}" data-lng="${lng}">${iconSvg('home')}Focar números nesta área</button><button type="button" data-action="shareMapCoordinates" data-lat="${lat}" data-lng="${lng}">${iconSvg('link')}Compartilhar localização</button><button type="button" data-action="copyMapCoordinates" data-lat="${lat}" data-lng="${lng}">${iconSvg('pin')}Copiar coordenadas</button></div></div>`;
}

function openMapPointMenu(lat,lng) {
  if(!map||!Number.isFinite(lat)||!Number.isFinite(lng))return;
  L.popup({className:'map-point-action-popup',maxWidth:310})
    .setLatLng([lat,lng])
    .setContent(mapPointMenuHtml(lat,lng))
    .openOn(map);
}

function focusMapCoordinates(lat,lng) {
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  map?.closePopup();
  identifyCoordinates(lat,lng,{source:'map'});
  openAddressRadius(currentAreaContext());
}
