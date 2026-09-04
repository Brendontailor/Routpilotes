function pushState() { history.push({...state}); if(history.length > 40) history.shift(); }
function navigate(patch, save=true) {
  patch={compare:null,...patch};
  clearTimeout(searchTimer);
  pendingCityChoice=null;
  mapHidden=false;
  if(save && Object.entries(patch).some(([key,value])=>state[key]!==value)) pushState();
  Object.assign(state,patch);
  render(); focusMap();
}
function prepareAreaNavigation() { if(typeof clearIdentifiedArea==='function'&&identifiedArea)clearIdentifiedArea(false);if(typeof clearRadiusSearch==='function')clearRadiusSearch();if(typeof clearAddressRadius==='function')clearAddressRadius();areaPanelMode='identify'; }
function selectCity(city) { prepareAreaNavigation();navigate({city, region:null,point:null,boundary:null,road:null,searchOpen:false,overview:false}); }
function selectRegion(id) { if(comparisonActive()){toggleCompareRegion(id);return;}const r=byRegion[id]; if(r) {prepareAreaNavigation();$('toggleRegions').checked=true;navigate({city:r.city,region:id,point:null,boundary:null,road:null,searchOpen:false,overview:false});} }
function selectPoint(id) { const p=pointFor(id); if(p) {prepareAreaNavigation();if(boundaryForPoint(p))$('toggleNeighborhoods').checked=true;else if(ruralPoint(p))$('toggleRegions').checked=true;navigate({city:p.city,region:p.region,point:p.id,boundary:boundaryForPoint(p)?.properties.id||null,road:null,searchOpen:false,overview:false});} }
function selectBoundary(id) {
  const f=boundaryById[id]; if(!f) return;
  $('toggleNeighborhoods').checked=true;
  const p=linkedPoint(f);
  if(p) selectPoint(p.id);
  else navigate({city:f.properties.city,region:f.properties.region,point:null,boundary:id,road:null,searchOpen:false,overview:false});
}
function mapPointClick(name) {
  const p=pointFor(name);if(!p)return;
  if(state.region!==p.region)selectRegion(p.region);else selectPoint(name);
}
function mapBoundaryClick(id) {
  const b=boundaryById[id]?.properties;if(!b)return;
  if(state.region!==b.region)selectRegion(b.region);else selectBoundary(id);
}
function selectRoad(name, point, region) {
  const r=byRegion[region]; if(r) navigate({city:r.city,region,point:point||null,boundary:boundaryForPoint(pointFor(point))?.properties.id||null,road:name,searchOpen:false,overview:false});
}
function goBack() {
  clearTimeout(searchTimer);
  if(pendingCityChoice){pendingCityChoice=null;renderSearch();return;}
  if(history.length) Object.assign(state,history.pop());
  else Object.assign(state,{city:null,region:null,point:null,boundary:null,road:null,query:'',searchOpen:false,overview:false,compare:null});
  $('q').value=state.query;
  render(); focusMap();
}
function generalMap() {
  if(typeof clearIdentifiedArea==='function')clearIdentifiedArea(false);
  navigate({city:null,region:null,point:null,boundary:null,road:null,query:'',searchOpen:false,overview:true});
  $('q').value='';
}
function goHome() {if(typeof clearIdentifiedArea==='function')clearIdentifiedArea(false);navigate({city:null,region:null,point:null,boundary:null,road:null,query:'',searchOpen:false,overview:false});$('q').value='';}
function sameNameChoices(entry) {
  const names=(entry.aliases||[entry.name]).map(clean);
  return INDICE_PESQUISA.filter(e=>e.kind!=='road'&&(e.aliases||[e.name]).some(n=>names.includes(clean(n))));
}
function askCity(choices) {
  const cities=[...new Set(choices.map(e=>e.city))];
  if(cities.length<2) return false;
  pendingCityChoice=choices;state.searchOpen=true;renderSearch();renderNavigation();renderDetails();return true;
}
function openEntry(e) {
  if(e.kind==='region') selectRegion(e.id);
  else if(e.kind==='point') selectPoint(e.id);
  else if(e.kind==='boundary') selectBoundary(e.id);
  else if(e.kind==='priority') openPriorityArea(e.id);
  else selectRoad(e.name,e.id,e.region);
}
function openResult(index) {
  const e=searchAll(state.query)[index]; if(!e) return;
  const namedCity=Object.keys(cityNames).find(city=>clean(state.query).includes(clean(city)));
  if(!namedCity && e.kind!=='road' && askCity(sameNameChoices(e))) return;
  openEntry(e);
}
function renderSearch() {
  $('results').hidden=!state.searchOpen;
  if(!state.searchOpen) return;
  const coordinate=parseCoordinateQuery(state.query);
  if(coordinate.matched){$('results').innerHTML=coordinateSearchHtml(coordinate);return;}
  if(pendingCityChoice){
    const cityChoices=[...new Set(pendingCityChoice.map(e=>e.city))];
    $('results').innerHTML='<section class="city-question"><h2>Em qual cidade?</h2><p>Esse nome aparece em mais de uma cidade.</p>'+cityChoices.map(city=>actionButton('chooseCity',city,cityName(city),pendingCityChoice.filter(e=>e.city===city).map(e=>e.name).join(', '))).join('')+'<button data-action="cancelCity" class="back-button">Voltar aos resultados</button></section>';return;
  }
  const matches=searchAll(state.query);
  const mapsUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(state.query+', RS, Brasil');
  $('results').innerHTML=`<div class="section-title">Resultados em todas as cidades <span>${matches.length === 40 ? '40+' : matches.length}</span></div>`+
    (matches.length ? matches.map((e,i) => actionButton('result',i,e.name,`${cityName(e.city)} · ${e.sub}`)).join('') : '<p class="empty">Nenhum local cadastrado com esse nome.</p>')+
    `<p class="address-note">Os números disponíveis aparecem no mapa em zoom 17+ ou pelo botão “Ver números no raio”. <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Conferir endereço no Google Maps</a></p>`;
}
function renderNavigation() {
  const r=byRegion[state.region], p=pointFor(state.point);
  $('startStats').innerHTML=`<span class="stat-chip">${Object.keys(cityNames).length} cidades</span><span class="stat-chip">${regions.length} regiões cadastradas</span><span class="stat-chip is-map">Mapa disponível</span>`;
  const heading=!state.city?'Navegar por regiões':!r?`Regiões de ${cityName(state.city)}`:!p?'Bairros e localidades':'Ruas e acessos';
  let html=`<div class="nav-top"><h2>${esc(heading)}</h2></div>`;
  if(!state.city) html+='<div class="city-grid">'+Object.keys(cityNames).map(city => {const total=regions.filter(r=>r.city===city).length;return actionButton('city',city,cityName(city),total+' '+(total===1?'região':'regiões'));}).join('')+'</div>';
  else if(!r) html+=regions.filter(r=>r.city===state.city).map(r => actionButton('region',r.id,`Região ${regionCode(r)} · ${r.name}`,points.filter(p=>p.region===r.id&&p.kind!=='referencia').length+' bairros e localidades')).join('');
  else if(state.boundary&&!p) html+=`<h3>${esc(boundaryById[state.boundary].properties.name)}</h3><p class="empty">Ruas ainda não cadastradas neste bairro. Consulte os nomes das vias na base do mapa.</p>`+actionButton('region',r.id,'Ver bairros desta região',r.name);
  else if(!p) html+=points.filter(p=>p.region===r.id&&p.kind!=='referencia').map(p=>actionButton('point',p.id,p.name,boundaryForPoint(p)?'Contorno disponível':'Ponto de localidade')).join('')+boundaries.features.filter(f=>f.properties.region===r.id&&!linkedPoint(f)).map(f=>actionButton('boundary',f.properties.id,f.properties.name,'Contorno · '+f.properties.source)).join('');
  else html+=streetNames(p).map(road=>actionButton('road',road,road,'Localidade: '+p.name,`data-point="${esc(p.id)}" data-region="${r.id}"`)).join('');
  $('navigation').innerHTML=html;
  $('navigation').hidden=state.searchOpen;
}
function renderDetails() {
  const r=byRegion[state.region], p=pointFor(state.point);
  $('details').hidden=!r || state.searchOpen;
  if(!r)return;
  const refs=points.filter(x=>x.region===r.id&&x.kind==='referencia');
  const detailedRefs=areaReferences();
  const boundary=boundaryById[state.boundary]?.properties;
  const context=currentAreaContext();
  const mapsUrl=context?googleMapsPointUrl(context.lat,context.lng):'';
  const pointActions=p?`<button data-action="understandArea">${iconSvg('crosshair')}Entender área</button><button data-action="aroundArea">${iconSvg('radius')}Ver ao redor</button><button data-action="addressRadius">${iconSvg('home')}Ver números no raio</button><button data-action="compareCurrent">${iconSvg('road')}Comparar</button><button data-action="showAddNote">${iconSvg('note')}Anotar</button><button data-action="streetViewContext">${iconSvg('pin')}Street View</button><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${iconSvg('pin')}Google Maps</a>`:`<button data-action="understandArea">${iconSvg('crosshair')}Entender região</button><button data-action="aroundArea">${iconSvg('radius')}Ver ao redor</button><button data-action="addressRadius">${iconSvg('home')}Ver números no raio</button><button data-action="compareCurrent">${iconSvg('road')}Comparar</button>`;
  const source=boundary?`Contorno de <b>${esc(boundary.name)}</b> (${esc(boundary.category)}). <a href="${boundary.sourceUrl}" target="_blank" rel="noopener noreferrer">${esc(boundary.source)}</a>`:p&&p.kind!=='referencia'?`Contorno próprio indisponível na base consultada. ${ruralPoint(p)?'Zoom na localidade; o contorno operacional aproximado da região permanece ativo.':'Exibindo o ponto da localidade.'}`:'Região de atendimento com limite operacional aproximado.';
  const nearbyPlaces=p?`<details class="context-section" open><summary>Bairros e localidades próximos</summary><div class="near-buttons">${nearButtons(p.nearby,p.nearbyText)||'<span class="near-unmapped">Nenhuma proximidade cadastrada.</span>'}</div></details>`:'';
  const references=referenceRows(detailedRefs.slice(0,10))+(refs.length?refs.map(ref=>`<button class="reference-row" data-action="point" data-value="${esc(ref.id)}">${referenceIcon(ref)}<span>${esc(ref.name)}</span></button>`).join(''):detailedRefs.length?'':'<p class="empty">Nenhuma referência cadastrada nesta região.</p>');
  $('details').innerHTML=`<div class="context-actions" aria-label="Ações para a seleção">${pointActions}<button data-action="shareArea">${iconSvg('link')}Compartilhar</button></div><details class="context-section selection-info"><summary>Informações principais</summary><p class="boundary-source">${source}</p>${state.road?`<div class="selection-note"><b>${esc(state.road)}</b><p>Exibindo a localidade associada. Confira o traçado e o número exato no mapa de ruas.</p></div>`:''}</details><details class="context-section" open><summary>Regiões próximas</summary><div class="near-buttons">${nearButtons(r.nearby,r.nearbyText)}</div></details>${nearbyPlaces}<details class="context-section"><summary>Pontos de referência <span>${detailedRefs.length+refs.length}</span></summary>${references}</details>${p?addNoteSection(context.lat,context.lng,false):''}`;
}
function renderContext() {
  if(comparisonActive()){
    $('mapGuide').hidden=true;
    return;
  }
  const r=byRegion[state.region], p=pointFor(state.point);
  $('mapGuide').hidden=!r;
  if(r) {
    const roads=p?streetNames(p):r.roads;
    const refs=points.filter(x=>x.region===r.id&&x.kind==='referencia');
    $('guideContent').innerHTML=`<h3>${p?'Ruas e acessos da localidade':'Acessos da região de atendimento'}</h3><ul>`+roads.map(road=>`<li>${esc(road)}</li>`).join('')+'</ul>'+
      (refs.length?'<h3>Referências</h3>'+refs.map(ref=>`<button class="reference-row" data-action="point" data-value="${esc(ref.id)}">${referenceIcon(ref)}<span>${esc(ref.name)}</span></button>`).join(''):'')+
      '<p class="map-caution">Posições aproximadas da base de atendimento.</p>';
  }
}
function renderLayout() {
  const start=!state.city&&!state.region&&!state.overview;
  $('app').classList.toggle('is-start',start);
  $('app').classList.toggle('is-map-hidden',mapHidden&&!start);
  const hidden=start||mapHidden;
  if(hidden&&streetViewMode)setStreetViewMode(false);
  if(hidden&&identifyPointMode)setIdentifyPointMode(false);
  $('mapStage').hidden=hidden;
  if(hidden&&typeof closeLayers==='function')closeLayers(false);
  $('toggleMap').innerHTML=iconSvg('pin')+(hidden?'Mostrar mapa':'Ocultar mapa');
  $('toggleMap').setAttribute('aria-expanded',String(!hidden));
}
function toggleMapVisibility() {
  if(!state.city&&!state.region&&!state.overview){generalMap();return;}
  mapHidden=!mapHidden;
  renderLayout();
  if(!mapHidden&&map){map.invalidateSize();updateLayers();}
}
function render() { renderLayout(); renderSearch(); renderNavigation(); renderDetails(); renderAreaInspector(); renderComparison(); renderContext(); updateLayers();if(typeof renderDesktopShell==='function')renderDesktopShell(); }
function doSearch(autoOpen=false) {
  const leavingComparison=comparisonActive();
  if(leavingComparison)Object.assign(state,{compare:null,overview:true});
  state.query=$('q').value; state.searchOpen=Boolean(clean(state.query));
  pendingCityChoice=null;
  renderSearch(); renderNavigation(); renderDetails();
  if(leavingComparison){renderComparison();renderContext();updateLayers();}
  const found=searchAll(state.query);
  const exact=found.filter(e=>e.kind!=='road'&&(e.aliases||[e.name]).some(n=>clean(n)===clean(state.query)));
  if(autoOpen && exact.length){if(askCity(exact))return;if(exact.length===1)openResult(found.indexOf(exact[0]));}
}
