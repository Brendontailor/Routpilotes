/* Recurso RoutePilot: números de imóveis por células. */
/* Carrega apenas as células de endereços abertos próximas ao bbox visível. */
const openAddressTileCache=new Map();
const openAddressTileRequests=new Map();
let openAddressVisiblePoints=[];

/** Guia: Exibe o conteúdo solicitado em números de imóveis por células (`openAddressTileKey`). */
function openAddressTileKey(latIndex,lonIndex){return `${latIndex}_${lonIndex}`;}

/** Guia: Exibe o conteúdo solicitado em números de imóveis por células (`openAddressTileKeys`). */
function openAddressTileKeys(bounds){
  if(typeof openAddressTileIndex==='undefined'||!bounds)return [];
  const size=openAddressTileIndex.cellSize,keys=[];
  const minLat=Math.floor(bounds.getSouth()/size),maxLat=Math.floor(bounds.getNorth()/size);
  const minLon=Math.floor(bounds.getWest()/size),maxLon=Math.floor(bounds.getEast()/size);
  for(let lat=minLat;lat<=maxLat;lat++)for(let lon=minLon;lon<=maxLon;lon++){
    const key=openAddressTileKey(lat,lon);
    if(Object.hasOwn(openAddressTileIndex.tiles,key))keys.push(key);
  }
  return keys;
}

/** Guia: Carrega os dados necessários em números de imóveis por células (`fetchOpenAddressTile`). */
async function fetchOpenAddressTile(key){
  if(openAddressTileCache.has(key))return openAddressTileCache.get(key);
  if(openAddressTileRequests.has(key))return openAddressTileRequests.get(key);
  const request=fetch(`${CONFIGURACAO_ENDERECOS_ABERTOS.diretorioTiles}/${encodeURIComponent(key)}.json`)
    .then(response=>{if(!response.ok)throw new Error(`Tile de endereços ${response.status}`);return response.json();})
    .then(data=>{
      const points=Array.isArray(data?.points)?data.points:[];
      openAddressTileCache.set(key,points);openAddressTileRequests.delete(key);
      return points;
    })
    .catch(error=>{openAddressTileRequests.delete(key);throw error;});
  openAddressTileRequests.set(key,request);
  return request;
}

/** Retorna somente os endereços dos tiles que cruzam os limites solicitados. */
async function loadOpenAddressesForBounds(bounds){
  const keys=openAddressTileKeys(bounds);
  const loaded=await Promise.all(keys.map(fetchOpenAddressTile));
  return loaded.flat().map(item=>({id:item[0],lat:item[1],lon:item[2],number:item[3],street:item[4],region:item[5]}));
}

/** Guia: Executa uma etapa auxiliar em números de imóveis por células (`setVisibleOpenAddresses`). */
function setVisibleOpenAddresses(points){openAddressVisiblePoints=Array.isArray(points)?points:[];}
/** Guia: Limpa dados ou estados temporários em números de imóveis por células (`clearVisibleOpenAddresses`). */
function clearVisibleOpenAddresses(){openAddressVisiblePoints=[];}

/** Procura o numero local mais proximo de um ponto selecionado manualmente. */
async function reverseOpenAddress(coords,{radiusMeters=80}={}){
  const [lat,lon]=coords.map(Number);if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const latPad=radiusMeters/111320,lonPad=radiusMeters/(111320*Math.max(.2,Math.cos(lat*Math.PI/180)));
  const bounds={getSouth:()=>lat-latPad,getNorth:()=>lat+latPad,getWest:()=>lon-lonPad,getEast:()=>lon+lonPad};
  const addresses=await loadOpenAddressesForBounds(bounds);let nearest=null;
  for(const address of addresses){
    const meters=distanceKm([lat,lon],[address.lat,address.lon])*1000;if(meters>radiusMeters||nearest&&nearest.meters<=meters)continue;nearest={address,meters};
  }
  if(!nearest)return null;
  const address=nearest.address,region=byRegion[address.region];
  return {id:`open:${address.id}`,name:`${address.street}, ${address.number}`,formattedAddress:`${address.street}, ${address.number}`,street:address.street,houseNumber:String(address.number),city:region?.city||'',cityName:region?cityName(region.city):'',region:region?.id||null,locality:region?.name||'',coords:[address.lat,address.lon],source:'local',approximate:false};
}

window.RoutePilotOpenAddresses={
  status:()=>({available:openAddressTileIndex.total,cells:Object.keys(openAddressTileIndex.tiles).length,loadedCells:openAddressTileCache.size,pendingCells:openAddressTileRequests.size,visiblePoints:openAddressVisiblePoints.length}),
  reverse:reverseOpenAddress,
  clearMemory:()=>{openAddressTileCache.clear();openAddressTileRequests.clear();clearVisibleOpenAddresses();}
};
