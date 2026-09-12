/* API autenticada para dados compartilhados e privados do RoutePilot. */
import {authorizationError,permissionsForUser,requireAuthenticatedUser} from './_lib/authorization.mjs';
import {ensureSchema,getDatabase,json} from './_lib/database.mjs';

const COLLECTION_POLICIES=Object.freeze({
  technicians:'shared-operation',workOrders:'shared-operation',agendas:'shared-operation',
  settings:'user',notes:'user',addressCorrections:'user',
  mapChangeRequests:'map-request',mapFeatures:'shared-map'
});
const NOTE_TYPES=new Set(['general','reference','access','warning']);
const NOTE_STATUSES=new Set(['pending','validated','rejected']);
const SERVICE_TYPES=new Set(['maintenance','installation','address_change','equipment_pickup','connector_pickup']);
const MAP_ENTITY_TYPES=new Set(['address','point','street','neighborhood']);
const MAP_REQUEST_STATUSES=new Set(['pending','approved','rejected']);
const MAX_BODY_BYTES=512_000;

export const config={path:'/api/data',rateLimit:{windowLimit:180,windowSize:60,aggregateBy:['ip','domain']}};

/** Limita textos recebidos antes que eles possam chegar ao banco. */
function safeText(value,maxLength){return String(value??'').replace(/\s+/g,' ').trim().slice(0,maxLength);}

/** Aceita somente links HTTPS sem credenciais embutidas. */
function safeUrl(value){const text=safeText(value,500);if(!text)return '';try{const url=new URL(text);return url.protocol==='https:'&&!url.username&&!url.password?url.toString():'';}catch{return '';}}

/** Aceita somente datas ISO válidas e usa o instante atual como contingência. */
function safeDate(value,fallback=new Date().toISOString()){const parsed=Date.parse(value);return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback;}

/** Rejeita coordenadas ausentes ou fora dos limites terrestres. */
function coordinates(latitude,longitude){const lat=Number(latitude),lng=Number(longitude);if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)throw new Error('invalid_coordinates');return [lat,lng];}

/** Valida um ID estável sem aceitar chaves excessivas ou vazias. */
function recordId(value){const id=safeText(value,160);if(!id||!/^[\p{L}\p{N}_.:-]+$/u.test(id))throw new Error('invalid_id');return id;}

/** Limita a restrição de horário usada pelo agendador. */
function timeConstraint(input={}){const type=['free','fixed','window'].includes(input.type)?input.type:'free',time=value=>/^\d{2}:\d{2}$/.test(String(value||''))?String(value):null;return {type,start:time(input.start),end:time(input.end)};}

/** Conserva somente os campos operacionais necessários de uma OS. */
export function sanitizeWorkOrder(input={}){
  const id=recordId(input.id),coords=coordinates(input.latitude??input.coords?.[0],input.longitude??input.coords?.[1]),createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt);
  const customerName=safeText(input.customerName,100),address=safeText(input.address||input.formattedAddress,240),date=safeText(input.date,10);
  if(!customerName||!address||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('invalid_work_order');
  const serviceType=safeText(input.serviceType,40);
  return {id,customerName,date,serviceType:SERVICE_TYPES.has(serviceType)?serviceType:'maintenance',timeUnits:Number(input.timeUnits)===2?2:1,addressInput:safeText(input.addressInput,240),formattedAddress:safeText(input.formattedAddress||address,240),searchedText:safeText(input.searchedText,240),address,latitude:coords[0],longitude:coords[1],coords,locality:safeText(input.locality,120),city:safeText(input.city,80),locationSource:safeText(input.locationSource,40),locationConfirmed:Boolean(input.locationConfirmed),locationApproximate:Boolean(input.locationApproximate),shift:['morning','afternoon','any'].includes(input.shift)?input.shift:'any',highPriority:Boolean(input.highPriority),locked:Boolean(input.locked),fixedPosition:Number.isInteger(Number(input.fixedPosition))&&Number(input.fixedPosition)>0?Number(input.fixedPosition):null,preferredTechnicianId:input.preferredTechnicianId?recordId(input.preferredTechnicianId):null,requiredTechnicianId:input.requiredTechnicianId?recordId(input.requiredTechnicianId):null,note:safeText(input.note,300),timeConstraint:timeConstraint(input.timeConstraint),archived:Boolean(input.archived),cancelledAt:input.cancelledAt?safeDate(input.cancelledAt):null,createdAt,updatedAt};
}

/** Conserva somente configuração operacional do técnico. */
export function sanitizeTechnician(input={}){
  const id=recordId(input.id),name=safeText(input.name,120),createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt);
  if(!name)throw new Error('invalid_technician');
  const startLocation=Array.isArray(input.startLocation)?coordinates(input.startLocation[0],input.startLocation[1]):null;
  return {id,name,serviceArea:safeText(input.serviceArea,100),active:input.active!==false,defaultShifts:(Array.isArray(input.defaultShifts)?input.defaultShifts:[]).filter(value=>['morning','afternoon'].includes(value)),displayOrder:Math.max(0,Math.min(500,Number(input.displayOrder)||0)),startLocation,createdAt,updatedAt};
}

/** Valida itens calculados da agenda sem confiar no objeto vindo do navegador. */
function sanitizeAgendaItem(input={}){return {order:sanitizeWorkOrder(input.order),start:Math.max(0,Math.min(1440,Number(input.start)||0)),end:Math.max(0,Math.min(1440,Number(input.end)||0)),travelKm:Math.max(0,Math.min(5000,Number(input.travelKm)||0)),travelMinutes:Math.max(0,Math.min(1440,Number(input.travelMinutes)||0)),areaReminder:safeText(input.areaReminder,240),warning:safeText(input.warning,240)||null};}

/** Conserva a programação diária compartilhada e seus vínculos estáveis. */
export function sanitizeAgenda(input={}){
  const date=safeText(input.date||input.id,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('invalid_agenda');
  const schedules=(Array.isArray(input.schedules)?input.schedules:[]).slice(0,100).map(schedule=>({technician:sanitizeTechnician(schedule.technician),shiftId:['morning','afternoon'].includes(schedule.shiftId)?schedule.shiftId:'morning',items:(Array.isArray(schedule.items)?schedule.items:[]).slice(0,100).map(sanitizeAgendaItem),load:Math.max(0,Number(schedule.load)||0),distanceKm:Math.max(0,Number(schedule.distanceKm)||0)}));
  const unallocated=(Array.isArray(input.unallocated)?input.unallocated:[]).slice(0,200).map(item=>({order:sanitizeWorkOrder(item.order),reason:safeText(item.reason,240)}));
  const createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt);
  return {id:date,date,schedules,unallocated,createdAt,updatedAt};
}

/** Sanitiza filtros e preferências que pertencem somente ao usuário atual. */
export function sanitizeSetting(input={}){const id=recordId(input.id),type=safeText(input.type,40),allowedTypes=new Set(['agendaTechnicianFilter','routeTechnicianFilter','preference']);if(!allowedTypes.has(type))throw new Error('invalid_setting');const createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt);return {id,type,name:safeText(input.name,100),technicianIds:(Array.isArray(input.technicianIds)?input.technicianIds:[]).slice(0,100).map(recordId),showUnassigned:input.showUnassigned!==false,isDefault:Boolean(input.isDefault),value:typeof input.value==='boolean'||typeof input.value==='number'||typeof input.value==='string'?input.value:null,createdAt,updatedAt};}

/** Associa a anotação ao usuário derivado da sessão, nunca ao cliente. */
export function sanitizeNote(input={},userId=''){
  const id=recordId(input.id),text=safeText(input.text,500),type=safeText(input.type,24),status=safeText(input.status,24),coords=coordinates(input.latitude,input.longitude);if(!text)throw new Error('invalid_note');const createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt);
  return {id,userId:recordId(userId),latitude:coords[0],longitude:coords[1],type:NOTE_TYPES.has(type)?type:'general',text,status:NOTE_STATUSES.has(status)?status:'pending',createdAt,updatedAt,validatedAt:input.validatedAt?safeDate(input.validatedAt):null};
}

/** Conserva somente a correção geográfica compartilhada, sem dados de cliente. */
export function sanitizeAddressCorrection(input={}){
  const id=recordId(input.id),formattedAddress=safeText(input.formattedAddress||input.name,180),city=safeText(input.city||input.cityName,80),coords=coordinates(input.latitude??input.coords?.[0],input.longitude??input.coords?.[1]);if(!formattedAddress||!city)throw new Error('invalid_address_correction');
  const createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt),aliases=Array.isArray(input.aliases)?input.aliases.slice(0,10).map(value=>safeText(value,180)).filter(Boolean):[formattedAddress];
  return {id,kind:'address',name:formattedAddress,formattedAddress,street:safeText(input.street,160),houseNumber:safeText(input.houseNumber,24),aliases:[...new Set(aliases.length?aliases:[formattedAddress])],city,cityName:city,region:safeText(input.region,100)||null,locality:safeText(input.locality,100),context:safeText(input.context,200),coords,boundaryId:null,source:'manual_correction',status:'pending',approximate:false,localPriority:185,createdAt,updatedAt};
}

/** Valida um ponto geografico sem aceitar geometrias inventadas pelo navegador. */
function pointGeometry(input={}){
  const raw=input.geometry?.coordinates||input.coords;
  const coords=input.geometry?coordinates(raw?.[1],raw?.[0]):coordinates(input.latitude??raw?.[0],input.longitude??raw?.[1]);
  return {type:'Point',coordinates:[coords[1],coords[0]]};
}

/** Conserva os dados necessarios para uma solicitacao de alteracao geografica. */
export function sanitizeMapChangeRequest(input={},user,{administrator=false}={}){
  const id=recordId(input.id),entityType=MAP_ENTITY_TYPES.has(input.entityType)?input.entityType:'address',name=safeText(input.name||input.formattedAddress,180),city=safeText(input.city||input.cityName,80);
  if(!name||!city)throw new Error('invalid_map_change_request');
  const createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt),requestedStatus=MAP_REQUEST_STATUSES.has(input.status)?input.status:'pending';
  const status=administrator?requestedStatus:'pending',reviewedAt=status==='pending'?null:safeDate(input.reviewedAt||updatedAt),reviewNote=safeText(input.reviewNote,300);
  return {id,entityType,action:['create','update','delete'].includes(input.action)?input.action:'create',targetId:input.targetId?recordId(input.targetId):null,name,formattedAddress:safeText(input.formattedAddress||name,180),street:safeText(input.street,160),houseNumber:safeText(input.houseNumber,24),aliases:[...new Set((Array.isArray(input.aliases)?input.aliases:[name]).slice(0,12).map(value=>safeText(value,180)).filter(Boolean))],city,cityName:city,region:safeText(input.region,100)||null,locality:safeText(input.locality,100),context:safeText(input.context,200),geometry:pointGeometry(input),sourceName:safeText(input.sourceName,120),sourceUrl:safeUrl(input.sourceUrl),reason:safeText(input.reason,500),status,requestedBy:administrator&&input.requestedBy?recordId(input.requestedBy):user.id,requestedByEmail:administrator?safeText(input.requestedByEmail,180)||user.email:user.email,reviewedBy:status==='pending'?null:user.id,reviewedAt,reviewNote,createdAt,updatedAt};
}

/** Transforma somente uma solicitacao aprovada em feicao compartilhada. */
export function sanitizeMapFeature(input={},user){
  const id=recordId(input.id||input.targetId),entityType=MAP_ENTITY_TYPES.has(input.entityType)?input.entityType:'address',name=safeText(input.name||input.formattedAddress,180),city=safeText(input.city||input.cityName,80),geometry=pointGeometry(input);
  if(!name||!city)throw new Error('invalid_map_feature');
  const createdAt=safeDate(input.createdAt),updatedAt=safeDate(input.updatedAt,createdAt);
  return {id,kind:entityType==='neighborhood'?'bairro':entityType,entityType,name,formattedAddress:safeText(input.formattedAddress||name,180),street:safeText(input.street,160),houseNumber:safeText(input.houseNumber,24),aliases:[...new Set((Array.isArray(input.aliases)?input.aliases:[name]).slice(0,12).map(value=>safeText(value,180)).filter(Boolean))],city,cityName:city,region:safeText(input.region,100)||null,locality:safeText(input.locality,100),context:safeText(input.context,200),geometry,coords:[geometry.coordinates[1],geometry.coordinates[0]],boundaryId:null,source:'approved_map_change',sourceName:safeText(input.sourceName,120),sourceUrl:safeUrl(input.sourceUrl),status:'approved',approximate:false,localPriority:195,approvedBy:user.id,createdAt,updatedAt};
}

/** Seleciona um sanitizador fixo; coleções e tabelas nunca vêm livres da requisição. */
export function sanitizeRecord(collection,input,user={id:'unknown',email:''},permissions={}){
  if(collection==='workOrders')return sanitizeWorkOrder(input);
  if(collection==='technicians')return sanitizeTechnician(input);
  if(collection==='agendas')return sanitizeAgenda(input);
  if(collection==='settings')return sanitizeSetting(input);
  if(collection==='notes')return sanitizeNote(input,user.id);
  if(collection==='addressCorrections')return sanitizeAddressCorrection(input);
  if(collection==='mapChangeRequests')return sanitizeMapChangeRequest(input,user,{administrator:permissions.canReviewMapRequests});
  if(collection==='mapFeatures')return sanitizeMapFeature(input,user);
  throw new Error('invalid_collection');
}

/** Responde à API somente depois da autenticação e autorização no servidor. */
export default async function handler(request){
  try{
    const user=await requireAuthenticatedUser(),permissions=permissionsForUser(user),url=new URL(request.url),collection=safeText(url.searchParams.get('collection'),32),policy=COLLECTION_POLICIES[collection];
    if(!policy)return json({error:'invalid_collection'},{status:400});
    if(policy==='shared-operation'&&!permissions.canUseSharedOperations)return json({error:'authorization_required'},{status:403});
    const scope=policy==='user'?'user':policy==='map-request'?'review':'shared';
    const ownerId=policy==='user'?user.id:policy==='map-request'?'map-review':policy==='shared-map'?'map':'shared',sql=getDatabase();await ensureSchema(sql);
    if(request.method==='GET'){
      const rows=policy==='map-request'&&!permissions.canReviewMapRequests
        ?await sql`SELECT payload,is_deleted,updated_at FROM routepilot_records WHERE scope=${scope} AND owner_id=${ownerId} AND collection=${collection} AND payload->>'requestedBy'=${user.id} ORDER BY updated_at DESC LIMIT 5000`
        :await sql`SELECT payload,is_deleted,updated_at FROM routepilot_records WHERE scope=${scope} AND owner_id=${ownerId} AND collection=${collection} ORDER BY updated_at DESC LIMIT 5000`;
      return json({collection,scope,records:rows.map(row=>row.is_deleted?{id:row.payload.id,_deleted:true,updatedAt:row.updated_at}:row.payload)});
    }
    if(!['PUT','DELETE'].includes(request.method))return json({error:'method_not_allowed'},{status:405});
    if(policy==='shared-map'&&!permissions.canManageSharedMap)return json({error:'map_admin_required'},{status:403});
    const raw=await request.text();if(raw.length>MAX_BODY_BYTES)return json({error:'payload_too_large'},{status:413});
    let body;try{body=JSON.parse(raw||'{}');}catch(error){return json({error:'invalid_json'},{status:400});}
    const requestedId=recordId(request.method==='DELETE'?body.id:body.record?.id);
    if(policy==='map-request'){
      const existing=(await sql`SELECT payload,is_deleted FROM routepilot_records WHERE scope=${scope} AND owner_id=${ownerId} AND collection=${collection} AND record_id=${requestedId} LIMIT 1`)[0];
      if(existing&&!permissions.canReviewMapRequests&&(existing.payload?.requestedBy!==user.id||existing.payload?.status!=='pending'))return json({error:'map_request_owner_required'},{status:403});
    }
    if(request.method==='DELETE'){
      const id=requestedId,updatedAt=safeDate(body.updatedAt),tombstone=JSON.stringify({id,updatedAt});
      await sql`INSERT INTO routepilot_records (scope,owner_id,collection,record_id,payload,is_deleted,created_by,updated_by,created_at,updated_at)
        VALUES (${scope},${ownerId},${collection},${id},${tombstone}::jsonb,TRUE,${user.id},${user.id},${updatedAt},${updatedAt})
        ON CONFLICT (scope,owner_id,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,is_deleted=TRUE,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at
        WHERE routepilot_records.updated_at<=EXCLUDED.updated_at`;
      return json({deleted:true,id,updatedAt});
    }
    const record=sanitizeRecord(collection,body.record,user,permissions),updatedAt=record.updatedAt||new Date().toISOString();
    let approvedFeature=null;
    if(collection==='mapChangeRequests'&&record.status==='approved'){
      approvedFeature=sanitizeMapFeature({...record,id:record.targetId||`map_feature_${record.id}`,createdAt:record.reviewedAt||updatedAt,updatedAt},user);
      await sql`INSERT INTO routepilot_records (scope,owner_id,collection,record_id,payload,is_deleted,created_by,updated_by,created_at,updated_at)
        VALUES ('shared','map','mapFeatures',${approvedFeature.id},${JSON.stringify(approvedFeature)}::jsonb,FALSE,${user.id},${user.id},${approvedFeature.createdAt},${approvedFeature.updatedAt})
        ON CONFLICT (scope,owner_id,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,is_deleted=FALSE,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at`;
    }
    await sql`INSERT INTO routepilot_records (scope,owner_id,collection,record_id,payload,is_deleted,created_by,updated_by,created_at,updated_at)
      VALUES (${scope},${ownerId},${collection},${record.id},${JSON.stringify(record)}::jsonb,FALSE,${user.id},${user.id},${record.createdAt||updatedAt},${updatedAt})
      ON CONFLICT (scope,owner_id,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,is_deleted=FALSE,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at
      WHERE routepilot_records.updated_at<=EXCLUDED.updated_at`;
    return json({saved:true,record,approvedFeature});
  }catch(error){
    const auth=authorizationError(error);if(auth)return json(auth.body,{status:auth.status});
    if(error?.code==='DATABASE_NOT_CONFIGURED')return json({error:'database_not_configured'},{status:503});
    if(/^invalid_/.test(error?.message||''))return json({error:error.message},{status:400});
    console.error('RoutePilot data operation failed',error?.message||error);return json({error:'database_unavailable'},{status:500});
  }
}
