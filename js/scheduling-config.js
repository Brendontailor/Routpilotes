/* Recurso RoutePilot: configuração editável de OS, turnos e técnicos. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotSchedulingConfig=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SERVICE_TYPES={
    maintenance:{label:'Manutenção',load:.25,durationMinutes:45,color:'#1687a0'},
    installation:{label:'Instalação',load:.5,durationMinutes:100,color:'#7c4dcc'},
    address_change:{label:'Mudança de endereço',load:.5,durationMinutes:100,color:'#d96b22'},
    equipment_pickup:{label:'Retirada de equipamento',load:.125,durationMinutes:30,color:'#27805b'},
    connector_pickup:{label:'Retirada de conector',load:.125,durationMinutes:25,color:'#a26a15'}
  };
  const SHIFTS={
    morning:{label:'Manhã',start:'08:00',end:'12:00'},
    afternoon:{label:'Tarde',start:'13:00',end:'18:00'}
  };
  const OPERATIONAL_SETTINGS={shiftCapacity:1,bufferMinutes:10,averageSpeedKmh:35,maxWorkOrders:80};
  const DEFAULT_TECHNICIANS=[
    ['william_pereira_de_sousa','William Pereira de Sousa','Pelotas'],
    ['wendell_abraham_coelho','Wendell Abraham Coelho','Morro Redondo'],
    ['eduardo_cesar_fiori_da_silva','Eduardo Cesar Fiori da Silva','Pelotas'],
    ['moises_moura_de_souza','Moises Moura de Souza','Morro Redondo'],
    ['joao_carlos_muller_junior','João Carlos Muller Junior','Pelotas'],
    ['pedro_juan_porciuncula_burgues_blaas','Pedro Juan Porciuncula Burgues Blaas','Pelotas'],
    ['vagner_aires_lemos','Vagner Aires Lemos','Monte Bonito'],
    ['pablo_albuquerque_dutra','Pablo Albuquerque Dutra','Monte Bonito'],
    ['alifer_medronha_de_lima','Alifer Medronha de Lima','Pelotas'],
    ['ivan_cardoso_amaral','Ivan Cardoso Amaral','Pelotas'],
    ['mauricio_lemos_oliveira','Mauricio Lemos Oliveira','Pelotas']
  ].map(([id,name,serviceArea],displayOrder)=>({id,name,serviceArea,active:true,defaultShifts:['morning','afternoon'],displayOrder,startLocation:null}));
  const UNALLOCATED_REASONS={
    CAPACITY_EXCEEDED:'Capacidade do turno atingida.',
    TIME_WINDOW_CONFLICT:'Nenhum técnico consegue cumprir o horário.',
    FIXED_TECH_UNAVAILABLE:'Técnico obrigatório indisponível.',
    SHIFT_CONFLICT:'Horário fora do turno disponível.',
    INVALID_LOCATION:'Localização não pôde ser determinada.',
    DUPLICATE_WORK_ORDER:'Número de OS já cadastrado.'
  };
  return {SERVICE_TYPES,SHIFTS,OPERATIONAL_SETTINGS,DEFAULT_TECHNICIANS,UNALLOCATED_REASONS};
});
