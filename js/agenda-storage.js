/* Persistencia offline com sincronizacao autenticada da operacao diaria. */
const RoutePilotAgendaStorage=(()=>{
  const DB_NAME='routepilot-agenda',VERSION=2,DATA_STORES=['technicians','workOrders','agendas','settings'],QUEUE_STORE='syncQueue',SYNC_INTERVAL_MS=15_000;
  const lastSync=new Map(),syncPromises=new Map();
  let syncedUserId=null;

  /** Abre o IndexedDB e cria a fila duravel usada quando a rede estiver indisponivel. */
  function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,VERSION);request.onupgradeneeded=()=>{DATA_STORES.forEach(name=>{if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});});if(!request.result.objectStoreNames.contains(QUEUE_STORE))request.result.createObjectStore(QUEUE_STORE,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Falha ao abrir a agenda local'));});}

  /** Executa uma operacao IndexedDB e fecha a conexao ao concluir. */
  async function run(storeName,mode,operation){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,mode),request=operation(tx.objectStore(storeName));tx.oncomplete=()=>{db.close();resolve(request?.result);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao salvar a agenda'));};tx.onabort=()=>{db.close();reject(tx.error||new Error('Operacao local cancelada'));};});}

  /** Retorna o usuario atual para separar preferencias no mesmo computador. */
  function currentUserId(){return globalThis.RoutePilotAuth?.currentUser()?.id||null;}

  /** Usa uma chave local composta para impedir que preferencias de contas diferentes colidam. */
  function localKey(store,id,ownerId=currentUserId()){return store==='settings'?`${ownerId||'legacy'}::${id}`:String(id);}

  /** Converte um registro remoto para o formato interno do IndexedDB. */
  function encodeLocal(store,record){if(store!=='settings')return structuredClone(record);const ownerId=record.ownerId||currentUserId()||'legacy';return {...structuredClone(record),id:localKey(store,record.id,ownerId),remoteId:String(record.id),ownerId};}

  /** Remove a chave tecnica local antes de entregar o registro a interface ou a API. */
  function decodeLocal(store,record){if(!record)return record;if(store!=='settings')return structuredClone(record);const result=structuredClone(record);result.id=result.remoteId||String(result.id).split('::').slice(1).join('::')||result.id;delete result.remoteId;return result;}

  /** Atribui uma preferencia legada a primeira conta que a abrir e remove a chave antiga. */
  async function claimLegacySetting(record,userId){const decoded={...decodeLocal('settings',record),ownerId:userId},db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite'),store=tx.objectStore('settings');store.delete(record.id);store.put(encodeLocal('settings',decoded));tx.oncomplete=()=>{db.close();resolve(decoded);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao migrar preferencia local'));};});}

  /** Lista registros locais sem disparar uma nova sincronizacao. */
  async function localAll(store){const records=await run(store,'readonly',objectStore=>objectStore.getAll());if(store!=='settings')return records.map(record=>decodeLocal(store,record));const userId=currentUserId();if(!userId)return [];const visible=[];for(const record of records){if(record.ownerId===userId)visible.push(decodeLocal(store,record));else if(!record.ownerId)visible.push(await claimLegacySetting(record,userId));}return visible;}

  /** Salva localmente sem criar outra entrada de sincronizacao. */
  const localPut=(store,value)=>run(store,'readwrite',objectStore=>objectStore.put(encodeLocal(store,value)));

  /** Exclui localmente sem criar outra entrada de sincronizacao. */
  const localRemove=(store,id,ownerId=currentUserId())=>run(store,'readwrite',objectStore=>objectStore.delete(localKey(store,id,ownerId)));

  /** Identifica a fila compartilhada ou a fila privada do usuario autenticado. */
  function queueOwner(store){return store==='settings'?currentUserId():'shared';}

  /** Monta uma chave idempotente para manter apenas a ultima operacao de cada registro. */
  function queueEntry(store,recordId,operation,record=null){const ownerId=queueOwner(store);if(!ownerId)throw new Error('authentication_required');return {id:`${ownerId}:${store}:${recordId}`,ownerId,store,recordId:String(recordId),operation,record:record?structuredClone(record):null,queuedAt:new Date().toISOString()};}

  /** Persiste uma alteracao e sua intencao de sincronizacao na mesma transacao. */
  async function writeAndQueue(store,records,operation='upsert'){const values=Array.isArray(records)?records:[records],db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction([store,QUEUE_STORE],'readwrite'),target=tx.objectStore(store),queue=tx.objectStore(QUEUE_STORE);for(const value of values){const id=String(value.id);if(operation==='delete')target.delete(localKey(store,id));else target.put(encodeLocal(store,value));queue.put(queueEntry(store,id,operation,operation==='upsert'?value:null));}tx.oncomplete=()=>{db.close();resolve(Array.isArray(records)?values:values[0]);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao registrar alteracao offline'));};tx.onabort=()=>{db.close();reject(tx.error||new Error('Alteracao offline cancelada'));};});}

  /** Adiciona datas de sincronizacao e autoria local as preferencias. */
  function prepareRecord(store,value){const now=new Date().toISOString(),ownerId=store==='settings'?currentUserId():undefined;if(store==='settings'&&!ownerId)throw new Error('authentication_required');return {...value,id:String(value.id),...(ownerId?{ownerId}:{}),createdAt:value.createdAt||now,updatedAt:now};}

  /** Retorna somente as operacoes que a conta atual pode enviar. */
  async function pendingEntries(store){const ownerId=queueOwner(store),entries=await run(QUEUE_STORE,'readonly',objectStore=>objectStore.getAll());return entries.filter(entry=>entry.store===store&&entry.ownerId===ownerId).sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt));}

  /** Envia a fila em ordem e so remove cada item depois da confirmacao do servidor. */
  async function flushQueue(store,cloud){for(const entry of await pendingEntries(store)){if(entry.operation==='delete')await cloud.remove(store,entry.recordId,entry.queuedAt);else await cloud.upsert(store,entry.record);await run(QUEUE_STORE,'readwrite',queue=>queue.delete(entry.id));}}

  /** Mescla Neon e IndexedDB pelo ID sem apagar alteracoes locais pendentes. */
  async function performSync(store){const cloud=globalThis.RoutePilotCloudSync,userId=currentUserId();if(!cloud||!userId)return false;await flushQueue(store,cloud);const [local,remote]=await Promise.all([localAll(store),cloud.list(store)]),localById=new Map(local.map(record=>[record.id,record])),remoteById=new Map();for(const record of remote){if(record._deleted){await localRemove(store,record.id,userId);localById.delete(record.id);continue;}const normalized=store==='settings'?{...record,ownerId:userId}:record;remoteById.set(normalized.id,normalized);const current=localById.get(normalized.id);if(!current||String(normalized.updatedAt)>String(current.updatedAt||'')){await localPut(store,normalized);localById.set(normalized.id,normalized);}}
    for(const record of localById.values()){const remoteRecord=remoteById.get(record.id);if(!remoteRecord||String(record.updatedAt||'')>String(remoteRecord.updatedAt||''))await cloud.upsert(store,record);}
    lastSync.set(store,Date.now());return true;}

  /** Sincroniza no maximo uma vez por intervalo e compartilha chamadas simultaneas. */
  async function syncStore(store,{force=false}={}){const userId=currentUserId();if(!userId)return false;if(syncedUserId!==userId){lastSync.clear();syncPromises.clear();syncedUserId=userId;}if(!force&&Date.now()-(lastSync.get(store)||0)<SYNC_INTERVAL_MS)return true;if(syncPromises.has(store))return syncPromises.get(store);const promise=performSync(store).catch(()=>false).finally(()=>syncPromises.delete(store));syncPromises.set(store,promise);return promise;}

  /** Lista todos os registros visiveis depois de tentar sincronizar. */
  async function all(store){await syncStore(store);return localAll(store);}

  /** Salva localmente, registra a fila e tenta enviar sem bloquear a interface. */
  async function put(store,value){const prepared=prepareRecord(store,value);await writeAndQueue(store,prepared);syncStore(store,{force:true});return prepared;}

  /** Exclui localmente e mantem a exclusao na fila ate o servidor confirma-la. */
  async function remove(store,id){await writeAndQueue(store,{id:String(id)},'delete');syncStore(store,{force:true});}

  /** Salva varios registros em uma unica transacao e evita duplicacao na fila. */
  async function putMany(store,values){const prepared=values.map(value=>prepareRecord(store,value));await writeAndQueue(store,prepared);syncStore(store,{force:true});return prepared;}

  /** Cria os tecnicos padrao apenas quando nao ha cadastro compartilhado. */
  async function ensureDefaultTechnicians(){const current=await all('technicians');if(current.length)return current;await putMany('technicians',RoutePilotSchedulingConfig.DEFAULT_TECHNICIANS);return all('technicians');}

  /** Ordena IDs conhecidos e mantem tecnicos adicionados manualmente no final. */
  function orderTechnicians(technicians,preferredOrder=RoutePilotSchedulingConfig.TECHNICIAN_DISPLAY_ORDER){const positions=new Map(preferredOrder.map((id,index)=>[id,index]));return [...technicians].sort((a,b)=>(positions.get(a.id)??preferredOrder.length+Number(a.displayOrder||0))-(positions.get(b.id)??preferredOrder.length+Number(b.displayOrder||0))).map((item,displayOrder)=>({...item,displayOrder}));}

  /** Aplica a ordem inicial uma vez por usuario sem desfazer edicoes posteriores. */
  async function ensureTechnicianDisplayOrder(){const migrationId='migration_technician_order_2026_09_08',done=(await all('settings')).find(item=>item.id===migrationId);if(done)return all('technicians');const ordered=orderTechnicians(await all('technicians'));await putMany('technicians',ordered);await put('settings',{id:migrationId,type:'preference',value:true});return ordered;}

  /** Obtem a Agenda compartilhada de uma data. */
  async function getAgenda(date){await syncStore('agendas');return (await localAll('agendas')).find(item=>item.id===date);}

  /** Persiste uma Agenda diaria completa com ID estavel pela data. */
  function saveAgenda(agenda){return put('agendas',{...agenda,id:agenda.date});}

  /** Lista os filtros visuais privados do usuario. */
  async function getAgendaFilters(){return (await all('settings')).filter(item=>item.type==='agendaTechnicianFilter');}

  /** Persiste um filtro visual privado usando IDs dos tecnicos. */
  function saveAgendaFilter(filter){return put('settings',{...filter,type:'agendaTechnicianFilter'});}

  /** Remove um filtro visual somente do usuario atual. */
  function removeAgendaFilter(id){return remove('settings',id);}

  /** Lista filtros privados da equipe escolhida para gerar rotas. */
  async function getRouteTechnicianFilters(){return (await all('settings')).filter(item=>item.type==='routeTechnicianFilter');}

  /** Persiste um filtro privado da equipe de distribuicao. */
  function saveRouteTechnicianFilter(filter){return put('settings',{...filter,type:'routeTechnicianFilter'});}

  /** Remove somente o filtro privado informado. */
  function removeRouteTechnicianFilter(id){return remove('settings',id);}

  /** Invalida a memoria de sincronizacao apos trocar de usuario ou recuperar a rede. */
  function resetSync(){lastSync.clear();syncPromises.clear();syncedUserId=currentUserId();globalThis.RoutePilotCloudSync?.retry();}

  /** Adaptador em memoria usado pelos testes da persistencia. */
  function createMemoryStore(seed={}){const stores=Object.fromEntries(DATA_STORES.map(name=>[name,new Map((seed[name]||[]).map(item=>[item.id,structuredClone(item)]))]));return {async all(name){return [...stores[name].values()].map(value=>structuredClone(value));},async put(name,value){stores[name].set(value.id,structuredClone(value));return value;},async get(name,id){return structuredClone(stores[name].get(id));},async remove(name,id){stores[name].delete(id);}};}

  globalThis.RoutePilotAuth?.onChange(resetSync);globalThis.addEventListener?.('online',resetSync);
  return {all,put,remove,putMany,syncStore,resetSync,ensureDefaultTechnicians,ensureTechnicianDisplayOrder,orderTechnicians,getAgenda,saveAgenda,getAgendaFilters,saveAgendaFilter,removeAgendaFilter,getRouteTechnicianFilters,saveRouteTechnicianFilter,removeRouteTechnicianFilter,createMemoryStore};
})();
globalThis.RoutePilotAgendaStorage=RoutePilotAgendaStorage;
if(typeof module==='object'&&module.exports)module.exports=RoutePilotAgendaStorage;
