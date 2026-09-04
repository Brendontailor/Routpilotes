import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(process.argv[2]||'outputs');
const failures=[];
const context={console:{groupCollapsed(){},groupEnd(){},info(){},warn(){},error(){}}};
vm.createContext(context);

for(const file of ['regions.js','locations.js','routes.js','boundaries.js','map-details.js','v2-metadata.js','priority-areas.js','coab-duque-addresses.js','osm-address-snapshot.js','open-address-tiles-index.js','routing-index.js']){
  const source=fs.readFileSync(path.join(root,'data',file),'utf8').replace(/^const /gm,'var ');
  vm.runInContext(source,context,{filename:file});
}

const {regions,points,boundaries,mapDetails,priorityMapAreas,verifiedAddressPoints,osmAddressSnapshot,openAddressTileIndex,localRoutingIndex}=context;
const duplicate=values=>[...new Set(values.filter((value,index)=>values.indexOf(value)!==index))];
const regionIds=new Set(regions.map(item=>item.id));
const pointIds=new Set(points.map(item=>item.id));
const validCoordinate=(lat,lng)=>Number.isFinite(lat)&&lat>=-90&&lat<=90&&Number.isFinite(lng)&&lng>=-180&&lng<=180;

duplicate(regions.map(item=>item.id)).forEach(id=>failures.push(`duplicate region id: ${id}`));
duplicate(points.map(item=>item.id)).forEach(id=>failures.push(`duplicate point id: ${id}`));
duplicate(boundaries.features.map(item=>item.properties.id)).forEach(id=>failures.push(`duplicate boundary id: ${id}`));
for(const region of regions){
  if(!validCoordinate(...region.center))failures.push(`invalid region center: ${region.id}`);
  for(const id of region.nearby||[])if(!regionIds.has(id))failures.push(`invalid nearby region: ${region.id}/${id}`);
}
for(const point of points){
  if(!regionIds.has(point.region))failures.push(`invalid point region: ${point.id}/${point.region}`);
  if(!validCoordinate(point.lat,point.lon))failures.push(`invalid point coordinates: ${point.id}`);
  for(const id of point.nearby||[])if(!pointIds.has(id))failures.push(`invalid nearby point: ${point.id}/${id}`);
  if(!Array.isArray(point.aliases)||!point.access||!Array.isArray(point.notes)||!point.dataQuality)failures.push(`missing V2 defaults: ${point.id}`);
}
duplicate(verifiedAddressPoints.map(item=>item.id)).forEach(id=>failures.push(`duplicate verified address id: ${id}`));
for(const item of verifiedAddressPoints){
  if(!validCoordinate(item.lat,item.lon))failures.push(`invalid verified address coordinates: ${item.id}`);
  if(!priorityMapAreas.some(area=>area.id===item.areaId))failures.push(`invalid verified address area: ${item.id}/${item.areaId}`);
  if(!['house','block'].includes(item.kind))failures.push(`invalid verified address kind: ${item.id}/${item.kind}`);
}
duplicate(priorityMapAreas.map(item=>item.id)).forEach(id=>failures.push(`duplicate priority area id: ${id}`));
for(const area of priorityMapAreas)if(!validCoordinate(...area.center))failures.push(`invalid priority area center: ${area.id}`);
duplicate(osmAddressSnapshot.points.map(item=>item.id)).forEach(id=>failures.push(`duplicate snapshot address id: ${id}`));
for(const item of osmAddressSnapshot.points){
  if(!validCoordinate(item.lat,item.lon))failures.push(`invalid snapshot address coordinates: ${item.id}`);
  if(!regionIds.has(item.region))failures.push(`invalid snapshot address region: ${item.id}/${item.region}`);
  if(!item.label)failures.push(`snapshot address without number: ${item.id}`);
}

const openAddressIds=new Set();
let openAddressCount=0;
for(const [key,expectedCount] of Object.entries(openAddressTileIndex.tiles||{})){
  const tileFile=path.join(root,'data','open-address-tiles',`${key}.json`);
  if(!fs.existsSync(tileFile)){failures.push(`missing open address tile: ${key}`);continue;}
  let tile;
  try{tile=JSON.parse(fs.readFileSync(tileFile,'utf8'));}
  catch(error){failures.push(`invalid open address tile ${key}: ${error.message}`);continue;}
  if(!Array.isArray(tile.points)){failures.push(`open address tile without points: ${key}`);continue;}
  if(tile.points.length!==expectedCount)failures.push(`open address tile count mismatch: ${key}`);
  for(const item of tile.points){
    const [id,lat,lng,number,,regionId]=item;
    openAddressCount++;
    if(openAddressIds.has(id))failures.push(`duplicate open address id: ${id}`);
    openAddressIds.add(id);
    if(!validCoordinate(lat,lng))failures.push(`invalid open address coordinates: ${id}`);
    if(!number)failures.push(`open address without number: ${id}`);
    if(!regionIds.has(regionId))failures.push(`invalid open address region: ${id}/${regionId}`);
  }
}
if(openAddressCount!==openAddressTileIndex.total)failures.push(`open address total mismatch: ${openAddressCount}/${openAddressTileIndex.total}`);

let routingAddressCount=0;
const roadNetworkFile=path.join(root,localRoutingIndex.roadNetworkFile);
const streetCatalogFile=path.join(root,localRoutingIndex.streetCatalogFile);
if(!fs.existsSync(roadNetworkFile))failures.push('missing local road network');
if(!fs.existsSync(streetCatalogFile))failures.push('missing local street catalog');
if(fs.existsSync(roadNetworkFile)){
  const network=JSON.parse(fs.readFileSync(roadNetworkFile,'utf8'));
  if(network.nodes.length!==localRoutingIndex.nodes)failures.push(`routing node count mismatch: ${network.nodes.length}/${localRoutingIndex.nodes}`);
  if(network.edges.length!==localRoutingIndex.edges)failures.push(`routing edge count mismatch: ${network.edges.length}/${localRoutingIndex.edges}`);
  for(const [from,to,meters,flags] of network.edges){
    if(!network.nodes[from]||!network.nodes[to]){failures.push(`routing edge with invalid node: ${from}/${to}`);break;}
    if(!Number.isFinite(meters)||meters<=0||![1,2,3].includes(flags)){failures.push(`invalid routing edge: ${from}/${to}`);break;}
  }
}
for(let index=0;index<localRoutingIndex.addressShards;index++){
  const shardName=index.toString(16).padStart(2,'0'),shardFile=path.join(root,'data','routing',`addresses-${shardName}.json`);
  if(!fs.existsSync(shardFile)){failures.push(`missing local address shard: ${shardName}`);continue;}
  const shard=JSON.parse(fs.readFileSync(shardFile,'utf8'));
  for(const [,addresses] of Object.values(shard.streets||{}))for(const address of addresses){
    routingAddressCount++;
    if(!regionIds.has(address[3])){failures.push(`routing address with invalid region: ${address[3]}`);break;}
  }
}
if(routingAddressCount!==localRoutingIndex.addresses)failures.push(`routing address count mismatch: ${routingAddressCount}/${localRoutingIndex.addresses}`);

const cascatas=points.filter(point=>point.name==='Cascata');
if(cascatas.length!==2)failures.push(`expected 2 Cascata points, found ${cascatas.length}`);
if(!pointIds.has('pelotas_cascata'))failures.push('pelotas_cascata is missing');
if(!pointIds.has('morro_redondo_cascata'))failures.push('morro_redondo_cascata is missing');

const unresolved=[
  ...regions.flatMap(region=>(region.nearbyText||[]).map(text=>({owner:region.id,text}))),
  ...points.flatMap(point=>(point.nearbyText||[]).map(text=>({owner:point.id,text}))),
];

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const htmlIds=[...index.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
duplicate(htmlIds).forEach(id=>failures.push(`duplicate HTML id: ${id}`));

const htmlAssets=[...index.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]).filter(asset=>!asset.startsWith('http')&&!asset.startsWith('#'));
for(const asset of htmlAssets)if(!fs.existsSync(path.resolve(root,asset)))failures.push(`missing HTML asset: ${asset}`);

const css=fs.readFileSync(path.join(root,'css','routepilot.css'),'utf8');
const cssAssets=[...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match=>match[1]).filter(asset=>!asset.startsWith('data:')&&!asset.startsWith('http'));
for(const asset of cssAssets)if(!fs.existsSync(path.resolve(root,'css',asset)))failures.push(`missing CSS asset: ${asset}`);

let manifest;
try { manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8')); } catch(error) { failures.push(`invalid manifest: ${error.message}`); }
for(const icon of manifest?.icons||[])if(!fs.existsSync(path.resolve(root,icon.src)))failures.push(`missing manifest icon: ${icon.src}`);
if(manifest?.start_url!=='./')failures.push(`unexpected manifest start_url: ${manifest?.start_url}`);

const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const shellAssets=[...serviceWorker.matchAll(/\s+'\.\/([^']+)'/g)].map(match=>match[1]);
for(const asset of shellAssets)if(!fs.existsSync(path.resolve(root,asset)))failures.push(`missing service worker asset: ${asset}`);
if(!serviceWorker.includes("routepilot-shell-v17"))failures.push('service worker cache is not v17');
if(/tile\.openstreetmap\.org/.test(serviceWorker))failures.push('service worker must not mass-cache OSM tiles');

const requiredV2=['config.js','notes-storage.js','area-inspector.js','area-intelligence.js','radius-search.js','address-radius.js','sharing.js','map-point-actions.js','notes-ui.js','data-review.js','open-address-tiles.js','local-routing.js'];
for(const file of requiredV2)if(!index.includes(`js/${file}`))failures.push(`V2 script not loaded: ${file}`);

const report={
  root,
  counts:{cities:new Set(regions.map(item=>item.city)).size,regions:regions.length,points:points.length,boundaries:boundaries.features.length,references:mapDetails.pois.length,priorityAreas:priorityMapAreas.length,verifiedAddresses:verifiedAddressPoints.length,snapshotAddresses:osmAddressSnapshot.points.length,openAddresses:openAddressCount,openAddressTiles:Object.keys(openAddressTileIndex.tiles||{}).length,routingNodes:localRoutingIndex.nodes,routingEdges:localRoutingIndex.edges,routingAddresses:routingAddressCount},
  cascatas:cascatas.map(point=>({id:point.id,city:point.city,region:point.region})),
  informativeNearby:unresolved.length,
  checked:{htmlAssets:htmlAssets.length,cssAssets:cssAssets.length,serviceWorkerAssets:shellAssets.length,htmlIds:htmlIds.length},
  manifest:{name:manifest?.name,start_url:manifest?.start_url,icons:manifest?.icons?.length||0},
  serviceWorkerCache:serviceWorker.match(/CACHE_NAME='([^']+)'/)?.[1]||null,
  failures
};

console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
