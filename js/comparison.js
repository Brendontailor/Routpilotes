let compareRadiusKm=15;
const comparisonActive=()=>Array.isArray(state.compare);
const placeComparison=()=>comparisonActive()&&state.compareMode==='places';
let compareDrafts=['',''],compareActiveSlot=0;
let compareCatalogCache;
let compareOverlayKey='',compareOverlay=[];
let transientComparePlaces=[];

function startCompare(mode='places') {
  const selected=state.region?[state.region]:[];
  const origin=state.point?'point:'+state.point:state.boundary?'boundary:'+state.boundary:state.region?'region:'+state.region:null;
  compareDrafts=[comparePlace(origin)?.name||'',''];compareActiveSlot=origin?1:0;
  $('toggleRegions').checked=true;
  navigate({city:null,region:null,point:null,boundary:null,road:null,searchOpen:false,overview:true,compare:selected,compareMode:mode,compareStops:[origin,null],compareReady:false});
}
function toggleCompareRegion(id) {
  if(!byRegion[id]||!comparisonActive())return;
  if(placeComparison()){if(!state.compareReady)chooseComparePlace(compareActiveSlot,'region:'+id);return;}
  const selected=state.compare.includes(id)?state.compare.filter(x=>x!==id):[...state.compare,id];
  navigate({compare:selected},false);
}
function compareCatalog() {
  if(compareCatalogCache)return compareCatalogCache;
  compareCatalogCache=INDICE_PESQUISA.filter(e=>['region','point','boundary'].includes(e.kind)&&!(e.kind==='point'&&pointFor(e.id)?.kind==='referencia')).map(e=>{
    const p=e.kind==='point'?pointFor(e.id):null;
    const boundary=e.kind==='boundary'?boundaryById[e.id]:p?boundaryForPoint(p):null;
    const center=boundary?boundaryLayers[boundary.properties.id]?.getBounds().getCenter():null;
    const coords=p?[p.lat,p.lon]:e.kind==='region'?byRegion[e.id].center:center?[center.lat,center.lng]:null;
    return {...e,key:e.kind+':'+e.id,coords,boundaryId:boundary?.properties.id||null};
  }).filter(e=>e.coords).concat(transientComparePlaces);
  return compareCatalogCache;
}
function comparePlace(key) { return compareCatalog().find(e=>e.key===key); }
function comparisonStops() { return (state.compareStops||[null,null]).map(comparePlace); }
function comparisonRegionIds() {
  return placeComparison()?[...new Set(comparisonStops().filter(Boolean).map(e=>e.region))]:state.compare||[];
}
function comparePlaceMatches(query) {
  if(!clean(query))return [];
  return compareCatalog().map(e=>({...e,score:Math.max(...(e.aliases||[e.name]).map(name=>pontuarTexto(name,e.context,query)))}))
    .filter(e=>e.score).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR')).slice(0,16);
}
function switchCompareMode(mode) {
  if(!['places','regions'].includes(mode))return;
  const selected=comparisonRegionIds();
  navigate({compare:selected,compareMode:mode,compareReady:false},false);
}
function chooseComparePlace(slot,key) {
  if(!placeComparison()||![0,1].includes(slot)||!comparePlace(key))return;
  const stops=[...state.compareStops];stops[slot]=key;
  compareDrafts[slot]=comparePlace(key).name;compareActiveSlot=slot===0?1:0;
  navigate({compare:state.compare,compareStops:stops,compareReady:false},false);
}
function updateCompareDraft(slot,value) {
  if(!placeComparison()||![0,1].includes(slot))return;
  compareActiveSlot=slot;compareDrafts[slot]=value;
  const stops=[...state.compareStops];stops[slot]=null;
  Object.assign(state,{compareStops:stops,compareReady:false});
  $('compareSelected'+slot).innerHTML='';
  renderCompareSuggestions(slot);renderCompareResults();updateCompareButton();renderContext();updateLayers();
}
function renderCompareSuggestions(slot) {
  const matches=comparePlaceMatches(compareDrafts[slot]);
  const exact=matches.filter(e=>(e.aliases||[e.name]).some(n=>clean(n)===clean(compareDrafts[slot])));
  const ambiguous=new Set(exact.map(e=>e.city)).size>1;
  const panel=$('compareSuggestions'+slot);
  panel.hidden=!clean(compareDrafts[slot])||Boolean(state.compareStops[slot]);
  $('compareInput'+slot).setAttribute('aria-expanded',String(!panel.hidden));
  panel.innerHTML=(ambiguous?'<p class="compare-ambiguity">Em qual cidade fica esse local?</p>':'')+(matches.length?matches.map(e=>`<button type="button" class="compare-suggestion" data-action="comparePlace" data-slot="${slot}" data-value="${esc(e.key)}"><strong>${esc(e.name)}</strong><small>${esc(cityName(e.city))} · ${esc(byRegion[e.region].name)}</small></button>`).join(''):'<p class="empty">Nenhum bairro ou região encontrado.</p>');
}
function updateCompareButton() {
  const [a,b]=comparisonStops();
  $('compareCalculate').disabled=!a||!b||a.key===b.key;
}
function calculatePlaceComparison() {
  const [a,b]=comparisonStops();
  if(!placeComparison()||!a||!b||a.key===b.key)return;
  navigate({compare:state.compare,compareReady:true},false);
}
function clearComparison() {
  compareDrafts=['',''];compareActiveSlot=0;
  navigate({compare:[],compareStops:[null,null],compareReady:false},false);
}
function placeComparisonResult() {
  const [a,b]=comparisonStops();
  if(!a||!b||a.key===b.key)return null;
  const km=distanceKm(a.coords,b.coords);
  return {a,b,km,near:km<=compareRadiusKm,sameRegion:a.region===b.region};
}
function distanceKm(a,b) {
  const rad=n=>n*Math.PI/180;
  const dlat=rad(b[0]-a[0]),dlon=rad(b[1]-a[1]);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function comparePairs() {
  const selected=(state.compare||[]).map(id=>byRegion[id]).filter(Boolean),pairs=[];
  for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++){
    const a=selected[i],b=selected[j],km=distanceKm(a.center,b.center);
    pairs.push({a,b,km,near:km<=compareRadiusKm});
  }
  return pairs.sort((a,b)=>a.km-b.km);
}
function renderComparison() {
  const active=comparisonActive();
  $('searchForm').hidden=active;
  $('comparison').hidden=!active;
  $('compareButton').setAttribute('aria-pressed',String(active));
  $('compareButton').setAttribute('aria-label',active?'Sair da comparação':'Comparar');
  $('compareButton').title=active?'Sair da comparação':'Comparar locais ou regiões';
  const tooltip=$('compareButton').querySelector('.tool-tooltip');if(tooltip)tooltip.textContent=active?'Sair da comparação':'Comparar';
  if(!active)return;
  $('navigation').hidden=true;$('results').hidden=true;$('details').hidden=true;
  const modes=`<div class="compare-modes" role="group" aria-label="Modo de comparação"><button data-action="compareMode" data-value="places" aria-pressed="${placeComparison()}">Dois locais</button><button data-action="compareMode" data-value="regions" aria-pressed="${!placeComparison()}">Várias regiões</button></div>`;
  if(placeComparison()){
    const stops=comparisonStops();
    $('comparison').innerHTML='<div class="nav-top"><h2>Comparar locais</h2></div>'+modes+
      [0,1].map(i=>`<div class="compare-stop"><label for="compareInput${i}"><span class="stop-letter stop-${i}">${i?'B':'A'}</span>${i?'Destino':'Origem'}</label><input id="compareInput${i}" data-compare-slot="${i}" value="${esc(compareDrafts[i])}" placeholder="Nome do bairro ou região" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="compareSuggestions${i}" aria-expanded="false"><div id="compareSelected${i}" class="compare-selected">${stops[i]?`${esc(cityName(stops[i].city))} · ${esc(byRegion[stops[i].region].name)}`:''}</div><div id="compareSuggestions${i}" class="compare-suggestions" hidden></div></div>`).join('')+
      '<button type="button" class="compare-calculate" id="compareCalculate" data-action="compareCalculate">Comparar no mapa</button>'+
      `<div class="compare-controls"><label for="compareRadius">Perto até <input id="compareRadius" type="number" min="1" max="100" step="1" value="${compareRadiusKm}"> km</label><button data-action="compareClear">Limpar</button></div><div id="compareResults" aria-live="polite"></div>`;
    updateCompareButton();renderCompareResults();return;
  }
  const selected=state.compare.length;
  $('comparison').innerHTML=`<div class="nav-top"><h2>Comparar regiões</h2><span class="selection-count">${selected} selecionadas</span></div>`+modes+
    Object.keys(cityNames).map(city=>`<fieldset class="compare-group"><legend>${esc(cityName(city))}</legend>`+
      regions.filter(r=>r.city===city).map(r=>`<label class="compare-option"><input type="checkbox" data-action="compareRegion" data-value="${r.id}" ${state.compare.includes(r.id)?'checked':''}><span class="compare-swatch" style="background:${r.color}">${regionCode(r)}</span><span>${esc(r.name)}</span></label>`).join('')+'</fieldset>').join('')+
    `<div class="compare-controls"><label for="compareRadius">Próximas até <input id="compareRadius" type="number" min="1" max="100" step="1" value="${compareRadiusKm}"> km</label><button data-action="compareClear" ${selected?'':'disabled'}>Limpar</button></div><div id="compareResults" aria-live="polite"></div>`;
  renderCompareResults();
}
function renderCompareResults() {
  if(placeComparison()){
    const [a,b]=comparisonStops(),result=placeComparisonResult();
    if(!state.compareReady||!result){
      $('compareResults').innerHTML=a&&b&&a.key===b.key?'<p class="empty">Escolha dois locais diferentes.</p>':'';return;
    }
    const mapsUrl='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(a.coords.join(','))+'&destination='+encodeURIComponent(b.coords.join(','))+'&travelmode=driving';
    $('compareResults').innerHTML=`<section class="place-comparison-result"><div class="compare-distance"><strong>${result.km.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} <small>km</small></strong><span>em linha reta</span><b class="proximity-badge ${result.near?'is-near':''}">${result.near?'Perto':'Longe'} · limite de ${compareRadiusKm} km</b></div><p class="region-verdict ${result.sameRegion?'same-region':''}">${result.sameRegion?'Mesma região de atendimento':'Regiões de atendimento diferentes'}</p><div class="compare-region-summary"><span><b>A</b> ${esc(byRegion[a.region].name)} · ${esc(cityName(a.city))}</span><span><b>B</b> ${esc(byRegion[b.region].name)} · ${esc(cityName(b.city))}</span></div><a class="maps-route-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Conferir rota por estrada no Google Maps ↗</a><p class="map-caution">A linha pontilhada não é uma rota por estrada. Distância entre pontos de referência aproximados; não usa o endereço do cliente. Região conforme o cadastro de atendimento.</p></section>`;
    return;
  }
  const pairs=comparePairs();
  $('compareResults').innerHTML=pairs.length?`<h3>Distância entre centros de referência</h3><div class="compare-pairs">`+
    pairs.map(({a,b,km,near})=>`<div class="compare-pair"><div><span>${esc(a.name)}</span><span>${esc(b.name)}</span></div><div class="distance-result ${near?'is-near':''}"><strong>${km.toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1})} km</strong><small>${near?'Dentro':'Fora'} de ${compareRadiusKm} km</small></div></div>`).join('')+'</div><p class="map-caution">Estimativa em linha reta entre centros operacionais aproximados. Não é distância por estrada nem tempo de deslocamento.</p>':'<p class="empty">Selecione pelo menos duas regiões.</p>';
}
function updateCompareRadius(value) {
  const number=Number(value);
  if(!Number.isFinite(number)||number<1||number>100){$('compareRadius').value=compareRadiusKm;return;}
  compareRadiusKm=Math.round(number);$('compareRadius').value=compareRadiusKm;
  renderCompareResults();
}

function renderComparisonOverlay() {
  if(!map)return;
  const key=placeComparison()?JSON.stringify([state.compareStops,state.compareReady]):'';
  if(key===compareOverlayKey)return;
  compareOverlay.forEach(layer=>sincronizarCamada(layer,false));compareOverlay=[];compareOverlayKey=key;
  if(!placeComparison())return;
  const stops=comparisonStops();
  if(state.compareReady&&stops.every(Boolean)){
    compareOverlay.push(L.polyline(stops.map(e=>e.coords),{color:'#008aa7',weight:3,dashArray:'7 8',opacity:.85,interactive:false}).addTo(map));
  }
  stops.forEach((e,i)=>{
    if(!e||(i===1&&e.key===stops[0]?.key))return;
    compareOverlay.push(L.marker(e.coords,{zIndexOffset:700,title:`${i?'B':'A'}: ${e.name}`,icon:L.divIcon({className:'',html:`<span class="compare-endpoint stop-${i}">${i?'B':'A'}</span>`,iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip(`${i?'B':'A'}: ${esc(e.name)} · ${esc(cityName(e.city))}`).addTo(map));
  });
}
function registerCoordinateComparison(inspection) {
  if(!inspection?.region)return;
  const id=`${inspection.lat.toFixed(6)},${inspection.lng.toFixed(6)}`;
  const entry={kind:'coordinate',id,key:`coordinate:${id}`,name:`Ponto ${id}`,aliases:[],city:inspection.city,region:inspection.region.id,context:`${inspection.city} ${inspection.region.name}`,sub:'Coordenadas',coords:[inspection.lat,inspection.lng],boundaryId:null};
  transientComparePlaces=[entry];compareCatalogCache=null;
  startCompare('places');chooseComparePlace(0,entry.key);
}
