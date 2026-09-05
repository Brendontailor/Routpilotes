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
  /** Retorna a carga normalizada de uma OS. */
  function workOrderLoad(order){return SERVICE_TYPES[order.serviceType]?.load??Infinity;}
  /** Soma a carga de tipos mistos no mesmo turno. */
  function calculateLoad(orders){return orders.reduce((total,order)=>total+workOrderLoad(order),0);}
  /** Informa se uma nova OS ainda cabe na capacidade única do turno. */
  function hasCapacity(orders,candidate,capacity=OPERATIONAL_SETTINGS.shiftCapacity){return calculateLoad(orders)+workOrderLoad(candidate)<=capacity+1e-9;}
  /** Detecta número de OS repetido sem depender da interface. */
  function findDuplicateWorkOrder(orders,candidate,ignoreId=null){const number=String(candidate.number||'').trim().toLowerCase();return orders.find(order=>order.id!==ignoreId&&String(order.number||'').trim().toLowerCase()===number)||null;}
  /** Lê uma distância da matriz e usa zero apenas para o mesmo ponto. */
  function matrixDistance(matrix,a,b){if(!a||!b||a.id===b.id)return 0;const value=matrix?.[a.id]?.[b.id];return Number.isFinite(value)?value:Infinity;}
  /** Calcula deslocamento estimado em minutos. */
  function travelMinutes(matrix,a,b,averageSpeedKmh=OPERATIONAL_SETTINGS.averageSpeedKmh){const km=matrixDistance(matrix,a,b);return Number.isFinite(km)?km/averageSpeedKmh*60:Infinity;}
  /** Normaliza uma restrição de horário livre, exata ou em janela. */
  function normalizeTimeConstraint(input={}){const type=['free','fixed','window'].includes(input.type)?input.type:'free';const start=timeToMinutes(input.start),end=timeToMinutes(input.end);return {type,start,end:type==='fixed'?start:end};}
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
    const duration=SERVICE_TYPES[order.serviceType]?.durationMinutes;
    if(!Number.isFinite(duration)||start+duration>shiftEnd)return {valid:false,reason:'SHIFT_CONFLICT'};
    return {valid:true,start,end:start+duration};
  }
  /** Ordena primeiro restrições obrigatórias, depois prioridade e localização. */
  function operationalOrder(orders){
    const constraintRank={fixed:0,window:1,free:2};
    return [...orders].sort((a,b)=>constraintRank[normalizeTimeConstraint(a.timeConstraint).type]-constraintRank[normalizeTimeConstraint(b.timeConstraint).type]||
      (normalizeTimeConstraint(a.timeConstraint).start??Infinity)-(normalizeTimeConstraint(b.timeConstraint).start??Infinity)||Number(Boolean(b.highPriority))-Number(Boolean(a.highPriority))||String(a.number).localeCompare(String(b.number),'pt-BR',{numeric:true}));
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
  function allocateWorkOrders(orders,technicians,{matrix={},selectedTechnicianIds=null,settings=OPERATIONAL_SETTINGS,initialSchedules=[]}={}){
    const selected=new Set(selectedTechnicianIds||technicians.filter(item=>item.active).map(item=>item.id));
    const available=technicians.filter(item=>item.active&&selected.has(item.id));
    const schedules=new Map(),unallocated=[];
    available.forEach(technician=>(technician.defaultShifts||[]).forEach(shiftId=>schedules.set(`${technician.id}:${shiftId}`,{technician,shiftId,items:[],load:0,distanceKm:0})));
    initialSchedules.forEach(initial=>{
      const target=schedules.get(`${initial.technician.id}:${initial.shiftId}`);if(!target)return;
      target.items=(initial.items||[]).map(item=>({...item}));target.load=calculateLoad(target.items.map(item=>item.order));target.distanceKm=Number(initial.distanceKm)||0;
    });
    for(const order of operationalOrder(orders)){
      if(!Array.isArray(order.coords)||order.coords.length!==2||order.coords.some(value=>!Number.isFinite(Number(value)))){unallocated.push({order,reason:'INVALID_LOCATION',message:UNALLOCATED_REASONS.INVALID_LOCATION});continue;}
      const candidates=[...schedules.values()].filter(schedule=>schedule.shiftId===order.shift&&(!order.requiredTechnicianId||schedule.technician.id===order.requiredTechnicianId));
      if(order.requiredTechnicianId&&!candidates.length){unallocated.push({order,reason:'FIXED_TECH_UNAVAILABLE',message:UNALLOCATED_REASONS.FIXED_TECH_UNAVAILABLE});continue;}
      if(!candidates.length){unallocated.push({order,reason:'SHIFT_CONFLICT',message:UNALLOCATED_REASONS.SHIFT_CONFLICT});continue;}
      let capacityBlocked=true,timeBlocked=false;
      const options=[];
      for(const schedule of candidates){
        if(!hasCapacity(schedule.items.map(item=>item.order),order,settings.shiftCapacity))continue;
        capacityBlocked=false;const placement=evaluateAppend(schedule,order,{matrix,shift:SHIFTS[order.shift],bufferMinutes:settings.bufferMinutes});
        if(!placement.valid){timeBlocked=true;continue;}
        const destination=workOrderArea(order),sameArea=String(schedule.technician.serviceArea||'').toLowerCase()===String(destination).toLowerCase();
        const balancePenalty=schedule.load*8,areaPenalty=sameArea?0:12;
        const priorityBonus=order.highPriority?-2:0;
        options.push({schedule,placement,score:placement.travelKm+balancePenalty+areaPenalty+priorityBonus});
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
  return {timeToMinutes,minutesToTime,workOrderLoad,calculateLoad,hasCapacity,findDuplicateWorkOrder,matrixDistance,travelMinutes,normalizeTimeConstraint,placeInTimeline,operationalOrder,workOrderArea,assignmentReminder,evaluateAppend,allocateWorkOrders,recalculateSchedule};
});
