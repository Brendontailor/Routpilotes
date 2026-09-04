import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import vm from 'node:vm';

const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/(.:)/,'$1'));
const inputDir=path.resolve(process.argv[2]||path.join(process.env.TEMP||'.','routepilot-overture-data'));
const outputDir=path.join(root,'data','open-address-tiles');
const indexFile=path.join(root,'data','open-address-tiles-index.js');
const CELL_SIZE=.01;
const RELEASE='2026-08-19.0';
const INPUTS={
  pelotas:'Pelotas',
  capao:'Capao do Leao',
  morro:'Morro Redondo',
  cangucu:'Cangucu',
  cerrito:'Cerrito'
};

const context={};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync(path.join(root,'data','regions.js'),'utf8')};globalThis.routePilotRegions=regions`,context);
const regions=context.routePilotRegions;
const tiles=new Map();
const ids=new Set();
const dedupe=new Set();
const counts={input:0,inside:0,withoutNumber:0,duplicates:0,integrated:0};

function insidePolygon(lat,lon,polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [latI,lonI]=polygon[i],[latJ,lonJ]=polygon[j];
    if((latI>lat)!==(latJ>lat)&&lon<(lonJ-lonI)*(lat-latI)/((latJ-latI)||Number.EPSILON)+lonI)inside=!inside;
  }
  return inside;
}

function distanceSquared(a,b){
  const lat=a[0]-b[0],lon=(a[1]-b[1])*Math.cos(a[0]*Math.PI/180);
  return lat*lat+lon*lon;
}

function regionFor(city,lat,lon){
  return regions.filter(region=>region.city===city&&insidePolygon(lat,lon,region.polygon))
    .sort((a,b)=>distanceSquared([lat,lon],a.center)-distanceSquared([lat,lon],b.center))[0]||null;
}

function normalizedNumber(value){
  const number=String(value||'').trim().replace(/\s+/g,' ');
  if(!number||/^(?:S\/?N|SN)(?:\b|\s|\()/i.test(number)||!/[0-9]/.test(number))return '';
  return number.slice(0,40);
}

function uniqueId(sourceId){
  const digest=crypto.createHash('sha1').update(String(sourceId)).digest('hex');
  for(let length=12;length<=digest.length;length+=2){
    const id=`oa_${digest.slice(0,length)}`;
    if(!ids.has(id)){ids.add(id);return id;}
  }
  throw new Error(`Nao foi possivel gerar ID unico para ${sourceId}`);
}

function tileKey(lat,lon){return `${Math.floor(lat/CELL_SIZE)}_${Math.floor(lon/CELL_SIZE)}`;}

async function processFile(baseName,city){
  const inputFile=path.join(inputDir,`${baseName}.geojsonseq`);
  if(!fs.existsSync(inputFile))throw new Error(`Arquivo Overture ausente: ${inputFile}`);
  const lines=readline.createInterface({input:fs.createReadStream(inputFile,{encoding:'utf8'}),crlfDelay:Infinity});
  for await(const line of lines){
    if(!line.trim())continue;
    counts.input++;
    const feature=JSON.parse(line),coordinates=feature.geometry?.coordinates;
    if(feature.geometry?.type!=='Point'||!Array.isArray(coordinates))continue;
    const lon=Number(coordinates[0]),lat=Number(coordinates[1]);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    const region=regionFor(city,lat,lon);
    if(!region)continue;
    counts.inside++;
    const number=normalizedNumber(feature.properties?.number);
    if(!number){counts.withoutNumber++;continue;}
    const street=String(feature.properties?.street||'').trim().replace(/\s+/g,' ').slice(0,140);
    const roundedLat=Number(lat.toFixed(6)),roundedLon=Number(lon.toFixed(6));
    const duplicateKey=`${region.id}|${roundedLat}|${roundedLon}|${number.toLocaleLowerCase('pt-BR')}|${street.toLocaleLowerCase('pt-BR')}`;
    if(dedupe.has(duplicateKey)){counts.duplicates++;continue;}
    dedupe.add(duplicateKey);
    const key=tileKey(roundedLat,roundedLon);
    if(!tiles.has(key))tiles.set(key,[]);
    tiles.get(key).push([uniqueId(feature.id),roundedLat,roundedLon,number,street,region.id]);
    counts.integrated++;
  }
}

fs.rmSync(outputDir,{recursive:true,force:true});
fs.mkdirSync(outputDir,{recursive:true});
for(const [baseName,city] of Object.entries(INPUTS)){
  await processFile(baseName,city);
  console.log(`${city}: concluido`);
}

const tileIndex={};
for(const [key,points] of [...tiles.entries()].sort(([a],[b])=>a.localeCompare(b,'en',{numeric:true}))){
  points.sort((a,b)=>a[1]-b[1]||a[2]-b[2]||a[3].localeCompare(b[3],'pt-BR',{numeric:true}));
  fs.writeFileSync(path.join(outputDir,`${key}.json`),JSON.stringify({v:1,points}));
  tileIndex[key]=points.length;
}

const metadata={
  version:1,
  release:RELEASE,
  generatedAt:new Date().toISOString(),
  cellSize:CELL_SIZE,
  source:'Overture Maps addresses / IBGE via AddressForAll',
  sourceUrl:'https://docs.overturemaps.org/attribution/',
  license:'CC0',
  total:counts.integrated,
  tiles:tileIndex
};
fs.writeFileSync(indexFile,`/* Gerado por scripts/generate-open-address-tiles.mjs. */\nconst openAddressTileIndex=${JSON.stringify(metadata)};\n`);
fs.writeFileSync(path.join(outputDir,'README.md'),`# Endereços abertos

Os arquivos desta pasta são gerados por \`scripts/generate-open-address-tiles.mjs\`.

- Fonte: Overture Maps Foundation, tema \`addresses\`.
- Fonte original no Brasil: IBGE, distribuída por AddressForAll.
- Versão consultada: \`${RELEASE}\`.
- Licença informada para o Brasil: CC0.
- Atribuição e termos: https://docs.overturemaps.org/attribution/

Cada JSON representa uma célula de ${CELL_SIZE.toLocaleString('pt-BR')} grau e é carregado somente quando cruza o mapa visível. Os campos compactos são, nesta ordem: ID interno, latitude, longitude, número, rua e ID da região RoutePilot.

Registros sem número, fora dos contornos operacionais ou duplicados não são publicados.
`);
console.log(JSON.stringify({...counts,tiles:tiles.size},null,2));
