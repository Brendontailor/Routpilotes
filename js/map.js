function registrarCamada(layer,meta) { layers.push({layer,...meta}); return layer; }
function sincronizarCamada(layer,exibir) { if(exibir&&!map.hasLayer(layer)) layer.addTo(map); else if(!exibir&&map.hasLayer(layer)) map.removeLayer(layer); }
function updateLayers() {
  if(!map) return;
  const zoom=map.getZoom();
  renderComparisonOverlay();
  const compareRegions=comparisonRegionIds(),compareBoundaries=placeComparison()?comparisonStops().filter(Boolean).map(e=>e.boundaryId).filter(Boolean):[];
  layers.forEach(x=>{
    let show=state.region ? x.region===state.region : state.city ? x.city===state.city : ['regionNumber','outline'].includes(x.kind);
    if(comparisonActive()){
      show=['regionNumber','outline'].includes(x.kind)&&(!compareRegions.length||compareRegions.includes(x.region))&&$('toggleRegions').checked;
      if(placeComparison()&&x.kind==='regionNumber')show=false;
      if(x.kind==='neighborhood')show=compareBoundaries.includes(x.boundary)&&$('toggleNeighborhoods').checked;
      sincronizarCamada(x.layer,show);return;
    }
    if(x.kind==='outline') show=show&&$('toggleRegions').checked;
    if(x.kind==='regionNumber') show=show&&$('toggleRegions').checked;
    if(state.boundary&&['outline','regionNumber'].includes(x.kind))show=false;
    if(x.kind==='neighborhood') {
      show=$('toggleNeighborhoods').checked&&(state.boundary?x.boundary===state.boundary:state.region?x.region===state.region:state.city?x.city===state.city:zoom>=CONFIGURACAO_MAPA.zoomLocalidades);
      x.layer.setStyle({color:x.color,weight:state.boundary===x.boundary?4:2,opacity:state.boundary?1:.8,fill:true,fillOpacity:0});
    }
    if(x.kind==='point') show=show&&(Boolean(state.region)||zoom>=CONFIGURACAO_MAPA.zoomLocalidades);
    if(x.kind==='reference') show=show&&$('toggleRefs').checked;
    sincronizarCamada(x.layer,show);
    if(x.kind==='outline') x.layer.setStyle({weight:state.region?4:3,opacity:.95});
  });
  updateLabels();
  updateAddressDetailLayer();
}
function updateLabels() {
  if(!map) return;
  if(comparisonActive()){labelRecords.forEach(x=>sincronizarCamada(x.layer,false));updateMapDetails();return;}
  const occupied=[], size=map.getSize(), zoom=map.getZoom();
  labelRecords.slice().sort((a,b)=>(b.p.id===state.point)-(a.p.id===state.point)||(b.p.kind==='referencia')-(a.p.kind==='referencia')).forEach(({p,layer})=>{
    const relevant=state.region ? p.region===state.region : state.city===p.city&&zoom>=CONFIGURACAO_MAPA.zoomLocalidades;
    let show=relevant&&$('toggleLabels').checked&&(p.kind!=='referencia'||$('toggleRefs').checked);
    if(p.boundaryId)show=show&&$('toggleNeighborhoods').checked&&(!state.boundary||p.boundaryId===state.boundary);
    const pos=map.latLngToContainerPoint([p.lat,p.lon]);
    const box={x:pos.x+14,y:pos.y-12,w:Math.min(180,p.name.length*6.6+16),h:26};
    show=show&&box.x>0&&box.y>0&&box.x+box.w<size.x&&box.y+box.h<size.y;
    if(show&&occupied.some(b=>box.x<b.x+b.w+6&&box.x+box.w+6>b.x&&box.y<b.y+b.h+5&&box.y+box.h+5>b.y)) show=false;
    if(show) occupied.push(box);
    sincronizarCamada(layer,show);
  });
  updateMapDetails(occupied);
}
function regionBounds(id) {
  const bounds=L.latLngBounds([...byRegion[id].polygon,...points.filter(p=>p.region===id).map(p=>[p.lat,p.lon])]);
  boundaries.features.filter(f=>f.properties.region===id).forEach(f=>{if(boundaryLayers[f.properties.id])bounds.extend(boundaryLayers[f.properties.id].getBounds());});
  return bounds;
}
function focusMap() {
  if(!map||$('mapStage').hidden) return;
  map.closePopup(); map.invalidateSize();
  if(placeComparison()&&comparisonStops().some(Boolean)){
    const stops=comparisonStops().filter(Boolean);
    if(stops.length===1)map.flyTo(stops[0].coords,stops[0].kind==='region'?12:14,{duration:.4});
    else map.flyToBounds(L.latLngBounds(stops.map(e=>e.coords)),{padding:[55,55],maxZoom:CONFIGURACAO_MAPA.zoomComparacao,duration:.4});
  }
  else if(comparisonActive()&&state.compare.length&&!placeComparison()){
    const bounds=L.latLngBounds([]);state.compare.forEach(id=>bounds.extend(regionBounds(id)));
    map.flyToBounds(bounds,{padding:[40,40],maxZoom:CONFIGURACAO_MAPA.zoomRegiao,duration:.4});
  }
  else if(state.boundary&&boundaryLayers[state.boundary])map.flyToBounds(boundaryLayers[state.boundary].getBounds(),{padding:[40,40],maxZoom:CONFIGURACAO_MAPA.zoomBairro,duration:.4});
  else if(state.point) { const p=pointFor(state.point);map.flyTo([p.lat,p.lon],p.kind==='referencia'?CONFIGURACAO_MAPA.zoomBairro:CONFIGURACAO_MAPA.zoomComparacao,{duration:.4}); }
  else if(state.region) map.flyToBounds(regionBounds(state.region),{padding:[35,35],maxZoom:CONFIGURACAO_MAPA.zoomRegiao,duration:.4});
  else if(state.city) {
    const bounds=L.latLngBounds([]); regions.filter(r=>r.city===state.city).forEach(r=>bounds.extend(regionBounds(r.id)));
    map.flyToBounds(bounds,{padding:[30,30],duration:.4});
  } else map.flyTo(CONFIGURACAO_MAPA.centroInicial,CONFIGURACAO_MAPA.zoomInicial,{duration:.4});
  if(window.matchMedia('(max-width:900px)').matches&&state.region&&!state.searchOpen) document.querySelector('.map-stage').scrollIntoView({behavior:'smooth',block:'start'});
}

/** Inicializa o Leaflet, as camadas operacionais e os eventos principais do mapa. */
function initMap() {
  if(typeof L==='undefined') { $('map').innerHTML='<div class="map-error">Não foi possível carregar o mapa. Verifique sua conexão e atualize a página.</div>'; return; }
  const mapNode=$('map');
  map=L.map('map',{zoomControl:false}).setView(CONFIGURACAO_MAPA.centroInicial,CONFIGURACAO_MAPA.zoomInicial);
  /* Zoom no canto inferior direito: evita conflito com a barra de ferramentas e o painel de camadas. */
  L.control.zoom({position:'bottomright',zoomInTitle:'Aproximar',zoomOutTitle:'Afastar'}).addTo(map);
  map.createPane('regionAreas').style.zIndex=410;
  map.createPane('neighborhoodAreas').style.zIndex=420;
  map.createPane('roadDetails').style.zIndex=430;
  map.createPane('addressDetails').style.zIndex=445;
  map.createPane('addressDebug').style.zIndex=446;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:CONFIGURACAO_MAPA.zoomNativoOsm,maxZoom:CONFIGURACAO_MAPA.zoomMaximo,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  L.control.scale({imperial:false}).addTo(map);
  boundaries.features.forEach(feature=>{
    const b=feature.properties;
    const layer=registrarCamada(L.geoJSON(feature,{pane:'neighborhoodAreas',bubblingMouseEvents:false,style:{color:b.color,weight:2,fill:true,fillOpacity:0}}),{city:b.city,region:b.region,kind:'neighborhood',boundary:b.id,color:b.color});
    layer.bindTooltip(`${esc(b.name)} · ${esc(cityName(b.city))}<br>${b.category} · ${esc(b.source)}`,{sticky:true}).on('click',event=>identifyPointMode||map.getZoom()>=CONFIGURACAO_MAPA.zoomCliqueDetalhado?identifyCoordinates(event.latlng.lat,event.latlng.lng,{source:'map'}):mapBoundaryClick(b.id));
    boundaryLayers[b.id]=layer;
    if(!linkedPoint(feature)){
      const center=layer.getBounds().getCenter();
      const p={name:b.name,city:b.city,region:b.region,lat:center.lat,lon:center.lng,kind:'boundary',boundaryId:b.id};
      const label=L.marker(center,{icon:L.divIcon({className:'',html:`<span class="point-label" style="border-color:${b.color}">${esc(b.name)}</span>`,iconSize:[180,26],iconAnchor:[-14,12]})}).on('click',()=>mapBoundaryClick(b.id));
      labelRecords.push({p,layer:label});
    }
  });
  regions.forEach(r=>{
    regionLayers[r.id]=registrarCamada(L.polygon(r.polygon,{pane:'regionAreas',bubblingMouseEvents:false,color:r.color,weight:2,fill:true,fillOpacity:0}),{city:r.city,region:r.id,kind:'outline'}).bindTooltip(esc(r.name),{sticky:true}).on('click',event=>identifyPointMode||map.getZoom()>=CONFIGURACAO_MAPA.zoomCliqueDetalhado?identifyCoordinates(event.latlng.lat,event.latlng.lng,{source:'map'}):selectRegion(r.id));
    registrarCamada(L.marker(r.center,{title:r.name,icon:L.divIcon({className:'',html:`<div class="region-number" style="background:${r.color}">${regionCode(r)}</div>`,iconSize:[28,28],iconAnchor:[14,14]})}),{city:r.city,region:r.id,kind:'regionNumber'}).bindTooltip(esc(r.name)).on('click',()=>selectRegion(r.id));
  });
  points.forEach(p=>{
    const r=byRegion[p.region], ref=p.kind==='referencia';
    const marker=registrarCamada(L.marker([p.lat,p.lon],{title:p.name,zIndexOffset:ref?300:0,icon:L.divIcon({className:'',html:ref?referenceIcon(p,true):`<div class="pin" style="background:${r.color}"></div>`,iconSize:ref?[28,28]:[14,14],iconAnchor:ref?[14,14]:[7,7]})}),{city:p.city,region:p.region,kind:ref?'reference':'point'});
    marker.bindTooltip(esc(p.name),{direction:'top'}).on('click',event=>identifyPointMode?identifyCoordinates(event.latlng.lat,event.latlng.lng,{source:'map'}):mapPointClick(p.id)); markers[p.id]=marker;
    const label=L.marker([p.lat,p.lon],{keyboard:false,icon:L.divIcon({className:'',html:`<span class="point-label">${esc(p.name)}</span>`,iconSize:[180,26],iconAnchor:[-14,12]})}).on('click',()=>mapPointClick(p.id));
    labelRecords.push({p,layer:label});
  });
  map.on('click',event=>identifyCoordinates(event.latlng.lat,event.latlng.lng,{source:'map'}));
  /* No modo de identificação, captura o clique antes das camadas Leaflet que normalmente o bloqueariam. */
  mapNode.addEventListener('click',event=>{
    if(!identifyPointMode||event.target.closest('.leaflet-control,.leaflet-popup,button,a,input,select,textarea'))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const rect=mapNode.getBoundingClientRect();
    const point=map.containerPointToLatLng(L.point(event.clientX-rect.left,event.clientY-rect.top));
    identifyCoordinates(point.lat,point.lng,{source:'map'});
  },true);
  map.on('contextmenu',event=>{
    event.originalEvent?.preventDefault();
    openMapPointMenu(event.latlng.lat,event.latlng.lng);
  });
  map.on('movestart zoomstart',cancelAddressDetailRequest);
  map.on('zoomend moveend resize',updateLayers);
  new ResizeObserver(()=>{if(!$('mapStage').hidden)map.invalidateSize();}).observe($('map'));
}
