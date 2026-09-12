/* Ajustes privados, solicitacoes e pontos geograficos aprovados do RoutePilot. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RoutePilotAddressCorrectionsStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DB_NAME='routepilot-address-corrections',ADDRESS_STORE='addresses',REQUEST_STORE='requests',VERSION=2;
  let privateCache=[],approvedCache=[],requestCache=[];

  /** Limita textos e remove espacos repetidos antes da persistencia local. */
  function safeText(value,maxLength){return String(value||'').replace(/\s+/g,' ').trim().slice(0,maxLength);}

  /** Converte latitude e longitude e rejeita pontos fora dos limites terrestres. */
  function validCoordinates(latitude,longitude){
    const lat=Number(latitude),lon=Number(longitude);
    if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)throw new Error('Informe coordenadas validas. Exemplo: -31.73921, -52.39854');
    return [lat,lon];
  }

  /** Gera um ID independente do nome para sincronizacao segura. */
  function makeId(prefix='address_correction'){return globalThis.crypto?.randomUUID?`${prefix}_${crypto.randomUUID()}`:`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;}

  /** Monta somente os campos geograficos permitidos para um ajuste. */
  function buildRecord(input){
    const formattedAddress=safeText(input.formattedAddress||input.address||input.name,180),city=safeText(input.city||input.cityName,80),locality=safeText(input.locality,100),coords=validCoordinates(input.latitude??input.coords?.[0]??input.geometry?.coordinates?.[1],input.longitude??input.coords?.[1]??input.geometry?.coordinates?.[0]);
    if(!formattedAddress)throw new Error('Informe o endereco que deve aparecer no RoutePilot.');
    if(!city)throw new Error('Selecione a cidade do endereco.');
    const numberMatch=formattedAddress.match(/,\s*([0-9]+[a-z]?)\s*$/i),now=new Date().toISOString(),entityType=['address','point','street','neighborhood'].includes(input.entityType)?input.entityType:'address';
    const aliases=Array.isArray(input.aliases)&&input.aliases.length?input.aliases.map(value=>safeText(value,180)).filter(Boolean):[formattedAddress];
    return {id:safeText(input.id,160)||makeId(),kind:entityType==='neighborhood'?'bairro':entityType,entityType,name:formattedAddress,formattedAddress,street:safeText(input.street,160)||(numberMatch?formattedAddress.slice(0,numberMatch.index).trim():formattedAddress),houseNumber:safeText(input.houseNumber,24)||(numberMatch?.[1]||''),aliases:[...new Set(aliases)],city,cityName:city,region:safeText(input.region,100)||null,locality,context:safeText(input.context,200)||[locality,city].filter(Boolean).join(', '),coords,boundaryId:null,source:safeText(input.source,40)||'manual_correction',sourceName:safeText(input.sourceName,120),sourceUrl:safeText(input.sourceUrl,500),status:input.status==='approved'?'approved':'pending',visibility:input.visibility==='shared'?'shared':'private',userId:safeText(input.userId,160),approximate:false,localPriority:input.status==='approved'?195:185,createdAt:input.createdAt||now,updatedAt:input.updatedAt||now};
  }

  /** Cria a solicitacao sem associar o ponto a uma OS ou cliente. */
  function buildRequest(input,user={}){
    const record=buildRecord(input),now=new Date().toISOString();
    return {...record,id:safeText(input.requestId||input.id,160)||makeId('map_request'),action:'create',geometry:{type:'Point',coordinates:[record.coords[1],record.coords[0]]},reason:safeText(input.reason,500),status:['approved','rejected'].includes(input.status)?input.status:'pending',requestedBy:safeText(input.requestedBy||user.id,160),requestedByEmail:safeText(input.requestedByEmail||user.email,180),reviewedAt:input.reviewedAt||null,reviewNote:safeText(input.reviewNote,300),createdAt:input.createdAt||now,updatedAt:input.updatedAt||now};
  }

  /** Abre os armazenamentos offline de ajustes e solicitacoes. */
  function openDatabase(){return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('Armazenamento local indisponivel'));return;}const request=indexedDB.open(DB_NAME,VERSION);request.onupgradeneeded=()=>{[ADDRESS_STORE,REQUEST_STORE].forEach(name=>{if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Falha ao abrir ajustes locais'));});}

  /** Executa uma operacao curta no IndexedDB e fecha a conexao. */
  async function transaction(storeName,mode,operation){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,mode),request=operation(tx.objectStore(storeName));tx.oncomplete=()=>{db.close();resolve(request?.result);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao salvar ajuste local'));};});}

  /** Devolve uma copia de um ponto para proteger o cache interno. */
  function copy(item){return {...item,aliases:[...(item.aliases||[])],coords:[...(item.coords||[])]};}

  /** Sincroniza apenas os ajustes privados pertencentes a conta atual. */
  async function syncPrivate(local,userId){
    const cloud=globalThis.RoutePilotCloudSync;if(!cloud)return local;
    const remote=(await cloud.list('addressCorrections')).map(item=>buildRecord({...item,userId,visibility:'private'})),merged=new Map(local.map(item=>[item.id,item]));
    for(const item of remote){const current=merged.get(item.id);if(!current||String(item.updatedAt)>String(current.updatedAt)){await transaction(ADDRESS_STORE,'readwrite',store=>store.put(item));merged.set(item.id,item);}}
    for(const item of local){const current=merged.get(item.id);if(current===item||String(item.updatedAt)>=String(current?.updatedAt||''))await cloud.upsert('addressCorrections',item);}
    return [...merged.values()];
  }

  /** Envia solicitacoes pendentes e recebe as revisoes do administrador. */
  async function syncRequests(local,user){
    const cloud=globalThis.RoutePilotCloudSync;if(!cloud)return local;
    for(const item of local.filter(entry=>entry.status==='pending'))await cloud.upsert('mapChangeRequests',item);
    const remote=(await cloud.list('mapChangeRequests')).map(item=>buildRequest(item,user)),merged=new Map(local.map(item=>[item.id,item]));
    for(const item of remote){const current=merged.get(item.id);if(!current||String(item.updatedAt)>=String(current.updatedAt||'')){await transaction(REQUEST_STORE,'readwrite',store=>store.put(item));merged.set(item.id,item);}}
    return [...merged.values()];
  }

  /** Carrega dados privados, solicitacoes visiveis e feicoes aprovadas. */
  async function init(){
    const user=globalThis.RoutePilotAuth?.currentUser();if(!user?.id)throw new Error('Entre com Google para usar ajustes geograficos');
    const raw=await transaction(ADDRESS_STORE,'readonly',store=>store.getAll()),local=[];
    for(const item of raw){if(item.userId&&item.userId!==user.id)continue;const record=buildRecord({...item,userId:user.id,visibility:'private'});if(!item.userId)await transaction(ADDRESS_STORE,'readwrite',store=>store.put(record));local.push(record);}
    try{privateCache=await syncPrivate(local,user.id);}catch{privateCache=local;}
    const localRequests=(await transaction(REQUEST_STORE,'readonly',store=>store.getAll())).filter(item=>user.permissions?.canReviewMapRequests||item.requestedBy===user.id).map(item=>buildRequest(item,user));
    try{requestCache=await syncRequests(localRequests,user);}catch{requestCache=localRequests;}
    try{approvedCache=(await globalThis.RoutePilotCloudSync.list('mapFeatures')).map(item=>buildRecord({...item,visibility:'shared',status:'approved',userId:''}));}catch{approvedCache=[];}
    return cached();
  }

  /** Reune pontos privados e aprovados usados pela busca local. */
  function cached(){const merged=new Map(privateCache.map(item=>[item.id,item]));approvedCache.forEach(item=>merged.set(item.id,item));return [...merged.values()].map(copy);}
  const privateRecords=()=>privateCache.map(copy);
  const approvedRecords=()=>approvedCache.map(copy);
  const requests=()=>requestCache.map(copy);

  /** Salva um ponto somente na conta atual e no fallback offline. */
  async function save(input){
    const user=globalThis.RoutePilotAuth?.currentUser();if(!user?.id)throw new Error('Entre com Google para salvar o ajuste');
    let record=buildRecord({...input,userId:user.id,visibility:'private'}),existing=privateCache.find(item=>item.city===record.city&&item.formattedAddress.toLocaleLowerCase('pt-BR')===record.formattedAddress.toLocaleLowerCase('pt-BR')&&Math.abs(item.coords[0]-record.coords[0])<1e-7&&Math.abs(item.coords[1]-record.coords[1])<1e-7);
    if(existing)record=buildRecord({...record,id:existing.id,createdAt:existing.createdAt,userId:user.id});
    await transaction(ADDRESS_STORE,'readwrite',store=>store.put(record));privateCache=[...privateCache.filter(item=>item.id!==record.id),record];globalThis.RoutePilotCloudSync?.upsert('addressCorrections',record).catch(()=>false);return copy(record);
  }

  /** Envia um ajuste privado para revisao do administrador do mapa. */
  async function submitRequest(input){
    const user=globalThis.RoutePilotAuth?.currentUser();if(!user?.id)throw new Error('Entre com Google para solicitar aprovacao');
    const request=buildRequest({...input,id:makeId('map_request')},user);await transaction(REQUEST_STORE,'readwrite',store=>store.put(request));requestCache=[...requestCache,request];
    try{const result=await globalThis.RoutePilotCloudSync.upsert('mapChangeRequests',request),saved=buildRequest(result.record||request,user);await transaction(REQUEST_STORE,'readwrite',store=>store.put(saved));requestCache=[...requestCache.filter(item=>item.id!==saved.id),saved];return copy(saved);}catch{return {...copy(request),syncPending:true};}
  }

  /** Publica diretamente uma feicao quando o servidor confirma a permissao. */
  async function publish(input){
    if(!globalThis.RoutePilotAuth?.hasCapability('canManageSharedMap'))throw new Error('Somente o administrador pode publicar no mapa');
    const record=buildRecord({...input,status:'approved',visibility:'shared',source:'approved_map_change'}),result=await globalThis.RoutePilotCloudSync.upsert('mapFeatures',{...record,geometry:{type:'Point',coordinates:[record.coords[1],record.coords[0]]}}),approved=buildRecord({...result.record,visibility:'shared',status:'approved'});approvedCache=[...approvedCache.filter(item=>item.id!==approved.id),approved];return copy(approved);
  }

  /** Aprova ou rejeita uma solicitacao; a API publica ao aprovar. */
  async function reviewRequest(id,status,reviewNote=''){
    if(!globalThis.RoutePilotAuth?.hasCapability('canReviewMapRequests'))throw new Error('Somente o administrador pode revisar solicitacoes');
    const current=requestCache.find(item=>item.id===id);if(!current)throw new Error('Solicitacao nao encontrada');
    const now=new Date().toISOString(),next=buildRequest({...current,status,reviewNote,reviewedAt:now,updatedAt:now},globalThis.RoutePilotAuth.currentUser()),result=await globalThis.RoutePilotCloudSync.upsert('mapChangeRequests',next),saved=buildRequest(result.record,globalThis.RoutePilotAuth.currentUser());
    await transaction(REQUEST_STORE,'readwrite',store=>store.put(saved));requestCache=[...requestCache.filter(item=>item.id!==id),saved];if(result.approvedFeature)approvedCache=[...approvedCache.filter(item=>item.id!==result.approvedFeature.id),buildRecord({...result.approvedFeature,visibility:'shared',status:'approved'})];return copy(saved);
  }

  /** Cria um arquivo completo dos ajustes privados para auditoria externa. */
  function exportPayload(addresses=privateCache){const copies=addresses.map(copy);return {schema:'routepilot-address-corrections-v2',coordinateSystem:'WGS84 (EPSG:4326)',exportedAt:new Date().toISOString(),count:copies.length,addresses:copies.map(({id,formattedAddress,street,houseNumber,aliases,city,locality,region,coords,status,createdAt,updatedAt})=>{const [latitude,longitude]=coords;return {id,formattedAddress,street,houseNumber,aliases,city,locality,region,latitude,longitude,coordinateText:`${latitude}, ${longitude}`,geometry:{type:'Point',coordinates:[longitude,latitude]},googleMapsUrl:`https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`,source:'manual_correction',status,approximate:false,createdAt,updatedAt};})};}

  return {buildRecord,buildRequest,init,cached,privateRecords,approvedRecords,requests,save,submitRequest,publish,reviewRequest,exportPayload};
});
