const test=require('node:test');
const assert=require('node:assert/strict');
const {DistanceMatrix,createDistanceProvider}=require('../js/route-distance.js');
const optimizer=require('../js/route-optimizer.js');
const landmarks=require('../js/landmark-ranking.js');
const sharing=require('../js/location-share-core.js');

const origin={id:'O',name:'Base',coords:[-31.75,-52.34]};
const points=[
  {id:'A',name:'A',coords:[-31.74,-52.33]},
  {id:'B',name:'B',coords:[-31.76,-52.31]},
  {id:'C',name:'C',coords:[-31.78,-52.35]},
  {id:'D',name:'D',coords:[-31.72,-52.38]}
];

function euclideanMatrix(items=[origin,...points]){
  return Object.fromEntries(items.map(a=>[a.id,Object.fromEntries(items.map(b=>[b.id,Math.hypot(a.coords[0]-b.coords[0],a.coords[1]-b.coords[1])*100]))]));
}

test('matriz de distância calcula uma vez e reutiliza o par',async()=>{
  let calls=0;
  const provider=createDistanceProvider({routeCalculator:async(a,b)=>{calls++;return {distanceKm:Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])};}});
  const matrix=new DistanceMatrix([origin,points[0]],provider,{mode:'route'});
  const first=await matrix.get(origin,points[0]),second=await matrix.get(origin,points[0]);
  assert.equal(first,second);assert.equal(calls,1);
});

test('nearest neighbor e 2-opt mantêm todos os pontos uma única vez',()=>{
  const result=optimizer.optimizeRoute(points,{origin,matrix:euclideanMatrix()});
  assert.deepEqual(new Set(result.orderedPoints.map(point=>point.id)),new Set(['A','B','C','D']));
  assert.equal(result.orderedPoints.length,4);
});

test('posição fixa mantém D como primeiro',()=>{
  const result=optimizer.optimizeRoute(points,{origin,matrix:euclideanMatrix(),lockedPositions:{D:0}});
  assert.equal(result.orderedPoints[0].id,'D');
});

test('mais de uma posição fixa é preservada',()=>{
  const result=optimizer.optimizeRoute(points,{origin,matrix:euclideanMatrix(),lockedPositions:{D:0,A:2}});
  assert.equal(result.orderedPoints[0].id,'D');assert.equal(result.orderedPoints[2].id,'A');
});

test('rota manual permanece exatamente na ordem informada',()=>{
  const manual=['D','C','B','A'].map(id=>points.find(point=>point.id===id));
  const result=optimizer.calculateRoute(manual,{origin,matrix:euclideanMatrix()});
  assert.deepEqual(result.orderedPoints.map(point=>point.id),['D','C','B','A']);
});

test('alterar a ordem recalcula o total dos trechos',()=>{
  const matrix=euclideanMatrix();
  const first=optimizer.calculateRoute(points,{origin,matrix});
  const second=optimizer.calculateRoute([...points].reverse(),{origin,matrix});
  assert.notEqual(first.totalDistance,second.totalDistance);
  assert.equal(second.totalDistance,second.segments.reduce((sum,segment)=>sum+segment.distance,0));
});

test('duplicatas por id ou coordenada são detectadas',()=>{
  assert.equal(optimizer.findDuplicatePoint([...points,points[0]]).reason,'id');
  assert.equal(optimizer.findDuplicatePoint([...points,{id:'E',coords:[points[0].coords[0]+.00001,points[0].coords[1]]}]).reason,'coordinates');
});

test('ranking combina referência reconhecível, próxima e de acesso',()=>{
  const ranked=landmarks.rankLandmarks([
    {name:'Loja pequena',category:'shop',km:.1},
    {name:'Posto Central',category:'fuel',km:2},
    {name:'Ponte do Arroio',category:'bridge',km:3},
    {name:'Escola Municipal',category:'school',km:.5}
  ]);
  assert.ok(ranked.some(item=>item.name==='Posto Central'));
  assert.ok(ranked.some(item=>item.name==='Ponte do Arroio'));
  assert.ok(ranked.length<=3);
});

test('mensagem possui somente dados geográficos e respeita os três modos',()=>{
  const location={name:'Coxilha dos Campos',city:'Canguçu',region:'Zona rural',coords:[-31.5,-52.6],link:'https://routepilot.test/?lat=-31.5&lng=-52.6',landmarks:[{name:'Posto Central',km:2}],customerName:'Nome proibido',phone:'55999999999',cpf:'000.000.000-00'};
  for(const mode of ['quick','detailed','location']){
    const message=sharing.buildLocationMessage(location,{mode});
    assert.doesNotMatch(message,/Nome proibido|55999999999|000\.000/);
    assert.match(message,/routepilot\.test/);
  }
});
