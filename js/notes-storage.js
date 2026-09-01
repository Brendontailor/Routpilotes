const RoutePilotNotes=(()=>{
  const DB_NAME='routepilot-operational-knowledge';
  const STORE_NAME='notes';
  const VERSION=1;
  const validTypes=new Set(['general','reference','access','warning']);
  const validStatuses=new Set(['pending','validated','rejected']);

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

  const all=()=>transaction('readonly',store=>store.getAll());
  const byId=id=>transaction('readonly',store=>store.get(id));
  const safeType=type=>validTypes.has(type)?type:'general';
  const safeText=text=>String(text||'').trim().slice(0,500);
  const makeId=()=>crypto.randomUUID?crypto.randomUUID():`note_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

  function coordinates(input) {
    const latitude=Number(input.latitude),longitude=Number(input.longitude);
    if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new Error('Coordenadas inválidas');
    return {latitude,longitude};
  }

  async function createNote(input) {
    const text=safeText(input.text);
    if(!text)throw new Error('Escreva uma anotação');
    const now=new Date().toISOString();
    const note={id:makeId(),...coordinates(input),type:safeType(input.type),text,status:'pending',createdAt:now,updatedAt:now,validatedAt:null};
    await transaction('readwrite',store=>store.add(note));
    return note;
  }

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

  async function changeStatus(id,status) {
    if(!validStatuses.has(status)||status==='pending')throw new Error('Status inválido');
    const current=await byId(id);
    if(!current)throw new Error('Anotação não encontrada');
    const now=new Date().toISOString();
    const next={...current,status,updatedAt:now,validatedAt:status==='validated'?now:null};
    await transaction('readwrite',store=>store.put(next));
    return next;
  }

  const validateNote=id=>changeStatus(id,'validated');
  const rejectNote=id=>changeStatus(id,'rejected');
  const noteDistanceKm=(note,lat,lng)=>distanceKm([lat,lng],[note.latitude,note.longitude]);

  async function getNearbyNotes(lat,lng,radiusMeters=500,{includeRejected=false}={}) {
    coordinates({latitude:lat,longitude:lng});
    const maxKm=Math.max(0,Number(radiusMeters)||500)/1000;
    return (await all()).filter(note=>(includeRejected||note.status!=='rejected')&&noteDistanceKm(note,lat,lng)<=maxKm)
      .map(note=>({...note,distanceKm:noteDistanceKm(note,lat,lng)})).sort((a,b)=>a.distanceKm-b.distanceKm);
  }

  async function getPendingNotes() {
    return (await all()).filter(note=>note.status==='pending').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }

  async function getAllNotes() {
    return (await all()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }

  return {createNote,updateNote,validateNote,rejectNote,getNearbyNotes,getPendingNotes,getAllNotes};
})();

const createNote=input=>RoutePilotNotes.createNote(input);
const updateNote=(id,patch)=>RoutePilotNotes.updateNote(id,patch);
const validateNote=id=>RoutePilotNotes.validateNote(id);
const rejectNote=id=>RoutePilotNotes.rejectNote(id);
const getNearbyNotes=(lat,lng,radiusMeters,options)=>RoutePilotNotes.getNearbyNotes(lat,lng,radiusMeters,options);
const getPendingNotes=()=>RoutePilotNotes.getPendingNotes();
