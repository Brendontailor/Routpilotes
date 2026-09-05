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
  /** Salva vários registros em uma única transação. */
  async function putMany(store,values){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),target=tx.objectStore(store);values.forEach(value=>target.put(structuredClone(value)));tx.oncomplete=()=>{db.close();resolve(values);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao salvar registros'));};});}
  /** Cria os técnicos padrão somente quando ainda não existe cadastro. */
  async function ensureDefaultTechnicians(){const current=await all('technicians');if(current.length)return current;await putMany('technicians',RoutePilotSchedulingConfig.DEFAULT_TECHNICIANS);return all('technicians');}
  /** Obtém a agenda de uma data sem criar dados fictícios. */
  async function getAgenda(date){return run('agendas','readonly',store=>store.get(date));}
  /** Persiste uma agenda diária completa. */
  function saveAgenda(agenda){return put('agendas',{...agenda,id:agenda.date,updatedAt:new Date().toISOString()});}
  /** Adaptador em memória usado pelos testes da persistência. */
  function createMemoryStore(seed={}){const stores=Object.fromEntries(STORES.map(name=>[name,new Map((seed[name]||[]).map(item=>[item.id,structuredClone(item)]))]));return {async all(name){return [...stores[name].values()].map(value=>structuredClone(value));},async put(name,value){stores[name].set(value.id,structuredClone(value));return value;},async get(name,id){return structuredClone(stores[name].get(id));}};}
  return {all,put,putMany,ensureDefaultTechnicians,getAgenda,saveAgenda,createMemoryStore};
})();
if(typeof module==='object'&&module.exports)module.exports=RoutePilotAgendaStorage;
