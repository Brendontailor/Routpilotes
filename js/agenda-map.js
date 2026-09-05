/* Recurso RoutePilot: mapa independente das rotas distribuídas por técnico. */
const RoutePilotAgendaMap=(()=>{
  const COLORS=['#087f96','#f27622','#7048b8','#27805b','#c84b61','#9a6b12','#3675c5','#9b4d96','#47717c','#b44c24','#547d24','#6558a8'];
  let agendaMap=null,routeLayers=new Map(),previewMarker=null;
  /** Inicializa o mapa da área operacional somente quando ela é aberta. */
  function ensureMap(){
    const container=document.getElementById('operationsMap');if(!container)return null;
    if(agendaMap&&agendaMap.getContainer()!==container){agendaMap.remove();agendaMap=null;routeLayers.clear();previewMarker=null;}
    if(agendaMap)return agendaMap;
    agendaMap=L.map(container,{zoomControl:true,preferCanvas:true}).setView([-31.69,-52.48],9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(agendaMap);
    return agendaMap;
  }
  /** Remove apenas as rotas da agenda, preservando o mapa base. */
  function clear(){routeLayers.forEach(layer=>layer.remove());routeLayers.clear();}
  /** Destaca temporariamente o melhor endereço sem cadastrar a OS. */
  function previewLocation(place,{confirmed=false}={}){
    const mapInstance=ensureMap();if(previewMarker)previewMarker.remove();if(!mapInstance||!place?.coords)return;
    previewMarker=L.marker(place.coords,{opacity:confirmed?1:.82}).bindTooltip(`${confirmed?'Local confirmado':'Sugestão'}: ${place.formattedAddress||place.name}`,{permanent:false}).addTo(mapInstance);
    mapInstance.setView(place.coords,place.approximate?16:18,{animate:false});
  }
  /** Remove somente o marcador temporário da busca de OS. */
  function clearPreview(){if(previewMarker){previewMarker.remove();previewMarker=null;}}
  /** Aguarda um clique para ajustar manualmente a coordenada aproximada. */
  function pickNextPoint(callback){const mapInstance=ensureMap();if(!mapInstance)return;mapInstance.getContainer().classList.add('is-picking-location');mapInstance.once('click',event=>{mapInstance.getContainer().classList.remove('is-picking-location');callback([event.latlng.lat,event.latlng.lng]);});}
  /** Desenha uma camada numerada para cada técnico e enquadra todos os pontos. */
  function render(schedules=[]){
    const mapInstance=ensureMap();if(!mapInstance)return;clear();const bounds=[];
    schedules.forEach((schedule,scheduleIndex)=>{
      const color=COLORS[schedule.technician.displayOrder%COLORS.length]||COLORS[scheduleIndex%COLORS.length];
      const group=L.layerGroup().addTo(mapInstance),points=schedule.items.map(item=>item.order.coords).filter(Boolean);routeLayers.set(`${schedule.technician.id}:${schedule.shiftId}`,group);
      if(points.length>1)L.polyline(points,{color,weight:4,opacity:.8,dashArray:'8 5'}).addTo(group);
      schedule.items.forEach((item,index)=>{const label=item.order.customerName||`OS ${item.order.number}`;bounds.push(item.order.coords);L.marker(item.order.coords,{icon:L.divIcon({className:'',html:`<span class="agenda-map-marker" style="--marker-color:${color}">${index+1}</span>`,iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip(`${label} · ${item.order.locality||item.order.address}`).addTo(group);});
    });
    if(bounds.length)mapInstance.fitBounds(bounds,{padding:[35,35],maxZoom:14});setTimeout(()=>mapInstance.invalidateSize(),0);
  }
  /** Corrige o tamanho do mapa após troca de aba ou redimensionamento. */
  function invalidate(){if(agendaMap)setTimeout(()=>agendaMap.invalidateSize(),0);}
  return {ensureMap,render,clear,previewLocation,clearPreview,pickNextPoint,invalidate,COLORS};
})();
