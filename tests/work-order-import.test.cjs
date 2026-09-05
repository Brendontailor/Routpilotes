const test=require('node:test');
const assert=require('node:assert/strict');
const importer=require('../js/work-order-import.js');

test('importa texto externo e ignora login',()=>{
  const text=`D: 244766
**Assunto: ASSISTÊNCIA TÉCNICA**
**Cliente: GILDO AMARO MORAES**
**Colaborador(a): ALIFER MEDRONHA DE LIMA - FUNCIONÁRIO**
**Data: Sábado, 5 de Setembro de 2026**
**Horário: 16:30 - 18:15**
**Endereço: RS Pelotas 96075-000 FATIMA - PASSEIO ALFREDO MALLUE, 85**
**Bairro: FATIMA**
**Login: gildo1112\\@rgsul.net.br**`;
  const result=importer.parse(text);
  assert.equal(result.externalId,'244766');
  assert.equal(result.customerName,'GILDO AMARO MORAES');
  assert.equal(result.technicianName,'ALIFER MEDRONHA DE LIMA');
  assert.equal(result.date,'2026-09-05');
  assert.equal(result.shift,'afternoon');
  assert.deepEqual(result.timeConstraint,{type:'window',start:'16:30',end:'18:15'});
  assert.equal(result.serviceType,'maintenance');
  assert.match(result.address,/PASSEIO ALFREDO MALLUE, 85/);
  assert.equal(Object.hasOwn(result,'login'),false);
});

test('horário anterior ao meio-dia seleciona manhã',()=>{
  const result=importer.parse(`Horário: 11:30 - 12:45
Endereço: RS Morro Redondo 96150-000 CENTRO - AVENIDA DAS ACÁCIAS, SN
Bairro: CENTRO
Login: indio@rgsul.net.br só tratar os dados que precisamos antes de usar`);
  assert.equal(result.shift,'morning');
  assert.equal(result.city,'Morro Redondo');
  assert.equal(Object.hasOwn(result,'login'),false);
  assert.match(result.address,/AVENIDA DAS ACÁCIAS, SN, CENTRO, Morro Redondo, RS/);
});
