const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

/** Carrega os dados clássicos como o navegador para validar a integração final. */
function loadData(){const context={};vm.createContext(context);for(const [file,name] of [['data/regions.js','regions'],['data/locations.js','points'],['data/boundaries.js','boundaries'],['data/pelotas-localities.js','pelotasOfficialLocalities']])vm.runInContext(`${fs.readFileSync(file,'utf8')}\nglobalThis.${name}=${name};`,context);vm.runInContext(fs.readFileSync('data/v2-metadata.js','utf8'),context);return context;}

test('Pelotas usa todas as localidades nomeadas da camada oficial',()=>{
  const data=loadData(),features=data.pelotasOfficialLocalities.features,points=data.points.filter(point=>point.city==='Pelotas'&&point.kind==='bairro');
  assert.equal(features.length,94);
  assert.equal(points.length,94);
  assert.equal(new Set(features.map(feature=>feature.properties.officialCode)).size,94);
  assert.equal(features.some(feature=>feature.properties.name==='VAZIO URBANO'),false);
  assert.ok(features.every(feature=>feature.properties.source==='Prefeitura Municipal de Pelotas'));
});

test('localidades citadas ficam separadas nos centroides oficiais',()=>{
  const {points}=loadData(),expected={Dunas:[-31.7416962,-52.3140712],'Jardim Europa':[-31.7484779,-52.3193235],'Bom Jesus':[-31.7442989,-52.3167631],Obelisco:[-31.7422247,-52.3044794],'Vasco Pires':[-31.7472827,-52.3012395]};
  for(const [name,coordinates] of Object.entries(expected)){const point=points.find(item=>item.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));assert.ok(point,name);assert.ok(Math.abs(point.lat-coordinates[0])<1e-6,name);assert.ok(Math.abs(point.lon-coordinates[1])<1e-6,name);}
});

test('todas as localidades explicam classificacao e origem sem inventar contorno',()=>{
  const {points,boundaries}=loadData(),localities=points.filter(point=>point.kind!=='referencia');
  assert.ok(localities.every(point=>point.classification&&point.description));
  assert.ok(boundaries.features.every(feature=>feature.properties.classification&&feature.properties.description));
  assert.match(localities.find(point=>point.id==='morro_redondo_acoita_cavalo').description,/Prefeitura de Morro Redondo/);
  assert.match(localities.find(point=>point.id==='capao_do_leao_hidraulica').description,/Prefeitura de Capão do Leão/);
  assert.match(localities.find(point=>point.id==='cerrito_calheco').description,/não há contorno oficial verificado/);
});
