/* Recurso RoutePilot: armazenamento local de anotações. */
/** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`RoutePilotNotes`). */
const RoutePilotNotes=(()=>{
  const DB_NAME='routepilot-operational-knowledge';
  const STORE_NAME='notes';
  const VERSION=1;
  const validTypes=new Set(['general','reference','access','warning']);
  const validStatuses=new Set(['pending','validated','rejected']);

  /** Guia: Exibe o conteúdo solicitado em armazenamento local de anotações (`openDatabase`). */
  function openDatabase() {
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB indisponível'));return;}
      const request=indexedDB.open(DB_NAME,VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(db.objectStoreNames.contains(STORE_NAME))return;
        const store=db.createObjectStore(STORE_NAME,{keyPath:'id'});
        store.createIndex('status','status',{unique:false});
        store.createIndex('createdAt','createdAt',{unique:false});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Falha ao abrir IndexedDB'));
    });
  }

  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`transaction`). */
  async function transaction(mode,operation) {
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,mode),store=tx.objectStore(STORE_NAME);
      let result;
      try { result=operation(store); } catch(error) { db.close();reject(error);return; }
      tx.oncomplete=()=>{db.close();resolve(result?.result);};
      tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha no armazenamento local'));};
      tx.onabort=()=>{db.close();reject(tx.error||new Error('Operação cancelada'));};
    });
  }

  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`all`). */
  const all=()=>transaction('readonly',store=>store.getAll());
  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`byId`). */
  const byId=id=>transaction('readonly',store=>store.get(id));
  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`safeType`). */
  const safeType=type=>validTypes.has(type)?type:'general';
  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`safeText`). */
  const safeText=text=>String(text||'').trim().slice(0,500);
  /** Guia: Monta a estrutura necessária em armazenamento local de anotações (`makeId`). */
  const makeId=()=>crypto.randomUUID?crypto.randomUUID():`note_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`coordinates`). */
  function coordinates(input) {
    const latitude=Number(input.latitude),longitude=Number(input.longitude);
    if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new Error('Coordenadas inválidas');
    return {latitude,longitude};
  }

  /** Guia: Monta a estrutura necessária em armazenamento local de anotações (`createNote`). */
  async function createNote(input) {
    const text=safeText(input.text);
    if(!text)throw new Error('Escreva uma anotação');
    const now=new Date().toISOString();
    const note={id:makeId(),...coordinates(input),type:safeType(input.type),text,status:'pending',createdAt:now,updatedAt:now,validatedAt:null};
    await transaction('readwrite',store=>store.add(note));
    return note;
  }

  /** Guia: Atualiza o estado e a interface em armazenamento local de anotações (`updateNote`). */
  async function updateNote(id,patch) {
    const current=await byId(id);
    if(!current)throw new Error('Anotação não encontrada');
    const next={...current,updatedAt:new Date().toISOString()};
    if(Object.hasOwn(patch,'text')){
      next.text=safeText(patch.text);
      if(!next.text)throw new Error('Escreva uma anotação');
    }
    if(Object.hasOwn(patch,'type'))next.type=safeType(patch.type);
    if(Object.hasOwn(patch,'latitude')||Object.hasOwn(patch,'longitude'))Object.assign(next,coordinates({...next,...patch}));
    await transaction('readwrite',store=>store.put(next));
    return next;
  }

  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`changeStatus`). */
  async function changeStatus(id,status) {
    if(!validStatuses.has(status)||status==='pending')throw new Error('Status inválido');
    const current=await byId(id);
    if(!current)throw new Error('Anotação não encontrada');
    const now=new Date().toISOString();
    const next={...current,status,updatedAt:now,validatedAt:status==='validated'?now:null};
    await transaction('readwrite',store=>store.put(next));
    return next;
  }

  /** Guia: Verifica as condições necessárias em armazenamento local de anotações (`validateNote`). */
  const validateNote=id=>changeStatus(id,'validated');
  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`rejectNote`). */
  const rejectNote=id=>changeStatus(id,'rejected');
  /** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`noteDistanceKm`). */
  const noteDistanceKm=(note,lat,lng)=>distanceKm([lat,lng],[note.latitude,note.longitude]);

  /** Guia: Obtém o valor atual em armazenamento local de anotações (`getNearbyNotes`). */
  async function getNearbyNotes(lat,lng,radiusMeters=500,{includeRejected=false}={}) {
    coordinates({latitude:lat,longitude:lng});
    const maxKm=Math.max(0,Number(radiusMeters)||500)/1000;
    return (await all()).filter(note=>(includeRejected||note.status!=='rejected')&&noteDistanceKm(note,lat,lng)<=maxKm)
      .map(note=>({...note,distanceKm:noteDistanceKm(note,lat,lng)})).sort((a,b)=>a.distanceKm-b.distanceKm);
  }

  /** Guia: Obtém o valor atual em armazenamento local de anotações (`getPendingNotes`). */
  async function getPendingNotes() {
    return (await all()).filter(note=>note.status==='pending').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }

  /** Guia: Obtém o valor atual em armazenamento local de anotações (`getAllNotes`). */
  async function getAllNotes() {
    return (await all()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }

  return {createNote,updateNote,validateNote,rejectNote,getNearbyNotes,getPendingNotes,getAllNotes};
})();

/** Guia: Monta a estrutura necessária em armazenamento local de anotações (`createNote`). */
const createNote=input=>RoutePilotNotes.createNote(input);
/** Guia: Atualiza o estado e a interface em armazenamento local de anotações (`updateNote`). */
const updateNote=(id,patch)=>RoutePilotNotes.updateNote(id,patch);
/** Guia: Verifica as condições necessárias em armazenamento local de anotações (`validateNote`). */
const validateNote=id=>RoutePilotNotes.validateNote(id);
/** Guia: Executa uma etapa auxiliar em armazenamento local de anotações (`rejectNote`). */
const rejectNote=id=>RoutePilotNotes.rejectNote(id);
/** Guia: Obtém o valor atual em armazenamento local de anotações (`getNearbyNotes`). */
const getNearbyNotes=(lat,lng,radiusMeters,options)=>RoutePilotNotes.getNearbyNotes(lat,lng,radiusMeters,options);
/** Guia: Obtém o valor atual em armazenamento local de anotações (`getPendingNotes`). */
const getPendingNotes=()=>RoutePilotNotes.getPendingNotes();
