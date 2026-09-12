const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');

global.window=global;
global.indexedDB=indexedDB;
global.IDBKeyRange=IDBKeyRange;
global.distanceKm=()=>0;

let currentUser={id:'autor_1',administrator:false};
const authListeners=new Set(),remoteNotes=new Map();

global.RoutePilotAuth={currentUser:()=>currentUser,isAuthenticated:()=>Boolean(currentUser),hasCapability:name=>name==='canReviewMapRequests'&&currentUser.administrator,onChange:listener=>{authListeners.add(listener);return()=>authListeners.delete(listener);}};
global.RoutePilotCloudSync={
  async list(){return [...remoteNotes.values()].filter(note=>currentUser.administrator||note.userId===currentUser.id||note.status==='validated').map(structuredClone);},
  async upsert(_collection,record){const existing=remoteNotes.get(record.id),saved=currentUser.administrator?{...record,userId:existing?.userId||currentUser.id}:{...record,userId:currentUser.id,status:'pending',validatedAt:null};remoteNotes.set(saved.id,structuredClone(saved));return {saved:true,record:saved};},
  async remove(_collection,id){remoteNotes.delete(id);return {deleted:true,id};}
};

require('../js/notes-storage.js');
const notes=global.RoutePilotNotes;
const waitForBackground=()=>new Promise(resolve=>setTimeout(resolve,100));

/** Simula a troca de conta emitida pelo cliente de identidade. */
function switchUser(id,administrator=false){currentUser={id,administrator};for(const listener of authListeners)listener(currentUser);}

test('anotacoes ficam pendentes, administrador revisa e aprovadas tornam-se compartilhadas',async()=>{
  const first=await notes.createNote({latitude:-31.7,longitude:-52.3,type:'access',text:'Acesso lateral'});
  await waitForBackground();
  assert.equal(first.userId,'autor_1');
  assert.equal(remoteNotes.size,1);

  switchUser('autor_2');
  assert.deepEqual(await notes.getAllNotes(),[]);
  await assert.rejects(()=>notes.validateNote(first.id),/Somente o administrador/);

  switchUser('admin_1',true);
  assert.deepEqual((await notes.getPendingNotes()).map(note=>note.id),[first.id]);
  await notes.validateNote(first.id);
  await waitForBackground();

  switchUser('autor_2');
  const visible=await notes.getAllNotes();
  assert.deepEqual(visible.map(note=>note.id),[first.id]);
  assert.equal(visible[0].status,'validated');
  await assert.rejects(()=>notes.updateNote(first.id,{text:'Alterar nota alheia'}),/próprias anotações/);
});
