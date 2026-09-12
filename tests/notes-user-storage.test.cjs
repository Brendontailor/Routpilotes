const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');

global.window=global;
global.indexedDB=indexedDB;
global.IDBKeyRange=IDBKeyRange;
global.distanceKm=()=>0;

let currentUser={id:'autor_1'};
const authListeners=new Set(),remoteByUser=new Map();
const remoteStore=()=>{if(!remoteByUser.has(currentUser.id))remoteByUser.set(currentUser.id,new Map());return remoteByUser.get(currentUser.id);};

global.RoutePilotAuth={currentUser:()=>currentUser,isAuthenticated:()=>Boolean(currentUser),onChange:listener=>{authListeners.add(listener);return()=>authListeners.delete(listener);}};
global.RoutePilotCloudSync={
  async list(){return [...remoteStore().values()].map(structuredClone);},
  async upsert(_collection,record){remoteStore().set(record.id,structuredClone(record));return {saved:true,record};},
  async remove(_collection,id){remoteStore().delete(id);return {deleted:true,id};}
};

require('../js/notes-storage.js');
const notes=global.RoutePilotNotes;
const waitForBackground=()=>new Promise(resolve=>setTimeout(resolve,100));

/** Simula a troca de conta emitida pelo cliente de identidade. */
function switchUser(id){currentUser={id};for(const listener of authListeners)listener(currentUser);}

test('anotacoes locais e remotas permanecem privadas por usuario',async()=>{
  const first=await notes.createNote({latitude:-31.7,longitude:-52.3,type:'access',text:'Acesso lateral'});
  await waitForBackground();
  assert.equal(first.userId,'autor_1');
  assert.equal(remoteByUser.get('autor_1').size,1);

  switchUser('autor_2');
  assert.deepEqual(await notes.getAllNotes(),[]);
  const second=await notes.createNote({latitude:-31.71,longitude:-52.31,type:'warning',text:'Via bloqueada'});
  assert.equal(second.userId,'autor_2');

  switchUser('autor_1');
  const visible=await notes.getAllNotes();
  assert.deepEqual(visible.map(note=>note.id),[first.id]);
});
