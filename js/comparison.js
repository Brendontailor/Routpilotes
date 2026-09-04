/* Recurso RoutePilot: comparação de locais e regiões. */
let compareRadiusKm=15;
/** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`comparisonActive`). */
const comparisonActive=()=>Array.isArray(state.compare);
/** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`placeComparison`). */
const placeComparison=()=>comparisonActive()&&state.compareMode==='places';
let compareDrafts=['',''],compareActiveSlot=0;
let compareCatalogCache;
let compareOverlayKey='',compareOverlay=[];
let transientComparePlaces=[];
let compareRequestToken=0;
let compareRoadStatus={state:'idle',key:'',route:null,error:''};

/** Guia: Limpa dados ou estados temporários em comparação de locais e regiões (`resetCompareRoadStatus`). */
function resetCompareRoadStatus(){compareRequestToken++;compareRoadStatus={state:'idle',key:'',route:null,error:''};}
/** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`comparisonRouteKey`). */
function comparisonRouteKey(stops=comparisonStops()){return stops.every(Boolean)?stops.map(item=>item.key).join('|'):'';}

/** Guia: Inicia o fluxo do recurso em comparação de locais e regiões (`startCompare`). */
function startCompare(mode='places') {
  resetCompareRoadStatus();
  const selected=state.region?[state.region]:[];
  const origin=state.point?'point:'+state.point:state.boundary?'boundary:'+state.boundary:state.region?'region:'+state.region:null;
  compareDrafts=[comparePlace(origin)?.name||'',''];compareActiveSlot=origin?1:0;
  $('toggleRegions').checked=true;
  navigate({city:null,region:null,point:null,boundary:null,road:null,searchOpen:false,overview:true,compare:selected,compareMode:mode,compareStops:[origin,null],compareReady:false});
}
/** Guia: Alterna o estado do recurso em comparação de locais e regiões (`toggleCompareRegion`). */
function toggleCompareRegion(id) {
  if(!byRegion[id]||!comparisonActive())return;
  if(placeComparison()){if(!state.compareReady)chooseComparePlace(compareActiveSlot,'region:'+id);return;}
  const selected=state.compare.includes(id)?state.compare.filter(x=>x!==id):[...state.compare,id];
  navigate({compare:selected},false);
}
/** Guia: Processa e organiza os itens em comparação de locais e regiões (`compareCatalog`). */
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
/** Guia: Processa e organiza os itens em comparação de locais e regiões (`comparePlace`). */
function comparePlace(key) { return compareCatalog().find(e=>e.key===key); }
/** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`comparisonStops`). */
function comparisonStops() { return (state.compareStops||[null,null]).map(comparePlace); }
/** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`comparisonRegionIds`). */
function comparisonRegionIds() {
  return placeComparison()?[...new Set(comparisonStops().filter(Boolean).map(e=>e.region))]:state.compare||[];
}
/** Guia: Processa e organiza os itens em comparação de locais e regiões (`comparePlaceMatches`). */
function comparePlaceMatches(query) {
  if(!clean(query))return [];
  return compareCatalog().map(e=>({...e,score:Math.max(...(e.aliases||[e.name]).map(name=>pontuarTexto(name,e.context,query)))}))
    .filter(e=>e.score).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR')).slice(0,16);
}
/** Guia: Alterna o estado do recurso em comparação de locais e regiões (`switchCompareMode`). */
function switchCompareMode(mode) {
  if(!['places','regions'].includes(mode))return;
  resetCompareRoadStatus();
  const selected=comparisonRegionIds();
  navigate({compare:selected,compareMode:mode,compareReady:false},false);
}
/** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`chooseComparePlace`). */
function chooseComparePlace(slot,key) {
  if(!placeComparison()||![0,1].includes(slot)||!comparePlace(key))return;
  resetCompareRoadStatus();
  const stops=[...state.compareStops];stops[slot]=key;
  compareDrafts[slot]=comparePlace(key).name;compareActiveSlot=slot===0?1:0;
  navigate({compare:state.compare,compareStops:stops,compareReady:false},false);
}
/** Guia: Atualiza o estado e a interface em comparação de locais e regiões (`updateCompareDraft`). */
function updateCompareDraft(slot,value) {
  if(!placeComparison()||![0,1].includes(slot))return;
  resetCompareRoadStatus();
  compareActiveSlot=slot;compareDrafts[slot]=value;
  const stops=[...state.compareStops];stops[slot]=null;
  Object.assign(state,{compareStops:stops,compareReady:false});
  $('compareSelected'+slot).innerHTML='';
  renderCompareSuggestions(slot);renderCompareResults();updateCompareButton();renderContext();updateLayers();
}
/** Guia: Renderiza a parte correspondente da interface em comparação de locais e regiões (`renderCompareSuggestions`). */
function renderCompareSuggestions(slot) {
  const matches=comparePlaceMatches(compareDrafts[slot]);
  const exact=matches.filter(e=>(e.aliases||[e.name]).some(n=>clean(n)===clean(compareDrafts[slot])));
  const ambiguous=new Set(exact.map(e=>e.city)).size>1;
  const addressDraft=/\d/.test(compareDrafts[slot]);
  const panel=$('compareSuggestions'+slot);
  panel.hidden=!clean(compareDrafts[slot])||Boolean(state.compareStops[slot]);
  $('compareInput'+slot).setAttribute('aria-expanded',String(!panel.hidden));
  panel.innerHTML=(ambiguous?'<p class="compare-ambiguity">Em qual cidade fica esse local?</p>':'')+(matches.length?matches.map(e=>`<button type="button" class="compare-suggestion" data-action="comparePlace" data-slot="${slot}" data-value="${esc(e.key)}"><strong>${esc(e.name)}</strong><small>${esc(cityName(e.city))} · ${esc(byRegion[e.region].name)}</small></button>`).join(''):addressDraft?'<p class="empty">Endereço exato: informe também a cidade e use “Calcular por estradas”.</p>':'<p class="empty">Nenhum bairro ou região encontrado.</p>');
}
/** Guia: Atualiza o estado e a interface em comparação de locais e regiões (`updateCompareButton`). */
function updateCompareButton() {
  const [a,b]=comparisonStops();
  const hasA=Boolean(a||clean(compareDrafts[0])),hasB=Boolean(b||clean(compareDrafts[1]));
  $('compareCalculate').disabled=compareRoadStatus.state==='loading'||!hasA||!hasB||(a&&b&&a.key===b.key);
}
/** Guia: Registra um novo item em comparação de locais e regiões (`addTransientComparePlace`). */
function addTransientComparePlace(entry){
  transientComparePlaces=[...transientComparePlaces.filter(item=>item.key!==entry.key),entry];compareCatalogCache=null;
}
/** Guia: Calcula o resultado solicitado em comparação de locais e regiões (`calculatePlaceComparison`). */
async function calculatePlaceComparison() {
  if(!placeComparison())return;
  // O token impede que uma resposta antiga substitua uma comparação mais recente.
  const token=++compareRequestToken;
  compareRoadStatus={state:'loading',key:'',route:null,error:''};renderCompareResults();updateCompareButton();
  try{
    const stopKeys=[...(state.compareStops||[null,null])];
    for(let slot=0;slot<2;slot++){
      if(comparePlace(stopKeys[slot]))continue;
      const entry=await resolveLocalRouteAddress(compareDrafts[slot]);
      if(token!==compareRequestToken)return;
      addTransientComparePlace(entry);stopKeys[slot]=entry.key;compareDrafts[slot]=entry.name;
    }
    Object.assign(state,{compareStops:stopKeys});
    const [a,b]=comparisonStops();
    if(!a||!b||a.key===b.key)throw new Error('Escolha dois endereços ou locais diferentes.');
    const key=comparisonRouteKey([a,b]),route=await calculateLocalRoadRoute(a.coords,b.coords);
    if(token!==compareRequestToken)return;
    compareRoadStatus={state:'ready',key,route,error:''};
    navigate({compare:state.compare,compareStops:stopKeys,compareReady:true},false);
  }catch(error){
    if(token!==compareRequestToken)return;
    compareRoadStatus={state:'error',key:comparisonRouteKey(),route:null,error:error.message||String(error)};
    Object.assign(state,{compareReady:Boolean(comparisonStops().every(Boolean))});
    renderComparison();renderComparisonOverlay();
  }
}
/** Guia: Limpa dados ou estados temporários em comparação de locais e regiões (`clearComparison`). */
function clearComparison() {
  resetCompareRoadStatus();
  compareDrafts=['',''];compareActiveSlot=0;
  navigate({compare:[],compareStops:[null,null],compareReady:false},false);
}
/** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`placeComparisonResult`). */
function placeComparisonResult() {
  const [a,b]=comparisonStops();
  if(!a||!b||a.key===b.key)return null;
  const straightKm=distanceKm(a.coords,b.coords);
  const route=compareRoadStatus.state==='ready'&&compareRoadStatus.key===comparisonRouteKey([a,b])?compareRoadStatus.route:null;
  // A linha reta é usada somente como contingência quando não há rota local válida.
  const km=route?.distanceKm||straightKm;
  return {a,b,km,straightKm,route,near:km<=compareRadiusKm,sameRegion:a.region===b.region};
}
/** Guia: Calcula o resultado solicitado em comparação de locais e regiões (`distanceKm`). */
function distanceKm(a,b) {
  /** Guia: Executa uma etapa auxiliar em comparação de locais e regiões (`rad`). */
  const rad=n=>n*Math.PI/180;
  const dlat=rad(b[0]-a[0]),dlon=rad(b[1]-a[1]);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
/** Guia: Processa e organiza os itens em comparação de locais e regiões (`comparePairs`). */
function comparePairs() {
  const selected=(state.compare||[]).map(id=>byRegion[id]).filter(Boolean),pairs=[];
  for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++){
    const a=selected[i],b=selected[j],km=distanceKm(a.center,b.center);
    pairs.push({a,b,km,near:km<=compareRadiusKm});
  }
  return pairs.sort((a,b)=>a.km-b.km);
}
/** Guia: Renderiza a parte correspondente da interface em comparação de locais e regiões (`renderComparison`). */
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
      [0,1].map(i=>`<div class="compare-stop"><label for="compareInput${i}"><span class="stop-letter stop-${i}">${i?'B':'A'}</span>${i?'Destino':'Origem'}</label><input id="compareInput${i}" data-compare-slot="${i}" value="${esc(compareDrafts[i])}" placeholder="Bairro, região ou rua, número, cidade" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="compareSuggestions${i}" aria-expanded="false"><div id="compareSelected${i}" class="compare-selected">${stops[i]?`${esc(cityName(stops[i].city))} · ${esc(byRegion[stops[i].region].name)}`:''}</div><div id="compareSuggestions${i}" class="compare-suggestions" hidden></div></div>`).join('')+
      '<p class="compare-address-hint">Para um endereço exato, informe rua, número e cidade. A consulta usa somente a base local.</p><button type="button" class="compare-calculate" id="compareCalculate" data-action="compareCalculate">Calcular por estradas</button>'+
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
/** Guia: Renderiza a parte correspondente da interface em comparação de locais e regiões (`renderCompareResults`). */
function renderCompareResults() {
  if(placeComparison()){
    const [a,b]=comparisonStops(),result=placeComparisonResult();
    if(compareRoadStatus.state==='loading'){
      $('compareResults').innerHTML='<div class="compare-route-status is-loading"><strong>Calculando pela malha viária local...</strong><span>Nenhum endereço é enviado para serviços externos.</span></div>';return;
    }
    if(!state.compareReady||!result){
      $('compareResults').innerHTML=compareRoadStatus.state==='error'?`<div class="compare-route-status is-error"><strong>Não foi possível calcular</strong><span>${esc(compareRoadStatus.error)}</span></div>`:a&&b&&a.key===b.key?'<p class="empty">Escolha dois locais diferentes.</p>':'';return;
    }
    const mapsUrl='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(a.coords.join(','))+'&destination='+encodeURIComponent(b.coords.join(','))+'&travelmode=driving';
    const routeWarning=compareRoadStatus.state==='error'?`<div class="compare-route-status is-error"><strong>Rota local indisponível</strong><span>${esc(compareRoadStatus.error)} Exibindo a distância em linha reta.</span></div>`:'';
    const snapText=result.route&&result.route.snapMeters>100?` Os pontos foram ajustados às vias mais próximas (${Math.round(result.route.snapMeters)} m no total).`:'';
    $('compareResults').innerHTML=`${routeWarning}<section class="place-comparison-result"><div class="compare-distance"><strong>${result.km.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} <small>km</small></strong><span>${result.route?'por estradas':'em linha reta · contingência'}</span><b class="proximity-badge ${result.near?'is-near':''}">${result.near?'Perto':'Longe'} · limite de ${compareRadiusKm} km</b></div><p class="region-verdict ${result.sameRegion?'same-region':''}">${result.sameRegion?'Mesma região de atendimento':'Regiões de atendimento diferentes'}</p><div class="compare-region-summary"><span><b>A</b> ${esc(a.name)}<small>${esc(byRegion[a.region].name)} · ${esc(cityName(a.city))}</small></span><span><b>B</b> ${esc(b.name)}<small>${esc(byRegion[b.region].name)} · ${esc(cityName(b.city))}</small></span></div><a class="maps-route-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Abrir os pontos no Google Maps ↗</a><p class="map-caution">${result.route?'Trajeto calculado no próprio RoutePilot sobre a malha viária local do Overture Maps.':'Não foi possível usar a malha local; o valor acima é apenas uma estimativa direta.'}${snapText} Confirme bloqueios e condições atuais da estrada.</p></section>`;
    return;
  }
  const pairs=comparePairs();
  $('compareResults').innerHTML=pairs.length?`<h3>Distância entre centros de referência</h3><div class="compare-pairs">`+
    pairs.map(({a,b,km,near})=>`<div class="compare-pair"><div><span>${esc(a.name)}</span><span>${esc(b.name)}</span></div><div class="distance-result ${near?'is-near':''}"><strong>${km.toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1})} km</strong><small>${near?'Dentro':'Fora'} de ${compareRadiusKm} km</small></div></div>`).join('')+'</div><p class="map-caution">Estimativa em linha reta entre centros operacionais aproximados. Não é distância por estrada nem tempo de deslocamento.</p>':'<p class="empty">Selecione pelo menos duas regiões.</p>';
}
/** Guia: Atualiza o estado e a interface em comparação de locais e regiões (`updateCompareRadius`). */
function updateCompareRadius(value) {
  const number=Number(value);
  if(!Number.isFinite(number)||number<1||number>100){$('compareRadius').value=compareRadiusKm;return;}
  compareRadiusKm=Math.round(number);$('compareRadius').value=compareRadiusKm;
  renderCompareResults();
}

/** Guia: Renderiza a parte correspondente da interface em comparação de locais e regiões (`renderComparisonOverlay`). */
function renderComparisonOverlay() {
  if(!map)return;
  const route=placeComparisonResult()?.route||null;
  const key=placeComparison()?JSON.stringify([state.compareStops,state.compareReady,compareRoadStatus.state,compareRoadStatus.key]):'';
  if(key===compareOverlayKey)return;
  compareOverlay.forEach(layer=>sincronizarCamada(layer,false));compareOverlay=[];compareOverlayKey=key;
  if(!placeComparison())return;
  const stops=comparisonStops();
  if(state.compareReady&&stops.every(Boolean)){
    compareOverlay.push(L.polyline(route?.geometry||stops.map(e=>e.coords),{color:'#008aa7',weight:route?5:3,dashArray:route?null:'7 8',opacity:.88,interactive:false}).addTo(map));
  }
  stops.forEach((e,i)=>{
    if(!e||(i===1&&e.key===stops[0]?.key))return;
    compareOverlay.push(L.marker(e.coords,{zIndexOffset:700,title:`${i?'B':'A'}: ${e.name}`,icon:L.divIcon({className:'',html:`<span class="compare-endpoint stop-${i}">${i?'B':'A'}</span>`,iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip(`${i?'B':'A'}: ${esc(e.name)} · ${esc(cityName(e.city))}`).addTo(map));
  });
}

/** Guia: Obtém o valor atual em comparação de locais e regiões (`currentLocalRoadRoute`). */
function currentLocalRoadRoute(){return placeComparisonResult()?.route||null;}
/** Guia: Registra um novo item em comparação de locais e regiões (`registerCoordinateComparison`). */
function registerCoordinateComparison(inspection) {
  if(!inspection?.region)return;
  const id=`${inspection.lat.toFixed(6)},${inspection.lng.toFixed(6)}`;
  const entry={kind:'coordinate',id,key:`coordinate:${id}`,name:`Ponto ${id}`,aliases:[],city:inspection.city,region:inspection.region.id,context:`${inspection.city} ${inspection.region.name}`,sub:'Coordenadas',coords:[inspection.lat,inspection.lng],boundaryId:null};
  transientComparePlaces=[entry];compareCatalogCache=null;
  startCompare('places');chooseComparePlace(0,entry.key);
}
