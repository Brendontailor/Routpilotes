const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');

global.indexedDB=indexedDB;
global.IDBKeyRange=IDBKeyRange;
global.RoutePilotSchedulingConfig=require('../js/scheduling-config.js');

let currentUser={id:'usuario_1'},offline=false;
const authListeners=new Set(),remoteStores=new Map();
const remoteKey=collection=>`${collection==='settings'?currentUser.id:'shared'}:${collection}`;
const remoteStore=collection=>{const key=remoteKey(collection);if(!remoteStores.has(key))remoteStores.set(key,new Map());return remoteStores.get(key);};

global.RoutePilotAuth={currentUser:()=>currentUser,isAuthenticated:()=>Boolean(currentUser),onChange:listener=>{authListeners.add(listener);return()=>authListeners.delete(listener);}};
global.RoutePilotCloudSync={
  async list(collection){if(offline)throw new Error('offline');return [...remoteStore(collection).values()].map(structuredClone);},
  async upsert(collection,record){if(offline)throw new Error('offline');remoteStore(collection).set(record.id,structuredClone(record));return {saved:true,record};},
  async remove(collection,id){if(offline)throw new Error('offline');remoteStore(collection).delete(id);return {deleted:true,id};},
  retry(){}
};

const storage=require('../js/agenda-storage.js');
const waitForBackground=()=>new Promise(resolve=>setTimeout(resolve,20));

/** Troca a identidade simulada e avisa os modulos como faria o Netlify Identity. */
function switchUser(id){currentUser={id};for(const listener of authListeners)listener(currentUser);}

test('fila offline sincroniza OS compartilhada e isola filtros por usuario',async()=>{
  offline=true;
  const workOrder={id:'os_offline_1',customerName:'Cliente operacional',date:'2026-09-08',address:'Rua Teste, 20',coords:[-31.7,-52.3],updatedAt:'2026-09-08T12:00:00.000Z'};
  await storage.put('workOrders',workOrder);
  await waitForBackground();
  assert.equal(remoteStore('workOrders').size,0);

  offline=false;
  await storage.syncStore('workOrders',{force:true});
  assert.equal(remoteStore('workOrders').get(workOrder.id).customerName,'Cliente operacional');

  await storage.saveRouteTechnicianFilter({id:'filtro_privado',name:'Minha equipe',technicianIds:['tecnico_1'],isDefault:true});
  await storage.syncStore('settings',{force:true});
  assert.equal((await storage.getRouteTechnicianFilters()).length,1);

  switchUser('usuario_2');
  assert.equal((await storage.getRouteTechnicianFilters()).length,0);
  assert.equal((await storage.all('workOrders')).some(record=>record.id===workOrder.id),true);

  switchUser('usuario_1');
  assert.equal((await storage.getRouteTechnicianFilters())[0].id,'filtro_privado');
});
