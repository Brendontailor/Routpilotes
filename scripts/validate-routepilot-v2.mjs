import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(process.argv[2]||'outputs');
const failures=[];
const context={console:{groupCollapsed(){},groupEnd(){},info(){},warn(){},error(){}}};
vm.createContext(context);

for(const file of ['regions.js','locations.js','routes.js','boundaries.js','map-details.js','v2-metadata.js']){
  const source=fs.readFileSync(path.join(root,'data',file),'utf8').replace(/^const /,'var ');
  vm.runInContext(source,context,{filename:file});
}

const {regions,points,boundaries,mapDetails}=context;
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
if(!serviceWorker.includes("routepilot-shell-v6"))failures.push('service worker cache is not v6');
if(/tile\.openstreetmap\.org/.test(serviceWorker))failures.push('service worker must not mass-cache OSM tiles');

const requiredV2=['notes-storage.js','area-inspector.js','area-intelligence.js','radius-search.js','sharing.js','notes-ui.js','data-review.js'];
for(const file of requiredV2)if(!index.includes(`js/${file}`))failures.push(`V2 script not loaded: ${file}`);

const report={
  root,
  counts:{cities:new Set(regions.map(item=>item.city)).size,regions:regions.length,points:points.length,boundaries:boundaries.features.length,references:mapDetails.pois.length},
  cascatas:cascatas.map(point=>({id:point.id,city:point.city,region:point.region})),
  informativeNearby:unresolved.length,
  checked:{htmlAssets:htmlAssets.length,cssAssets:cssAssets.length,serviceWorkerAssets:shellAssets.length,htmlIds:htmlIds.length},
  manifest:{name:manifest?.name,start_url:manifest?.start_url,icons:manifest?.icons?.length||0},
  serviceWorkerCache:serviceWorker.match(/CACHE_NAME='([^']+)'/)?.[1]||null,
  failures
};

console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
