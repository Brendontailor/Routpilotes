/* Recurso RoutePilot: regras puras de capacidade, horários e distribuição de OS. */
(function(root,factory){
  const config=typeof module==='object'&&module.exports?require('./scheduling-config.js'):root.RoutePilotSchedulingConfig;
  const api=factory(config);if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotSchedulingCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(CONFIG){
  const {SERVICE_TYPES,SHIFTS,OPERATIONAL_SETTINGS,UNALLOCATED_REASONS}=CONFIG;

  /** Converte HH:MM em minutos desde meia-noite. */
  function timeToMinutes(value){const match=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));if(!match)return null;const minutes=Number(match[1])*60+Number(match[2]);return minutes>=0&&minutes<1440?minutes:null;}
  /** Formata minutos desde meia-noite como HH:MM. */
  function minutesToTime(value){const safe=Math.max(0,Math.round(value));return `${String(Math.floor(safe/60)%24).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}`;}
  /** Normaliza a quantidade de tempos de uma OS para um ou dois. */
  function workOrderTimeUnits(order){return Number(order?.timeUnits)===2?2:1;}
  /** Retorna a carga normalizada da OS considerando um ou dois tempos. */
  function workOrderLoad(order){const base=SERVICE_TYPES[order.serviceType]?.load;return Number.isFinite(base)?base*workOrderTimeUnits(order):Infinity;}
  /** Retorna a duracao total do atendimento considerando um ou dois tempos. */
  function workOrderDuration(order){const base=SERVICE_TYPES[order.serviceType]?.durationMinutes;return Number.isFinite(base)?base*workOrderTimeUnits(order):Infinity;}
  /** Soma a carga de tipos mistos no mesmo turno. */
  function calculateLoad(orders){return orders.reduce((total,order)=>total+workOrderLoad(order),0);}
  /** Informa se uma nova OS ainda cabe na capacidade única do turno. */
  function hasCapacity(orders,candidate,capacity=OPERATIONAL_SETTINGS.shiftCapacity){return calculateLoad(orders)+workOrderLoad(candidate)<=capacity+1e-9;}
  /** Detecta número de OS repetido sem depender da interface. */
  function findDuplicateWorkOrder(orders,candidate,ignoreId=null){
    const number=String(candidate.number||'').trim().toLowerCase(),customer=String(candidate.customerName||'').trim().toLowerCase(),coords=(candidate.coords||[]).map(Number);
    return orders.find(order=>{if(order.id===ignoreId)return false;if(number&&String(order.number||'').trim().toLowerCase()===number)return true;if(!customer||String(order.customerName||'').trim().toLowerCase()!==customer||candidate.date&&order.date!==candidate.date)return false;return coords.length===2&&Array.isArray(order.coords)&&Math.abs(Number(order.coords[0])-coords[0])<1e-5&&Math.abs(Number(order.coords[1])-coords[1])<1e-5;})||null;
  }
  /** Lê uma distância da matriz e usa zero apenas para o mesmo ponto. */
  function matrixDistance(matrix,a,b){if(!a||!b||a.id===b.id)return 0;const value=matrix?.[a.id]?.[b.id];return Number.isFinite(value)?value:Infinity;}
  /** Calcula deslocamento estimado em minutos. */
  function travelMinutes(matrix,a,b,averageSpeedKmh=OPERATIONAL_SETTINGS.averageSpeedKmh){const km=matrixDistance(matrix,a,b);return Number.isFinite(km)?km/averageSpeedKmh*60:Infinity;}
  /** Normaliza uma restrição de horário livre, exata ou em janela. */
  function normalizeTimeConstraint(input={}){const type=['free','fixed','window'].includes(input.type)?input.type:'free';const start=timeToMinutes(input.start),end=timeToMinutes(input.end);return {type,start,end:type==='fixed'?start:end};}
  /** Resolve os turnos possíveis sem duplicar uma OS marcada como Qualquer. */
  function allowedShiftIds(order){
    if(order.shift&&order.shift!=='any')return SHIFTS[order.shift]?[order.shift]:[];
    const constraint=normalizeTimeConstraint(order.timeConstraint),shiftIds=Object.keys(SHIFTS).filter(id=>id!=='any');
    if(constraint.type==='free')return shiftIds;
    if(constraint.start===null)return [];
    if(constraint.type==='fixed')return shiftIds.filter(id=>constraint.start>=timeToMinutes(SHIFTS[id].start)&&constraint.start<timeToMinutes(SHIFTS[id].end));
    if(constraint.end===null)return [];
    return shiftIds.filter(id=>Math.max(constraint.start,timeToMinutes(SHIFTS[id].start))<Math.min(constraint.end,timeToMinutes(SHIFTS[id].end)));
  }
  /** Calcula o primeiro horário válido e rejeita chegadas tardias. */
  function placeInTimeline(order,earliestStart,shift){
    const constraint=normalizeTimeConstraint(order.timeConstraint),shiftStart=timeToMinutes(shift.start),shiftEnd=timeToMinutes(shift.end);
    let start=Math.max(earliestStart,shiftStart);
    if(constraint.type==='fixed'){
      if(constraint.start===null||start>constraint.start)return {valid:false,reason:'TIME_WINDOW_CONFLICT'};
      start=constraint.start;
    }
    if(constraint.type==='window'){
      if(constraint.start===null||constraint.end===null)return {valid:false,reason:'TIME_WINDOW_CONFLICT'};
      start=Math.max(start,constraint.start);if(start>constraint.end)return {valid:false,reason:'TIME_WINDOW_CONFLICT'};
    }
    const duration=workOrderDuration(order),allowedEnd=constraint.type==='window'&&constraint.start<shiftEnd?Math.max(shiftEnd,constraint.end):shiftEnd;
    if(!Number.isFinite(duration)||start+duration>allowedEnd)return {valid:false,reason:'SHIFT_CONFLICT'};
    return {valid:true,start,end:start+duration};
  }
  /** Ordena primeiro restrições obrigatórias, depois prioridade e localização. */
  function operationalOrder(orders){
    const constraintRank={fixed:0,window:1,free:2};
    return [...orders].sort((a,b)=>constraintRank[normalizeTimeConstraint(a.timeConstraint).type]-constraintRank[normalizeTimeConstraint(b.timeConstraint).type]||
      (normalizeTimeConstraint(a.timeConstraint).start??Infinity)-(normalizeTimeConstraint(b.timeConstraint).start??Infinity)||Number(Boolean(b.highPriority))-Number(Boolean(a.highPriority))||String(a.customerName||a.number||a.id).localeCompare(String(b.customerName||b.number||b.id),'pt-BR',{numeric:true}));
  }
  /** Identifica a área operacional da OS sem transformar a preferência em bloqueio. */
  function workOrderArea(order){const locality=String(order.locality||'').toLowerCase();return locality.includes('monte bonito')?'Monte Bonito':order.city||order.locality||'';}
  /** Gera um lembrete não bloqueante quando o técnico sai de sua base habitual. */
  function assignmentReminder(technician,order){const base=String(technician.serviceArea||'').trim(),destination=workOrderArea(order);if(!base||!destination||base.toLowerCase()===String(destination).toLowerCase())return '';return `${technician.name} tem base em ${base}. Confirme o deslocamento para ${destination}.`;}
  /** Simula a inclusão de uma OS no fim da rota de um técnico/turno. */
  function evaluateAppend(schedule,order,{matrix,shift,bufferMinutes=OPERATIONAL_SETTINGS.bufferMinutes}){
    const previous=schedule.items.at(-1)?.order||null;
    const travel=previous?travelMinutes(matrix,previous,order):0;
    const earliest=schedule.items.length?schedule.items.at(-1).end+bufferMinutes+travel:timeToMinutes(shift.start);
    const placement=placeInTimeline(order,earliest,shift);
    if(!placement.valid)return placement;
    return {...placement,travelKm:previous?matrixDistance(matrix,previous,order):0,travelMinutes:travel};
  }
  /** Distribui OS entre técnicos ativos sem ultrapassar carga ou horários. */
  function allocateWorkOrders(orders,technicians,{matrix={},selectedTechnicianIds=null,selectedShiftIds=null,settings=OPERATIONAL_SETTINGS,initialSchedules=[]}={}){
    const selected=new Set(selectedTechnicianIds||technicians.filter(item=>item.active).map(item=>item.id));
    const selectedShifts=new Set(selectedShiftIds||Object.keys(SHIFTS).filter(id=>id!=='any'));
    const available=technicians.filter(item=>item.active&&selected.has(item.id));
    const schedules=new Map(),unallocated=[];
    available.forEach(technician=>(technician.defaultShifts||[]).filter(shiftId=>selectedShifts.has(shiftId)).forEach(shiftId=>schedules.set(`${technician.id}:${shiftId}`,{technician,shiftId,items:[],load:0,distanceKm:0})));
    initialSchedules.forEach(initial=>{
      const target=schedules.get(`${initial.technician.id}:${initial.shiftId}`);if(!target)return;
      target.items=(initial.items||[]).map(item=>({...item}));target.load=calculateLoad(target.items.map(item=>item.order));target.distanceKm=Number(initial.distanceKm)||0;
    });
    for(const order of operationalOrder(orders)){
      if(!Array.isArray(order.coords)||order.coords.length!==2||order.coords.some(value=>!Number.isFinite(Number(value)))){unallocated.push({order,reason:'INVALID_LOCATION',message:UNALLOCATED_REASONS.INVALID_LOCATION});continue;}
      const allowedShifts=allowedShiftIds(order);
      const candidates=[...schedules.values()].filter(schedule=>allowedShifts.includes(schedule.shiftId)&&(!order.requiredTechnicianId||schedule.technician.id===order.requiredTechnicianId));
      if(order.requiredTechnicianId&&!candidates.length){unallocated.push({order,reason:'FIXED_TECH_UNAVAILABLE',message:UNALLOCATED_REASONS.FIXED_TECH_UNAVAILABLE});continue;}
      if(!candidates.length){unallocated.push({order,reason:'SHIFT_CONFLICT',message:UNALLOCATED_REASONS.SHIFT_CONFLICT});continue;}
      let capacityBlocked=true,timeBlocked=false;
      const options=[];
      for(const schedule of candidates){
        if(!hasCapacity(schedule.items.map(item=>item.order),order,settings.shiftCapacity))continue;
        capacityBlocked=false;const placement=evaluateAppend(schedule,order,{matrix,shift:SHIFTS[schedule.shiftId],bufferMinutes:settings.bufferMinutes});
        if(!placement.valid){timeBlocked=true;continue;}
        const destination=workOrderArea(order),sameArea=String(schedule.technician.serviceArea||'').toLowerCase()===String(destination).toLowerCase();
        const balancePenalty=schedule.load*8,areaPenalty=sameArea?0:12;
        const priorityBonus=order.highPriority?-2:0,preferredTechnicianBonus=order.preferredTechnicianId===schedule.technician.id?-10:0;
        options.push({schedule,placement,score:placement.travelKm+balancePenalty+areaPenalty+priorityBonus+preferredTechnicianBonus});
      }
      if(!options.length){const reason=capacityBlocked?'CAPACITY_EXCEEDED':timeBlocked?'TIME_WINDOW_CONFLICT':'SHIFT_CONFLICT';unallocated.push({order,reason,message:UNALLOCATED_REASONS[reason]});continue;}
      const chosen=options.sort((a,b)=>a.score-b.score||a.schedule.technician.displayOrder-b.schedule.technician.displayOrder)[0];
      chosen.schedule.items.push({order,start:chosen.placement.start,end:chosen.placement.end,travelKm:chosen.placement.travelKm,travelMinutes:chosen.placement.travelMinutes,areaReminder:assignmentReminder(chosen.schedule.technician,order)});
      chosen.schedule.load+=workOrderLoad(order);chosen.schedule.distanceKm+=chosen.placement.travelKm;
    }
    return {schedules:[...schedules.values()].filter(schedule=>schedule.items.length),unallocated,total:orders.length,allocated:orders.length-unallocated.length};
  }
  /** Valida uma ordem manual completa e recalcula horários, carga e distância. */
  function recalculateSchedule(orders,technician,shiftId,{matrix={},settings=OPERATIONAL_SETTINGS}={}){
    const schedule={technician,shiftId,items:[],load:0,distanceKm:0};
    for(const order of orders){
      if(!hasCapacity(schedule.items.map(item=>item.order),order,settings.shiftCapacity))return {valid:false,reason:'CAPACITY_EXCEEDED',schedule};
      const placement=evaluateAppend(schedule,order,{matrix,shift:SHIFTS[shiftId],bufferMinutes:settings.bufferMinutes});
      if(!placement.valid)return {valid:false,reason:placement.reason,schedule};
      schedule.items.push({order,start:placement.start,end:placement.end,travelKm:placement.travelKm,travelMinutes:placement.travelMinutes,areaReminder:assignmentReminder(technician,order)});schedule.load+=workOrderLoad(order);schedule.distanceKm+=placement.travelKm;
    }
    return {valid:true,schedule};
  }
  /** Tenta inserir uma OS em uma rota sem alterar a rota recebida. */
  function assignWorkOrderToSchedule(order,targetSchedule,targetIndex,{matrix={},settings=OPERATIONAL_SETTINGS}={}){
    if(!order||!targetSchedule)return {valid:false,reason:'INVALID_MOVE'};
    if(order.requiredTechnicianId&&order.requiredTechnicianId!==targetSchedule.technician.id)return {valid:false,reason:'FIXED_TECH_UNAVAILABLE'};
    if(!allowedShiftIds(order).includes(targetSchedule.shiftId))return {valid:false,reason:'SHIFT_CONFLICT'};
    const orders=targetSchedule.items.map(item=>item.order).filter(item=>item.id!==order.id),safeIndex=Math.max(0,Math.min(Number.isInteger(targetIndex)?targetIndex:orders.length,orders.length));orders.splice(safeIndex,0,order);
    const result=recalculateSchedule(orders,targetSchedule.technician,targetSchedule.shiftId,{matrix,settings});
    return result.valid?{...result,order,targetIndex:safeIndex}:result;
  }
  /** Move uma OS entre técnicos e só devolve a alteração se as duas rotas forem válidas. */
  function moveWorkOrderBetweenSchedules(sourceSchedule,targetSchedule,orderId,targetIndex,{matrix={},settings=OPERATIONAL_SETTINGS}={}){
    if(!sourceSchedule||!targetSchedule||sourceSchedule===targetSchedule)return {valid:false,reason:'INVALID_MOVE'};
    const sourceOrders=sourceSchedule.items.map(item=>item.order),sourceIndex=sourceOrders.findIndex(order=>order.id===orderId),order=sourceOrders[sourceIndex];
    if(!order)return {valid:false,reason:'INVALID_MOVE'};
    if(order.locked)return {valid:false,reason:'LOCKED_WORK_ORDER'};
    if(order.requiredTechnicianId&&order.requiredTechnicianId!==targetSchedule.technician.id)return {valid:false,reason:'FIXED_TECH_UNAVAILABLE'};
    if(!allowedShiftIds(order).includes(targetSchedule.shiftId))return {valid:false,reason:'SHIFT_CONFLICT'};
    sourceOrders.splice(sourceIndex,1);
    const targetOrders=targetSchedule.items.map(item=>item.order),safeIndex=Math.max(0,Math.min(Number.isInteger(targetIndex)?targetIndex:targetOrders.length,targetOrders.length));targetOrders.splice(safeIndex,0,order);
    const sourceResult=recalculateSchedule(sourceOrders,sourceSchedule.technician,sourceSchedule.shiftId,{matrix,settings});if(!sourceResult.valid)return sourceResult;
    const targetResult=recalculateSchedule(targetOrders,targetSchedule.technician,targetSchedule.shiftId,{matrix,settings});if(!targetResult.valid)return targetResult;
    return {valid:true,order,sourceSchedule:sourceResult.schedule,targetSchedule:targetResult.schedule};
  }
  /** Reposiciona uma OS em um horario exato, inclusive dentro da mesma coluna. */
  function scheduleWorkOrderAtTime(order,sourceSchedule,targetSchedule,targetStart,{matrix={},settings=OPERATIONAL_SETTINGS}={}){
    if(!order||!targetSchedule||!Number.isFinite(targetStart))return {valid:false,reason:'INVALID_MOVE'};
    const sourceOrder=sourceSchedule?.items.find(item=>item.order.id===order.id)?.order||order;
    if(sourceOrder.locked)return {valid:false,reason:'LOCKED_WORK_ORDER'};
    if(sourceOrder.requiredTechnicianId&&sourceOrder.requiredTechnicianId!==targetSchedule.technician.id)return {valid:false,reason:'FIXED_TECH_UNAVAILABLE'};
    const scheduledOrder={...sourceOrder,shift:targetSchedule.shiftId,timeConstraint:{type:'fixed',start:minutesToTime(targetStart),end:null}};
    if(!allowedShiftIds(scheduledOrder).includes(targetSchedule.shiftId))return {valid:false,reason:'SHIFT_CONFLICT'};
    const sourceKey=sourceSchedule?`${sourceSchedule.technician.id}:${sourceSchedule.shiftId}`:null,targetKey=`${targetSchedule.technician.id}:${targetSchedule.shiftId}`,sameSchedule=sourceKey===targetKey;
    if(sourceSchedule&&!sourceSchedule.items.some(item=>item.order.id===order.id))return {valid:false,reason:'INVALID_MOVE'};
    const targetItems=targetSchedule.items.filter(item=>item.order.id!==order.id),targetOrders=targetItems.map(item=>item.order),targetIndex=targetItems.findIndex(item=>item.start>targetStart),safeIndex=targetIndex<0?targetOrders.length:targetIndex;
    targetOrders.splice(safeIndex,0,scheduledOrder);
    const targetResult=recalculateSchedule(targetOrders,targetSchedule.technician,targetSchedule.shiftId,{matrix,settings});if(!targetResult.valid)return targetResult;
    let sourceResult=null;
    if(sourceSchedule&&!sameSchedule){sourceResult=recalculateSchedule(sourceSchedule.items.filter(item=>item.order.id!==order.id).map(item=>item.order),sourceSchedule.technician,sourceSchedule.shiftId,{matrix,settings});if(!sourceResult.valid)return sourceResult;}
    return {valid:true,order:scheduledOrder,sourceSchedule:sourceResult?.schedule||null,targetSchedule:targetResult.schedule,targetIndex:safeIndex};
  }
  /** Retira uma OS da rota e recalcula os horarios restantes sem apagar o atendimento. */
  function removeWorkOrderFromSchedule(schedule,orderId,{matrix={},settings=OPERATIONAL_SETTINGS}={}){
    if(!schedule)return {valid:false,reason:'INVALID_MOVE'};
    const order=schedule.items.find(item=>item.order.id===orderId)?.order;if(!order)return {valid:false,reason:'INVALID_MOVE'};
    const result=recalculateSchedule(schedule.items.filter(item=>item.order.id!==orderId).map(item=>item.order),schedule.technician,schedule.shiftId,{matrix,settings});
    return result.valid?{valid:true,order,schedule:result.schedule}:result;
  }
  /** Reorganiza cada rota sem transferir atendimentos entre tecnicos ou turnos. */
  function reorganizeTechnicianSchedules(schedules,{matrix={},optimizeRoute,settings=OPERATIONAL_SETTINGS,selectedTechnicianIds=null,selectedShiftIds=null}={}){
    if(typeof optimizeRoute!=='function')throw new Error('ROUTE_OPTIMIZER_REQUIRED');
    const selectedTechnicians=selectedTechnicianIds?new Set(selectedTechnicianIds):null,selectedShifts=selectedShiftIds?new Set(selectedShiftIds):null;
    let changedSchedules=0,failedSchedules=0;
    const reorganized=(Array.isArray(schedules)?schedules:[]).map(schedule=>{
      if(selectedTechnicians&&!selectedTechnicians.has(schedule.technician.id)||selectedShifts&&!selectedShifts.has(schedule.shiftId))return schedule;
      const orders=(schedule.items||[]).map(item=>item.order);
      if(orders.length<2)return schedule;
      const occupied=new Set(),lockedPositions={};let invalidLocks=false;
      orders.forEach((order,index)=>{
        const position=Number(order.fixedPosition)-1;
        if(!Number.isInteger(position)||position<0||position>=orders.length)return;
        if(occupied.has(position)){invalidLocks=true;return;}
        lockedPositions[order.id]=position;occupied.add(position);
      });
      orders.forEach((order,index)=>{
        if(Object.hasOwn(lockedPositions,order.id)||!order.locked&&normalizeTimeConstraint(order.timeConstraint).type==='free')return;
        if(occupied.has(index)){invalidLocks=true;return;}
        lockedPositions[order.id]=index;occupied.add(index);
      });
      if(invalidLocks){failedSchedules++;return schedule;}
      try{
        const optimized=optimizeRoute(orders,{origin:orders[0],matrix,lockedPositions}),calculated=recalculateSchedule(optimized.orderedPoints,schedule.technician,schedule.shiftId,{matrix,settings});
        if(!calculated.valid){failedSchedules++;return schedule;}
        const changed=calculated.schedule.items.some((item,index)=>item.order.id!==schedule.items[index]?.order.id||item.start!==schedule.items[index]?.start);
        if(changed)changedSchedules++;
        return calculated.schedule;
      }catch(error){failedSchedules++;return schedule;}
    });
    return {schedules:reorganized,changedSchedules,failedSchedules};
  }
  /** Compara todos os encaixes válidos e ordena técnicos pela rota resultante. */
  function recommendWorkOrderAssignments(order,schedules,technicians,{matrix={},settings=OPERATIONAL_SETTINGS}={}){
    if(!order||order.locked)return [];
    const currentSchedules=Array.isArray(schedules)?schedules:[],source=currentSchedules.find(schedule=>schedule.items.some(item=>item.order.id===order.id))||null;
    const sourceKey=source?`${source.technician.id}:${source.shiftId}`:null,sourceOrders=source?.items.map(item=>item.order).filter(item=>item.id!==order.id)||[];
    const sourceResult=source?recalculateSchedule(sourceOrders,source.technician,source.shiftId,{matrix,settings}):null;
    if(sourceResult&&!sourceResult.valid)return [];
    const validShifts=new Set(allowedShiftIds(order)),destination=workOrderArea(order),options=[];
    for(const technician of technicians.filter(item=>item.active!==false)){
      if(order.requiredTechnicianId&&order.requiredTechnicianId!==technician.id)continue;
      for(const shiftId of technician.defaultShifts||[]){
        if(!validShifts.has(shiftId))continue;
        const targetKey=`${technician.id}:${shiftId}`,target=currentSchedules.find(schedule=>`${schedule.technician.id}:${schedule.shiftId}`===targetKey);
        const targetOrders=(target?.items||[]).map(item=>item.order).filter(item=>item.id!==order.id);
        const untouchedDistance=currentSchedules.reduce((sum,schedule)=>{
          const key=`${schedule.technician.id}:${schedule.shiftId}`;return key===sourceKey||key===targetKey?sum:sum+(Number(schedule.distanceKm)||0);
        },0);
        for(let index=0;index<=targetOrders.length;index++){
          const candidateOrders=[...targetOrders];candidateOrders.splice(index,0,order);
          const targetResult=recalculateSchedule(candidateOrders,technician,shiftId,{matrix,settings});if(!targetResult.valid)continue;
          const sourceDistance=sourceKey&&sourceKey!==targetKey?(Number(sourceResult.schedule.distanceKm)||0):0;
          const totalDistance=untouchedDistance+sourceDistance+(Number(targetResult.schedule.distanceKm)||0);
          const areaPenalty=String(technician.serviceArea||'').toLowerCase()===String(destination).toLowerCase()?0:12;
          options.push({technician,shiftId,index,schedule:targetResult.schedule,sourceSchedule:sourceKey===targetKey?null:sourceResult?.schedule||null,sourceKey,targetKey,totalDistance,score:totalDistance+areaPenalty,areaReminder:assignmentReminder(technician,order)});
        }
      }
    }
    return options.sort((a,b)=>a.score-b.score||a.totalDistance-b.totalDistance||a.technician.displayOrder-b.technician.displayOrder);
  }
  return {timeToMinutes,minutesToTime,workOrderTimeUnits,workOrderLoad,workOrderDuration,calculateLoad,hasCapacity,findDuplicateWorkOrder,matrixDistance,travelMinutes,normalizeTimeConstraint,allowedShiftIds,placeInTimeline,operationalOrder,workOrderArea,assignmentReminder,evaluateAppend,allocateWorkOrders,recalculateSchedule,assignWorkOrderToSchedule,moveWorkOrderBetweenSchedules,scheduleWorkOrderAtTime,removeWorkOrderFromSchedule,reorganizeTechnicianSchedules,recommendWorkOrderAssignments};
});
