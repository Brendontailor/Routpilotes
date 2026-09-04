/* Recurso RoutePilot: geração da malha de roteamento local. */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import vm from 'node:vm';

const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/(.:)/,'$1'));
const inputFile=path.resolve(process.argv[2]||path.join(process.env.TEMP||'.','routepilot-overture-data','roads.geojsonseq'));
const outputDir=path.join(root,'data','routing');
const RELEASE='2026-08-19.0';
const MAX_EDGE_METERS=120;
const ADDRESS_SHARDS=64;
const ALLOWED_CLASSES=new Set(['motorway','trunk','primary','secondary','tertiary','residential','living_street','unclassified','service','track','unknown']);
const EXCLUDED_SUBCLASSES=new Set(['sidewalk','crosswalk']);

const context={};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync(path.join(root,'data','regions.js'),'utf8')};globalThis.routePilotRegions=regions`,context);
const regions=context.routePilotRegions;
const regionById=new Map(regions.map(region=>[region.id,region]));

/** Guia: Executa uma etapa auxiliar em geração da malha de roteamento local (`radians`). */
function radians(value){return value*Math.PI/180;}
/** Guia: Calcula o resultado solicitado em geração da malha de roteamento local (`distanceMeters`). */
function distanceMeters(a,b){
  const dlat=radians(b[1]-a[1]),dlon=radians(b[0]-a[0]);
  const h=Math.sin(dlat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(dlon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
/** Guia: Executa uma etapa auxiliar em geração da malha de roteamento local (`interpolate`). */
function interpolate(a,b,ratio){return [a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio];}
/** Guia: Formata os dados para uso consistente em geração da malha de roteamento local (`clean`). */
function clean(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
/** Guia: Executa uma etapa auxiliar em geração da malha de roteamento local (`hash`). */
function hash(value){
  let result=2166136261;
  for(let index=0;index<value.length;index++){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}
  return result>>>0;
}

/** Guia: Executa uma etapa auxiliar em geração da malha de roteamento local (`roadDirections`). */
function roadDirections(properties){
  let forward=true,reverse=true;
  for(const rule of properties.access_restrictions||[]){
    if(rule.access_type!=='denied')continue;
    const when=rule.when||{};
    const modes=when.mode||null;
    const appliesToCar=!modes||modes.includes('motor_vehicle')||modes.includes('vehicle');
    const conditional=when.during||when.using||when.recognized||when.vehicle;
    if(!appliesToCar||conditional)continue;
    if(when.heading==='forward')forward=false;
    else if(when.heading==='backward')reverse=false;
    else forward=reverse=false;
  }
  return (forward?1:0)|(reverse?2:0);
}

/** Guia: Verifica as condições necessárias em geração da malha de roteamento local (`usableRoad`). */
function usableRoad(feature){
  const properties=feature.properties||{};
  if(properties.subtype!=='road'||!ALLOWED_CLASSES.has(properties.class)||EXCLUDED_SUBCLASSES.has(properties.subclass))return false;
  const flags=(properties.road_flags||[]).flatMap(rule=>rule.values||[]);
  return !flags.includes('is_under_construction')&&!flags.includes('is_abandoned')&&roadDirections(properties)!==0;
}

/** Guia: Monta a estrutura necessária em geração da malha de roteamento local (`prepareSegment`). */
function prepareSegment(feature){
  const source=feature.geometry?.coordinates||[];
  if(source.length<2)return null;
  const cumulative=[0];
  for(let index=1;index<source.length;index++)cumulative.push(cumulative[index-1]+distanceMeters(source[index-1],source[index]));
  const total=cumulative.at(-1);
  if(!total)return null;
  const entries=source.map((coordinate,index)=>({at:cumulative[index]/total,coordinate,connectorId:null}));
  // Conectores unem segmentos diferentes; pontos intermediários limitam arestas longas.
  for(const connector of feature.properties.connectors||[]){
    const at=Math.max(0,Math.min(1,Number(connector.at)));
    let segmentIndex=1;
    while(segmentIndex<cumulative.length&&cumulative[segmentIndex]/total<at)segmentIndex++;
    const before=Math.max(0,segmentIndex-1),span=cumulative[segmentIndex]-cumulative[before];
    const target=at*total,ratio=span?(target-cumulative[before])/span:0;
    entries.push({at,coordinate:interpolate(source[before],source[segmentIndex],ratio),connectorId:connector.connector_id});
  }
  entries.sort((a,b)=>a.at-b.at||Number(Boolean(b.connectorId))-Number(Boolean(a.connectorId)));
  const merged=[];
  for(const entry of entries){
    const previous=merged.at(-1);
    if(previous&&Math.abs(previous.at-entry.at)<1e-10){if(entry.connectorId)Object.assign(previous,entry);continue;}
    merged.push(entry);
  }
  const sampled=[];
  for(let index=0;index<merged.length-1;index++){
    const start=merged[index],end=merged[index+1],meters=distanceMeters(start.coordinate,end.coordinate);
    sampled.push(start);
    const steps=Math.ceil(meters/MAX_EDGE_METERS);
    for(let step=1;step<steps;step++)sampled.push({at:start.at+(end.at-start.at)*step/steps,coordinate:interpolate(start.coordinate,end.coordinate,step/steps),connectorId:null});
  }
  sampled.push(merged.at(-1));
  return {id:feature.id,flags:roadDirections(feature.properties),entries:sampled};
}

const nodes=[];
const edges=[];
const connectorNodes=new Map();
let roadFeatures=0;

/** Guia: Registra um novo item em geração da malha de roteamento local (`addNode`). */
function addNode(coordinate,connectorId,segmentId,index){
  if(connectorId&&connectorNodes.has(connectorId))return connectorNodes.get(connectorId);
  const nodeIndex=nodes.length;
  nodes.push([Math.round(coordinate[1]*1e6),Math.round(coordinate[0]*1e6)]);
  if(connectorId)connectorNodes.set(connectorId,nodeIndex);
  return nodeIndex;
}

if(!fs.existsSync(inputFile))throw new Error(`Malha viaria ausente: ${inputFile}`);
const lines=readline.createInterface({input:fs.createReadStream(inputFile,{encoding:'utf8'}),crlfDelay:Infinity});
for await(const line of lines){
  if(!line.trim())continue;
  const feature=JSON.parse(line);
  if(!usableRoad(feature))continue;
  const segment=prepareSegment(feature);
  if(!segment)continue;
  roadFeatures++;
  let previous=null;
  segment.entries.forEach((entry,index)=>{
    const current=addNode(entry.coordinate,entry.connectorId,segment.id,index);
    if(previous!==null&&previous!==current){
      const meters=Math.max(1,Math.round(distanceMeters([nodes[previous][1]/1e6,nodes[previous][0]/1e6],[nodes[current][1]/1e6,nodes[current][0]/1e6])));
      edges.push([previous,current,meters,segment.flags]);
    }
    previous=current;
  });
}

const streets=new Map();
const addressDir=path.join(root,'data','open-address-tiles');
for(const file of fs.readdirSync(addressDir).filter(file=>file.endsWith('.json'))){
  const tile=JSON.parse(fs.readFileSync(path.join(addressDir,file),'utf8'));
  for(const item of tile.points||[]){
    const [,lat,lon,number,street,regionId]=item,normalized=clean(street);
    if(!normalized||!number||!regionById.has(regionId))continue;
    if(!streets.has(normalized))streets.set(normalized,{name:street,addresses:[],seen:new Set()});
    const record=streets.get(normalized),key=`${clean(number)}|${lat}|${lon}|${regionId}`;
    if(record.seen.has(key))continue;
    record.seen.add(key);record.addresses.push([String(number),Math.round(lat*1e6),Math.round(lon*1e6),regionId]);
  }
}

fs.rmSync(outputDir,{recursive:true,force:true});
fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(path.join(outputDir,'road-network.json'),JSON.stringify({v:1,nodes,edges}));

const shards=Array.from({length:ADDRESS_SHARDS},()=>({v:1,streets:{}}));
const catalog=[];
// O hash mantém cada rua sempre no mesmo fragmento, sem carregar toda a base.
for(const [normalized,record] of [...streets.entries()].sort(([a],[b])=>a.localeCompare(b,'pt-BR'))){
  const shard=(hash(normalized)%ADDRESS_SHARDS).toString(16).padStart(2,'0');
  record.addresses.sort((a,b)=>a[0].localeCompare(b[0],'pt-BR',{numeric:true})||a[1]-b[1]||a[2]-b[2]);
  shards[Number.parseInt(shard,16)].streets[normalized]=[record.name,record.addresses];
  catalog.push([normalized,record.name,shard]);
}
fs.writeFileSync(path.join(outputDir,'address-streets.json'),JSON.stringify({v:1,streets:catalog}));
shards.forEach((shard,index)=>fs.writeFileSync(path.join(outputDir,`addresses-${index.toString(16).padStart(2,'0')}.json`),JSON.stringify(shard)));

const metadata={
  version:1,release:RELEASE,generatedAt:new Date().toISOString(),source:'Overture Maps transportation / OpenStreetMap and TomTom',
  sourceUrl:'https://docs.overturemaps.org/attribution/',license:'ODbL-1.0',roadFeatures,nodes:nodes.length,edges:edges.length,
  streets:catalog.length,addresses:[...streets.values()].reduce((sum,item)=>sum+item.addresses.length,0),addressShards:ADDRESS_SHARDS,
  roadNetworkFile:'data/routing/road-network.json',streetCatalogFile:'data/routing/address-streets.json'
};
fs.writeFileSync(path.join(root,'data','routing-index.js'),`/* Gerado por scripts/generate-local-routing-data.mjs. */\nconst localRoutingIndex=${JSON.stringify(metadata)};\n`);
fs.writeFileSync(path.join(outputDir,'README.md'),`# Roteamento local\n\nDados gerados por \`scripts/generate-local-routing-data.mjs\` para cálculo de distância por vias dentro do navegador.\n\n- Fonte da malha viária: Overture Maps Foundation, tema \`transportation\`; fontes declaradas no recorte: OpenStreetMap e TomTom.\n- Versão: \`${RELEASE}\`.\n- Licença declarada no recorte: ODbL 1.0.\n- Atribuição: https://docs.overturemaps.org/attribution/\n\nO arquivo \`road-network.json\` é carregado somente ao calcular uma rota. O catálogo e os 64 fragmentos de endereços locais também são carregados sob demanda. Nenhuma consulta de roteamento ou geocodificação é enviada a terceiros.\n`);
console.log(JSON.stringify(metadata,null,2));
