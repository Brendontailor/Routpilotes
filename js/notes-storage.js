/* Persistencia offline e revisao compartilhada das anotacoes operacionais. */
const RoutePilotNotes=(()=>{
  const DB_NAME='routepilot-operational-knowledge',STORE_NAME='notes',VERSION=2;
  const validTypes=new Set(['general','reference','access','warning']),validStatuses=new Set(['pending','validated','rejected']);
  let cloudSyncPromise=null,syncedUserId=null;

  /** Retorna a identidade usada para isolar as anotacoes neste navegador. */
  function currentUserId(){return globalThis.RoutePilotAuth?.currentUser()?.id||null;}

  /** Indica se a conta atual pode moderar observacoes de todos os autores. */
  function canReview(){return Boolean(globalThis.RoutePilotAuth?.hasCapability?.('canReviewMapRequests'));}

  /** Exige login antes de ler ou alterar conhecimento operacional privado. */
  function requireUser(){const userId=currentUserId();if(!userId)throw new Error('Entre com Google para usar anotações');return userId;}

  /** Abre o banco local e adiciona o indice de proprietario quando necessario. */
  function openDatabase(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB indisponível'));return;}const request=indexedDB.open(DB_NAME,VERSION);request.onupgradeneeded=()=>{const db=request.result,store=db.objectStoreNames.contains(STORE_NAME)?request.transaction.objectStore(STORE_NAME):db.createObjectStore(STORE_NAME,{keyPath:'id'});if(!store.indexNames.contains('status'))store.createIndex('status','status',{unique:false});if(!store.indexNames.contains('createdAt'))store.createIndex('createdAt','createdAt',{unique:false});if(!store.indexNames.contains('userId'))store.createIndex('userId','userId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Falha ao abrir IndexedDB'));});}

  /** Executa uma transacao curta e fecha a conexao ao concluir. */
  async function transaction(mode,operation){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,mode),store=tx.objectStore(STORE_NAME);let result;try{result=operation(store);}catch(error){db.close();reject(error);return;}tx.oncomplete=()=>{db.close();resolve(result?.result);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha no armazenamento local'));};tx.onabort=()=>{db.close();reject(tx.error||new Error('Operação cancelada'));};});}

  /** Lista todas as anotacoes brutas para permitir migracao do formato anterior. */
  const localAll=()=>transaction('readonly',store=>store.getAll());

  /** Localiza uma anotacao visivel para a conta atual. */
  async function byId(id){const note=await transaction('readonly',store=>store.get(id));return note&&(canReview()||note.userId===currentUserId()||note.status==='validated')?note:null;}

  /** Restringe o tipo aos valores conhecidos pela interface. */
  const safeType=type=>validTypes.has(type)?type:'general';

  /** Limita o texto operacional sem aceitar conteudo vazio. */
  const safeText=text=>String(text||'').trim().slice(0,500);

  /** Gera um ID estavel para sincronizacao sem depender do nome do local. */
  const makeId=()=>crypto.randomUUID?crypto.randomUUID():`note_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

  /** Valida latitude e longitude antes de persistir. */
  function coordinates(input){const latitude=Number(input.latitude),longitude=Number(input.longitude);if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new Error('Coordenadas inválidas');return {latitude,longitude};}

  /** Entrega notas proprias, notas aprovadas e, ao administrador, toda a fila. */
  async function localVisible(){const userId=requireUser(),administrator=canReview(),records=await localAll(),visible=[];for(const record of records){const note=record.userId?record:{...record,userId,syncStatus:'pending'};if(!record.userId)await transaction('readwrite',store=>store.put(note));if(administrator||note.userId===userId||note.status==='validated')visible.push(note);}return visible;}

  /** Marca uma alteracao como sincronizada apenas se ela nao mudou durante o envio. */
  async function markSynced(note){const current=await byId(note.id);if(!current||current.updatedAt!==note.updatedAt)return;await transaction('readwrite',store=>store.put({...current,syncStatus:'synced',syncError:null}));}

  /** Envia pendencias, recebe a versao mais recente e preserva falhas no IndexedDB. */
  async function syncCloud(){const userId=requireUser(),administrator=canReview(),cloud=globalThis.RoutePilotCloudSync;if(!cloud)return false;const local=await localAll();for(const note of local.filter(item=>item.syncStatus!=='synced'&&(item.userId===userId||administrator))){try{await cloud.upsert('notes',note);await markSynced(note);}catch(error){await transaction('readwrite',store=>store.put({...note,syncStatus:'failed',syncError:String(error?.message||'sync_failed').slice(0,80)}));throw error;}}const remote=await cloud.list('notes'),localMap=new Map((await localAll()).map(note=>[note.id,note]));for(const record of remote){if(record._deleted){const current=localMap.get(record.id);if(current?.syncStatus==='synced')await transaction('readwrite',store=>store.delete(record.id));continue;}const note={...record,syncStatus:'synced',syncError:null},current=localMap.get(note.id);if(!current||current.syncStatus==='synced'&&String(note.updatedAt)>String(current.updatedAt||'')){await transaction('readwrite',store=>store.put(note));localMap.set(note.id,note);}}return true;}

  /** Compartilha uma tentativa de sincronizacao e libera nova tentativa depois. */
  async function ensureCloudSync(){const userId=currentUserId();if(!userId)return false;if(syncedUserId!==userId){cloudSyncPromise=null;syncedUserId=userId;}if(!cloudSyncPromise)cloudSyncPromise=syncCloud().catch(()=>false).finally(()=>{const timer=setTimeout(()=>{cloudSyncPromise=null;},30_000);timer.unref?.();});return cloudSyncPromise;}

  /** Agenda o envio sem bloquear a gravacao local feita pelo usuario. */
  function pushCloud(){cloudSyncPromise=null;ensureCloudSync();}

  /** Lista anotacoes autorizadas depois de tentar incorporar a nuvem. */
  async function all(){requireUser();await ensureCloudSync();return localVisible();}

  /** Cria uma anotacao pendente associada somente a coordenadas e ao autor. */
  async function createNote(input){const userId=requireUser(),text=safeText(input.text);if(!text)throw new Error('Escreva uma anotação');const now=new Date().toISOString(),note={id:makeId(),userId,...coordinates(input),type:safeType(input.type),text,status:'pending',createdAt:now,updatedAt:now,validatedAt:null,syncStatus:'pending',syncError:null};await transaction('readwrite',store=>store.add(note));pushCloud();return note;}

  /** Atualiza texto, tipo ou coordenadas e recoloca a nota na fila. */
  async function updateNote(id,patch){const current=await byId(id);if(!current||current.userId!==currentUserId())throw new Error('Você só pode editar suas próprias anotações');const next={...current,status:'pending',validatedAt:null,updatedAt:new Date().toISOString(),syncStatus:'pending',syncError:null};if(Object.hasOwn(patch,'text')){next.text=safeText(patch.text);if(!next.text)throw new Error('Escreva uma anotação');}if(Object.hasOwn(patch,'type'))next.type=safeType(patch.type);if(Object.hasOwn(patch,'latitude')||Object.hasOwn(patch,'longitude'))Object.assign(next,coordinates({...next,...patch}));await transaction('readwrite',store=>store.put(next));pushCloud();return next;}

  /** Altera o estado de revisao sem transformar a nota em dado geografico estrutural. */
  async function changeStatus(id,status){if(!canReview())throw new Error('Somente o administrador pode revisar anotações');if(!validStatuses.has(status)||status==='pending')throw new Error('Status inválido');const current=await byId(id);if(!current)throw new Error('Anotação não encontrada');const now=new Date().toISOString(),next={...current,status,updatedAt:now,validatedAt:status==='validated'?now:null,syncStatus:'pending',syncError:null};await transaction('readwrite',store=>store.put(next));pushCloud();return next;}

  /** Valida somente a observacao operacional. */
  const validateNote=id=>changeStatus(id,'validated');

  /** Rejeita uma observacao sem alterar o mapa estrutural. */
  const rejectNote=id=>changeStatus(id,'rejected');

  /** Calcula a distancia da anotacao ao ponto consultado. */
  const noteDistanceKm=(note,lat,lng)=>distanceKm([lat,lng],[note.latitude,note.longitude]);

  /** Retorna anotacoes autorizadas dentro do raio informado. */
  async function getNearbyNotes(lat,lng,radiusMeters=500,{includeRejected=false}={}){coordinates({latitude:lat,longitude:lng});const maxKm=Math.max(0,Number(radiusMeters)||500)/1000;return (await all()).filter(note=>(includeRejected||note.status!=='rejected')&&noteDistanceKm(note,lat,lng)<=maxKm).map(note=>({...note,distanceKm:noteDistanceKm(note,lat,lng)})).sort((a,b)=>a.distanceKm-b.distanceKm);}

  /** Lista anotacoes que ainda aguardam revisao. */
  async function getPendingNotes(){return (await all()).filter(note=>note.status==='pending').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}

  /** Lista todas as anotacoes visiveis pela ultima alteracao. */
  async function getAllNotes(){return (await all()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}

  globalThis.RoutePilotAuth?.onChange(()=>{cloudSyncPromise=null;syncedUserId=currentUserId();});globalThis.addEventListener?.('online',()=>{cloudSyncPromise=null;ensureCloudSync();});
  return {createNote,updateNote,validateNote,rejectNote,getNearbyNotes,getPendingNotes,getAllNotes};
})();
globalThis.RoutePilotNotes=RoutePilotNotes;

/** Cria uma nova anotacao por meio da abstracao de persistencia. */
const createNote=input=>RoutePilotNotes.createNote(input);
/** Atualiza uma anotacao existente da conta atual. */
const updateNote=(id,patch)=>RoutePilotNotes.updateNote(id,patch);
/** Valida uma observacao operacional. */
const validateNote=id=>RoutePilotNotes.validateNote(id);
/** Rejeita uma observacao operacional. */
const rejectNote=id=>RoutePilotNotes.rejectNote(id);
/** Busca anotacoes proximas ao ponto informado. */
const getNearbyNotes=(lat,lng,radiusMeters,options)=>RoutePilotNotes.getNearbyNotes(lat,lng,radiusMeters,options);
/** Busca as anotacoes que aguardam revisao. */
const getPendingNotes=()=>RoutePilotNotes.getPendingNotes();
