/* Recurso RoutePilot: planejador desktop de múltiplos atendimentos. */
const ROUTE_PLANNER_MAX_STOPS=RoutePilotRouteOptimizer.MAX_STOPS;
const routePlannerState={active:false,originKey:null,originDraft:'',stopKeys:[],stopDrafts:[],settings:new Map(),matrix:null,matrixSource:'',recommendedOrder:[],recommendedTotal:null,currentOrder:[],metrics:null,segments:[],status:'idle',error:'',undoOrder:null,dragIndex:null};

/** Informa se o painel do planejador está ativo. */
function routePlannerActive(){return routePlannerState.active;}

/** Retorna a origem já resolvida no catálogo compartilhado. */
function routePlannerOrigin(){return comparePlace(routePlannerState.originKey);}

/** Retorna os atendimentos na ordem atual ou na ordem de edição. */
function routePlannerStops(){
  const keys=routePlannerState.currentOrder.length?routePlannerState.currentOrder:routePlannerState.stopKeys;
  return keys.map(comparePlace).filter(Boolean);
}

/** Reinicia somente resultados calculados, preservando os locais digitados. */
function invalidateRoutePlan(){
  Object.assign(routePlannerState,{matrix:null,matrixSource:'',recommendedOrder:[],recommendedTotal:null,currentOrder:[],metrics:null,segments:[],status:'idle',error:'',undoOrder:null});
  clearRoutePlannerMap();
}

/** Abre o planejador e opcionalmente importa locais do comparador. */
function startRoutePlanner(initialStops=[]){
  if(window.matchMedia('(max-width:900px)').matches){showToast('O planejador está disponível no desktop');return;}
  cancelMapInteraction('planner');
  if(comparisonActive())Object.assign(state,{compare:null,compareStops:[],compareReady:false});
  routePlannerState.active=true;routePlannerState.error='';routePlannerState.status='idle';
  if(initialStops.length){
    routePlannerState.stopKeys=initialStops.map(stop=>stop.key);
    routePlannerState.stopDrafts=initialStops.map(stop=>stop.name);
    routePlannerState.settings=new Map(initialStops.map(stop=>[stop.key,{mode:'free',fixedPosition:null}]));
  }else if(!routePlannerState.stopDrafts.length){
    routePlannerState.stopKeys=[null,null];routePlannerState.stopDrafts=['',''];
  }
  mapHidden=false;Object.assign(state,{city:null,region:null,point:null,boundary:null,road:null,searchOpen:false,overview:true});
  render();renderRoutePlanner();renderRoutePlannerMap({stops:routePlannerStops()});
}

/** Fecha o planejador e limpa apenas sua camada visual. */
function closeRoutePlanner(){
  routePlannerState.active=false;clearRoutePlannerMap();render();
}

/** Adiciona um atendimento vazio dentro do limite seguro. */
function addRoutePlannerStop(){
  if(routePlannerState.stopDrafts.length>=ROUTE_PLANNER_MAX_STOPS){showToast(`Limite de ${ROUTE_PLANNER_MAX_STOPS} atendimentos`);return;}
  invalidateRoutePlan();routePlannerState.stopKeys.push(null);routePlannerState.stopDrafts.push('');renderRoutePlanner();
  requestAnimationFrame(()=>$(`routeStopInput${routePlannerState.stopDrafts.length-1}`)?.focus());
}

/** Remove um atendimento e seu eventual ajuste de posição fixa. */
function removeRoutePlannerStop(index){
  if(routePlannerState.stopDrafts.length<=2)return;
  const key=routePlannerState.stopKeys[index];if(key)routePlannerState.settings.delete(key);
  invalidateRoutePlan();routePlannerState.stopKeys.splice(index,1);routePlannerState.stopDrafts.splice(index,1);renderRoutePlanner();renderRoutePlannerMap({origin:routePlannerOrigin(),stops:routePlannerStops()});
}

/** Atualiza um campo e invalida o local anterior daquele campo. */
function updateRoutePlannerDraft(kind,index,value){
  invalidateRoutePlan();
  if(kind==='origin'){routePlannerState.originDraft=value;routePlannerState.originKey=null;}
  else{routePlannerState.stopDrafts[index]=value;routePlannerState.stopKeys[index]=null;}
  renderRoutePlannerSuggestions(kind,index);
}

/** Renderiza sugestões usando o mesmo catálogo da comparação. */
function renderRoutePlannerSuggestions(kind,index){
  const draft=kind==='origin'?routePlannerState.originDraft:routePlannerState.stopDrafts[index];
  const target=$(kind==='origin'?'routeOriginSuggestions':`routeStopSuggestions${index}`);if(!target)return;
  const matches=comparePlaceMatches(draft).slice(0,10);
  target.hidden=!clean(draft)||(kind==='origin'?routePlannerState.originKey:routePlannerState.stopKeys[index]);
  target.innerHTML=matches.length?matches.map(item=>`<button type="button" class="compare-suggestion" data-action="routeChoosePlace" data-kind="${kind}" data-index="${index}" data-value="${esc(item.key)}"><strong>${esc(item.name)}</strong><small>${esc(cityName(item.city))} · ${esc(byRegion[item.region].name)}</small></button>`).join(''):/\d/.test(draft)?'<p class="empty">Endereço exato: inclua rua, número e cidade.</p>':'<p class="empty">Nenhum local encontrado.</p>';
}

/** Associa uma sugestão à origem ou a um atendimento e bloqueia duplicatas. */
function chooseRoutePlannerPlace(kind,index,key){
  const place=comparePlace(key);if(!place)return;
  const used=[routePlannerState.originKey,...routePlannerState.stopKeys].filter(Boolean);
  const current=kind==='origin'?routePlannerState.originKey:routePlannerState.stopKeys[index];
  if(key!==current&&used.includes(key)){showToast('Este local já faz parte da rota');return;}
  invalidateRoutePlan();
  if(kind==='origin'){routePlannerState.originKey=key;routePlannerState.originDraft=place.name;}
  else{routePlannerState.stopKeys[index]=key;routePlannerState.stopDrafts[index]=place.name;routePlannerState.settings.set(key,routePlannerState.settings.get(key)||{mode:'free',fixedPosition:null});}
  renderRoutePlanner();renderRoutePlannerMap({origin:routePlannerOrigin(),stops:routePlannerStops()});
}

/** Resolve texto exato pela base local quando nenhuma sugestão foi escolhida. */
async function resolveRoutePlannerDraft(kind,index){
  const key=kind==='origin'?routePlannerState.originKey:routePlannerState.stopKeys[index];
  if(comparePlace(key))return key;
  const draft=kind==='origin'?routePlannerState.originDraft:routePlannerState.stopDrafts[index];
  const matches=comparePlaceMatches(draft);
  const place=matches.length===1?matches[0]:await resolveLocalRouteAddress(draft);
  addTransientComparePlace(place);
  if(kind==='origin'){routePlannerState.originKey=place.key;routePlannerState.originDraft=place.name;}
  else{routePlannerState.stopKeys[index]=place.key;routePlannerState.stopDrafts[index]=place.name;routePlannerState.settings.set(place.key,{mode:'free',fixedPosition:null});}
  return place.key;
}

/** Resolve todos os campos antes de calcular a matriz. */
async function resolveRoutePlannerPlaces(){
  await resolveRoutePlannerDraft('origin',0);
  for(let index=0;index<routePlannerState.stopDrafts.length;index++)await resolveRoutePlannerDraft('stop',index);
  const origin=routePlannerOrigin(),stops=routePlannerState.stopKeys.map(comparePlace);
  if(!origin)throw new Error('Defina uma origem válida.');
  if(stops.some(stop=>!stop))throw new Error('Confira todos os atendimentos.');
  const duplicate=RoutePilotRouteOptimizer.findDuplicatePoint([origin,...stops],.015,(a,b)=>distanceKm(a.coords,b.coords));
  if(duplicate)throw new Error(`${duplicate.point.name} está repetido ou a menos de 15 m de outro ponto.`);
  return {origin,stops};
}

/** Converte as posições fixas dos cartões para o formato do otimizador. */
function routePlannerConstraints(stops){
  const lockedPositions={};
  stops.forEach(stop=>{
    const setting=routePlannerState.settings.get(stop.key)||{mode:'free',fixedPosition:null};
    if(setting.mode==='fixed')lockedPositions[stop.key]=Number(setting.fixedPosition)-1;
  });
  return {lockedPositions};
}

/** Cria uma matriz local por estradas e usa Haversine somente se necessário. */
async function buildRoutePlannerMatrix(origin,stops){
  const points=[{...origin,id:origin.key},...stops.map(stop=>({...stop,id:stop.key}))];
  try{
    const result=await RoutePilotLocalRouting.calculateMatrix(points);
    return {matrix:result.matrix,source:'Malha viária local',fallback:false};
  }catch(error){
    const provider=RoutePilotDistance.createDistanceProvider();
    const matrix=await new RoutePilotDistance.DistanceMatrix(points,provider,{mode:'straight'}).build();
    return {matrix,source:'Estimativa em linha reta',fallback:true,error:error.message||String(error)};
  }
}

/** Calcula a melhor sequência e guarda a recomendação para restauração. */
async function calculateBestRoute(){
  routePlannerState.status='loading';routePlannerState.error='';renderRoutePlanner();
  try{
    const {origin,stops}=await resolveRoutePlannerPlaces();
    const matrixResult=await buildRoutePlannerMatrix(origin,stops);
    routePlannerState.matrix=matrixResult.matrix;routePlannerState.matrixSource=matrixResult.source;
    const constraints=routePlannerConstraints(stops);
    const result=RoutePilotRouteOptimizer.optimizeRoute(stops.map(stop=>({...stop,id:stop.key})),{origin:{...origin,id:origin.key},matrix:routePlannerState.matrix,...constraints});
    routePlannerState.recommendedOrder=result.orderedPoints.map(point=>point.key);
    routePlannerState.currentOrder=[...routePlannerState.recommendedOrder];routePlannerState.recommendedTotal=result.totalDistance;
    routePlannerState.metrics=result;routePlannerState.status='ready';routePlannerState.error=matrixResult.fallback?`Rota estimada: ${matrixResult.error}`:'';routePlannerState.undoOrder=null;
    await updateRoutePlannerSegments();renderRoutePlanner();
  }catch(error){routePlannerState.status='error';routePlannerState.error=error.message||String(error);renderRoutePlanner();}
}

/** Reotimiza mantendo a origem e todas as posições fixas. */
async function reoptimizeRoute(){
  if(!routePlannerState.matrix){await calculateBestRoute();return;}
  try{
    const origin=routePlannerOrigin(),stops=routePlannerState.stopKeys.map(comparePlace),constraints=routePlannerConstraints(stops);
    const result=RoutePilotRouteOptimizer.optimizeRoute(stops.map(stop=>({...stop,id:stop.key})),{origin:{...origin,id:origin.key},matrix:routePlannerState.matrix,...constraints});
    routePlannerState.undoOrder=[...routePlannerState.currentOrder];routePlannerState.currentOrder=result.orderedPoints.map(point=>point.key);routePlannerState.metrics=result;routePlannerState.status='ready';
    await updateRoutePlannerSegments();renderRoutePlanner();
  }catch(error){routePlannerState.status='error';routePlannerState.error=error.message||String(error);renderRoutePlanner();}
}

/** Recalcula totais respeitando exatamente a ordem manual atual. */
async function recalculateManualRoute(){
  if(!routePlannerState.matrix)return;
  const origin={...routePlannerOrigin(),id:routePlannerState.originKey};
  const stops=routePlannerState.currentOrder.map(key=>({...comparePlace(key),id:key}));
  routePlannerState.metrics=RoutePilotRouteOptimizer.calculateRoute(stops,{origin,matrix:routePlannerState.matrix});
  routePlannerState.status='ready';await updateRoutePlannerSegments();renderRoutePlanner();
}

/** Carrega apenas as geometrias dos trechos usados pela ordem escolhida. */
async function updateRoutePlannerSegments(){
  const origin=routePlannerOrigin(),stops=routePlannerState.currentOrder.map(comparePlace).filter(Boolean),segments=[];let previous=origin;
  for(const stop of stops){
    let geometry=null;
    try{geometry=(await calculateLocalRoadRoute(previous.coords,stop.coords)).geometry;}catch(error){/* a linha direta será exibida como contingência */}
    segments.push({from:previous,to:stop,geometry});previous=stop;
  }
  routePlannerState.segments=segments;renderRoutePlannerMap({origin,stops,segments});
}

/** Alterna um atendimento entre ordem livre e posição fixa. */
function setRoutePlannerConstraint(key,type,position=null){
  if(!routePlannerState.stopKeys.includes(key))return;
  const visibleOrder=routePlannerState.currentOrder.length?routePlannerState.currentOrder:routePlannerState.stopKeys;
  const setting={mode:type==='fixed'?'fixed':'free',fixedPosition:type==='fixed'?Number(position)||visibleOrder.indexOf(key)+1:null};
  if(setting.mode==='fixed'){
    if(setting.fixedPosition<1||setting.fixedPosition>routePlannerState.stopKeys.length){showToast('Posição fixa inválida');return;}
    const conflict=[...routePlannerState.settings].find(([otherKey,value])=>otherKey!==key&&value.mode==='fixed'&&Number(value.fixedPosition)===setting.fixedPosition);
    if(conflict){showToast(`A posição ${setting.fixedPosition} já está fixada`);return;}
  }
  routePlannerState.settings.set(key,setting);renderRoutePlanner();
}

/** Guarda a ordem anterior e aplica o drop somente ao final do arrasto. */
async function reorderRoutePlannerStop(from,to){
  if(!routePlannerState.currentOrder.length||from===to)return;
  const fixedIndexes=new Set([...routePlannerState.settings.values()].filter(value=>value.mode==='fixed').map(value=>Number(value.fixedPosition)-1));
  if(fixedIndexes.has(from)||fixedIndexes.has(to)){showToast('Libere a posição fixa antes de mover');return;}
  routePlannerState.undoOrder=[...routePlannerState.currentOrder];
  const [key]=routePlannerState.currentOrder.splice(from,1);routePlannerState.currentOrder.splice(to,0,key);
  await recalculateManualRoute();
}

/** Restaura a última recomendação automática. */
async function restoreRecommendedRoute(){
  if(!routePlannerState.recommendedOrder.length)return;
  routePlannerState.undoOrder=[...routePlannerState.currentOrder];routePlannerState.currentOrder=[...routePlannerState.recommendedOrder];await recalculateManualRoute();
}

/** Desfaz somente a última alteração de ordem. */
async function undoRoutePlannerOrder(){
  if(!routePlannerState.undoOrder)return;
  const current=[...routePlannerState.currentOrder];routePlannerState.currentOrder=[...routePlannerState.undoOrder];routePlannerState.undoOrder=current;await recalculateManualRoute();
}

/** Foca um atendimento da rota sem alterar a ordem. */
function focusRoutePlannerStop(key){
  const place=comparePlace(key);if(place&&map)map.flyTo(place.coords,CONFIGURACAO_MAPA.zoomComparacao,{duration:.35});
}

/** Abre o compartilhamento geográfico de uma parada. */
function shareRoutePlannerStop(key){
  const place=comparePlace(key);if(place)openLocationShare(locationShareContext(place.coords[0],place.coords[1],{name:place.name,city:cityName(place.city),region:byRegion[place.region]?.name||''}));
}

/** Renderiza um campo de pesquisa do planejador. */
function routePlannerSearchField(kind,index,label,draft,key){
  const id=kind==='origin'?'routeOriginInput':`routeStopInput${index}`,suggestions=kind==='origin'?'routeOriginSuggestions':`routeStopSuggestions${index}`;
  return `<label for="${id}">${label}</label><input id="${id}" data-route-kind="${kind}" data-route-index="${index}" value="${esc(draft)}" placeholder="Bairro, região ou rua, número, cidade" autocomplete="off"><div id="${suggestions}" class="compare-suggestions" hidden></div>${key?`<small class="route-place-context">${esc(cityName(comparePlace(key)?.city))} · ${esc(byRegion[comparePlace(key)?.region]?.name||'')}</small>`:''}`;
}

/** Renderiza os cartões na ordem calculada ou na ordem de edição. */
function routePlannerStopCards(){
  const keys=routePlannerState.currentOrder.length?routePlannerState.currentOrder:routePlannerState.stopKeys;
  return keys.map((key,index)=>{
    const setting=routePlannerState.settings.get(key)||{mode:'free',fixedPosition:null};
    if(routePlannerState.currentOrder.length){
      const stop=comparePlace(key),segment=routePlannerState.metrics?.segments[index];
      return `<article class="route-stop-card" draggable="${setting.mode!=='fixed'}" data-route-drag-index="${index}"><button class="drag-handle" aria-label="Arrastar atendimento">⋮⋮</button><span class="route-order-number">${index+1}</span><div class="route-stop-copy"><strong>${esc(stop.name)}</strong><small>${segment?`${segment.distance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km desde o ponto anterior`:''}</small></div><button data-action="routeFocusStop" data-value="${esc(key)}" title="Ver no mapa">${iconSvg('pin')}</button><button data-action="routeShareStop" data-value="${esc(key)}" title="Compartilhar">${iconSvg('link')}</button><div class="route-constraint"><select data-route-constraint="${esc(key)}" aria-label="Posição de ${esc(stop.name)}"><option value="free" ${setting.mode==='free'?'selected':''}>Ordem livre</option><option value="fixed" ${setting.mode==='fixed'?'selected':''}>Posição fixa</option></select>${setting.mode==='fixed'?`<input type="number" min="1" max="${keys.length}" value="${setting.fixedPosition}" data-route-fixed="${esc(key)}" aria-label="Posição fixa">`:''}</div></article>`;
    }
    return `<article class="route-edit-stop"><span class="route-order-number">${index+1}</span><div>${routePlannerSearchField('stop',index,`Atendimento ${index+1}`,routePlannerState.stopDrafts[index],routePlannerState.stopKeys[index])}</div>${routePlannerState.stopDrafts.length>2?`<button data-action="routeRemoveStop" data-index="${index}" aria-label="Remover atendimento">&times;</button>`:''}</article>`;
  }).join('');
}

/** Renderiza o painel completo do planejador apenas em desktop. */
function renderRoutePlanner(){
  const panel=$('routePlanner');if(!panel)return;
  panel.hidden=!routePlannerState.active;if(!routePlannerState.active)return;
  const metrics=routePlannerState.metrics,difference=metrics&&routePlannerState.recommendedTotal!==null?metrics.totalDistance-routePlannerState.recommendedTotal:null;
  const result=metrics?`<section class="route-summary"><div><small>DISTÂNCIA TOTAL</small><strong>${metrics.totalDistance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km</strong><span>${esc(routePlannerState.matrixSource)}</span></div>${difference!==null&&Math.abs(difference)>.05?`<b class="route-difference ${difference<0?'is-better':''}">${difference<0?`${Math.abs(difference).toLocaleString('pt-BR',{maximumFractionDigits:1})} km menor`:`+${difference.toLocaleString('pt-BR',{maximumFractionDigits:1})} km em relação à recomendada`}</b>`:''}</section>`:'';
  panel.innerHTML=`<div class="nav-top"><div><small>PLANEJAMENTO DESKTOP</small><h2>Rota de atendimentos</h2></div><button data-action="closeRoutePlanner" aria-label="Fechar">&times;</button></div><section class="route-origin">${routePlannerSearchField('origin',0,'Origem da rota',routePlannerState.originDraft,routePlannerState.originKey)}</section><div class="route-stop-list" id="routeStopList">${routePlannerStopCards()}</div>${!routePlannerState.currentOrder.length?`<button class="route-add-stop" data-action="routeAddStop">+ Adicionar atendimento</button><button class="planner-primary" data-action="routeCalculate" ${routePlannerState.status==='loading'?'disabled':''}>${routePlannerState.status==='loading'?'Calculando matriz viária...':'Calcular melhor rota'}</button>`:`<div class="route-plan-actions"><button class="planner-primary" data-action="routeReoptimize">Reotimizar</button><button data-action="routeRestore" ${routePlannerState.recommendedOrder.length?'':'disabled'}>Restaurar recomendada</button><button data-action="routeUndo" ${routePlannerState.undoOrder?'':'disabled'}>Desfazer alteração</button></div>`}${routePlannerState.error?`<div class="compare-route-status ${routePlannerState.status==='error'?'is-error':''}"><span>${esc(routePlannerState.error)}</span></div>`:''}${result}<p class="map-caution">A origem não conta como atendimento. Arraste os cartões para respeitar uma ordem manual; o recálculo acontece ao soltar.</p>`;
}
