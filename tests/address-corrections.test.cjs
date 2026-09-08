const test=require('node:test');
const assert=require('node:assert/strict');
const corrections=require('../js/address-corrections-storage.js');

test('correcao manual preserva endereco e coordenadas exatas',()=>{
  const record=corrections.buildRecord({formattedAddress:'Rua Rozalvo Mendes, 180',latitude:-31.739210888312844,longitude:-52.39853950331596,city:'Pelotas',locality:'Fragata',region:'pelotas_urbana'});
  assert.equal(record.formattedAddress,'Rua Rozalvo Mendes, 180');
  assert.equal(record.houseNumber,'180');
  assert.deepEqual(record.coords,[-31.739210888312844,-52.39853950331596]);
  assert.equal(record.status,'pending');
});

test('exportacao permite identificar o ponto sem carregar dados da OS',()=>{
  const record=corrections.buildRecord({formattedAddress:'Rua Exemplo, 25',latitude:-31.7,longitude:-52.3,city:'Pelotas',locality:'Centro',customerName:'Nao exportar'}),payload=corrections.exportPayload([record]),item=payload.addresses[0];
  assert.equal(payload.coordinateSystem,'WGS84 (EPSG:4326)');
  assert.equal(item.latitude,-31.7);assert.equal(item.longitude,-52.3);
  assert.deepEqual(item.geometry,{type:'Point',coordinates:[-52.3,-31.7]});
  assert.match(item.googleMapsUrl,/-31.7%2C-52.3/);
  assert.equal(Object.hasOwn(item,'customerName'),false);
});

test('coordenadas invalidas nao sao persistidas',()=>{
  assert.throws(()=>corrections.buildRecord({formattedAddress:'Rua Exemplo, 25',latitude:200,longitude:-52.3,city:'Pelotas'}),/coordenadas validas/i);
});
