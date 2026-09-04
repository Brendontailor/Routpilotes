/* Recurso RoutePilot: consulta de números e referências no raio. */
let addressRadiusContext=null;
let addressRadiusMeters=CONFIGURACAO_FOCO_ENDERECOS.raioInicialMetros;
let addressRadiusLayer=null;
let addressRadiusStatus={state:'idle',addresses:0,blocks:0,rendered:0,error:''};

/** Guia: Exibe o conteúdo solicitado em consulta de números e referências no raio (`openPriorityArea`). */
function openPriorityArea(id) {
  const area=(typeof priorityMapAreas!=='undefined'?priorityMapAreas:[]).find(item=>item.id===id);
  if(!area)return;
  identifyCoordinates(area.center[0],area.center[1],{source:'priority'});
  identifiedArea.priorityArea=area;
  openAddressRadius({...currentAreaContext(),name:area.name});
}

/** Abre o foco de números e referências ao redor do contexto selecionado. */
function openAddressRadius(context=currentAreaContext()) {
  if(!context||!map)return;
  cancelMapInteraction('addressRadius');
  areaPanelMode='addressRadius';addressRadiusContext=context;
  mapHidden=false;
  $('toggleAddresses').checked=true;
  $('toggleRefs').checked=true;
  $('toggleLabels').checked=true;
  renderLayout();renderAreaInspector();applyAddressRadius(addressRadiusMeters);
  renderDesktopShell();
}

/** Guia: Limpa dados ou estados temporários em consulta de números e referências no raio (`clearAddressRadius`). */
function clearAddressRadius({close=false}={}) {
  if(addressRadiusLayer&&map){map.removeLayer(addressRadiusLayer);addressRadiusLayer=null;}
  if(typeof clearAddressDetailRadius==='function')clearAddressDetailRadius();
  if(close){addressRadiusContext=null;areaPanelMode=identifiedArea?'identify':'none';renderAreaInspector();if(typeof renderDesktopShell==='function')renderDesktopShell();}
}

/** Guia: Executa uma etapa auxiliar em consulta de números e referências no raio (`addressRadiusReferences`). */
function addressRadiusReferences() {
  if(!addressRadiusContext||!map)return [];
  const origin=[addressRadiusContext.lat,addressRadiusContext.lng],limit=addressRadiusMeters/1000,items=[];
  points.filter(item=>item.kind==='referencia').forEach(item=>{
    const km=distanceKm(origin,[item.lat,item.lon]);
    if(km<=limit)items.push({key:`point:${item.id}`,id:item.id,name:item.name,category:'Referência local',lat:item.lat,lng:item.lon,source:'RoutePilot',km});
  });
  (mapDetails.pois||[]).forEach(item=>{
    const km=distanceKm(origin,[item.lat,item.lon]);
    if(km<=limit)items.push({key:`detail:${item.id}`,id:item.id,name:item.name,category:item.category||'Referência',lat:item.lat,lng:item.lon,source:item.source||'RoutePilot',km});
  });
  (addressRadiusStatus.references||[]).forEach(item=>{
    const km=distanceKm(origin,[item.lat,item.lng]);
    if(km<=limit)items.push({key:`osm:${item.id}`,id:item.id,name:item.name,category:item.category,lat:item.lat,lng:item.lng,source:'OpenStreetMap',km});
  });
  const unique=new Map();items.forEach(item=>{const key=`${clean(item.name)}:${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`;if(!unique.has(key))unique.set(key,item);});
  return [...unique.values()].sort((a,b)=>a.km-b.km||a.name.localeCompare(b.name,'pt-BR'));
}

/** Guia: Executa uma etapa auxiliar em consulta de números e referências no raio (`addressRadiusVerifiedItems`). */
function addressRadiusVerifiedItems(){
  if(!addressRadiusContext||typeof verifiedAddressPoints==='undefined')return [];
  const origin=[addressRadiusContext.lat,addressRadiusContext.lng],limit=addressRadiusMeters/1000;
  return verifiedAddressPoints.map(item=>({...item,km:distanceKm(origin,[item.lat,item.lon])})).filter(item=>item.km<=limit)
    .sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{numeric:true,sensitivity:'base'}));
}

/** Guia: Executa uma etapa auxiliar em consulta de números e referências no raio (`focusVerifiedAddress`). */
function focusVerifiedAddress(id){
  const item=(typeof verifiedAddressPoints!=='undefined'?verifiedAddressPoints:[]).find(entry=>entry.id===id);
  if(!item||!map)return;
  map.flyTo([item.lat,item.lon],CONFIGURACAO_FOCO_ENDERECOS.zoomNumeroVerificado,{duration:.35});
  L.popup().setLatLng([item.lat,item.lon]).setContent(`<b>${item.kind==='block'?'Bloco ':''}${esc(item.label)}</b><br><small>${esc(item.source)}</small><br><a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir fonte</a>`).openOn(map);
}

/** Guia: Executa uma etapa auxiliar em consulta de números e referências no raio (`focusAddressReference`). */
function focusAddressReference(key){
  const item=addressRadiusReferences().find(reference=>reference.key===key);
  if(!item||!map)return;
  map.flyTo([item.lat,item.lng],CONFIGURACAO_FOCO_ENDERECOS.zoomReferencia,{duration:.35});
  L.popup().setLatLng([item.lat,item.lng]).setContent(`<b>${esc(item.name)}</b><br>${esc(item.category)}<br><small>${esc(item.source)}</small>`).openOn(map);
}

/** Guia: Executa uma etapa auxiliar em consulta de números e referências no raio (`addressRadiusStatusText`). */
function addressRadiusStatusText() {
  if(addressRadiusStatus.state==='loading')return 'Consultando números no OpenStreetMap...';
  if(addressRadiusStatus.state==='error')return 'Os números estão temporariamente indisponíveis. O mapa e as referências continuam funcionando.';
  if(addressRadiusStatus.state==='limited')return 'A área visível é grande demais. Escolha um raio menor.';
  if(addressRadiusStatus.state==='ready'&&addressRadiusStatus.cacheExpirado)return 'Exibindo a última consulta salva porque o OpenStreetMap está temporariamente indisponível.';
  if(addressRadiusStatus.state==='ready'&&addressRadiusStatus.endpoint==='base-aberta')return `${addressRadiusStatus.openAddresses||0} números da base aberta IBGE/Overture. A atualização do OpenStreetMap está temporariamente indisponível.`;
  if(addressRadiusStatus.state==='ready'&&addressRadiusStatus.endpoint==='base-local')return `${addressRadiusStatus.local||0} números da base local. A atualização do OpenStreetMap está temporariamente indisponível.`;
  if(addressRadiusStatus.state==='ready')return `${addressRadiusStatus.addresses||0} números e ${addressRadiusStatus.blocks||0} blocos encontrados neste trecho${addressRadiusStatus.verified?`, incluindo ${addressRadiusStatus.verified} do mapa verificado`:''}.`;
  return 'Os números disponíveis aparecem sobre as construções.';
}

/** Guia: Renderiza a parte correspondente da interface em consulta de números e referências no raio (`renderAddressRadiusPanel`). */
function renderAddressRadiusPanel(panel=$('areaInspector')) {
  if(areaPanelMode!=='addressRadius'||!addressRadiusContext)return false;
  const references=addressRadiusReferences(),verified=addressRadiusVerifiedItems();
  const verifiedBlocks=verified.filter(item=>item.kind==='block');
  const verifiedNumbers=verified.filter(item=>item.kind!=='block');
  const rows=references.slice(0,24).map((item,index)=>`<button type="button" class="radius-row" data-action="focusAddressReference" data-value="${esc(item.key)}"><span>${index+1}</span><b>${esc(item.name)}</b><small>${esc(item.category)}</small><strong>${distanceLabel(item.km)}</strong></button>`).join('');
  /** Guia: Executa uma etapa auxiliar em consulta de números e referências no raio (`verifiedButtons`). */
  const verifiedButtons=items=>items.map(item=>`<button type="button" data-action="focusVerifiedAddress" data-value="${esc(item.id)}" title="${esc(item.source)}">${esc(item.label)}</button>`).join('');
  panel.hidden=false;
  panel.innerHTML=`<p class="panel-intro">Foco em <b>${esc(addressRadiusContext.name)}</b>. Exibe números disponíveis no OpenStreetMap e referências cadastradas dentro do círculo.</p>
    <div class="radius-options address-radius-options" role="group" aria-label="Raio dos números">${CONFIGURACAO_FOCO_ENDERECOS.raiosDisponiveisMetros.map(meters=>`<button type="button" data-action="setAddressRadius" data-value="${meters}" aria-pressed="${addressRadiusMeters===meters}">${meters} m</button>`).join('')}</div>
    <div class="address-radius-status" aria-live="polite">${esc(addressRadiusStatusText())}</div>
    ${verifiedBlocks.length?`<div class="section-title">BLOCOS VERIFICADOS <span>${verifiedBlocks.length}</span></div><div class="verified-number-grid">${verifiedButtons(verifiedBlocks)}</div>`:''}
    ${verifiedNumbers.length?`<div class="section-title">NÚMEROS VERIFICADOS <span>${verifiedNumbers.length}</span></div><div class="verified-number-grid">${verifiedButtons(verifiedNumbers)}</div>`:''}
    ${verified.length?'<p class="straight-line-note">Fonte: Google My Maps fornecido. Clique em um item para aproximar.</p>':''}
    <div class="section-title">REFERÊNCIAS NO RAIO <span>${references.length}</span></div>
    <div class="radius-results">${rows||'<p class="empty">Nenhuma referência cadastrada dentro deste raio.</p>'}</div>
    <div class="inspector-actions"><button type="button" data-action="refreshAddressRadius">Atualizar números</button><button type="button" data-action="clearAddressRadius">Encerrar foco</button></div>`;
  return true;
}

/** Guia: Executa uma etapa auxiliar em consulta de números e referências no raio (`applyAddressRadius`). */
function applyAddressRadius(meters) {
  if(!addressRadiusContext||!map)return;
  addressRadiusMeters=Math.max(CONFIGURACAO_FOCO_ENDERECOS.raioMinimoMetros,Math.min(CONFIGURACAO_FOCO_ENDERECOS.raioMaximoMetros,Number(meters)||CONFIGURACAO_FOCO_ENDERECOS.raioInicialMetros));
  if(addressRadiusLayer)map.removeLayer(addressRadiusLayer);
  addressRadiusLayer=L.circle([addressRadiusContext.lat,addressRadiusContext.lng],{radius:addressRadiusMeters,color:'#f27622',weight:2.5,fillColor:'#f59e0b',fillOpacity:.07,dashArray:'8 5'}).addTo(map);
  const fitZoom=map.getBoundsZoom(addressRadiusLayer.getBounds().pad(.12));
  map.flyTo([addressRadiusContext.lat,addressRadiusContext.lng],Math.max(CONFIGURACAO_FOCO_ENDERECOS.zoomMinimo,Math.min(CONFIGURACAO_FOCO_ENDERECOS.zoomMaximo,fitZoom)),{duration:.4});
  setAddressDetailRadius([addressRadiusContext.lat,addressRadiusContext.lng],addressRadiusMeters);
  updateLayers();renderAddressRadiusPanel();
  if(window.matchMedia('(max-width:900px)').matches)document.querySelector('.map-stage').scrollIntoView({behavior:'smooth',block:'start'});
}

/** Guia: Atualiza o estado e a interface em consulta de números e referências no raio (`refreshAddressRadius`). */
function refreshAddressRadius() {
  if(!addressRadiusContext)return;
  setAddressDetailRadius([addressRadiusContext.lat,addressRadiusContext.lng],addressRadiusMeters);
  window.RoutePilotAddressDebug?.reload();
}

window.addEventListener('routepilot:address-status',event=>{
  addressRadiusStatus={...addressRadiusStatus,...event.detail};
  if(areaPanelMode==='addressRadius')renderAddressRadiusPanel();
});
