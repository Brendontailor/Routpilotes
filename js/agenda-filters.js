/* Recurso RoutePilot: regras puras dos filtros visuais da Agenda. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotAgendaFilters=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  /** Normaliza um filtro mantendo vínculos exclusivamente por ID. */
  function normalizeFilter(filter,technicianIds=[]){const valid=new Set(technicianIds);return {...filter,technicianIds:[...new Set(filter.technicianIds||[])].filter(id=>valid.has(id)),showUnassigned:filter.showUnassigned!==false,isDefault:Boolean(filter.isDefault)};}
  /** Retorna somente as colunas escolhidas sem alterar técnicos ou agenda. */
  function visibleTechnicians(technicians,selectedIds){const selected=new Set(selectedIds);return technicians.filter(technician=>selected.has(technician.id));}
  /** Insere ou edita um filtro e garante somente um padrão. */
  function saveFilter(filters,filter){const next=filters.filter(item=>item.id!==filter.id).map(item=>filter.isDefault?{...item,isDefault:false}:item);return [...next,{...filter,technicianIds:[...new Set(filter.technicianIds||[])]}];}
  /** Remove um filtro salvo sem afetar técnicos ou ordens. */
  function removeFilter(filters,id){return filters.filter(filter=>filter.id!==id);}
  /** Define o filtro padrão de forma exclusiva. */
  function setDefault(filters,id){return filters.map(filter=>({...filter,isDefault:filter.id===id}));}
  return {normalizeFilter,visibleTechnicians,saveFilter,removeFilter,setDefault};
});
