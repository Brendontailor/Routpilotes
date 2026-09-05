/* Recurso RoutePilot: eventos da interface. */
// Centraliza os cliques dos botões que usam o atributo data-action.
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');
  if(!button){if(layersOpen&&!event.target.closest('#mapToggles')&&!event.target.closest('#layersButton'))closeLayers();return;}
  const {action,value,point,region}=button.dataset;
  if(action==='city') selectCity(value);
  if(action==='region') selectRegion(value);
  if(action==='point') selectPoint(value);
  if(action==='road') selectRoad(value,point,region);
  if(action==='result') openResult(Number(value));
  if(action==='back') goBack();
  if(action==='general') generalMap();
  if(action==='home') goHome();
  if(action==='boundary') selectBoundary(value);
  if(action==='detailPoi') openDetailPoi(value);
  if(action==='compareRegion')toggleCompareRegion(value);
  if(action==='compareClear')clearComparison();
  if(action==='compareMode')switchCompareMode(value);
  if(action==='comparePlace')chooseComparePlace(Number(button.dataset.slot),value);
  if(action==='compareCalculate')calculatePlaceComparison();
  if(action==='compareAddStop')addCompareStop();
  if(action==='compareRemoveStop')removeCompareStop(Number(button.dataset.slot));
  if(action==='planCompared')planComparedLocations();
  if(action==='openRoutePlanner')routePlannerActive()?closeRoutePlanner():startRoutePlanner();
  if(action==='closeRoutePlanner')closeRoutePlanner();
  if(action==='routeAddStop')addRoutePlannerStop();
  if(action==='routeRemoveStop')removeRoutePlannerStop(Number(button.dataset.index));
  if(action==='routeChoosePlace')chooseRoutePlannerPlace(button.dataset.kind,Number(button.dataset.index),value);
  if(action==='routeCalculate')calculateBestRoute();
  if(action==='routeReoptimize')reoptimizeRoute();
  if(action==='routeRestore')restoreRecommendedRoute();
  if(action==='routeUndo')undoRoutePlannerOrder();
  if(action==='routeFocusStop')focusRoutePlannerStop(value);
  if(action==='routeShareStop')shareRoutePlannerStop(value);
  if(action==='identifyCoordinates')identifyCoordinates(Number(button.dataset.lat),Number(button.dataset.lng));
  if(action==='clearIdentifiedArea')clearIdentifiedArea();
  if(action==='streetViewCoordinates'&&identifiedArea)openStreetViewAt(L.latLng(identifiedArea.lat,identifiedArea.lng));
  if(action==='compareCoordinates')compareIdentifiedCoordinates();
  if(action==='understandArea')openUnderstandArea();
  if(action==='aroundArea')openAroundArea();
  if(action==='addressRadius')openAddressRadius();
  if(action==='setAddressRadius')applyAddressRadius(value);
  if(action==='refreshAddressRadius')refreshAddressRadius();
  if(action==='clearAddressRadius')clearAddressRadius({close:true});
  if(action==='focusVerifiedAddress')focusVerifiedAddress(value);
  if(action==='focusAddressReference')focusAddressReference(value);
  if(action==='closeAreaTool')closeAreaTool();
  if(action==='setRadius')setRadius(value);
  if(action==='customRadius')applyCustomRadius();
  if(action==='clearRadius')clearRadiusSearch();
  if(action==='clearRadiusClose')clearRadiusSearch({close:true});
  if(action==='radiusResult')openRadiusResult(button.dataset.kind,value);
  if(action==='shareArea')shareArea();
  if(action==='shareMode')setLocationShareMode(value);
  if(action==='shareWhatsApp')shareLocationToWhatsApp();
  if(action==='copyLocationMessage')copyLocationMessage();
  if(action==='closeSharePanel')closeLocationShare();
  if(action==='focusMapCoordinates')focusMapCoordinates(Number(button.dataset.lat),Number(button.dataset.lng));
  if(action==='shareMapCoordinates')shareMapCoordinates(Number(button.dataset.lat),Number(button.dataset.lng));
  if(action==='copyMapCoordinates')copyMapCoordinates(Number(button.dataset.lat),Number(button.dataset.lng));
  if(action==='streetViewContext')streetViewContext();
  if(action==='showAddNote')showAddNoteForm();
  if(action==='cancelAddNote')cancelAddNote();
  if(action==='closeTools')closeTools();
  if(action==='focusSearch')focusGlobalSearch();
  if(action==='toggleLayers')toggleLayers();
  if(action==='closeLayers')closeLayers();
  if(action==='compareCurrent'){cancelMapInteraction('compare');startCompare();}
  if(action==='activateIdentify'){closeTools(false);if(comparisonActive())goBack();cancelMapInteraction('identify');if(!state.city&&!state.region&&!state.overview)generalMap();setIdentifyPointMode(true);}
  if(action==='annotatePoint')startAnnotatePoint();
  if(action==='reviewNotes')renderNotesReview();
  if(action==='reviewData')openDataReview();
  if(action==='validateOperationalNote')validateOperationalNote(button.dataset.id);
  if(action==='rejectOperationalNote')rejectOperationalNote(button.dataset.id);
  if(action==='editOperationalNote')editOperationalNote(button.dataset.id);
  if(action==='openNoteMap')openOperationalNote(button.dataset.id,Number(button.dataset.lat),Number(button.dataset.lng));
  if(action==='noteStreetView')openStreetViewAt(L.latLng(Number(button.dataset.lat),Number(button.dataset.lng)));
  if(action==='cancelCity'){pendingCityChoice=null;renderSearch();}
  if(action==='chooseCity'){
    const matches=(pendingCityChoice||[]).filter(e=>e.city===value);
    if(matches.length===1)openEntry(matches[0]);
    else if(matches.length){pendingCityChoice=null;state.query+=' '+cityName(value);$('q').value=state.query;doSearch();}
  }
  if(layersOpen&&!event.target.closest('#mapToggles')&&!event.target.closest('#layersButton'))closeLayers();
});
// Salva formulários de anotações sem recarregar a página.
document.addEventListener('submit',event=>{
  if(event.target.id==='operationalNoteForm'){event.preventDefault();saveOperationalNote(event.target);}
  if(event.target.matches('.note-edit-form')){event.preventDefault();saveOperationalNoteEdit(event.target);}
});
// Mantém a pesquisa, os comandos principais e os modos do mapa sincronizados.
$('q').addEventListener('input',()=>{ clearTimeout(searchTimer); doSearch(); searchTimer=setTimeout(()=>doSearch(true),CONFIGURACAO_PESQUISA.debounceMs); });
$('searchForm').addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);doSearch();const coordinate=parseCoordinateQuery(state.query);if(coordinate.matched&&coordinate.valid)identifyCoordinates(coordinate.lat,coordinate.lng);else if(searchAll(state.query).length)openResult(0);});
$('clearSearch').addEventListener('click',()=>{clearTimeout(searchTimer);$('q').value='';doSearch();$('q').focus();});
$('reset').addEventListener('click',generalMap);
$('toggleMap').addEventListener('click',toggleMapVisibility);
$('compareButton').addEventListener('click',()=>{if(comparisonActive()){goBack();return;}cancelMapInteraction('compare');startCompare();});
$('identifyPointButton').addEventListener('click',()=>{const active=!identifyPointMode||annotatePointMode;if(annotatePointMode)cancelAnnotatePoint(false);if(active){if(comparisonActive())goBack();cancelMapInteraction('identify');}setIdentifyPointMode(active);});
// Atualiza comparação e camadas quando os controles mudam.
document.addEventListener('change',event=>{if(event.target.id==='compareRadius')updateCompareRadius(event.target.value);});
document.addEventListener('input',event=>{
  const slot=event.target.dataset?.compareSlot;
  if(slot!==undefined)updateCompareDraft(Number(slot),event.target.value);
  const routeKind=event.target.dataset?.routeKind;
  if(routeKind)updateRoutePlannerDraft(routeKind,Number(event.target.dataset.routeIndex),event.target.value);
});
document.addEventListener('change',event=>{
  if(event.target.dataset?.routeConstraint)setRoutePlannerConstraint(event.target.dataset.routeConstraint,event.target.value);
  if(event.target.dataset?.routeFixed)setRoutePlannerConstraint(event.target.dataset.routeFixed,'fixed',event.target.value);
});
document.addEventListener('focusin',event=>{
  const slot=event.target.dataset?.compareSlot;
  if(slot!==undefined){compareActiveSlot=Number(slot);if(!state.compareStops[compareActiveSlot])renderCompareSuggestions(compareActiveSlot);}
});
['toggleRegions','toggleNeighborhoods','toggleLabels','toggleRefs','toggleRoads'].forEach(id=>$(id).addEventListener('change',updateLayers));
$('toggleAddresses').addEventListener('change',updateAddressDetailLayer);
$('toggleAddressDebug').addEventListener('change',event=>toggleAddressDebugMode(event.target.checked));
// O planejador recalcula apenas quando o cartão é solto, não durante o movimento.
document.addEventListener('dragstart',event=>{
  const card=event.target.closest('[data-route-drag-index]');if(!card)return;
  routePlannerState.dragIndex=Number(card.dataset.routeDragIndex);card.classList.add('is-dragging');event.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragover',event=>{if(event.target.closest('[data-route-drag-index]')){event.preventDefault();event.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',event=>{
  const card=event.target.closest('[data-route-drag-index]');if(!card||routePlannerState.dragIndex===null)return;
  event.preventDefault();const from=routePlannerState.dragIndex,to=Number(card.dataset.routeDragIndex);routePlannerState.dragIndex=null;reorderRoutePlannerStop(from,to);
});
document.addEventListener('dragend',event=>{event.target.closest('[data-route-drag-index]')?.classList.remove('is-dragging');routePlannerState.dragIndex=null;});
// Trata o Esc por prioridade e confirma escolhas da comparação com Enter.
document.addEventListener('keydown',event=>{
  const plainEscape=event.key==='Escape'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing;
  if(plainEscape&&$('operationalNoteForm')){event.preventDefault();cancelAddNote();return;}
  if(plainEscape&&document.querySelector('.note-edit-form')){event.preventDefault();document.querySelector('.note-edit-form').remove();return;}
  if(event.key==='Escape'&&identifyPointMode&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing){
    event.preventDefault();cancelAnnotatePoint();setIdentifyPointMode(false);return;
  }
  if(event.key==='Escape'&&streetViewMode&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing){
    event.preventDefault();setStreetViewMode(false);return;
  }
  if(plainEscape&&layersOpen){event.preventDefault();closeLayers();return;}
  if(event.key==='Escape'&&areaPanelMode==='radius'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing){event.preventDefault();clearRadiusSearch({close:true});return;}
  if(event.key==='Escape'&&areaPanelMode==='addressRadius'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing){event.preventDefault();clearAddressRadius({close:true});return;}
  if(event.key==='Escape'&&areaPanelMode==='understand'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing){event.preventDefault();closeAreaTool();return;}
  if(event.key==='Escape'&&toolsOpen&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing){event.preventDefault();closeTools();return;}
  if(plainEscape&&routePlannerActive()){event.preventDefault();closeRoutePlanner();return;}
  if(event.key==='Escape'&&identifiedArea&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.repeat&&!event.isComposing){event.preventDefault();clearIdentifiedArea();return;}
  if(event.key==='Enter'&&placeComparison()&&event.target?.dataset?.compareSlot!==undefined){
    event.preventDefault();const slot=Number(event.target.dataset.compareSlot),matches=comparePlaceMatches(compareDrafts[slot]);
    if(!state.compareStops[slot]&&matches.length===1)chooseComparePlace(slot,matches[0].key);
    else if(!state.compareStops[slot])renderCompareSuggestions(slot);
    else calculatePlaceComparison();
    return;
  }
  if(event.key!=='Escape'||event.ctrlKey||event.altKey||event.metaKey||event.repeat||event.isComposing) return;
  event.preventDefault(); goBack();
});
// Inicializa os recursos somente depois que todos os módulos foram carregados.
initDesktopShell();initToolsButton();initMap();initAddressDebug();initStreetViewLauncher();render();applyDeepLink();RoutePilotAgenda.init().catch(error=>console.error('Falha ao iniciar Agenda',error));
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
}
