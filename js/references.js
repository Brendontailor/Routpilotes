const detailKinds={
  school:{label:'Escola / ensino',icon:'campus',color:'#2463a2',tint:'#edf5ff'},
  bus:{label:'Rodoviária',icon:'bus',color:'#247491',tint:'#eaf7fc'},
  health:{label:'Saúde',icon:'health',color:'#b73352',tint:'#fff0f3'},
  fuel:{label:'Combustível',icon:'fuel',color:'#936515',tint:'#fff6df'},
  shop:{label:'Comércio',icon:'shop',color:'#24784f',tint:'#ebf8ee'},
  church:{label:'Igreja',icon:'church',color:'#77628c',tint:'#f5f0fa'},
  civic:{label:'Serviço público',icon:'civic',color:'#366c7b',tint:'#edf7f9'},
  community:{label:'Comunidade',icon:'community',color:'#4c6e92',tint:'#eff5fb'},
  water:{label:'Caixa-d’água',icon:'water',color:'#007d9c',tint:'#e9f9fd'},
  tower:{label:'Antena',icon:'tower',color:'#5b6976',tint:'#f0f4f7'},
  landmark:{label:'Referência',icon:'pin',color:'#487057',tint:'#eef7f0'}
};
const detailCache=new Map();
let visibleDetailKeys=new Set();
const detailBoundsCache=new Map();
function detailBounds(id) {
  if(!detailBoundsCache.has(id))detailBoundsCache.set(id,regionBounds(id));
  return detailBoundsCache.get(id);
}

function isPointInsidePolygon(lat,lon,polygon) {
  if(!Array.isArray(polygon)||polygon.length<3)return false;
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [latI,lonI]=polygon[i],[latJ,lonJ]=polygon[j];
    if((latI>lat)!==(latJ>lat)&&lon<(lonJ-lonI)*(lat-latI)/(latJ-latI)+lonI)inside=!inside;
  }
  return inside;
}
function regionContainsPoint(region,lat,lon) {
  return region?.polygon?.length>=3?isPointInsidePolygon(lat,lon,region.polygon):detailBounds(region.id).contains([lat,lon]);
}

function insideRing(lat,lon,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [x,y]=ring[i],[px,py]=ring[j];
    if((y>lat)!==(py>lat)&&lon<(px-x)*(lat-y)/(py-y)+x)inside=!inside;
  }
  return inside;
}
function insideGeometry(lat,lon,geometry) {
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  return polygons.some(rings=>insideRing(lat,lon,rings[0])&&!rings.slice(1).some(r=>insideRing(lat,lon,r)));
}
function detailInArea(lat,lon) {
  if(comparisonActive()||(!state.region&&!state.city))return false;
  if(state.boundary)return insideGeometry(lat,lon,boundaryById[state.boundary].geometry);
  const p=pointFor(state.point);
  if(p)return map.distance([lat,lon],[p.lat,p.lon])<=4000;
  if(state.region)return regionContainsPoint(byRegion[state.region],lat,lon);
  return regions.filter(r=>r.city===state.city).some(r=>regionContainsPoint(r,lat,lon));
}
function detailInScope(lat,lon) {
  return map.getBounds().contains([lat,lon])&&detailInArea(lat,lon);
}
function areaReferences() {
  if(!map)return [];
  const p=pointFor(state.point),center=p?[p.lat,p.lon]:byRegion[state.region]?.center||map.getCenter();
  return mapDetails.pois.filter(p=>detailInArea(p.lat,p.lon)).sort((a,b)=>map.distance(center,[a.lat,a.lon])-map.distance(center,[b.lat,b.lon]));
}
function referenceRows(pois) {
  return pois.map(p=>`<button class="reference-row" data-action="detailPoi" data-value="${p.id}">${referenceIcon(p)}<span>${esc(p.name)}<small>${esc(p.category)}</small></span></button>`).join('');
}
function detailPopup(p) {
  const note=p.source==='OpenStreetMap'?`OpenStreetMap consultado em ${p.sourceDate}. Cadastro colaborativo; confirme a situação atual.`:`Levantamento municipal de ${mapDetails.poiYear}. Confirme a existência atual.`;
  return `<b>${esc(p.name)}</b><br>${esc(p.category)}${p.address?'<br>'+esc(p.address):''}<br><small>${esc(note)}</small><br><a href="${esc(p.sourceUrl||mapDetails.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte: ${esc(p.source||mapDetails.source)}</a>`;
}
function cachedDetail(key,create,visible) {
  if(!detailCache.has(key))detailCache.set(key,create());
  const layer=detailCache.get(key);sincronizarCamada(layer,true);visible.add(key);return layer;
}
function detailLabel(key,latlon,text,kind,visible,occupied) {
  const pos=map.latLngToContainerPoint(latlon),size=map.getSize();
  const box={x:pos.x+12,y:pos.y-10,w:Math.min(176,text.length*5.5+8),h:20};
  if(box.x<0||box.y<0||box.x+box.w>size.x||box.y+box.h>size.y)return false;
  if(occupied.some(b=>box.x<b.x+b.w+6&&box.x+box.w+6>b.x&&box.y<b.y+b.h+5&&box.y+box.h+5>b.y))return false;
  occupied.push(box);
  const layer=cachedDetail(key,()=>L.marker(latlon,{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:`<span class="detail-label ${kind}">${esc(text)}</span>`,iconSize:[176,20],iconAnchor:[-12,10]})}),visible);
  layer.setLatLng(latlon);
  return true;
}
function detailDensity(zoom) {
  return zoom<12?{limit:6,gap:72,names:0,roads:4}:zoom<14?{limit:10,gap:60,names:0,roads:6}:zoom<16?{limit:24,gap:40,names:8,roads:12}:{limit:40,gap:30,names:16,roads:16};
}
function visibleRoadAnchor(road) {
  const center=map.getCenter();let best=null,bestDistance=Infinity;
  // Test the closest point on each segment, including roads with no vertex in the viewport.
  for(const path of road.paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b[1]-a[1],dy=b[0]-a[0],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((center.lng-a[1])*dx+(center.lat-a[0])*dy)/length)):0;
    for(const p of [a,b,[a[0]+dy*t,a[1]+dx*t]]){
      if(!detailInScope(...p))continue;
      const distance=map.distance(center,p);
      if(distance<bestDistance){best=p;bestDistance=distance;}
    }
  }
  return best;
}
function updateMapDetails(occupied=[]) {
  if(!map)return;
  const visible=new Set(),pois=[],roads=[];
  let total=0;
  if((state.region||state.city)&&!comparisonActive()){
    const center=map.getCenter(),zoom=map.getZoom(),density=detailDensity(zoom),positions=[];
    if($('toggleRoads').checked){
      const names=new Set();let labels=0;
      const candidates=mapDetails.roads.filter(r=>zoom>=14||!['residential','unclassified'].includes(r.highway))
        .map(road=>({road,anchor:visibleRoadAnchor(road)})).filter(r=>r.anchor)
        .sort((a,b)=>map.distance(center,a.anchor)-map.distance(center,b.anchor));
      for(const {road,anchor} of candidates){
        if(names.has(clean(road.name)))continue;
        names.add(clean(road.name));
        cachedDetail('road:'+road.id,()=>L.polyline(road.paths,{pane:'roadDetails',color:'#667b83',weight:1.5,opacity:.5,interactive:false}),visible);
        roads.push(road);
        if($('toggleLabels').checked&&labels<density.roads&&detailLabel('road-label:'+road.id,anchor,road.name,'road-name',visible,occupied))labels++;
        if(roads.length>=60)break;
      }
    }
    if($('toggleRefs').checked){
      const priority={health:0,civic:1,bus:1,school:2,fuel:2,landmark:3};
      const candidates=mapDetails.pois.filter(p=>detailInScope(p.lat,p.lon)).sort((a,b)=>(priority[a.type]??4)-(priority[b.type]??4)||map.distance(center,[a.lat,a.lon])-map.distance(center,[b.lat,b.lon]));
      total=candidates.length;let labels=0;
      for(const p of candidates){
        const screen=map.latLngToContainerPoint([p.lat,p.lon]);
        if(positions.some(other=>Math.hypot(screen.x-other.x,screen.y-other.y)<density.gap))continue;
        positions.push(screen);
        cachedDetail('poi:'+p.id,()=>L.marker([p.lat,p.lon],{title:`${p.name} (${p.category})`,zIndexOffset:400,icon:L.divIcon({className:'',html:referenceIcon(p,true),iconSize:[28,28],iconAnchor:[14,14]})}).bindPopup(detailPopup(p)).bindTooltip(esc(p.name)),visible);
        pois.push(p);
        if($('toggleLabels').checked&&labels<density.names&&detailLabel('poi-label:'+p.id,[p.lat,p.lon],p.name,'poi-name',visible,occupied))labels++;
        if(pois.length>=density.limit)break;
      }
    }
  }
  visibleDetailKeys.forEach(key=>{if(!visible.has(key))sincronizarCamada(detailCache.get(key),false);});
  visibleDetailKeys=visible;
  const panel=$('visibleMapDetails');
  const types=[...new Set(pois.map(p=>p.type))];
  panel.innerHTML=(state.region||state.city)&&!comparisonActive()?(types.length?'<div class="detail-legend">'+types.map(type=>`<span>${referenceIcon({type,name:''})}${esc(detailKinds[type].label)}</span>`).join('')+'</div>':'')+'<h3>Na área visível do mapa</h3>'+`<p class="reference-count">${pois.length} ícones visíveis · ${total} referências cadastradas neste trecho</p>`+
    (roads.length?'<ul class="visible-road-list">'+roads.slice(0,8).map(r=>`<li>${esc(r.name)}</li>`).join('')+'</ul>':'')+
    (pois.length?referenceRows(pois.slice(0,8)):'<p class="empty">Sem referências cadastradas na área visível.</p>')+
    `<p class="map-caution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap / ODbL</a>: ${mapDetails.osmDate}. <a href="${mapDetails.sourceUrl}" target="_blank" rel="noopener noreferrer">Prefeitura de Pelotas</a>: referências ${mapDetails.poiYear}, vias ${mapDetails.roadYear}. Confirme a situação atual.</p>`:'';
}
function openDetailPoi(id) {
  const p=mapDetails.pois.find(p=>p.id===id);
  if(!p||!map)return;
  $('toggleRefs').checked=true;
  identifyCoordinates(p.lat,p.lon,{source:'reference',reference:p});
  map.flyTo([p.lat,p.lon],16,{duration:.4});
  cachedDetail('poi:'+id,()=>L.marker([p.lat,p.lon],{title:`${p.name} (${p.category})`,icon:L.divIcon({className:'',html:referenceIcon(p,true),iconSize:[28,28],iconAnchor:[14,14]})}).bindPopup(detailPopup(p)).bindTooltip(esc(p.name)),visibleDetailKeys).openPopup();
}
