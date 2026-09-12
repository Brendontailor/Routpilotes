const test=require('node:test');
const assert=require('node:assert/strict');

const apiPromise=import('../netlify/functions/operational-data.mjs');

test('API do Neon remove campos pessoais e impede autovalidacao de anotacao',async()=>{
  const {sanitizeNote}=await apiPromise,record=sanitizeNote({id:'note_1',userId:'usuario_falso',latitude:-31.7,longitude:-52.3,type:'warning',text:'Ponte interditada',status:'validated',customerName:'Nao armazenar',phone:'Nao armazenar'},'usuario_autenticado');
  assert.equal(record.text,'Ponte interditada');
  assert.equal(record.status,'pending');
  assert.equal(record.userId,'usuario_autenticado');
  assert.equal(Object.hasOwn(record,'customerName'),false);
  assert.equal(Object.hasOwn(record,'phone'),false);
});

test('API do Neon conserva somente os dados geograficos da correcao',async()=>{
  const {sanitizeAddressCorrection}=await apiPromise,record=sanitizeAddressCorrection({id:'address_1',formattedAddress:'Rua Teste, 20',street:'Rua Teste',houseNumber:'20',city:'Pelotas',locality:'Centro',coords:[-31.7,-52.3],customerName:'Nao armazenar'});
  assert.deepEqual(record.coords,[-31.7,-52.3]);
  assert.equal(record.formattedAddress,'Rua Teste, 20');
  assert.equal(Object.hasOwn(record,'customerName'),false);
});

test('API do Neon rejeita colecao e coordenadas invalidas',async()=>{
  const {sanitizeRecord,sanitizeNote}=await apiPromise;
  assert.throws(()=>sanitizeRecord('work_orders',{}),/invalid_collection/);
  assert.throws(()=>sanitizeNote({id:'note_2',text:'Teste',latitude:200,longitude:0}),/invalid_coordinates/);
});

test('API conserva somente os campos operacionais necessarios da OS',async()=>{
  const {sanitizeWorkOrder}=await apiPromise,record=sanitizeWorkOrder({id:'os_1',customerName:'Cliente autorizado',date:'2026-09-08',serviceType:'maintenance',address:'Rua Teste, 20',coords:[-31.7,-52.3],city:'Pelotas',locality:'Centro',login:'nao_salvar',password:'nao_salvar',apiKey:'nao_salvar'});
  assert.equal(record.customerName,'Cliente autorizado');
  assert.equal(record.address,'Rua Teste, 20');
  assert.equal(Object.hasOwn(record,'login'),false);
  assert.equal(Object.hasOwn(record,'password'),false);
  assert.equal(Object.hasOwn(record,'apiKey'),false);
});

test('preferencia privada aceita IDs estaveis de tecnicos',async()=>{
  const {sanitizeSetting}=await apiPromise,record=sanitizeSetting({id:'filtro_1',type:'routeTechnicianFilter',name:'Equipe A',technicianIds:['tecnico_1','tecnico_2'],isDefault:true});
  assert.deepEqual(record.technicianIds,['tecnico_1','tecnico_2']);
  assert.equal(record.isDefault,true);
});

test('administrador modera sem trocar autor ou conteudo da anotacao',async()=>{
  const {sanitizeNote}=await apiPromise,existing={id:'note_3',userId:'autor_1',latitude:-31.7,longitude:-52.3,type:'access',text:'Entrada lateral',status:'pending',createdAt:'2026-09-12T10:00:00.000Z',updatedAt:'2026-09-12T10:00:00.000Z'};
  const record=sanitizeNote({id:'note_3',text:'Texto adulterado',latitude:0,longitude:0,status:'validated',updatedAt:'2026-09-12T11:00:00.000Z'},{id:'admin_1'},{administrator:true,existing});
  assert.equal(record.status,'validated');
  assert.equal(record.userId,'autor_1');
  assert.equal(record.text,'Entrada lateral');
  assert.deepEqual([record.latitude,record.longitude],[-31.7,-52.3]);
  assert.equal(record.reviewedBy,'admin_1');
});

test('solicitacao comum permanece pendente e usa a identidade autenticada',async()=>{
  const {sanitizeMapChangeRequest}=await apiPromise,user={id:'user_1',email:'user@example.com'};
  const record=sanitizeMapChangeRequest({id:'request_1',entityType:'neighborhood',name:'Bairro conferido',city:'Pelotas',coords:[-31.7,-52.3],status:'approved',requestedBy:'outro_usuario'},user);
  assert.equal(record.status,'pending');
  assert.equal(record.requestedBy,'user_1');
  assert.deepEqual(record.geometry,{type:'Point',coordinates:[-52.3,-31.7]});
});

test('administrador pode aprovar uma feicao sem campos de cliente',async()=>{
  const {sanitizeMapFeature}=await apiPromise,record=sanitizeMapFeature({id:'map_feature_1',entityType:'street',name:'Rua Conferida',city:'Pelotas',geometry:{type:'Point',coordinates:[-52.3,-31.7]},customerName:'Nao armazenar'}, {id:'admin_1'});
  assert.equal(record.status,'approved');
  assert.equal(record.approvedBy,'admin_1');
  assert.equal(Object.hasOwn(record,'customerName'),false);
});
