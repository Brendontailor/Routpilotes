/* Recurso RoutePilot: mapa independente das rotas distribuídas por técnico. */
const RoutePilotAgendaMap=(()=>{
  const COLORS=['#087f96','#f27622','#7048b8','#27805b','#c84b61','#9a6b12','#3675c5','#9b4d96','#47717c','#b44c24','#547d24','#6558a8'];
  let agendaMap=null,routeLayers=new Map();
  /** Inicializa o mapa da área operacional somente quando ela é aberta. */
  function ensureMap(){
    if(agendaMap)return agendaMap;
    agendaMap=L.map('operationsMap',{zoomControl:true,preferCanvas:true}).setView([-31.69,-52.48],9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(agendaMap);
    return agendaMap;
  }
  /** Remove apenas as rotas da agenda, preservando o mapa base. */
  function clear(){routeLayers.forEach(layer=>layer.remove());routeLayers.clear();}
  /** Desenha uma camada numerada para cada técnico e enquadra todos os pontos. */
  function render(schedules=[]){
    const mapInstance=ensureMap();clear();const bounds=[];
    schedules.forEach((schedule,scheduleIndex)=>{
      const color=COLORS[schedule.technician.displayOrder%COLORS.length]||COLORS[scheduleIndex%COLORS.length];
      const group=L.layerGroup().addTo(mapInstance),points=schedule.items.map(item=>item.order.coords).filter(Boolean);routeLayers.set(`${schedule.technician.id}:${schedule.shiftId}`,group);
      if(points.length>1)L.polyline(points,{color,weight:4,opacity:.8,dashArray:'8 5'}).addTo(group);
      schedule.items.forEach((item,index)=>{bounds.push(item.order.coords);L.marker(item.order.coords,{icon:L.divIcon({className:'',html:`<span class="agenda-map-marker" style="--marker-color:${color}">${index+1}</span>`,iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip(`${item.order.number} · ${item.order.locality||item.order.address}`).addTo(group);});
    });
    if(bounds.length)mapInstance.fitBounds(bounds,{padding:[35,35],maxZoom:14});setTimeout(()=>mapInstance.invalidateSize(),0);
  }
  /** Corrige o tamanho do mapa após troca de aba ou redimensionamento. */
  function invalidate(){if(agendaMap)setTimeout(()=>agendaMap.invalidateSize(),0);}
  return {ensureMap,render,clear,invalidate,COLORS};
})();
