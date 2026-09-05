/* Recurso RoutePilot: otimização pura de rotas com múltiplas paradas. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RoutePilotRouteOptimizer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const MAX_STOPS=24;

  /** Lê uma distância previamente calculada sem depender da interface. */
  function matrixDistance(matrix,a,b){
    const value=typeof matrix==='function'?matrix(a,b):matrix?.[a.id]?.[b.id];
    if(!Number.isFinite(value)||value<0)throw new Error(`Distância inválida entre ${a.id} e ${b.id}.`);
    return value;
  }

  /** Detecta IDs repetidos e coordenadas praticamente idênticas. */
  function findDuplicatePoint(points,toleranceKm=.015,distance=null){
    const measure=distance||((a,b)=>{
      const radians=value=>value*Math.PI/180,dlat=radians(b.coords[0]-a.coords[0]),dlon=radians(b.coords[1]-a.coords[1]);
      const value=Math.sin(dlat/2)**2+Math.cos(radians(a.coords[0]))*Math.cos(radians(b.coords[0]))*Math.sin(dlon/2)**2;
      return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(Math.max(0,1-value)));
    });
    const ids=new Set();
    for(let i=0;i<points.length;i++){
      if(ids.has(points[i].id))return {point:points[i],reason:'id'};
      ids.add(points[i].id);
      for(let j=0;j<i;j++)if(measure(points[i],points[j])<=toleranceKm)return {point:points[i],other:points[j],reason:'coordinates'};
    }
    return null;
  }

  /** Valida e normaliza posições fixas, usando índices iniciados em zero. */
  function normalizeLockedPositions(points,lockedPositions={}){
    const result=new Map(),occupied=new Set(),ids=new Set(points.map(point=>point.id));
    const entries=lockedPositions instanceof Map?[...lockedPositions]:Object.entries(lockedPositions);
    for(const [id,rawPosition] of entries){
      const position=Number(rawPosition);
      if(!ids.has(id))throw new Error(`Ponto fixado inexistente: ${id}.`);
      if(!Number.isInteger(position)||position<0||position>=points.length)throw new Error(`Posição fixa inválida para ${id}.`);
      if(occupied.has(position))throw new Error(`Mais de um atendimento foi fixado na posição ${position+1}.`);
      occupied.add(position);result.set(id,position);
    }
    return result;
  }

  /** Soma os trechos da origem até a última parada, preservando a ordem recebida. */
  function calculateRoute(points,{origin,matrix,returnToOrigin=false}={}){
    if(!origin)throw new Error('A origem da rota é obrigatória.');
    const segments=[];let previous=origin,totalDistance=0;
    for(const point of points){
      const distance=matrixDistance(matrix,previous,point);
      segments.push({from:previous,to:point,distance});totalDistance+=distance;previous=point;
    }
    if(returnToOrigin&&points.length){
      const distance=matrixDistance(matrix,previous,origin);
      segments.push({from:previous,to:origin,distance});totalDistance+=distance;
    }
    return {orderedPoints:[...points],segments,totalDistance};
  }

  /** Gera uma primeira solução rápida pelo vizinho mais próximo. */
  function nearestNeighbor(points,{origin,matrix,lockedPositions=new Map()}={}){
    const fixedIds=new Set(lockedPositions.keys()),remaining=new Map(points.filter(point=>!fixedIds.has(point.id)).map(point=>[point.id,point]));
    const fixedByPosition=new Map([...lockedPositions].map(([id,position])=>[position,points.find(point=>point.id===id)]));
    const ordered=[];let previous=origin;
    for(let position=0;position<points.length;position++){
      let next=fixedByPosition.get(position);
      if(!next){
        const candidates=[...remaining.values()];
        next=candidates.sort((a,b)=>{
          const scoreA=matrixDistance(matrix,previous,a),scoreB=matrixDistance(matrix,previous,b);
          return scoreA-scoreB||a.id.localeCompare(b.id);
        })[0];
        remaining.delete(next.id);
      }
      ordered.push(next);previous=next;
    }
    return ordered;
  }

  /** Avalia o percurso total usado para comparar alternativas. */
  function routeScore(points,options){
    return calculateRoute(points,options).totalDistance;
  }

  /** Aplica 2-opt somente em intervalos que não deslocam posições fixas. */
  function improveWithTwoOpt(initial,options){
    let best=[...initial],bestScore=routeScore(best,options),changed=true,passes=0;
    const lockedIndexes=new Set(options.lockedPositions.values());
    while(changed&&passes++<40){
      changed=false;
      for(let start=0;start<best.length-1;start++)for(let end=start+1;end<best.length;end++){
        let blocked=false;for(let index=start;index<=end;index++)if(lockedIndexes.has(index)){blocked=true;break;}
        if(blocked)continue;
        const candidate=[...best.slice(0,start),...best.slice(start,end+1).reverse(),...best.slice(end+1)];
        const score=routeScore(candidate,options);
        if(score+1e-9<bestScore){best=candidate;bestScore=score;changed=true;}
      }
    }
    return best;
  }

  /** Testa trocas entre posições livres para melhorar trechos separados por posições fixas. */
  function improveFreePositions(initial,options){
    let best=[...initial],bestScore=routeScore(best,options),changed=true,passes=0;
    const lockedIndexes=new Set(options.lockedPositions.values());
    while(changed&&passes++<20){
      changed=false;
      for(let a=0;a<best.length-1;a++)for(let b=a+1;b<best.length;b++){
        if(lockedIndexes.has(a)||lockedIndexes.has(b))continue;
        const candidate=[...best];[candidate[a],candidate[b]]=[candidate[b],candidate[a]];
        const score=routeScore(candidate,options);
        if(score+1e-9<bestScore){best=candidate;bestScore=score;changed=true;}
      }
    }
    return best;
  }

  /** Otimiza entre 2 e 24 atendimentos sem alterar a origem. */
  function optimizeRoute(points,{origin,matrix,lockedPositions={},returnToOrigin=false}={}){
    if(!origin)throw new Error('Defina a origem antes de calcular a rota.');
    if(points.length<2)throw new Error('Adicione pelo menos dois atendimentos.');
    if(points.length>MAX_STOPS)throw new Error(`O limite seguro é de ${MAX_STOPS} atendimentos.`);
    const locked=normalizeLockedPositions(points,lockedPositions);
    const options={origin,matrix,lockedPositions:locked,returnToOrigin};
    const initial=nearestNeighbor(points,options);
    const optimized=improveFreePositions(improveWithTwoOpt(initial,options),options);
    return {...calculateRoute(optimized,options),algorithm:'nearest-neighbor + 2-opt',lockedPositions:locked};
  }

  return {MAX_STOPS,matrixDistance,findDuplicatePoint,normalizeLockedPositions,calculateRoute,nearestNeighbor,improveWithTwoOpt,optimizeRoute};
});
