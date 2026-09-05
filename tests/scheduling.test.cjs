const test=require('node:test');
const assert=require('node:assert/strict');
const config=require('../js/scheduling-config.js');
const core=require('../js/scheduling-core.js');
const search=require('../js/work-order-search.js');
const filters=require('../js/agenda-filters.js');

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

test('janela iniciada de manhã pode terminar após meio-dia',()=>{
  const result=core.placeInTimeline(order(8,'maintenance',{shift:'morning',timeConstraint:{type:'window',start:'11:30',end:'12:45'}}),8*60,config.SHIFTS.morning);
  assert.equal(result.valid,true);assert.equal(result.start,690);assert.equal(result.end,735);
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

test('técnico inicial é preferência e não bloqueio',()=>{
  const first=technician('t1',{displayOrder:0}),preferred=technician('t2',{displayOrder:1}),visit=order(9,'maintenance',{preferredTechnicianId:'t2'}),result=core.allocateWorkOrders([visit],[first,preferred],{matrix:matrixFor([visit])});
  assert.equal(result.schedules[0].technician.id,'t2');
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

test('OS pode mudar de técnico com recálculo das duas rotas',()=>{
  const first=technician('t1',{name:'Origem'}),second=technician('t2',{name:'Destino',serviceArea:'Morro Redondo'});
  const firstOrder=order(1),movedOrder=order(2,'maintenance',{city:'Morro Redondo',locality:'Centro de Morro Redondo'}),targetOrder=order(3),matrix=matrixFor([firstOrder,movedOrder,targetOrder]);
  const source=core.recalculateSchedule([firstOrder,movedOrder],first,'morning',{matrix}).schedule,target=core.recalculateSchedule([targetOrder],second,'morning',{matrix}).schedule;
  const result=core.moveWorkOrderBetweenSchedules(source,target,movedOrder.id,1,{matrix});
  assert.equal(result.valid,true);
  assert.deepEqual(result.sourceSchedule.items.map(item=>item.order.id),[firstOrder.id]);
  assert.deepEqual(result.targetSchedule.items.map(item=>item.order.id),[targetOrder.id,movedOrder.id]);
  assert.equal(result.targetSchedule.items[1].areaReminder,'');
});

test('mudança de técnico respeita capacidade e não altera as rotas originais',()=>{
  const first=technician('t1'),second=technician('t2'),moved=order(10),fullOrders=[order(11),order(12),order(13),order(14)],matrix=matrixFor([moved,...fullOrders]);
  const source=core.recalculateSchedule([moved],first,'morning',{matrix}).schedule,target=core.recalculateSchedule(fullOrders,second,'morning',{matrix}).schedule;
  const result=core.moveWorkOrderBetweenSchedules(source,target,moved.id,4,{matrix});
  assert.equal(result.valid,false);assert.equal(result.reason,'CAPACITY_EXCEEDED');
  assert.equal(source.items.length,1);assert.equal(target.items.length,4);
});

test('técnico obrigatório impede mudança para outro técnico',()=>{
  const first=technician('t1'),second=technician('t2'),moved=order(20,'maintenance',{requiredTechnicianId:'t1'}),matrix=matrixFor([moved]);
  const source=core.recalculateSchedule([moved],first,'morning',{matrix}).schedule,target={technician:second,shiftId:'morning',items:[],load:0,distanceKm:0};
  const result=core.moveWorkOrderBetweenSchedules(source,target,moved.id,0,{matrix});
  assert.equal(result.valid,false);assert.equal(result.reason,'FIXED_TECH_UNAVAILABLE');
});

test('OS não agendada pode ser encaixada em uma rota válida',()=>{
  const tech=technician('t1'),existing=order(25),unassigned=order(26),matrix=matrixFor([existing,unassigned]);
  const target=core.recalculateSchedule([existing],tech,'morning',{matrix}).schedule;
  const result=core.assignWorkOrderToSchedule(unassigned,target,0,{matrix});
  assert.equal(result.valid,true);
  assert.deepEqual(result.schedule.items.map(item=>item.order.id),[unassigned.id,existing.id]);
});

test('sugestão de técnico considera distância, área, turno e capacidade',()=>{
  const pelotas=technician('pelotas',{serviceArea:'Pelotas',displayOrder:0}),morro=technician('morro',{serviceArea:'Morro Redondo',displayOrder:1});
  const current=order(30),candidate=order(31,'maintenance',{city:'Morro Redondo',locality:'Morro Redondo'}),matrix=matrixFor([current,candidate]);
  matrix[current.id][candidate.id]=20;matrix[candidate.id][current.id]=20;
  const schedule=core.recalculateSchedule([current],pelotas,'morning',{matrix}).schedule;
  const suggestions=core.recommendWorkOrderAssignments(candidate,[schedule],[pelotas,morro],{matrix});
  assert.equal(suggestions[0].technician.id,'morro');
  assert.equal(suggestions[0].shiftId,'morning');
  assert.equal(suggestions[0].areaReminder,'');
});

test('sugestão respeita técnico obrigatório e ignora encaixes lotados',()=>{
  const first=technician('t1'),required=technician('t2'),full=[order(40),order(41),order(42),order(43)],candidate=order(44,'maintenance',{requiredTechnicianId:'t2'}),matrix=matrixFor([...full,candidate]);
  const fullSchedule=core.recalculateSchedule(full,required,'morning',{matrix}).schedule;
  assert.deepEqual(core.recommendWorkOrderAssignments(candidate,[fullSchedule],[first,required],{matrix}),[]);
});

test('duplicata de OS é detectada pelo número',()=>{
  assert.equal(core.findDuplicateWorkOrder([order(123)],{number:'123'}).id,'os_123');
});

test('atendimento duplicado usa cliente, data e coordenada sem depender do nome como ID',()=>{
  const saved=order(124,'maintenance',{customerName:'Cliente Teste',date:'2026-09-05'}),candidate={customerName:'cliente teste',date:'2026-09-05',coords:saved.coords};
  assert.equal(core.findDuplicateWorkOrder([saved],candidate).id,saved.id);
  assert.equal(core.findDuplicateWorkOrder([saved],{...candidate,date:'2026-09-06'}),null);
});

test('adaptador de persistência em memória mantém dados após nova leitura',async()=>{
  global.structuredClone??=(value)=>JSON.parse(JSON.stringify(value));
  global.RoutePilotSchedulingConfig=config;
  const source=require('../js/agenda-storage.js');
  const store=source.createMemoryStore();await store.put('workOrders',order(7));
  assert.equal((await store.all('workOrders'))[0].number,'7');
});

test('busca tolera erros, acentos, abreviações e ordem diferente',()=>{
  const candidates=[
    {id:'pelotas',name:'Pelotas',localPriority:100},
    {id:'morro',name:'Morro Redondo',localPriority:100},
    {id:'rua28',name:'Rua Vinte e Oito Dunas',context:'Areal Pelotas',localPriority:100}
  ];
  assert.equal(search.rank('pelotss',candidates)[0].id,'pelotas');
  assert.equal(search.rank('moro redndo',candidates)[0].id,'morro');
  assert.equal(search.rank('r 28 dunas',candidates)[0].id,'rua28');
  assert.equal(search.rank('pelotas dunas rua 28',candidates)[0].id,'rua28');
  assert.equal(search.rank('Morró Redôndo',candidates)[0].id,'morro');
  assert.deepEqual(search.rank('local inexistente xyz',candidates),[]);
});

test('busca fuzzy nunca confunde numeros diferentes',()=>{
  assert.equal(search.tokenSimilarity('28','284'),0);
  assert.equal(search.tokenSimilarity('331','331a'),0);
  assert.equal(search.tokenSimilarity('331','331'),1);
});

test('resultado local recebe prioridade no ranking',()=>{
  const ranked=search.rank('Areal',[{id:'longe',name:'Areal',localPriority:0},{id:'local',name:'Areal',context:'Pelotas',localPriority:100}]);
  assert.equal(ranked[0].id,'local');
});

test('busca de via ignora número da casa e usa cidade e região no ranking',()=>{
  const candidates=[
    {id:'duque',name:'Avenida Duque de Caxias',context:'Pelotas Fragata',localPriority:80},
    {id:'outra',name:'Rua Caxias',context:'Canguçu Centro',localPriority:80}
  ];
  const ranked=candidates.map(candidate=>({...candidate,score:search.scoreStreetCandidate('av duqe caxias 331 fragata pelotss',candidate)})).sort((a,b)=>b.score-a.score);
  assert.equal(ranked[0].id,'duque');
  assert.ok(ranked[0].score>ranked[1].score);
});

test('busca usa cache e resposta antiga não sobrescreve a nova',async()=>{
  let calls=0;const pending={};const coordinator=search.createCoordinator(query=>new Promise(resolve=>{calls++;pending[query]=resolve;}));
  const oldRequest=coordinator.search('pelotss'),newRequest=coordinator.search('moro redndo');pending['moro redndo']([{id:'morro'}]);assert.equal((await newRequest).results[0].id,'morro');pending.pelotss([{id:'pelotas'}]);assert.equal((await oldRequest).stale,true);
  const cached=await coordinator.search('moro redndo');assert.equal(cached.cached,true);assert.equal(calls,2);
});

test('turno Qualquer escolhe manhã sem duplicar a OS',()=>{
  assert.equal(Object.keys(config.SHIFTS)[0],'any');
  const flexible=order(20,'maintenance',{shift:'any'}),result=core.allocateWorkOrders([flexible],[technician()],{matrix:matrixFor([flexible])});
  assert.equal(result.allocated,1);assert.equal(result.schedules.length,1);assert.equal(result.schedules[0].shiftId,'morning');
});

test('turno Qualquer usa tarde quando manhã está completa',()=>{
  const existing=Array.from({length:4},(_,index)=>order(index+30)),flexible=order(40,'maintenance',{shift:'any'}),matrix=matrixFor([...existing,flexible]);
  const initial={technician:technician(),shiftId:'morning',items:existing.map((item,index)=>({order:item,start:480+index*55,end:525+index*55,travelKm:0})),load:1,distanceKm:0};
  const result=core.allocateWorkOrders([flexible],[technician()],{matrix,initialSchedules:[initial]});
  assert.equal(result.allocated,1);assert.equal(result.schedules.find(schedule=>schedule.items.some(item=>item.order.id===flexible.id)).shiftId,'afternoon');
});

test('horário fixo restringe Qualquer ao turno correto',()=>{
  const morning=order(50,'maintenance',{shift:'any',timeConstraint:{type:'fixed',start:'09:30'}}),afternoon=order(51,'maintenance',{shift:'any',timeConstraint:{type:'window',start:'14:00',end:'16:00'}}),matrix=matrixFor([morning,afternoon]);
  const result=core.allocateWorkOrders([morning,afternoon],[technician()],{matrix});
  assert.equal(result.schedules.find(schedule=>schedule.items.some(item=>item.order.id===morning.id)).shiftId,'morning');
  assert.equal(result.schedules.find(schedule=>schedule.items.some(item=>item.order.id===afternoon.id)).shiftId,'afternoon');
  assert.equal(result.schedules.flatMap(schedule=>schedule.items).length,2);
});

test('filtros usam IDs, controlam Sem colaborador e preservam renome do técnico',()=>{
  const technicians=[technician('a',{name:'Antes'}),technician('b')],filter={id:'f1',name:'Equipe',technicianIds:['a'],showUnassigned:false,isDefault:true};
  assert.deepEqual(filters.visibleTechnicians(technicians,filter.technicianIds).map(item=>item.id),['a']);
  technicians[0].name='Depois';assert.equal(filters.visibleTechnicians(technicians,filter.technicianIds)[0].name,'Depois');
  assert.equal(filters.normalizeFilter(filter,['a','b']).showUnassigned,false);
});

test('filtros podem salvar, editar, definir padrão e excluir',()=>{
  let saved=filters.saveFilter([],{id:'f1',name:'Pelotas',technicianIds:['a'],showUnassigned:true,isDefault:false});
  saved=filters.saveFilter(saved,{...saved[0],name:'Equipe Pelotas'});assert.equal(saved[0].name,'Equipe Pelotas');
  saved=filters.saveFilter(saved,{id:'f2',name:'Morro',technicianIds:['b'],showUnassigned:false,isDefault:true});saved=filters.setDefault(saved,'f1');
  assert.equal(saved.find(item=>item.id==='f1').isDefault,true);assert.equal(saved.find(item=>item.id==='f2').isDefault,false);
  assert.deepEqual(filters.removeFilter(saved,'f2').map(item=>item.id),['f1']);
});

test('filtro persistido pode ser carregado novamente por ID',async()=>{
  global.structuredClone??=(value)=>JSON.parse(JSON.stringify(value));global.RoutePilotSchedulingConfig=config;
  const storage=require('../js/agenda-storage.js'),store=storage.createMemoryStore(),filter={id:'agenda_filter_1',type:'agendaTechnicianFilter',name:'Equipe Pelotas',technicianIds:['a'],showUnassigned:true,isDefault:true};
  await store.put('settings',filter);const reloaded=(await store.all('settings')).find(item=>item.id===filter.id);
  assert.deepEqual(reloaded.technicianIds,['a']);assert.equal(reloaded.isDefault,true);
});
