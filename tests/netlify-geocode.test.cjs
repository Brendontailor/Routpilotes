const test=require('node:test');
const assert=require('node:assert/strict');

test('proxy informa quando Geoapify nao esta configurado',async()=>{
  const previous=process.env.GEOAPIFY_API_KEY;
  delete process.env.GEOAPIFY_API_KEY;
  const {handler}=await import('../netlify/functions/geocode.mjs');
  const response=await handler({httpMethod:'GET',queryStringParameters:{operation:'search',text:'Pelotas'}});
  assert.equal(response.statusCode,503);
  if(previous===undefined)delete process.env.GEOAPIFY_API_KEY;else process.env.GEOAPIFY_API_KEY=previous;
});

test('proxy envia somente parametros geograficos e mantem a chave no servidor',async()=>{
  const previousKey=process.env.GEOAPIFY_API_KEY,previousFetch=global.fetch;
  process.env.GEOAPIFY_API_KEY='chave-apenas-de-teste';
  let requestedUrl='';
  global.fetch=async url=>{
    requestedUrl=String(url);
    return {status:200,headers:{get:()=> 'application/json'},text:async()=>'{"features":[]}'};
  };
  try{
    const {handler}=await import('../netlify/functions/geocode.mjs');
    const response=await handler({httpMethod:'GET',queryStringParameters:{operation:'autocomplete',text:'Rua Vinte e Oito',limit:'5',customerName:'nao-enviar'}});
    const target=new URL(requestedUrl);
    assert.equal(response.statusCode,200);
    assert.equal(target.hostname,'api.geoapify.com');
    assert.equal(target.searchParams.get('text'),'Rua Vinte e Oito');
    assert.equal(target.searchParams.get('customerName'),null);
    assert.ok(target.searchParams.get('apiKey'));
  }finally{
    global.fetch=previousFetch;
    if(previousKey===undefined)delete process.env.GEOAPIFY_API_KEY;else process.env.GEOAPIFY_API_KEY=previousKey;
  }
});
