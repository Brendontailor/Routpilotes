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

window.RoutePilotOpenAddresses={
  status:()=>({available:openAddressTileIndex.total,cells:Object.keys(openAddressTileIndex.tiles).length,loadedCells:openAddressTileCache.size,pendingCells:openAddressTileRequests.size,visiblePoints:openAddressVisiblePoints.length}),
  clearMemory:()=>{openAddressTileCache.clear();openAddressTileRequests.clear();clearVisibleOpenAddresses();}
};
