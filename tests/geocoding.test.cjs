const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../js/geocoding-core.js');
const providers=require('../js/geocoding-providers.js');
const serviceModule=require('../js/geocoding-service.js');

const context=core.createOperationContext([
  {
    id:'pelotas_urbana',
    name:'Pelotas urbana',
    city:'pelotas',
    center:[-31.765,-52.337],
    polygon:[[-31.9,-52.55],[-31.9,-52.15],[-31.55,-52.15],[-31.55,-52.55]]
  }
],{pelotas:'Pelotas'},[-31.765,-52.337]);

const config={
  cacheTtlMs:60000,
  maximoSugestoes:5,
  minimoCaracteres:4,
  pontuacaoLocalForte:1080,
  pontuacaoExternaForte:900
};

function candidate(source='local',overrides={}){
  return {
    id:`${source}-1`,
    source,
    name:'Rua Vinte e Oito, 100',
    formattedAddress:'Rua Vinte e Oito, 100',
    street:'Rua Vinte e Oito',
    houseNumber:'100',
    locality:'Areal',
    city:'pelotas',
    cityName:'Pelotas',
    state:'Rio Grande do Sul',
    coords:[-31.76,-52.34],
    approximate:false,
    confidence:1,
    ...overrides
  };
}

function fakeProvider(name,results,{configured=true,error=null,delay=0}={}){
  return {
    name,
    calls:0,
    isConfigured(){return configured;},
    async autocomplete(query){
      this.calls++;
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      if(error)throw error;
      return typeof results==='function'?results(query):results;
    },
    async reverseGeocode(){
      this.calls++;
      if(error)throw error;
      return typeof results==='function'?results('reverse'):results;
    }
  };
}

test('normaliza uma feature do Photon para o modelo interno',()=>{
  const result=core.normalizePhotonFeature({
    geometry:{coordinates:[-52.34,-31.76]},
    properties:{osm_type:'W',osm_id:42,street:'Rua Vinte e Oito',housenumber:'100',suburb:'Areal',city:'Pelotas',state:'Rio Grande do Sul',country:'Brasil'}
  });
  assert.equal(result.source,'photon');
  assert.equal(result.houseNumber,'100');
  assert.equal(result.city,'Pelotas');
  assert.deepEqual(result.coords,[-31.76,-52.34]);
});

test('Photon usa idioma aceito e contexto geografico na URL',()=>{
  const provider=new providers.PhotonProvider({habilitado:true,urlBase:'https://photon.komoot.io',idioma:'default',limiteResultados:8});
  const url=new URL(provider.url('api',{q:'Pelotas'},context));
  assert.equal(url.searchParams.get('lang'),'default');
  assert.equal(url.searchParams.get('lat'),'-31.765');
  assert.ok(url.searchParams.get('bbox'));
});

test('normaliza uma feature do Geoapify para o modelo interno',()=>{
  const result=core.normalizeGeoapifyFeature({
    geometry:{coordinates:[-52.34,-31.76]},
    properties:{place_id:'abc',formatted:'Rua Vinte e Oito, 100, Areal, Pelotas',street:'Rua Vinte e Oito',housenumber:'100',suburb:'Areal',city:'Pelotas',state:'Rio Grande do Sul',rank:{confidence:.95}}
  });
  assert.equal(result.source,'geoapify');
  assert.equal(result.locality,'Areal');
  assert.equal(result.confidence,.95);
  assert.deepEqual(result.coords,[-31.76,-52.34]);
});

test('deduplica o mesmo endereco vindo de providers diferentes',()=>{
  const merged=core.deduplicate([
    candidate('local'),
    candidate('photon',{id:'photon-2',coords:[-31.76002,-52.34002]}),
    candidate('geoapify',{id:'geoapify-3'})
  ]);
  assert.equal(merged.length,1);
  assert.equal(merged[0].source,'local');
});

test('ranking favorece resultado local dentro de Pelotas',()=>{
  const ranked=core.rankResults('rua 28 100 areal pelotss',[
    candidate('photon',{id:'fora',city:'Outra cidade',cityName:'Outra cidade',coords:[-30,-51]}),
    candidate('local')
  ],context);
  assert.equal(ranked[0].source,'local');
  assert.equal(ranked[0].city,'pelotas');
});

test('rua externa muito compativel vence sugestao local apenas vagamente parecida',()=>{
  const ranked=core.rankResults('Rua Vinte e Oito 99999 Areal Pelotas',[
    candidate('local',{id:'local-fraco',name:'Rua Dois do Beco Tres Loteamento Areal',formattedAddress:'Rua Dois do Beco Tres Loteamento Areal',street:'Rua Dois do Beco Tres Loteamento Areal',houseNumber:'',approximate:true}),
    candidate('photon',{id:'photon-correto',name:'Rua Vinte e Oito, Areal, Pelotas',formattedAddress:'Rua Vinte e Oito, Areal, Pelotas',street:'Rua Vinte e Oito',houseNumber:'',approximate:true})
  ],context);
  assert.equal(ranked[0].id,'photon-correto');
});

test('resultado local forte evita Photon e Geoapify',async()=>{
  const photon=fakeProvider('photon',[candidate('photon')]),geoapify=fakeProvider('geoapify',[candidate('geoapify')]);
  const service=serviceModule.create({config,context,localSearch:async()=>[candidate('local')],localReverse:async()=>null,photon,geoapify});
  const result=await service.search('Rua Vinte e Oito, 100');
  assert.equal(result.localStrong,true);
  assert.equal(photon.calls,0);
  assert.equal(geoapify.calls,0);
});

test('rua local forte sem numero nao espera provider externo',async()=>{
  const photon=fakeProvider('photon',[candidate('photon')]),geoapify=fakeProvider('geoapify',[candidate('geoapify')]);
  const local=candidate('local',{name:'Rua Vinte e Oito Dunas',formattedAddress:'Rua Vinte e Oito Dunas',street:'Rua Vinte e Oito Dunas',houseNumber:'',approximate:true});
  const service=serviceModule.create({config,context,localSearch:async()=>[local],localReverse:async()=>null,photon,geoapify});
  const result=await service.search('Rua Vinte e Oito Dunas');
  assert.equal(result.localStrong,true);
  assert.equal(photon.calls,0);
  assert.equal(geoapify.calls,0);
});

test('Photon amplia uma busca sem resultado local',async()=>{
  const photon=fakeProvider('photon',[candidate('photon')]),geoapify=fakeProvider('geoapify',[]);
  const service=serviceModule.create({config,context,localSearch:async()=>[],localReverse:async()=>null,photon,geoapify});
  const result=await service.search('Rua Vinte e Oito Areal');
  assert.equal(result.results[0].source,'photon');
  assert.equal(photon.calls,1);
  assert.equal(geoapify.calls,0);
});

test('Geoapify complementa quando Photon nao retorna candidatos',async()=>{
  const photon=fakeProvider('photon',[]),geoapify=fakeProvider('geoapify',[candidate('geoapify')]);
  const service=serviceModule.create({config,context,localSearch:async()=>[],localReverse:async()=>null,photon,geoapify});
  const result=await service.search('Rua Vinte e Oito Areal');
  assert.equal(result.results[0].source,'geoapify');
  assert.equal(photon.calls,1);
  assert.equal(geoapify.calls,1);
});

test('Geoapify sem chave ou proxy nao impede o restante da busca',async()=>{
  const provider=new providers.GeoapifyProvider({habilitado:true,urlBase:'https://api.geoapify.com/v1/geocode',apiKey:'',proxyUrl:''});
  assert.equal(provider.isConfigured(),false);
  const photon=fakeProvider('photon',[candidate('photon')]);
  const service=serviceModule.create({config,context,localSearch:async()=>[],localReverse:async()=>null,photon,geoapify:provider});
  assert.equal((await service.search('Rua Vinte e Oito Areal')).results[0].source,'photon');
});

test('proxy Geoapify mantem a chave fora da URL criada no navegador',()=>{
  const provider=new providers.GeoapifyProvider({habilitado:true,urlBase:'https://api.geoapify.com/v1/geocode',apiKey:'',proxyUrl:'/.netlify/functions/geocode',limiteResultados:8});
  const url=new URL(provider.url('autocomplete',{text:'Rua Vinte e Oito'},context));
  assert.equal(url.pathname,'/.netlify/functions/geocode');
  assert.equal(url.searchParams.get('operation'),'autocomplete');
  assert.equal(url.searchParams.has('apiKey'),false);
});

test('falha de um provider preserva resultados disponiveis e fallback manual',async()=>{
  const failure=new providers.ProviderError('NETWORK_ERROR','offline','photon');
  const photon=fakeProvider('photon',[],{error:failure}),geoapify=fakeProvider('geoapify',[],{configured:false});
  const service=serviceModule.create({config,context,localSearch:async()=>[],localReverse:async()=>null,photon,geoapify});
  const result=await service.search('Endereco inexistente');
  assert.match(result.warning,/indisponivel/i);
  const reverse=await service.reverse([-31.76,-52.34]);
  assert.equal(reverse.result.source,'manual');
  assert.deepEqual(reverse.result.coords,[-31.76,-52.34]);
});

test('cache evita repetir a mesma consulta externa valida',async()=>{
  const photon=fakeProvider('photon',[candidate('photon')]),geoapify=fakeProvider('geoapify',[]);
  const service=serviceModule.create({config,context,localSearch:async()=>[],localReverse:async()=>null,photon,geoapify});
  await service.search('Rua Vinte e Oito Areal');
  const second=await service.search('Rua Vinte e Oito Areal');
  assert.equal(second.cached,true);
  assert.equal(photon.calls,1);
});

test('resposta antiga nao substitui a consulta mais recente',async()=>{
  const photon=fakeProvider('photon',query=>[candidate('photon',{id:query,name:query,formattedAddress:query})],{delay:20}),geoapify=fakeProvider('geoapify',[],{configured:false});
  const service=serviceModule.create({config,context,localSearch:async()=>[],localReverse:async()=>null,photon,geoapify});
  const oldRequest=service.search('Consulta antiga');
  await new Promise(resolve=>setTimeout(resolve,2));
  const currentRequest=service.search('Consulta atual');
  assert.equal((await oldRequest).stale,true);
  assert.equal((await currentRequest).stale,false);
});

test('endereco parcial permite confirmar a rua sem inventar numero',()=>{
  const [result]=core.rankResults('Rua Vinte e Oito 331',[candidate('local',{houseNumber:'',formattedAddress:'Rua Vinte e Oito',name:'Rua Vinte e Oito',approximate:true})],context);
  assert.equal(result.partialAddress,true);
  assert.equal(result.numberConfirmed,false);
  assert.equal(result.requestedHouseNumber,'331');
});

test('numero no nome da rua nao vira numero da casa',()=>{
  const [result]=core.rankResults('Rua Vinte e Oito 99999 Areal Pelotas',[candidate('local',{houseNumber:'28',formattedAddress:'Rua Tres do Beco, 28',name:'Rua Tres do Beco, 28',street:'Rua Tres do Beco',approximate:false})],context);
  assert.equal(result.requestedHouseNumber,'99999');
  assert.equal(result.numberConfirmed,false);
  assert.equal(result.partialAddress,true);
});

test('ponto manual permanece valido sem reverse geocoding',()=>{
  const result=core.createManualCandidate([-31.76,-52.34]);
  assert.equal(result.source,'manual');
  assert.equal(result.locationConfirmed,true);
  assert.deepEqual(result.coords,[-31.76,-52.34]);
});
