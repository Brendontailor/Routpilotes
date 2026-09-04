let localRoadNetworkPromise=null;
let localStreetCatalogPromise=null;
const localAddressShardPromises=new Map();
const localRouteCache=new Map();

function localRoutingFetch(path){
  return fetch(path).then(response=>{
    if(!response.ok)throw new Error(`Arquivo local indisponível (${response.status}).`);
    return response.json();
  });
}

function loadLocalRoadNetwork(){
  if(!localRoadNetworkPromise){
    localRoadNetworkPromise=localRoutingFetch(CONFIGURACAO_ROTAS_LOCAIS.arquivoMalha).then(data=>{
      if(!Array.isArray(data?.nodes)||!Array.isArray(data?.edges))throw new Error('Malha viária local inválida.');
      const adjacency=Array.from({length:data.nodes.length},()=>[]);
      data.edges.forEach(([from,to,meters,flags])=>{
        if(flags&1)adjacency[from].push([to,meters]);
        if(flags&2)adjacency[to].push([from,meters]);
      });
      return {...data,adjacency};
    }).catch(error=>{localRoadNetworkPromise=null;throw error;});
  }
  return localRoadNetworkPromise;
}

function loadLocalStreetCatalog(){
  if(!localStreetCatalogPromise)localStreetCatalogPromise=localRoutingFetch(CONFIGURACAO_ROTAS_LOCAIS.arquivoCatalogoRuas).catch(error=>{localStreetCatalogPromise=null;throw error;});
  return localStreetCatalogPromise;
}

function loadLocalAddressShard(shard){
  if(!localAddressShardPromises.has(shard)){
    const promise=localRoutingFetch(`${CONFIGURACAO_ROTAS_LOCAIS.diretorioDados}/addresses-${encodeURIComponent(shard)}.json`)
      .catch(error=>{localAddressShardPromises.delete(shard);throw error;});
    localAddressShardPromises.set(shard,promise);
  }
  return localAddressShardPromises.get(shard);
}

function parseLocalAddressQuery(query){
  let normalized=clean(query),city=null;
  Object.keys(cityNames).forEach(cityId=>{
    const name=clean(cityName(cityId));
    if(normalized.includes(name)){city=cityId;normalized=normalized.replace(name,' ').replace(/\s+/g,' ').trim();}
  });
  normalized=normalized.replace(/\b(?:rio grande do sul|brasil)\b/g,' ').replace(/\brs\b/g,' ').replace(/\s+/g,' ').trim();
  let match=normalized.match(/^(\d+[a-z]?)\s+(.+)$/i);
  if(match)return {number:match[1],street:match[2].trim(),city};
  match=normalized.match(/^(.+?)\s+(?:n(?:umero)?\s+)?(\d+[a-z]?)$/i);
  return match?{number:match[2],street:match[1].trim(),city}:{number:'',street:'',city};
}

function localStreetScore(entry,query){
  if(entry[0]===query)return 10000;
  if(entry[0].startsWith(query)||query.startsWith(entry[0]))return 8000-Math.abs(entry[0].length-query.length);
  return typeof pontuarTexto==='function'?pontuarTexto(entry[1],'',query):0;
}

function dedupeLocalAddressMatches(matches){
  const unique=[];
  matches.forEach(match=>{
    if(unique.some(item=>item.region===match.region&&distanceKm(item.coords,match.coords)<.02))return;
    unique.push(match);
  });
  return unique;
}

/** Resolve um endereço somente na base estática do RoutePilot. */
async function resolveLocalRouteAddress(query){
  const parsed=parseLocalAddressQuery(query);
  if(!parsed.number||!parsed.street)throw new Error('Informe rua, número e cidade. Exemplo: Avenida Duque de Caxias, 331, Pelotas.');
  const catalog=await loadLocalStreetCatalog();
  const scored=(catalog.streets||[]).map(entry=>({entry,score:localStreetScore(entry,parsed.street)})).filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score||a.entry[1].localeCompare(b.entry[1],'pt-BR')).slice(0,8);
  if(!scored.length)throw new Error('Rua não encontrada na base local do RoutePilot.');
  const bestScore=scored[0].score,candidates=scored.filter(item=>item.score===bestScore||item.score>=bestScore*.92);
  const shards=await Promise.all([...new Set(candidates.map(item=>item.entry[2]))].map(loadLocalAddressShard));
  const loadedByStreet=new Map();
  shards.forEach(shard=>Object.entries(shard.streets||{}).forEach(([key,value])=>loadedByStreet.set(key,value)));
  const matches=[];
  candidates.forEach(({entry})=>{
    const group=loadedByStreet.get(entry[0]);
    if(!group)return;
    group[1].filter(address=>clean(address[0])===clean(parsed.number)).forEach(address=>{
      const region=byRegion[address[3]];
      if(!region||(parsed.city&&region.city!==parsed.city))return;
      matches.push({kind:'address',id:`${entry[0]}:${address[0]}:${address[1]}:${address[2]}`,name:`${group[0]}, ${address[0]}`,aliases:[query],city:region.city,region:region.id,context:`${cityName(region.city)} ${region.name}`,sub:'Endereço local',coords:[address[1]/1e6,address[2]/1e6],boundaryId:null});
    });
  });
  const unique=dedupeLocalAddressMatches(matches);
  if(!unique.length)throw new Error('Número não encontrado nessa rua na base local.');
  if(unique.length>1&&!parsed.city){
    const cities=[...new Set(unique.map(item=>cityName(item.city)))].join(' ou ');
    throw new Error(`Há mais de um resultado. Inclua a cidade no endereço${cities?`: ${cities}`:''}.`);
  }
  if(unique.length>1)throw new Error('Há mais de um imóvel com esse número. Acrescente bairro ou confira o ponto no mapa.');
  return {...unique[0],key:`address:${unique[0].id}`};
}

function routingNodeCoordinates(network,index){const node=network.nodes[index];return [node[0]/1e6,node[1]/1e6];}

function nearestRoutingNode(network,coords){
  let bestIndex=-1,bestMeters=Infinity;
  for(let index=0;index<network.nodes.length;index++){
    const meters=distanceKm(coords,routingNodeCoordinates(network,index))*1000;
    if(meters<bestMeters){bestIndex=index;bestMeters=meters;}
  }
  return {index:bestIndex,meters:bestMeters,coords:routingNodeCoordinates(network,bestIndex)};
}

class RoutingMinHeap{
  constructor(){this.items=[];}
  push(item){
    this.items.push(item);let index=this.items.length-1;
    while(index){const parent=(index-1)>>1;if(this.items[parent][0]<=item[0])break;this.items[index]=this.items[parent];index=parent;}
    this.items[index]=item;
  }
  pop(){
    if(!this.items.length)return null;
    const first=this.items[0],last=this.items.pop();
    if(this.items.length){let index=0;this.items[0]=last;while(true){let child=index*2+1;if(child>=this.items.length)break;if(child+1<this.items.length&&this.items[child+1][0]<this.items[child][0])child++;if(this.items[child][0]>=this.items[index][0])break;[this.items[index],this.items[child]]=[this.items[child],this.items[index]];index=child;}}
    return first;
  }
  get length(){return this.items.length;}
}

function shortestLocalRoadPath(network,start,target){
  const distances=new Float64Array(network.nodes.length);distances.fill(Infinity);distances[start]=0;
  const previous=new Int32Array(network.nodes.length);previous.fill(-1);
  const visited=new Uint8Array(network.nodes.length),heap=new RoutingMinHeap();
  heap.push([0,start]);
  while(heap.length){
    const [,current]=heap.pop();
    if(visited[current])continue;
    visited[current]=1;
    if(current===target)break;
    for(const [next,meters] of network.adjacency[current]){
      if(visited[next])continue;
      const candidate=distances[current]+meters;
      if(candidate>=distances[next])continue;
      distances[next]=candidate;previous[next]=current;
      const heuristic=distanceKm(routingNodeCoordinates(network,next),routingNodeCoordinates(network,target))*1000;
      heap.push([candidate+heuristic,next]);
    }
  }
  if(!Number.isFinite(distances[target]))return null;
  const path=[];for(let current=target;current!==-1;current=previous[current])path.push(current);
  path.reverse();return {meters:distances[target],path};
}

function localRouteCacheKey(origin,destination){return [...origin,...destination].map(value=>Number(value).toFixed(5)).join(':');}

/** Calcula a menor distância na malha viária embutida, sem serviço externo. */
async function calculateLocalRoadRoute(origin,destination){
  const key=localRouteCacheKey(origin,destination);
  if(localRouteCache.has(key))return localRouteCache.get(key);
  const network=await loadLocalRoadNetwork(),start=nearestRoutingNode(network,origin),end=nearestRoutingNode(network,destination);
  if(start.meters>CONFIGURACAO_ROTAS_LOCAIS.distanciaMaximaAjusteMetros||end.meters>CONFIGURACAO_ROTAS_LOCAIS.distanciaMaximaAjusteMetros)throw new Error('Um dos pontos está distante demais da malha viária local.');
  const route=shortestLocalRoadPath(network,start.index,end.index);
  if(!route)throw new Error('Não foi encontrada uma ligação por estrada entre os dois pontos.');
  const result={distanceKm:route.meters/1000,snapMeters:start.meters+end.meters,geometry:route.path.map(index=>routingNodeCoordinates(network,index)),source:'RoutePilot · malha Overture Maps'};
  localRouteCache.set(key,result);
  if(localRouteCache.size>CONFIGURACAO_ROTAS_LOCAIS.maximoRotasCache)localRouteCache.delete(localRouteCache.keys().next().value);
  return result;
}

window.RoutePilotLocalRouting={
  status:()=>({networkLoaded:Boolean(localRoadNetworkPromise),streetCatalogLoaded:Boolean(localStreetCatalogPromise),addressShardsLoaded:localAddressShardPromises.size,cachedRoutes:localRouteCache.size}),
  calculate:calculateLocalRoadRoute,
  resolveAddress:resolveLocalRouteAddress
};
