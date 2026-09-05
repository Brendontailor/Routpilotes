/* Recurso RoutePilot: roteamento local. */
let localRoadNetworkPromise=null;
let localStreetCatalogPromise=null;
const localAddressShardPromises=new Map();
const localRouteCache=new Map();
const localDistanceCache=new Map();

/** Guia: Executa uma etapa auxiliar em roteamento local (`localRoutingFetch`). */
function localRoutingFetch(path){
  return fetch(path).then(response=>{
    if(!response.ok)throw new Error(`Arquivo local indisponível (${response.status}).`);
    return response.json();
  });
}

/** Guia: Carrega os dados necessários em roteamento local (`loadLocalRoadNetwork`). */
function loadLocalRoadNetwork(){
  if(!localRoadNetworkPromise){
    localRoadNetworkPromise=localRoutingFetch(CONFIGURACAO_ROTAS_LOCAIS.arquivoMalha).then(data=>{
      if(!Array.isArray(data?.nodes)||!Array.isArray(data?.edges))throw new Error('Malha viária local inválida.');
      // Converte as arestas compactas em vizinhos rápidos para o cálculo das rotas.
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

/** Guia: Carrega os dados necessários em roteamento local (`loadLocalStreetCatalog`). */
function loadLocalStreetCatalog(){
  if(!localStreetCatalogPromise)localStreetCatalogPromise=localRoutingFetch(CONFIGURACAO_ROTAS_LOCAIS.arquivoCatalogoRuas).catch(error=>{localStreetCatalogPromise=null;throw error;});
  return localStreetCatalogPromise;
}

/** Guia: Carrega os dados necessários em roteamento local (`loadLocalAddressShard`). */
function loadLocalAddressShard(shard){
  // Cada fragmento é baixado no máximo uma vez durante a sessão.
  if(!localAddressShardPromises.has(shard)){
    const promise=localRoutingFetch(`${CONFIGURACAO_ROTAS_LOCAIS.diretorioDados}/addresses-${encodeURIComponent(shard)}.json`)
      .catch(error=>{localAddressShardPromises.delete(shard);throw error;});
    localAddressShardPromises.set(shard,promise);
  }
  return localAddressShardPromises.get(shard);
}

/** Guia: Interpreta os dados recebidos em roteamento local (`parseLocalAddressQuery`). */
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

/** Guia: Executa uma etapa auxiliar em roteamento local (`localStreetScore`). */
function localStreetScore(entry,query){
  if(entry[0]===query)return 10000;
  if(entry[0].startsWith(query)||query.startsWith(entry[0]))return 8000-Math.abs(entry[0].length-query.length);
  return typeof pontuarTexto==='function'?pontuarTexto(entry[1],'',query):0;
}

/** Guia: Processa e organiza os itens em roteamento local (`dedupeLocalAddressMatches`). */
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

/** Procura endereços, ruas e localidades sem exigir texto ou número exatos. */
async function searchLocalRouteLocations(query,{limit=5}={}){
  const SEARCH=RoutePilotWorkOrderSearch,normalizedQuery=SEARCH.normalize(query);if(!normalizedQuery)return [];
  const known=typeof compareCatalog==='function'?compareCatalog().map(item=>({...item,formattedAddress:item.name,cityName:cityName(item.city),locality:item.context,source:'Cadastro RoutePilot',approximate:false,localPriority:110})):[];
  const cityCandidates=Object.keys(cityNames).map(city=>{const related=regions.filter(region=>region.city===city),coords=related.length?[related.reduce((sum,region)=>sum+region.center[0],0)/related.length,related.reduce((sum,region)=>sum+region.center[1],0)/related.length]:null;return coords?{kind:'city',id:`city:${city}`,key:`city:${city}`,name:cityName(city),formattedAddress:cityName(city),city,cityName:cityName(city),locality:'Cidade atendida',region:null,coords,source:'Cadastro RoutePilot',approximate:true,localPriority:130}:null;}).filter(Boolean);
  const catalog=await loadLocalStreetCatalog();
  // O catálogo leve cobre todas as vias e inclui as regiões onde cada uma possui números.
  const streetEntries=(catalog.streets||[]).map(entry=>{
    const regionIds=entry[3]||[],context=regionIds.map(regionId=>{const region=byRegion[regionId];return region?`${cityName(region.city)} ${region.name}`:'';}).filter(Boolean).join(' ');
    const candidate={entry,name:entry[1],context:`via rua avenida estrada rodovia travessa ${context}`,localPriority:80};
    return {...candidate,searchScore:SEARCH.scoreStreetCandidate(query,candidate)};
  }).filter(item=>item.searchScore>0).sort((a,b)=>b.searchScore-a.searchScore||a.name.localeCompare(b.name,'pt-BR')).slice(0,16);
  const queryNumbers=normalizedQuery.match(/\b\d+[a-z]?\b/g)||[],streetResults=[];
  const loadedShards=new Map(await Promise.all([...new Set(streetEntries.map(item=>item.entry[2]))].map(async shard=>[shard,await loadLocalAddressShard(shard)])));
  for(const ranked of streetEntries){
    const entry=ranked.entry,group=loadedShards.get(entry[2])?.streets?.[entry[0]];if(!group)continue;
    const streetNumbers=new Set((SEARCH.normalize(group[0]).match(/\b\d+[a-z]?\b/g)||[])),houseNumber=queryNumbers.find(number=>!streetNumbers.has(number))||'';
    const grouped=new Map();
    group[1].forEach(address=>{const region=byRegion[address[3]];if(!region)return;const key=region.id;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(address);});
    for(const [regionId,addresses] of grouped){
      const region=byRegion[regionId],exact=houseNumber?addresses.find(address=>SEARCH.normalize(address[0])===houseNumber):null,address=exact||addresses[Math.floor(addresses.length/2)];if(!address)continue;
      streetResults.push({kind:'address',id:`${entry[0]}:${address[0]}:${address[1]}:${address[2]}`,key:`address:${entry[0]}:${address[0]}:${address[1]}:${address[2]}`,name:exact?`${group[0]}, ${address[0]}`:group[0],formattedAddress:exact?`${group[0]}, ${address[0]}`:group[0],city:region.city,cityName:cityName(region.city),region:region.id,locality:region.name,context:`${cityName(region.city)} ${region.name}`,sub:exact?'Endereço local':'Localização aproximada',coords:[address[1]/1e6,address[2]/1e6],boundaryId:null,source:'Base local RoutePilot',approximate:!exact,localPriority:exact?145:90});
    }
  }
  const combined=SEARCH.rank(query,[...cityCandidates,...known,...streetResults],{limit:limit*3}),seen=new Set(),results=[];
  for(const item of combined){const key=`${item.kind}:${item.name}:${item.city}:${item.region||''}`;if(seen.has(key))continue;seen.add(key);results.push(item);if(results.length===limit)break;}
  return results;
}

/** Guia: Executa uma etapa auxiliar em roteamento local (`routingNodeCoordinates`). */
function routingNodeCoordinates(network,index){const node=network.nodes[index];return [node[0]/1e6,node[1]/1e6];}

/** Guia: Localiza o item correspondente em roteamento local (`nearestRoutingNode`). */
function nearestRoutingNode(network,coords){
  let bestIndex=-1,bestMeters=Infinity;
  for(let index=0;index<network.nodes.length;index++){
    const meters=distanceKm(coords,routingNodeCoordinates(network,index))*1000;
    if(meters<bestMeters){bestIndex=index;bestMeters=meters;}
  }
  return {index:bestIndex,meters:bestMeters,coords:routingNodeCoordinates(network,bestIndex)};
}

/** Guia: estrutura auxiliar `RoutingMinHeap` usada pelo recurso de roteamento local. */
class RoutingMinHeap{
  /** Inicializa a fila de prioridade usada pelo algoritmo A*. */
  constructor(){this.items=[];}
  /** Insere um nó mantendo o menor custo no topo da fila. */
  push(item){
    this.items.push(item);let index=this.items.length-1;
    while(index){const parent=(index-1)>>1;if(this.items[parent][0]<=item[0])break;this.items[index]=this.items[parent];index=parent;}
    this.items[index]=item;
  }
  /** Retira e devolve o nó com menor custo estimado. */
  pop(){
    if(!this.items.length)return null;
    const first=this.items[0],last=this.items.pop();
    if(this.items.length){let index=0;this.items[0]=last;while(true){let child=index*2+1;if(child>=this.items.length)break;if(child+1<this.items.length&&this.items[child+1][0]<this.items[child][0])child++;if(this.items[child][0]>=this.items[index][0])break;[this.items[index],this.items[child]]=[this.items[child],this.items[index]];index=child;}}
    return first;
  }
  /** Informa quantos nós ainda aguardam processamento. */
  get length(){return this.items.length;}
}

/** Guia: Executa uma etapa auxiliar em roteamento local (`shortestLocalRoadPath`). */
function shortestLocalRoadPath(network,start,target){
  // A* combina a distância percorrida com a estimativa até o destino.
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

/** Guia: Executa uma etapa auxiliar em roteamento local (`localRouteCacheKey`). */
function localRouteCacheKey(origin,destination){return [...origin,...destination].map(value=>Number(value).toFixed(5)).join(':');}

/** Cria uma chave estável para reaproveitar distâncias direcionadas entre dois pontos. */
function localDistanceCacheKey(origin,destination){return `${localRouteCacheKey(origin,destination)}:distance`;}

/** Calcula de uma origem até vários destinos e encerra quando todos forem encontrados. */
function shortestDistancesToTargets(network,start,targetIndexes){
  const targets=new Set(targetIndexes),found=new Map(),distances=new Float64Array(network.nodes.length),visited=new Uint8Array(network.nodes.length);
  distances.fill(Infinity);distances[start]=0;
  const heap=new RoutingMinHeap();heap.push([0,start]);
  while(heap.length&&found.size<targets.size){
    const [cost,current]=heap.pop();
    if(visited[current])continue;
    visited[current]=1;
    if(targets.has(current))found.set(current,cost);
    for(const [next,meters] of network.adjacency[current]){
      if(visited[next])continue;
      const candidate=cost+meters;
      if(candidate>=distances[next])continue;
      distances[next]=candidate;heap.push([candidate,next]);
    }
  }
  return found;
}

/** Monta a matriz viária de uma lista sem recalcular pares já armazenados. */
async function calculateLocalRoadDistanceMatrix(points){
  if(!Array.isArray(points)||points.length<2)throw new Error('A matriz local precisa de pelo menos dois pontos.');
  const network=await loadLocalRoadNetwork();
  const snapped=points.map(point=>({...point,snap:nearestRoutingNode(network,point.coords)}));
  const distant=snapped.find(point=>point.snap.meters>CONFIGURACAO_ROTAS_LOCAIS.distanciaMaximaAjusteMetros);
  if(distant)throw new Error(`${distant.name||'Um ponto'} está distante demais da malha viária local.`);
  const matrix=Object.fromEntries(points.map(point=>[point.id,{[point.id]:0}]));
  for(let sourceIndex=0;sourceIndex<snapped.length;sourceIndex++){
    const source=snapped[sourceIndex],missing=[];
    for(let targetIndex=0;targetIndex<snapped.length;targetIndex++){
      if(sourceIndex===targetIndex)continue;
      const target=snapped[targetIndex],key=localDistanceCacheKey(source.coords,target.coords);
      if(localDistanceCache.has(key))matrix[source.id][target.id]=localDistanceCache.get(key);
      else missing.push(targetIndex);
    }
    if(missing.length){
      const distances=shortestDistancesToTargets(network,source.snap.index,missing.map(index=>snapped[index].snap.index));
      for(const targetIndex of missing){
        const target=snapped[targetIndex],meters=distances.get(target.snap.index);
        if(!Number.isFinite(meters))throw new Error(`Não existe ligação viária local entre ${source.name||source.id} e ${target.name||target.id}.`);
        const km=meters/1000;
        matrix[source.id][target.id]=km;localDistanceCache.set(localDistanceCacheKey(source.coords,target.coords),km);
      }
    }
    if(sourceIndex%2===1)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {matrix,snapMeters:snapped.reduce((sum,point)=>sum+point.snap.meters,0),source:'RoutePilot · malha Overture Maps'};
}

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
  localDistanceCache.set(localDistanceCacheKey(origin,destination),result.distanceKm);
  if(localRouteCache.size>CONFIGURACAO_ROTAS_LOCAIS.maximoRotasCache)localRouteCache.delete(localRouteCache.keys().next().value);
  return result;
}

window.RoutePilotLocalRouting={
  status:()=>({networkLoaded:Boolean(localRoadNetworkPromise),streetCatalogLoaded:Boolean(localStreetCatalogPromise),addressShardsLoaded:localAddressShardPromises.size,cachedRoutes:localRouteCache.size,cachedDistances:localDistanceCache.size}),
  calculate:calculateLocalRoadRoute,
  calculateMatrix:calculateLocalRoadDistanceMatrix,
  resolveAddress:resolveLocalRouteAddress
};
