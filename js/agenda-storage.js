/* Recurso RoutePilot: persistência local de técnicos, OS e agendas. */
const RoutePilotAgendaStorage=(()=>{
  const DB_NAME='routepilot-agenda',VERSION=1,STORES=['technicians','workOrders','agendas','settings'];
  /** Abre e atualiza o banco isolado da agenda. */
  function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,VERSION);request.onupgradeneeded=()=>{STORES.forEach(name=>{if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Falha ao abrir a agenda local'));});}
  /** Executa uma operação IndexedDB e fecha a conexão ao concluir. */
  async function run(storeName,mode,operation){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,mode),request=operation(tx.objectStore(storeName));tx.oncomplete=()=>{db.close();resolve(request?.result);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao salvar a agenda'));};});}
  /** Lista todos os registros de uma coleção. */
  const all=store=>run(store,'readonly',objectStore=>objectStore.getAll());
  /** Salva ou substitui um registro pelo ID. */
  const put=(store,value)=>run(store,'readwrite',objectStore=>objectStore.put(structuredClone(value)));
  /** Exclui somente um registro identificado, sem afetar as demais coleções. */
  const remove=(store,id)=>run(store,'readwrite',objectStore=>objectStore.delete(id));
  /** Salva vários registros em uma única transação. */
  async function putMany(store,values){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),target=tx.objectStore(store);values.forEach(value=>target.put(structuredClone(value)));tx.oncomplete=()=>{db.close();resolve(values);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao salvar registros'));};});}
  /** Cria os técnicos padrão somente quando ainda não existe cadastro. */
  async function ensureDefaultTechnicians(){const current=await all('technicians');if(current.length)return current;await putMany('technicians',RoutePilotSchedulingConfig.DEFAULT_TECHNICIANS);return all('technicians');}
  /** Obtém a agenda de uma data sem criar dados fictícios. */
  async function getAgenda(date){return run('agendas','readonly',store=>store.get(date));}
  /** Persiste uma agenda diária completa. */
  function saveAgenda(agenda){return put('agendas',{...agenda,id:agenda.date,updatedAt:new Date().toISOString()});}
  /** Lista somente filtros visuais da Agenda armazenados nas configurações. */
  async function getAgendaFilters(){return (await all('settings')).filter(item=>item.type==='agendaTechnicianFilter');}
  /** Persiste um filtro visual usando IDs estáveis dos técnicos. */
  function saveAgendaFilter(filter){return put('settings',{...filter,type:'agendaTechnicianFilter'});}
  /** Remove um filtro visual sem alterar técnicos, OS ou agendas. */
  function removeAgendaFilter(id){return remove('settings',id);}
  /** Adaptador em memória usado pelos testes da persistência. */
  function createMemoryStore(seed={}){const stores=Object.fromEntries(STORES.map(name=>[name,new Map((seed[name]||[]).map(item=>[item.id,structuredClone(item)]))]));return {async all(name){return [...stores[name].values()].map(value=>structuredClone(value));},async put(name,value){stores[name].set(value.id,structuredClone(value));return value;},async get(name,id){return structuredClone(stores[name].get(id));},async remove(name,id){stores[name].delete(id);}};}
  return {all,put,remove,putMany,ensureDefaultTechnicians,getAgenda,saveAgenda,getAgendaFilters,saveAgendaFilter,removeAgendaFilter,createMemoryStore};
})();
if(typeof module==='object'&&module.exports)module.exports=RoutePilotAgendaStorage;
