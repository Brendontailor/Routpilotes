/* Recurso RoutePilot: camada exclusiva do planejador no mapa. */
let routePlannerMapLayer=null;

/** Garante que a camada do planejador exista sem entrar no registro das demais camadas. */
function ensureRoutePlannerMapLayer(){
  if(!routePlannerMapLayer&&typeof L!=='undefined')routePlannerMapLayer=L.layerGroup();
  if(routePlannerMapLayer&&map&&!map.hasLayer(routePlannerMapLayer))routePlannerMapLayer.addTo(map);
  return routePlannerMapLayer;
}

/** Cria o marcador especial da origem. */
function routeOriginIcon(){
  return L.divIcon({className:'',html:`<span class="route-origin-marker">${iconSvg('home')}</span>`,iconSize:[34,34],iconAnchor:[17,17]});
}

/** Cria um marcador numerado de atendimento. */
function routeStopIcon(number){
  return L.divIcon({className:'',html:`<span class="route-stop-marker">${number}</span>`,iconSize:[32,32],iconAnchor:[16,16]});
}

/** Atualiza somente a rota planejada, sem remover busca, regiões ou notas. */
function renderRoutePlannerMap({origin=null,stops=[],segments=[]}={}){
  const layer=ensureRoutePlannerMapLayer();
  if(!layer)return;
  layer.clearLayers();
  const coordinates=[];
  if(origin){coordinates.push(origin.coords);L.marker(origin.coords,{icon:routeOriginIcon(),zIndexOffset:900,title:`Origem: ${origin.name}`}).bindTooltip(`Origem: ${esc(origin.name)}`).addTo(layer);}
  stops.forEach((stop,index)=>{
    coordinates.push(stop.coords);
    L.marker(stop.coords,{icon:routeStopIcon(index+1),zIndexOffset:880,title:`${index+1}. ${stop.name}`}).bindTooltip(`${index+1}. ${esc(stop.name)}`).addTo(layer);
  });
  segments.forEach(segment=>{
    const geometry=segment.geometry?.length?segment.geometry:[segment.from.coords,segment.to.coords];
    L.polyline(geometry,{color:'#087f96',weight:5,opacity:.9,dashArray:segment.geometry?.length?null:'7 8',interactive:false}).addTo(layer);
  });
  if(map&&coordinates.length){
    map.invalidateSize();
    if(coordinates.length===1)map.flyTo(coordinates[0],CONFIGURACAO_MAPA.zoomComparacao,{duration:.35});
    else map.flyToBounds(L.latLngBounds(coordinates),{padding:[55,55],maxZoom:CONFIGURACAO_MAPA.zoomComparacao,duration:.4});
  }
}

/** Remove somente os elementos visuais do planejador. */
function clearRoutePlannerMap(){
  if(routePlannerMapLayer)routePlannerMapLayer.clearLayers();
}
