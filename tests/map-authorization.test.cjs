const test=require('node:test');
const assert=require('node:assert/strict');

const authorizationPromise=import('../netlify/functions/_lib/authorization.mjs');

test('somente o e-mail do proprietario administra o mapa por padrao',async()=>{
  const previous=process.env.ROUTEPILOT_MAP_ADMIN_EMAILS;delete process.env.ROUTEPILOT_MAP_ADMIN_EMAILS;
  const {permissionsForUser}=await authorizationPromise;
  assert.equal(permissionsForUser({email:'brendontailor040@gmail.com',roles:[]}).canManageSharedMap,true);
  assert.equal(permissionsForUser({email:'outro@example.com',roles:[]}).canManageSharedMap,false);
  if(previous===undefined)delete process.env.ROUTEPILOT_MAP_ADMIN_EMAILS;else process.env.ROUTEPILOT_MAP_ADMIN_EMAILS=previous;
});

test('operador comum usa agenda mas nao publica alteracoes geograficas',async()=>{
  const previous=process.env.ROUTEPILOT_ALLOWED_EMAILS;process.env.ROUTEPILOT_ALLOWED_EMAILS='operador@example.com';
  const {permissionsForUser}=await authorizationPromise,permissions=permissionsForUser({email:'operador@example.com',roles:[]});
  assert.equal(permissions.canUseSharedOperations,true);
  assert.equal(permissions.canManageSharedMap,false);
  assert.equal(permissions.canReviewMapRequests,false);
  if(previous===undefined)delete process.env.ROUTEPILOT_ALLOWED_EMAILS;else process.env.ROUTEPILOT_ALLOWED_EMAILS=previous;
});
