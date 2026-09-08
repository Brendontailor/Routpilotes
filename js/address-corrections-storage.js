/* Recurso RoutePilot: correcoes locais de enderecos ainda ausentes na base aberta. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RoutePilotAddressCorrectionsStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DB_NAME='routepilot-address-corrections',STORE_NAME='addresses',VERSION=1;
  let addressCache=[];

  /** Limita textos e remove espacos repetidos antes da persistencia local. */
  function safeText(value,maxLength){return String(value||'').replace(/\s+/g,' ').trim().slice(0,maxLength);}

  /** Converte latitude e longitude e rejeita pontos fora dos limites terrestres. */
  function validCoordinates(latitude,longitude){
    const lat=Number(latitude),lon=Number(longitude);
    if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)throw new Error('Informe coordenadas validas. Exemplo: -31.73921, -52.39854');
    return [lat,lon];
  }

  /** Gera um ID independente do nome para permitir ruas iguais em cidades diferentes. */
  function makeId(){return globalThis.crypto?.randomUUID?`address_correction_${crypto.randomUUID()}`:`address_correction_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;}

  /** Monta somente os campos geograficos que podem entrar na lista de revisao. */
  function buildRecord(input){
    const formattedAddress=safeText(input.formattedAddress||input.address,180),city=safeText(input.city,80),locality=safeText(input.locality,100),coords=validCoordinates(input.latitude??input.coords?.[0],input.longitude??input.coords?.[1]);
    if(!formattedAddress)throw new Error('Informe o endereco que deve aparecer no RoutePilot.');
    if(!city)throw new Error('Selecione a cidade do endereco.');
    const numberMatch=formattedAddress.match(/,\s*([0-9]+[a-z]?)\s*$/i),now=new Date().toISOString();
    return {id:safeText(input.id,120)||makeId(),kind:'address',name:formattedAddress,formattedAddress,street:numberMatch?formattedAddress.slice(0,numberMatch.index).trim():formattedAddress,houseNumber:numberMatch?.[1]||'',aliases:[formattedAddress],city,cityName:city,region:safeText(input.region,100)||null,locality,context:[locality,city].filter(Boolean).join(', '),coords,boundaryId:null,source:'manual_correction',status:'pending',approximate:false,localPriority:185,createdAt:input.createdAt||now,updatedAt:now};
  }

  /** Abre um banco separado da agenda e das anotacoes operacionais. */
  function openDatabase(){return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('Armazenamento local indisponivel'));return;}const request=indexedDB.open(DB_NAME,VERSION);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Falha ao abrir ajustes locais'));});}

  /** Executa uma operacao no IndexedDB e sempre fecha a conexao. */
  async function transaction(mode,operation){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,mode),request=operation(tx.objectStore(STORE_NAME));tx.oncomplete=()=>{db.close();resolve(request?.result);};tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha ao salvar ajuste local'));};});}

  /** Carrega as correcoes uma vez e as disponibiliza para a busca sincrona. */
  async function init(){addressCache=(await transaction('readonly',store=>store.getAll())).map(buildRecord);return cached();}

  /** Devolve copias para impedir alteracao acidental da memoria interna. */
  function cached(){return addressCache.map(item=>({...item,aliases:[...item.aliases],coords:[...item.coords]}));}

  /** Salva uma correcao pendente e reaproveita o ID quando o ponto ja existe. */
  async function save(input){
    let record=buildRecord(input),existing=addressCache.find(item=>item.city===record.city&&item.formattedAddress.toLocaleLowerCase('pt-BR')===record.formattedAddress.toLocaleLowerCase('pt-BR')&&Math.abs(item.coords[0]-record.coords[0])<1e-7&&Math.abs(item.coords[1]-record.coords[1])<1e-7);
    if(existing)record=buildRecord({...record,id:existing.id,createdAt:existing.createdAt});
    await transaction('readwrite',store=>store.put(record));addressCache=[...addressCache.filter(item=>item.id!==record.id),record];return {...record,aliases:[...record.aliases],coords:[...record.coords]};
  }

  /** Cria um arquivo completo para localizar e importar cada ponto posteriormente. */
  function exportPayload(addresses=addressCache){const copies=addresses.map(item=>({...item,aliases:[...(item.aliases||[])],coords:[...item.coords]}));return {schema:'routepilot-address-corrections-v1',coordinateSystem:'WGS84 (EPSG:4326)',exportedAt:new Date().toISOString(),count:copies.length,addresses:copies.map(({id,formattedAddress,street,houseNumber,aliases,city,locality,region,coords,status,createdAt,updatedAt})=>{const [latitude,longitude]=coords;return {id,formattedAddress,street,houseNumber,aliases,city,locality,region,latitude,longitude,coordinateText:`${latitude}, ${longitude}`,geometry:{type:'Point',coordinates:[longitude,latitude]},googleMapsUrl:`https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`,source:'manual_correction',status,approximate:false,createdAt,updatedAt};})};}

  return {buildRecord,init,cached,save,exportPayload};
});
