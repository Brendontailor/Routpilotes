/* Recurso RoutePilot: consulta de endereços do OpenStreetMap. */
/*
 * RoutePilot - detalhes de enderecamento OpenStreetMap.
 * Consulta somente o bbox visivel e funciona sem lista fixa de cidades.
 */
const addressDetailLayer=L.layerGroup();
const addressDebugLayer=L.layerGroup();
const addressDetailMemoryCache=new Map();
let addressDetailTimer=null;
let addressDetailAbort=null;
let addressDetailRenderedKey='';
let addressDetailPendingKey='';
let addressDetailRequestToken=0;
let addressDetailBuildings=[];
let addressDebugEnabled=false;
let addressDetailRadiusFilter=null;
let addressDetailStatus={state:'idle',endpoint:'',elements:0,addresses:0,blocks:0,buildings:0,rendered:0,error:''};

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`publishAddressDetailStatus`). */
function publishAddressDetailStatus(){
  window.dispatchEvent(new CustomEvent('routepilot:address-status',{detail:{...addressDetailStatus}}));
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`addressDetailsEnabled`). */
function addressDetailsEnabled(){return Boolean($('toggleAddresses')?.checked);}

/** Guia: Obtém o valor atual em consulta de endereços do OpenStreetMap (`obterPerfilRenderizacaoEnderecos`). */
function obterPerfilRenderizacaoEnderecos(zoom=map?.getZoom()||CONFIGURACAO_OVERPASS.zoomMinimo){
  return CONFIGURACAO_OVERPASS.perfisRenderizacao.find(perfil=>zoom>=perfil.zoomMinimo)||CONFIGURACAO_OVERPASS.perfisRenderizacao.at(-1);
}

/** Guia: Monta a estrutura necessária em consulta de endereços do OpenStreetMap (`criarChaveCacheEnderecos`). */
function criarChaveCacheEnderecos(bounds,zoom){
  const precision=zoom>=CONFIGURACAO_OVERPASS.zoomCacheDetalhado?4:3;
  return [bounds.getSouth(),bounds.getWest(),bounds.getNorth(),bounds.getEast()]
    .map(value=>value.toFixed(precision)).concat(Math.min(zoom,CONFIGURACAO_OVERPASS.zoomMaximoChaveCache),addressDetailRadiusFilter?'focus':'map').join(':');
}
/** Guia: Monta a estrutura necessária em consulta de endereços do OpenStreetMap (`criarChaveArmazenamentoEnderecos`). */
function criarChaveArmazenamentoEnderecos(key){return `${CONFIGURACAO_OVERPASS.prefixoCache}${key}`;}

/** Guia: Limpa dados ou estados temporários em consulta de endereços do OpenStreetMap (`limparCachePersistenteAntigo`). */
function limparCachePersistenteAntigo(){
  try{
    const entries=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key?.startsWith(CONFIGURACAO_OVERPASS.prefixoCache))continue;
      try{entries.push({key,ts:Number(JSON.parse(localStorage.getItem(key))?.ts)||0});}
      catch(error){localStorage.removeItem(key);}
    }
    entries.sort((a,b)=>b.ts-a.ts).slice(CONFIGURACAO_OVERPASS.cacheMaximo).forEach(entry=>localStorage.removeItem(entry.key));
  }catch(error){/* armazenamento pode estar indisponivel */}
}
/** Guia: Interpreta os dados recebidos em consulta de endereços do OpenStreetMap (`lerCacheEnderecos`). */
function lerCacheEnderecos(key,{aceitarExpirado=false}={}){
  const memory=addressDetailMemoryCache.get(key);
  if(memory&&(aceitarExpirado||Date.now()-memory.ts<CONFIGURACAO_OVERPASS.cacheTtlMs))return memory.elements;
  try{
    const raw=localStorage.getItem(criarChaveArmazenamentoEnderecos(key));
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    if(!parsed||!Array.isArray(parsed.elements))return null;
    if(!aceitarExpirado&&Date.now()-Number(parsed.ts)>CONFIGURACAO_OVERPASS.cacheTtlMs)return null;
    addressDetailMemoryCache.set(key,{ts:parsed.ts,elements:parsed.elements});
    return parsed.elements;
  }catch(error){return null;}
}
/** Guia: Salva os dados no armazenamento adequado em consulta de endereços do OpenStreetMap (`gravarCacheEnderecos`). */
function gravarCacheEnderecos(key,elements){
  const entry={ts:Date.now(),elements};
  addressDetailMemoryCache.set(key,entry);
  while(addressDetailMemoryCache.size>CONFIGURACAO_OVERPASS.cacheMaximo)addressDetailMemoryCache.delete(addressDetailMemoryCache.keys().next().value);
  try{localStorage.setItem(criarChaveArmazenamentoEnderecos(key),JSON.stringify(entry));limparCachePersistenteAntigo();}
  catch(error){/* cache persistente e apenas uma otimizacao */}
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`addressDetailPolygons`). */
function addressDetailPolygons(element){
  if(element.type==='relation'&&Array.isArray(element.members)){
    const outers=element.members
      .filter(member=>(member.role||'outer')==='outer'&&Array.isArray(member.geometry)&&member.geometry.length>=3)
      .map(member=>member.geometry.map(point=>[point.lat,point.lon]));
    if(outers.length)return outers;
  }
  const geometry=element.geometry||[];
  return geometry.length>=3?[geometry.map(point=>[point.lat,point.lon])]:[];
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`ringCentroid`). */
function ringCentroid(ring){
  let twiceArea=0,centroidX=0,centroidY=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const x1=ring[j][1],y1=ring[j][0],x2=ring[i][1],y2=ring[i][0],cross=x1*y2-x2*y1;
    twiceArea+=cross;centroidX+=(x1+x2)*cross;centroidY+=(y1+y2)*cross;
  }
  if(Math.abs(twiceArea)<1e-12)return {point:[ring.reduce((sum,p)=>sum+p[0],0)/ring.length,ring.reduce((sum,p)=>sum+p[1],0)/ring.length],area:0};
  return {point:[centroidY/(3*twiceArea),centroidX/(3*twiceArea)],area:Math.abs(twiceArea/2)};
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`polygonsCentroid`). */
function polygonsCentroid(polygons){
  const parts=polygons.map(ringCentroid),total=parts.reduce((sum,part)=>sum+part.area,0);
  if(total>0)return [parts.reduce((sum,part)=>sum+part.point[0]*part.area,0)/total,parts.reduce((sum,part)=>sum+part.point[1]*part.area,0)/total];
  return parts[0]?.point||null;
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`addressDetailPoint`). */
function addressDetailPoint(element,polygons=null){
  if(Number.isFinite(element.lat)&&Number.isFinite(element.lon))return [element.lat,element.lon];
  if(polygons?.length)return polygonsCentroid(polygons);
  if(element.center&&Number.isFinite(element.center.lat)&&Number.isFinite(element.center.lon))return [element.center.lat,element.center.lon];
  const geometry=element.geometry||[];
  return geometry.length?[geometry.reduce((sum,p)=>sum+p.lat,0)/geometry.length,geometry.reduce((sum,p)=>sum+p.lon,0)/geometry.length]:null;
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`addressElementId`). */
function addressElementId(element){return `${element.type||'unknown'}/${element.id||'0'}`;}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`pointInsideLatLngPolygon`). */
function pointInsideLatLngPolygon(point,polygon){
  const [lat,lon]=point;let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [latI,lonI]=polygon[i],[latJ,lonJ]=polygon[j];
    if(((latI>lat)!==(latJ>lat))&&(lon<(lonJ-lonI)*(lat-latI)/((latJ-latI)||Number.EPSILON)+lonI))inside=!inside;
  }
  return inside;
}
/** Guia: Formata os dados para uso consistente em consulta de endereços do OpenStreetMap (`normalizeAddressNumber`). */
function normalizeAddressNumber(value){return String(value||'').trim().replace(/\s+/g,' ');}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`explicitBlockLabel`). */
function explicitBlockLabel(tags={}){
  const direct=tags['addr:block']||tags['addr:block_number']||tags['addr:block-number']||tags['building:block'];
  if(direct){
    const value=String(direct).trim(),prefixed=value.match(/^(?:bloco|bl\.?)\s*(.+)$/i);
    return prefixed?`Bloco ${prefixed[1]}`:`Bloco ${value}`;
  }
  for(const candidate of [tags.name,tags.ref,tags['addr:housename']]){
    const value=String(candidate||'').trim();
    const explicit=value.match(/(?:^|\b)(?:bloco|bl\.?)\s*([\p{L}\d-]{1,8})(?:\b|$)/iu);
    if(explicit)return `Bloco ${explicit[1]}`;
  }
  if(tags.ref&&(tags['building:part']==='yes'||tags.residential==='apartments'||tags['building:use']==='apartments')){
    const ref=String(tags.ref).trim();if(/^[\p{L}\d-]{1,8}$/u.test(ref))return `Bloco ${ref}`;
  }
  return '';
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`addressLabelIcon`). */
function addressLabelIcon(number,scale,verified=false){
  return L.divIcon({className:`address-number-icon address-label-${scale}${verified?' verified-address-icon':''}`,html:`<span class="house-number">${esc(number)}</span>`,iconSize:[64,26],iconAnchor:[32,13]});
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`blockLabelIcon`). */
function blockLabelIcon(label,scale,verified=false){
  return L.divIcon({className:`block-number-icon address-label-${scale}${verified?' verified-address-icon':''}`,html:`<span class="block-number">${esc(label)}</span>`,iconSize:[132,30],iconAnchor:[66,15]});
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`buildingRecords`). */
function buildingRecords(elements){
  return elements.filter(element=>['way','relation'].includes(element.type)&&element.tags?.building).map(element=>{
    const polygons=addressDetailPolygons(element);
    return {element,id:addressElementId(element),tags:element.tags||{},polygons,center:addressDetailPoint(element,polygons)};
  }).filter(building=>building.polygons.length&&building.center);
}
/** Guia: Monta a estrutura necessária em consulta de endereços do OpenStreetMap (`buildAddressSpatialIndex`). */
function buildAddressSpatialIndex(buildings){
  const grid=new Map();
  buildings.forEach(building=>{
    const points=building.polygons.flat();
    let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity;
    points.forEach(([lat,lon])=>{minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);});
    const minLatCell=Math.floor(minLat/.00055),maxLatCell=Math.floor(maxLat/.00055);
    const minLonCell=Math.floor(minLon/.00055),maxLonCell=Math.floor(maxLon/.00055);
    if((maxLatCell-minLatCell+1)*(maxLonCell-minLonCell+1)>400){if(!grid.has('*'))grid.set('*',[]);grid.get('*').push(building);return;}
    for(let latCell=minLatCell;latCell<=maxLatCell;latCell++)for(let lonCell=minLonCell;lonCell<=maxLonCell;lonCell++){
      const key=`${latCell}:${lonCell}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(building);
    }
  });
  return grid;
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`nearbyIndexedBuildings`). */
function nearbyIndexedBuildings(point,grid,size=.00055){
  const latCell=Math.floor(point[0]/size),lonCell=Math.floor(point[1]/size),found=new Set();
  (grid.get('*')||[]).forEach(building=>found.add(building));
  for(let latOffset=-1;latOffset<=1;latOffset++)for(let lonOffset=-1;lonOffset<=1;lonOffset++)(grid.get(`${latCell+latOffset}:${lonCell+lonOffset}`)||[]).forEach(building=>found.add(building));
  return [...found];
}
/** Guia: Localiza o item correspondente em consulta de endereços do OpenStreetMap (`nearestBuildingForAddress`). */
function nearestBuildingForAddress(point,buildings,index){
  const indexed=nearbyIndexedBuildings(point,index),pool=indexed.length?indexed:buildings;
  const containing=pool.find(building=>building.polygons.some(polygon=>pointInsideLatLngPolygon(point,polygon)));
  if(containing)return containing;
  if(!map)return null;
  let best=null,bestDistance=Infinity;
  pool.forEach(building=>{const distance=map.distance(point,building.center);if(distance<bestDistance){bestDistance=distance;best=building;}});
  return bestDistance<=CONFIGURACAO_OVERPASS.distanciaAssociacaoPredioMetros?best:null;
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`labelBox`). */
function labelBox(point,text,kind){
  const screen=map.latLngToContainerPoint(point);
  const width=kind==='block'?Math.min(142,Math.max(74,text.length*7.4+20)):Math.min(72,Math.max(26,text.length*6.7+14));
  return {x:screen.x-width/2,y:screen.y-(kind==='block'?15:12),w:width,h:kind==='block'?30:24};
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`boxesCollide`). */
function boxesCollide(a,b,padding=3){return a.x<b.x+b.w+padding&&a.x+a.w+padding>b.x&&a.y<b.y+b.h+padding&&a.y+a.h+padding>b.y;}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`visibleLabelCandidates`). */
function visibleLabelCandidates(elements,buildings){
  const candidates=[],seenHouse=new Set(),seenBlocks=new Set(),index=buildAddressSpatialIndex(buildings),buildingIds=new Set(buildings.map(item=>item.id));
  /** Guia: Registra um novo item em consulta de endereços do OpenStreetMap (`addBlock`). */
  const addBlock=(element,building)=>{
    const label=explicitBlockLabel(element.tags||{}),point=building?.center||addressDetailPoint(element);
    if(!label||!point)return;
    const key=`${label.toLowerCase()}|${building?.id||point.map(value=>value.toFixed(6)).join(':')}`;
    if(seenBlocks.has(key))return;
    seenBlocks.add(key);candidates.push({kind:'block',label,point,building,element,priority:100});
  };
  buildings.forEach(building=>addBlock(building.element,building));
  elements.forEach(element=>{
    if(!explicitBlockLabel(element.tags||{})||buildingIds.has(addressElementId(element)))return;
    const point=addressDetailPoint(element);addBlock(element,point?nearestBuildingForAddress(point,buildings,index):null);
  });
  elements.forEach(element=>{
    const tags=element.tags||{},number=normalizeAddressNumber(tags['addr:housenumber']);
    if(!number)return;
    const originalPoint=addressDetailPoint(element);if(!originalPoint)return;
    const building=['way','relation'].includes(element.type)&&tags.building?buildings.find(item=>item.id===addressElementId(element))||null:nearestBuildingForAddress(originalPoint,buildings,index);
    const point=building?.center||originalPoint,street=String(tags['addr:street']||tags['addr:place']||'').trim().toLowerCase();
    const key=`${number}|${street}|${building?.id||point.map(value=>value.toFixed(6)).join(':')}`;
    if(seenHouse.has(key))return;
    seenHouse.add(key);candidates.push({kind:'house',label:number,street,point,building,element,priority:building?70:45});
  });
  return candidates.sort((a,b)=>b.priority-a.priority||a.label.localeCompare(b.label,'pt-BR',{numeric:true}));
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`verifiedLabelCandidates`). */
function verifiedLabelCandidates(){
  if(typeof verifiedAddressPoints==='undefined'||!map)return [];
  const bounds=map.getBounds();
  return verifiedAddressPoints.filter(item=>bounds.contains([item.lat,item.lon])).map(item=>({
    kind:item.kind,label:item.kind==='block'?`Bloco ${item.label}`:item.label,point:[item.lat,item.lon],building:null,
    element:null,priority:130,verified:true,source:item.source,sourceUrl:item.sourceUrl
  }));
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`localSnapshotCandidates`). */
function localSnapshotCandidates(){
  if(typeof osmAddressSnapshot==='undefined'||!map)return [];
  const bounds=map.getBounds();
  return osmAddressSnapshot.points.filter(item=>bounds.contains([item.lat,item.lon])).map(item=>({
    kind:'house',label:item.label,street:String(item.street||item.place||'').trim().toLowerCase(),point:[item.lat,item.lon],building:null,element:null,
    priority:110,local:true,source:'OpenStreetMap · base local',sourceUrl:`https://www.openstreetmap.org/${item.osmId}`
  }));
}

/** Guia: Exibe o conteúdo solicitado em consulta de endereços do OpenStreetMap (`openAddressCandidates`). */
function openAddressCandidates(buildings){
  if(typeof openAddressVisiblePoints==='undefined'||!map)return [];
  const bounds=map.getBounds(),buildingIndex=buildAddressSpatialIndex(buildings),seen=new Map(),candidates=[];
  openAddressVisiblePoints.filter(item=>bounds.contains([item.lat,item.lon])).forEach(item=>{
    const originalPoint=[item.lat,item.lon],street=String(item.street||'').trim().toLowerCase();
    const duplicateKey=`${clean(item.number)}|${clean(street)}`,nearby=seen.get(duplicateKey)||[];
    if(nearby.some(point=>map.distance(point,originalPoint)<=CONFIGURACAO_ENDERECOS_ABERTOS.distanciaDuplicadaMetros))return;
    nearby.push(originalPoint);seen.set(duplicateKey,nearby);
    const building=nearestBuildingForAddress(originalPoint,buildings,buildingIndex);
    candidates.push({
      kind:'house',label:item.number,street,point:building?.center||originalPoint,building,element:null,
      priority:CONFIGURACAO_ENDERECOS_ABERTOS.prioridade,openAddress:true,
      source:'IBGE via Overture Maps',sourceUrl:openAddressTileIndex.sourceUrl
    });
  });
  return candidates;
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`sameAddressCandidate`). */
function sameAddressCandidate(a,b){
  if(a.kind!==b.kind||clean(a.label)!==clean(b.label))return false;
  if(a.street&&b.street&&clean(a.street)!==clean(b.street))return false;
  return map.distance(a.point,b.point)<=CONFIGURACAO_ENDERECOS_ABERTOS.distanciaDuplicadaMetros;
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`mergedAddressCandidates`). */
function mergedAddressCandidates(elements,buildings){
  const ordered=[...verifiedLabelCandidates(),...openAddressCandidates(buildings),...localSnapshotCandidates(),...visibleLabelCandidates(elements,buildings)]
    .sort((a,b)=>b.priority-a.priority||a.label.localeCompare(b.label,'pt-BR',{numeric:true}));
  const unique=[],buckets=new Map();
  ordered.forEach(candidate=>{
    const key=`${candidate.kind}|${clean(candidate.label)}`,bucket=buckets.get(key)||[];
    if(bucket.some(item=>sameAddressCandidate(item,candidate)))return;
    bucket.push(candidate);buckets.set(key,bucket);unique.push(candidate);
  });
  return unique;
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`osmReferenceType`). */
function osmReferenceType(tags={}){
  if(['hospital','clinic','doctors','pharmacy'].includes(tags.amenity))return 'health';
  if(['school','college','university','kindergarten'].includes(tags.amenity))return 'school';
  if(tags.amenity==='fuel')return 'fuel';
  if(tags.amenity==='place_of_worship')return 'church';
  if(['townhall','police','fire_station','post_office'].includes(tags.amenity))return 'civic';
  if(['community_centre','social_centre'].includes(tags.amenity))return 'community';
  if(tags.shop)return 'shop';
  if(tags.public_transport||tags.highway==='bus_stop'||tags.amenity==='bus_station')return 'bus';
  return 'landmark';
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`osmReferenceRecords`). */
function osmReferenceRecords(elements){
  if(!addressDetailRadiusFilter||!map||!$('toggleRefs')?.checked)return [];
  const keys=['amenity','shop','tourism','leisure','public_transport'];
  return elements.filter(element=>element.tags?.name&&keys.some(key=>element.tags[key])).map(element=>{
    const point=addressDetailPoint(element),type=osmReferenceType(element.tags);
    return point?{id:addressElementId(element),name:String(element.tags.name),category:detailKinds[type]?.label||'Referência',type,point,source:'OpenStreetMap'}:null;
  }).filter(item=>item&&map.distance(item.point,addressDetailRadiusFilter.center)<=addressDetailRadiusFilter.meters)
    .sort((a,b)=>map.distance(a.point,addressDetailRadiusFilter.center)-map.distance(b.point,addressDetailRadiusFilter.center)).slice(0,CONFIGURACAO_OVERPASS.limiteReferenciasConsulta);
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`addressBuildingGeoJSON`). */
function addressBuildingGeoJSON(building){
  const rings=building.polygons.map(ring=>{
    const coordinates=ring.map(([lat,lon])=>[lon,lat]),first=coordinates[0],last=coordinates[coordinates.length-1];
    if(first&&last&&(first[0]!==last[0]||first[1]!==last[1]))coordinates.push([...first]);
    return coordinates;
  });
  return {type:'Feature',properties:{osmId:building.id,...building.tags},geometry:rings.length===1?{type:'Polygon',coordinates:[rings[0]]}:{type:'MultiPolygon',coordinates:rings.map(ring=>[ring])}};
}
/** Guia: Renderiza a parte correspondente da interface em consulta de endereços do OpenStreetMap (`renderAddressDebugBuildings`). */
function renderAddressDebugBuildings(buildings=addressDetailBuildings){
  addressDebugLayer.clearLayers();
  if(!map||!addressDebugEnabled||map.getZoom()<CONFIGURACAO_OVERPASS.zoomMinimo){if(map?.hasLayer(addressDebugLayer))map.removeLayer(addressDebugLayer);return;}
  if(!map.hasLayer(addressDebugLayer))addressDebugLayer.addTo(map);
  buildings.forEach(building=>{
    L.polygon(building.polygons,{pane:'addressDebug',color:'#f27622',weight:2,opacity:.9,fill:true,fillColor:'#f59e0b',fillOpacity:.08})
      .bindTooltip(`OSM ${esc(building.id)}`,{sticky:true})
      .on('click',event=>{L.DomEvent.stopPropagation(event);window.RoutePilotAddressInspector?.open(building,addressBuildingGeoJSON(building));})
      .addTo(addressDebugLayer);
  });
}
/** Guia: Renderiza a parte correspondente da interface em consulta de endereços do OpenStreetMap (`renderAddressDetails`). */
function renderAddressDetails(elements,{cacheExpirado=false}={}){
  addressDetailLayer.clearLayers();if(!map)return;
  const profile=obterPerfilRenderizacaoEnderecos(),buildings=buildingRecords(elements),allCandidates=mergedAddressCandidates(elements,buildings);
  const candidates=addressDetailRadiusFilter?allCandidates.filter(candidate=>map.distance(candidate.point,addressDetailRadiusFilter.center)<=addressDetailRadiusFilter.meters):allCandidates;
  const references=osmReferenceRecords(elements),occupied=[],size=map.getSize();
  let rendered=0;
  candidates.forEach(candidate=>{
    if(rendered>=profile.maxLabels)return;
    const box=labelBox(candidate.point,candidate.label,candidate.kind);
    if(box.x< -12||box.y< -12||box.x+box.w>size.x+12||box.y+box.h>size.y+12)return;
    const padding=candidate.kind==='block'?Math.max(4,profile.collisionPadding):profile.collisionPadding;
    if(candidate.kind==='house'&&occupied.some(existing=>boxesCollide(box,existing,padding))&&!(candidate.verified&&map.getZoom()>=19))return;
    if(candidate.kind==='block'&&candidate.building?.polygons)L.polygon(candidate.building.polygons,{pane:'addressDetails',interactive:false,color:'#6d28d9',weight:2.5,opacity:.88,fill:true,fillOpacity:.035,dashArray:'6 4'}).addTo(addressDetailLayer);
    L.marker(candidate.point,{keyboard:false,interactive:false,title:candidate.verified||candidate.local||candidate.openAddress?`${candidate.label} · ${candidate.source}`:'',zIndexOffset:candidate.kind==='block'?980:900,icon:candidate.kind==='block'?blockLabelIcon(candidate.label,profile.labelScale,candidate.verified):addressLabelIcon(candidate.label,profile.labelScale,candidate.verified)}).addTo(addressDetailLayer);
    occupied.push(box);rendered++;
  });
  references.slice(0,CONFIGURACAO_OVERPASS.limiteReferenciasMapa).forEach(reference=>{
    const [osmType,osmId]=reference.id.split('/'),url=`https://www.openstreetmap.org/${encodeURIComponent(osmType)}/${encodeURIComponent(osmId)}`;
    L.marker(reference.point,{title:reference.name,zIndexOffset:760,icon:L.divIcon({className:'',html:referenceIcon({type:reference.type,name:reference.name},true),iconSize:[28,28],iconAnchor:[14,14]})})
      .bindTooltip(esc(reference.name)).bindPopup(`<b>${esc(reference.name)}</b><br>${esc(reference.category)}<br><a href="${url}" target="_blank" rel="noopener noreferrer">Fonte: OpenStreetMap</a>`).addTo(addressDetailLayer);
  });
  addressDetailBuildings=buildings;
  addressDetailStatus={...addressDetailStatus,state:'ready',cacheExpirado,elements:elements.length,addresses:candidates.filter(item=>item.kind==='house').length,blocks:candidates.filter(item=>item.kind==='block').length,verified:candidates.filter(item=>item.verified).length,local:candidates.filter(item=>item.local).length,openAddresses:candidates.filter(item=>item.openAddress).length,references:references.map(item=>({id:item.id,name:item.name,category:item.category,type:item.type,lat:item.point[0],lng:item.point[1],source:item.source})),buildings:buildings.length,rendered,error:''};
  publishAddressDetailStatus();
  renderAddressDebugBuildings(buildings);
}

/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`montarConsultaOverpass`). */
function montarConsultaOverpass(bounds){
  const bbox=[bounds.getSouth(),bounds.getWest(),bounds.getNorth(),bounds.getEast()].map(value=>value.toFixed(7)).join(',');
  const references=addressDetailRadiusFilter?`nwr["amenity"]["name"](${bbox});nwr["shop"]["name"](${bbox});nwr["tourism"]["name"](${bbox});nwr["leisure"]["name"](${bbox});nwr["public_transport"]["name"](${bbox});`:'';
  return `[out:json][timeout:${CONFIGURACAO_OVERPASS.timeoutConsultaSegundos}][maxsize:${CONFIGURACAO_OVERPASS.tamanhoMaximoResposta}];(
    nwr["addr:housenumber"](${bbox});
    nwr["addr:housename"](${bbox});
    way["building"](${bbox});
    relation["building"](${bbox});
    nwr["addr:block"](${bbox});
    nwr["building:block"](${bbox});
    ${references}
  );out tags center geom qt;`;
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`consultarOverpass`). */
async function consultarOverpass(query,signal,endpoints=CONFIGURACAO_OVERPASS.endpoints){
  let lastError=null;
  for(const endpoint of endpoints){
    let timedOut=false;
    const endpointAbort=new AbortController(),abortFromParent=()=>endpointAbort.abort();
    signal?.addEventListener('abort',abortFromParent,{once:true});
    const timeout=setTimeout(()=>{timedOut=true;endpointAbort.abort();},CONFIGURACAO_OVERPASS.timeoutRequisicaoMs);
    try{
      const response=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),signal:endpointAbort.signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}});
      if(!response.ok)throw new Error(`Overpass ${response.status}`);
      const data=await response.json(),elements=Array.isArray(data.elements)?data.elements:[];
      if(elements.length>CONFIGURACAO_OVERPASS.maximoElementos)throw new Error('Resposta Overpass excedeu o limite seguro');
      return {elements,endpoint};
    }catch(error){
      if(signal?.aborted)throw new DOMException('Consulta cancelada','AbortError');
      lastError=timedOut?new Error(`Timeout em ${endpoint}`):error;
    }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abortFromParent);}
  }
  throw lastError||new Error('Overpass indisponivel');
}
/** Guia: Obtém o valor atual em consulta de endereços do OpenStreetMap (`obterLimitesConsulta`). */
function obterLimitesConsulta(){return map.getBounds().pad(map.getZoom()>=CONFIGURACAO_OVERPASS.zoomCacheDetalhado?CONFIGURACAO_OVERPASS.margemConsultaDetalhada:CONFIGURACAO_OVERPASS.margemConsultaPadrao);}
/** Guia: Calcula o resultado solicitado em consulta de endereços do OpenStreetMap (`calcularAreaConsultaKm2`). */
function calcularAreaConsultaKm2(bounds){
  const center=bounds.getCenter(),width=map.distance([center.lat,bounds.getWest()],[center.lat,bounds.getEast()])/1000,height=map.distance([bounds.getSouth(),center.lng],[bounds.getNorth(),center.lng])/1000;
  return width*height;
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`cancelAddressDetailRequest`). */
function cancelAddressDetailRequest(){
  clearTimeout(addressDetailTimer);addressDetailTimer=null;
  if(addressDetailAbort)addressDetailAbort.abort();
  addressDetailAbort=null;addressDetailPendingKey='';addressDetailRequestToken++;
}
/** Carrega endereços OSM do trecho visível, usando cache e fallback entre endpoints. */
async function loadAddressDetails({force=false,endpoints=CONFIGURACAO_OVERPASS.endpoints}={}){
  if(!map||!addressDetailsEnabled()||map.getZoom()<CONFIGURACAO_OVERPASS.zoomMinimo){
    clearVisibleOpenAddresses();
    addressDetailLayer.clearLayers();addressDebugLayer.clearLayers();
    if(map?.hasLayer(addressDetailLayer))map.removeLayer(addressDetailLayer);
    if(map?.hasLayer(addressDebugLayer))map.removeLayer(addressDebugLayer);
    return;
  }
  if(!map.hasLayer(addressDetailLayer))addressDetailLayer.addTo(map);
  const bounds=obterLimitesConsulta(),profile=obterPerfilRenderizacaoEnderecos(),areaKm2=calcularAreaConsultaKm2(bounds);
  if(areaKm2>profile.maxAreaKm2){
    cancelAddressDetailRequest();addressDetailLayer.clearLayers();addressDebugLayer.clearLayers();
    addressDetailStatus={...addressDetailStatus,state:'limited',error:`Area visivel de ${areaKm2.toFixed(1)} km2 acima do limite`};publishAddressDetailStatus();return;
  }
  const key=criarChaveCacheEnderecos(bounds,map.getZoom());
  if(!force&&(key===addressDetailRenderedKey||key===addressDetailPendingKey))return;
  cancelAddressDetailRequest();addressDetailPendingKey=key;
  if(key!==addressDetailRenderedKey){addressDetailLayer.clearLayers();addressDebugLayer.clearLayers();}
  const cached=force?null:lerCacheEnderecos(key);
  const cacheExpirado=force?null:lerCacheEnderecos(key,{aceitarExpirado:true});
  addressDetailAbort=new AbortController();
  const token=++addressDetailRequestToken;
  renderAddressDetails([]);
  addressDetailStatus={...addressDetailStatus,state:'loading',endpoint:'',error:''};publishAddressDetailStatus();
  try{
    let openPoints=[];
    try{openPoints=await loadOpenAddressesForBounds(bounds);}
    catch(error){console.warn('RoutePilot: não foi possível carregar uma célula de endereços abertos.',error);}
    if(token!==addressDetailRequestToken)return;
    setVisibleOpenAddresses(openPoints);
    renderAddressDetails(cached||[]);
    if(cached){addressDetailRenderedKey=key;addressDetailStatus={...addressDetailStatus,state:'cache',endpoint:'cache',error:''};publishAddressDetailStatus();return;}
    const result=await consultarOverpass(montarConsultaOverpass(bounds),addressDetailAbort.signal,endpoints);
    if(token!==addressDetailRequestToken)return;
    gravarCacheEnderecos(key,result.elements);addressDetailRenderedKey=key;
    addressDetailStatus={...addressDetailStatus,state:'ready',endpoint:result.endpoint,error:''};renderAddressDetails(result.elements);
  }catch(error){
    if(error.name!=='AbortError'&&cacheExpirado){addressDetailRenderedKey=key;addressDetailStatus={...addressDetailStatus,endpoint:'cache-expirado',error:''};renderAddressDetails(cacheExpirado,{cacheExpirado:true});}
    else if(error.name!=='AbortError'){
      const abertos=openAddressCandidates([]),locais=localSnapshotCandidates();
      if(abertos.length||locais.length){addressDetailStatus={...addressDetailStatus,state:'ready',cacheExpirado:false,openAddresses:abertos.length,local:locais.length,endpoint:abertos.length?'base-aberta':'base-local',error:error.message||String(error)};publishAddressDetailStatus();}
      else {addressDetailStatus={...addressDetailStatus,state:'error',cacheExpirado:false,error:error.message||String(error)};publishAddressDetailStatus();console.warn('RoutePilot: numeros de imoveis indisponiveis no momento.',error);}
    }
  }finally{if(token===addressDetailRequestToken){addressDetailPendingKey='';addressDetailAbort=null;}}
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`scheduleAddressDetails`). */
function scheduleAddressDetails(){
  cancelAddressDetailRequest();
  if(!map||!addressDetailsEnabled()||map.getZoom()<CONFIGURACAO_OVERPASS.zoomMinimo){
    addressDetailRenderedKey='';clearVisibleOpenAddresses();addressDetailLayer.clearLayers();addressDebugLayer.clearLayers();
    if(map?.hasLayer(addressDetailLayer))map.removeLayer(addressDetailLayer);
    if(map?.hasLayer(addressDebugLayer))map.removeLayer(addressDebugLayer);
    return;
  }
  addressDetailTimer=setTimeout(()=>loadAddressDetails(),CONFIGURACAO_OVERPASS.debounceMs);
}
/** Guia: Atualiza o estado e a interface em consulta de endereços do OpenStreetMap (`updateAddressDetailLayer`). */
function updateAddressDetailLayer(){
  if(!map)return;
  if(addressDetailsEnabled()&&map.getZoom()>=CONFIGURACAO_OVERPASS.zoomMinimo){if(!map.hasLayer(addressDetailLayer))addressDetailLayer.addTo(map);scheduleAddressDetails();}
  else{
    cancelAddressDetailRequest();addressDetailRenderedKey='';clearVisibleOpenAddresses();addressDetailLayer.clearLayers();addressDebugLayer.clearLayers();
    if(map.hasLayer(addressDetailLayer))map.removeLayer(addressDetailLayer);
    if(map.hasLayer(addressDebugLayer))map.removeLayer(addressDebugLayer);
  }
}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`setAddressDebugMode`). */
function setAddressDebugMode(enabled){addressDebugEnabled=Boolean(enabled);renderAddressDebugBuildings();if(!addressDebugEnabled)window.RoutePilotAddressInspector?.close();}
/** Guia: Executa uma etapa auxiliar em consulta de endereços do OpenStreetMap (`setAddressDetailRadius`). */
function setAddressDetailRadius(center,meters){
  const lat=Number(center?.[0]),lng=Number(center?.[1]),radius=Number(meters);
  addressDetailRadiusFilter=Number.isFinite(lat)&&Number.isFinite(lng)&&Number.isFinite(radius)&&radius>0?{center:[lat,lng],meters:radius}:null;
  addressDetailRenderedKey='';addressDetailLayer.clearLayers();scheduleAddressDetails();
}
/** Guia: Limpa dados ou estados temporários em consulta de endereços do OpenStreetMap (`clearAddressDetailRadius`). */
function clearAddressDetailRadius(){setAddressDetailRadius(null,0);}

window.RoutePilotAddressDebug={
  reload(){addressDetailRenderedKey='';return loadAddressDetails({force:true});},
  clearCache(){
    addressDetailMemoryCache.clear();
    try{const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(CONFIGURACAO_OVERPASS.prefixoCache))keys.push(key);}keys.forEach(key=>localStorage.removeItem(key));}catch(error){}
    addressDetailRenderedKey='';return loadAddressDetails({force:true});
  },
  query(){return map?montarConsultaOverpass(obterLimitesConsulta()):'';},
  cancel:cancelAddressDetailRequest,
  setDebug:setAddressDebugMode,
  setRadius:setAddressDetailRadius,
  clearRadius:clearAddressDetailRadius,
  isDebug(){return addressDebugEnabled;},
  status(){return {...addressDetailStatus};},
  snapshot(){return addressDetailBuildings.map(building=>({id:building.id,center:[...building.center],tags:{...building.tags},geojson:addressBuildingGeoJSON(building)}));},
  testFallback(endpoints){return loadAddressDetails({force:true,endpoints});},
  endpoints:[...CONFIGURACAO_OVERPASS.endpoints],
  priorityAreas:typeof priorityMapAreas!=='undefined'?priorityMapAreas:[]
};

const addressLayerSourceHint=$('toggleAddresses')?.closest('label')?.querySelector('small');
if(addressLayerSourceHint)addressLayerSourceHint.textContent='(OSM + Overture/IBGE · zoom 17+)';
