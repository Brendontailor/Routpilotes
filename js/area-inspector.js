/* Recurso RoutePilot: identificação de pontos e áreas. */
let identifyPointMode=false;
let identifiedArea=null;
let identifiedMarker=null;

const areaTypeLabels={bairro:'Área urbana',distrito:'Distrito',localidade:'Localidade rural',centro:'Área central',estrada:'Eixo rodoviário',referencia:'Referência',boundary:'Bairro'};

/** Guia: Interpreta os dados recebidos em identificação de pontos e áreas (`parseCoordinateQuery`). */
function parseCoordinateQuery(value) {
  const text=String(value||'').trim();
  const match=text.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:,\s*|\s+)([+-]?\d+(?:\.\d+)?)$/);
  if(!match)return {matched:false,valid:false};
  const lat=Number(match[1]),lng=Number(match[2]);
  return {matched:true,valid:Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180,lat,lng};
}

/** Guia: Executa uma etapa auxiliar em identificação de pontos e áreas (`regionAtCoordinates`). */
function regionAtCoordinates(lat,lng) {
  const matches=regions.filter(region=>regionContainsPoint(region,lat,lng));
  return matches.sort((a,b)=>distanceKm([lat,lng],a.center)-distanceKm([lat,lng],b.center))[0]||null;
}

/** Guia: Localiza o item correspondente em identificação de pontos e áreas (`nearestItem`). */
function nearestItem(items,lat,lng,coordinates=item=>[item.lat,item.lon]) {
  return items.reduce((best,item)=>{
    const km=distanceKm([lat,lng],coordinates(item));
    return !best||km<best.km?{item,km}:best;
  },null);
}

/** Guia: Executa uma etapa auxiliar em identificação de pontos e áreas (`analyzeCoordinates`). */
function analyzeCoordinates(lat,lng) {
  const region=regionAtCoordinates(lat,lng);
  const scopedPoints=region?points.filter(point=>point.region===region.id&&point.kind!=='referencia'):[];
  const scopedReferences=region?(mapDetails.pois||[]).filter(reference=>regionContainsPoint(region,reference.lat,reference.lon)):[];
  const nearestPoint=nearestItem(scopedPoints,lat,lng);
  const nearestReference=nearestItem(scopedReferences,lat,lng);
  return {
    lat,lng,insideCoverage:Boolean(region),region,city:region?.city||null,
    nearestPoint,nearestReference,
    areaType:nearestPoint?areaTypeLabels[nearestPoint.item.kind]||null:null,
    source:'coordinate'
  };
}

/** Guia: Calcula o resultado solicitado em identificação de pontos e áreas (`distanceLabel`). */
function distanceLabel(km) {
  if(!Number.isFinite(km))return 'Não informado';
  return km<1?`${Math.round(km*1000)} m`:`${km.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} km`;
}

/** Guia: Executa uma etapa auxiliar em identificação de pontos e áreas (`coordinateSearchHtml`). */
function coordinateSearchHtml(parsed) {
  if(!parsed.matched)return null;
  if(!parsed.valid)return '<section class="coordinate-result is-invalid"><h2>Coordenadas inválidas</h2><p>Use latitude entre -90 e 90 e longitude entre -180 e 180.</p></section>';
  return `<section class="coordinate-result"><div class="section-title">Coordenadas reconhecidas</div><button type="button" class="nav-row" data-action="identifyCoordinates" data-lat="${parsed.lat}" data-lng="${parsed.lng}"><span class="coordinate-icon">${iconSvg('pin')}</span><span class="nav-copy"><b>${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}</b><small>Identificar este ponto no mapa</small></span><span class="chevron">›</span></button></section>`;
}

/** Guia: Executa uma etapa auxiliar em identificação de pontos e áreas (`setIdentifyPointMode`). */
function setIdentifyPointMode(active,renderNow=true) {
  if(active&&(!state.city&&!state.region&&!state.overview))generalMap();
  identifyPointMode=Boolean(active&&map);
  if(identifyPointMode&&streetViewMode)setStreetViewMode(false,false);
  $('identifyPointButton').setAttribute('aria-pressed',String(identifyPointMode));
  $('identifyPointHint').hidden=!identifyPointMode;
  document.querySelector('.map-canvas').classList.toggle('identify-point-active',identifyPointMode);
  if(renderNow&&typeof renderDesktopShell==='function')renderDesktopShell();
}

/** Guia: Limpa dados ou estados temporários em identificação de pontos e áreas (`clearIdentifiedArea`). */
function clearIdentifiedArea(renderNow=true) {
  identifiedArea=null;
  areaPanelMode='identify';areaUnderstandingContext=null;
  if(typeof clearRadiusSearch==='function')clearRadiusSearch();
  if(identifiedMarker&&map){map.removeLayer(identifiedMarker);identifiedMarker=null;}
  if(renderNow){renderAreaInspector();if(typeof renderDesktopShell==='function')renderDesktopShell();}
}

/** Guia: Executa uma etapa auxiliar em identificação de pontos e áreas (`identifiedMarkerIcon`). */
function identifiedMarkerIcon() {
  return L.divIcon({className:'',html:'<span class="identified-pin"><span></span></span>',iconSize:[30,38],iconAnchor:[15,36]});
}

/** Guia: Executa uma etapa auxiliar em identificação de pontos e áreas (`identifyCoordinates`). */
function identifyCoordinates(lat,lng,{source='search',reference=null,note=null}={}) {
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return;
  const openNoteForm=typeof annotatePointMode!=='undefined'&&annotatePointMode;
  if(!state.city&&!state.region&&!state.overview)generalMap();
  mapHidden=false;
  setIdentifyPointMode(false);
  identifiedArea={...analyzeCoordinates(lat,lng),source,reference,note};
  state.searchOpen=false;state.query='';$('q').value='';
  if(identifiedMarker&&map)map.removeLayer(identifiedMarker);
  if(map)identifiedMarker=L.marker([lat,lng],{zIndexOffset:900,title:'Ponto identificado',icon:identifiedMarkerIcon()}).addTo(map);
  render();
  if(openNoteForm){cancelAnnotatePoint();showAddNoteForm();}
  if(map){
    const zoomDestino=Math.max(map.getZoom(),CONFIGURACAO_MAPA.zoomPontoIdentificado);
    map.flyTo([lat,lng],zoomDestino,{duration:.4});
    identifiedMarker.bindTooltip('Ponto identificado',{direction:'top'}).openTooltip();
  }
}

/** Guia: Renderiza a parte correspondente da interface em identificação de pontos e áreas (`renderAreaInspector`). */
function renderAreaInspector() {
  const panel=$('areaInspector');
  if(typeof renderAddressRadiusPanel==='function'&&renderAddressRadiusPanel(panel))return;
  if(typeof renderRadiusPanel==='function'&&renderRadiusPanel(panel))return;
  if(typeof renderAreaIntelligencePanel==='function'&&renderAreaIntelligencePanel(panel))return;
  panel.hidden=!identifiedArea;
  if(!identifiedArea){panel.innerHTML='';return;}
  const item=identifiedArea,region=item.region,nearest=item.nearestPoint,reference=item.nearestReference;
  const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lng}`)}`;
  const rows=item.insideCoverage?`
    <dl class="inspection-grid">
      <div><dt>Latitude</dt><dd>${item.lat.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>${item.lng.toFixed(6)}</dd></div>
      <div><dt>Cidade</dt><dd>${esc(cityName(item.city))}</dd></div><div><dt>Região operacional</dt><dd>${esc(region.name)}</dd></div>
      <div><dt>Localidade mais próxima</dt><dd>${nearest?`${esc(nearest.item.name)} · ${distanceLabel(nearest.km)}`:'Não informado'}</dd></div>
      <div><dt>Referência mais próxima</dt><dd>${reference?`${esc(reference.item.name)} · ${distanceLabel(reference.km)}`:'Não informado'}</dd></div>
      <div><dt>Tipo de área</dt><dd>${esc(item.areaType||'Não informado')}</dd></div>
    </dl>`:`<div class="coverage-warning"><b>Fora da cobertura</b><p>Este ponto está fora da cobertura cadastrada do RoutePilot.</p></div><dl class="inspection-grid"><div><dt>Latitude</dt><dd>${item.lat.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>${item.lng.toFixed(6)}</dd></div></dl>`;
  const note=item.note;
  const noteCard=note?`<article class="review-note selected-note" data-note-id="${esc(note.id)}"><div class="note-state is-${esc(note.status)}">${esc(noteStatusLabel(note.status))}</div><h3>${esc(note.text)}</h3><p><b>Tipo:</b> ${esc(noteTypeLabel(note.type))}</p><p><b>Coordenadas:</b> ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</p><div class="review-actions">${note.status==='pending'?`<button data-action="validateOperationalNote" data-id="${esc(note.id)}">Validar</button><button data-action="editOperationalNote" data-id="${esc(note.id)}">Editar</button><button data-action="rejectOperationalNote" data-id="${esc(note.id)}">Rejeitar</button>`:'<button data-action="editOperationalNote" data-id="'+esc(note.id)+'">Editar</button>'}</div><div class="note-edit-host"></div></article>`:'';
  const actions=`<div class="inspector-actions" aria-label="Ações para este ponto"><button type="button" data-action="understandArea">${iconSvg('crosshair')}Entender área</button><button type="button" data-action="aroundArea">${iconSvg('radius')}Ver ao redor</button><button type="button" data-action="addressRadius">${iconSvg('home')}Ver números no raio</button><button type="button" data-action="streetViewCoordinates">${iconSvg('pin')}Street View</button><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${iconSvg('pin')}Google Maps</a>${item.insideCoverage?`<button type="button" data-action="compareCoordinates">${iconSvg('road')}Comparar</button>`:''}<button type="button" data-action="shareArea">${iconSvg('link')}Compartilhar</button></div>`;
  panel.innerHTML=`${noteCard||rows}${actions}${note?'':addNoteSection(item.lat,item.lng)}`;
  renderNearbyOperationalNotes(item.lat,item.lng);
}

/** Guia: Processa e organiza os itens em identificação de pontos e áreas (`compareIdentifiedCoordinates`). */
function compareIdentifiedCoordinates() {
  if(!identifiedArea?.insideCoverage)return;
  registerCoordinateComparison(identifiedArea);
}
