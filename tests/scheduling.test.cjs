const test=require('node:test');
const assert=require('node:assert/strict');
const config=require('../js/scheduling-config.js');
const core=require('../js/scheduling-core.js');

const technician=(id='t1',overrides={})=>({id,name:id,serviceArea:'Pelotas',active:true,defaultShifts:['morning','afternoon'],displayOrder:0,...overrides});
const order=(number,serviceType='maintenance',overrides={})=>({id:`os_${number}`,number:String(number),serviceType,coords:[-31.7+Number(number)/10000,-52.3],city:'Pelotas',locality:'Centro',shift:'morning',timeConstraint:{type:'free',start:null,end:null},...overrides});
const matrixFor=orders=>Object.fromEntries(orders.map(a=>[a.id,Object.fromEntries(orders.map(b=>[b.id,a.id===b.id?0:2]))]));

test('cargas equivalentes completam exatamente um turno',()=>{
  assert.equal(core.calculateLoad([1,2,3,4].map(n=>order(n,'maintenance'))),1);
  assert.equal(core.calculateLoad([1,2].map(n=>order(n,'installation'))),1);
  assert.equal(core.calculateLoad([1,2].map(n=>order(n,'address_change'))),1);
  assert.equal(core.calculateLoad(Array.from({length:8},(_,i)=>order(i,'equipment_pickup'))),1);
  assert.equal(core.calculateLoad(Array.from({length:8},(_,i)=>order(i,'connector_pickup'))),1);
});

test('capacidade mista usa uma carga única',()=>{
  const current=[order(1,'maintenance'),order(2,'maintenance')];
  assert.equal(core.hasCapacity(current,order(3,'installation')),true);
  assert.equal(core.hasCapacity([...current,order(3,'installation')],order(4,'connector_pickup')),false);
});

test('horário exato e janela são respeitados',()=>{
  const fixed=core.placeInTimeline(order(1,'maintenance',{timeConstraint:{type:'fixed',start:'10:30'}}),8*60,config.SHIFTS.morning);
  assert.equal(fixed.valid,true);assert.equal(fixed.start,630);
  const late=core.placeInTimeline(order(2,'maintenance',{timeConstraint:{type:'fixed',start:'10:30'}}),640,config.SHIFTS.morning);
  assert.equal(late.reason,'TIME_WINDOW_CONFLICT');
  const window=core.placeInTimeline(order(3,'maintenance',{timeConstraint:{type:'window',start:'09:00',end:'10:00'}}),8*60,config.SHIFTS.morning);
  assert.equal(window.start,540);
});

test('técnico obrigatório indisponível produz motivo específico',()=>{
  const orders=[order(1,'maintenance',{requiredTechnicianId:'ausente'})];
  const result=core.allocateWorkOrders(orders,[technician()],{matrix:matrixFor(orders)});
  assert.equal(result.unallocated[0].reason,'FIXED_TECH_UNAVAILABLE');
});

test('capacidade excedida nunca é alocada silenciosamente',()=>{
  const orders=Array.from({length:5},(_,index)=>order(index+1));
  const result=core.allocateWorkOrders(orders,[technician()],{matrix:matrixFor(orders),selectedTechnicianIds:['t1']});
  assert.equal(result.allocated,4);assert.equal(result.unallocated[0].reason,'CAPACITY_EXCEEDED');
});

test('prioridade ordena antes das OS livres sem vencer horário obrigatório',()=>{
  const sorted=core.operationalOrder([order(1),order(2,'maintenance',{highPriority:true}),order(3,'maintenance',{timeConstraint:{type:'fixed',start:'11:00'}})]);
  assert.deepEqual(sorted.map(item=>item.number),['3','2','1']);
});

test('outra cidade gera lembrete, mas continua permitida',()=>{
  const tech=technician('t1',{name:'William Pereira de Sousa',serviceArea:'Pelotas'}),remote=order(1,'maintenance',{city:'Morro Redondo',locality:'Morro Redondo - Centro'});
  const result=core.allocateWorkOrders([remote],[tech],{matrix:matrixFor([remote])});
  assert.equal(result.allocated,1);
  assert.match(result.schedules[0].items[0].areaReminder,/William Pereira de Sousa.*Pelotas.*Morro Redondo/);
  assert.equal(result.unallocated.length,0);
});

test('atendimento na cidade-base não gera lembrete',()=>{
  const tech=technician('t1',{serviceArea:'Pelotas'}),local=order(1);
  const result=core.allocateWorkOrders([local],[tech],{matrix:matrixFor([local])});
  assert.equal(result.allocated,1);
  assert.equal(result.schedules[0].items[0].areaReminder,'');
});

test('agenda existente pode ser preservada ao encaixar novas OS',()=>{
  const tech=technician(),existing=order(1),next=order(2),matrix=matrixFor([existing,next]);
  const initial={technician:tech,shiftId:'morning',items:[{order:existing,start:480,end:530,travelKm:0}],load:.25,distanceKm:0};
  const result=core.allocateWorkOrders([next],[tech],{matrix,initialSchedules:[initial]});
  assert.deepEqual(result.schedules[0].items.map(item=>item.order.number),['1','2']);
  assert.ok(result.schedules[0].items[1].start>=540);
});

test('duplicata de OS é detectada pelo número',()=>{
  assert.equal(core.findDuplicateWorkOrder([order(123)],{number:'123'}).id,'os_123');
});

test('adaptador de persistência em memória mantém dados após nova leitura',async()=>{
  global.structuredClone??=(value)=>JSON.parse(JSON.stringify(value));
  global.RoutePilotSchedulingConfig=config;
  const source=require('../js/agenda-storage.js');
  const store=source.createMemoryStore();await store.put('workOrders',order(7));
  assert.equal((await store.all('workOrders'))[0].number,'7');
});
