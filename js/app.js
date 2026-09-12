/* Recurso RoutePilot: inicialização da aplicação. */
const byRegion = Object.fromEntries(regions.map(r => [r.id, r]));
const byPoint = Object.fromEntries(points.map(p => [p.id, p]));
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`$`). */
const $ = id => document.getElementById(id);
const cityNames = {Pelotas:'Pelotas', 'Capao do Leao':'Capão do Leão', 'Morro Redondo':'Morro Redondo', Cangucu:'Canguçu', Cerrito:'Cerrito'};
const cityStyles={Pelotas:{initials:'PE',color:'#0089b0'},'Capao do Leao':{initials:'CL',color:'#228660'},'Morro Redondo':{initials:'MR',color:'#bf6252'},Cangucu:{initials:'CG',color:'#6579a5'},Cerrito:{initials:'CE',color:'#a63d78'}};
const state = {city:null, region:null, point:null, boundary:null, road:null, query:'', searchOpen:false, overview:false, compare:null,compareMode:'places',compareStops:[null,null],compareReady:false};
const history = [];
let pendingCityChoice=null;
let searchTimer;
let map;
let mapHidden=false;
let streetViewMode=false;
const regionLayers = {}, boundaryLayers = {}, markers = {}, labelRecords = [];
const layers = [];
/** Guia: Formata os dados para uso consistente em inicialização da aplicação (`clean`). */
const clean = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`esc`). */
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`cityName`). */
const cityName = city => cityNames[city] || city;
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`regionCode`). */
const regionCode = r => (r.name.match(/Zona\s*(\d+)/i) || [])[1] || regions.filter(x => x.city === r.city).findIndex(x => x.id === r.id) + 1;
/** Guia: Obtém o valor atual em inicialização da aplicação (`pointFor`). */
const pointFor = id => byPoint[id];
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`ruralPoint`). */
const ruralPoint=p=>p&&['localidade','distrito','centro','estrada'].includes(p.kind);
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`streetNames`). */
const streetNames = p => p.roads.split(',').map(s => s.trim()).filter(Boolean);
const boundaryById=Object.fromEntries(boundaries.features.map(f=>[f.properties.id,f]));
/** Desenha uma miniatura cartografica a partir dos limites reais cadastrados da cidade. */
function cityMapThumbnail(city){
  let rings=boundaries.features.filter(feature=>feature.properties.city===city).flatMap(feature=>feature.geometry.type==='Polygon'?[feature.geometry.coordinates[0]]:feature.geometry.coordinates.map(polygon=>polygon[0])).filter(ring=>ring.length>2);
  if(!rings.length)rings=regions.filter(region=>region.city===city&&Array.isArray(region.polygon)).map(region=>region.polygon.map(([lat,lng])=>[lng,lat]));
  if(!rings.length)return iconSvg('pin');
  const all=rings.flat(),xs=all.map(point=>point[0]),ys=all.map(point=>point[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),width=Math.max(maxX-minX,.0001),height=Math.max(maxY-minY,.0001),scale=Math.min(38/width,38/height),offsetX=(48-width*scale)/2,offsetY=(48-height*scale)/2;
  const paths=rings.map(ring=>{const step=Math.max(1,Math.ceil(ring.length/36)),sampled=ring.filter((_,index)=>index%step===0),last=ring[ring.length-1];if(sampled[sampled.length-1]!==last)sampled.push(last);return sampled.map((point,index)=>`${index?'L':'M'}${(offsetX+(point[0]-minX)*scale).toFixed(1)} ${(offsetY+(maxY-point[1])*scale).toFixed(1)}`).join(' ')+' Z';}).join(' ');
  return `<svg class="city-map-thumbnail" viewBox="0 0 48 48" aria-hidden="true"><path d="${paths}"></path><circle cx="24" cy="24" r="2.5"></circle></svg>`;
}
/** Guia: Obtém o valor atual em inicialização da aplicação (`boundaryForPoint`). */
const boundaryForPoint=p=>p && boundaries.features.find(f=>f.properties.pointId===p.id);
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`linkedPoint`). */
const linkedPoint=f=>pointFor(f.properties.pointId);
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`pointAliases`). */
const pointAliases=p=>[...new Set([p.name,...(p.aliases||[]),boundaryForPoint(p)?.properties.name].filter(Boolean))];
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`iconSvg`). */
function iconSvg(type) {
  const shapes=(mapIcons[type]||mapIcons.pin).map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([key,value])=>`${key}="${esc(value)}"`).join(' ')}></${tag}>`).join('');
  return `<svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes}</svg>`;
}
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`refType`). */
function refType(p) { return /shopping/i.test(p.name) ? 'shop' : /rodoviaria/i.test(p.name) ? 'bus' : /campus|ufpel|embrapa/i.test(p.name) ? 'campus' : 'pin'; }
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`referenceAppearance`). */
function referenceAppearance(p) {
  const kind=p.type||(refType(p)==='campus'?'school':refType(p));
  const appearance=detailKinds[kind]||detailKinds.landmark;
  return /museu/i.test(p.name)?{...appearance,icon:'civic'}:appearance;
}
/** Guia: Executa uma etapa auxiliar em inicialização da aplicação (`referenceIcon`). */
function referenceIcon(p,marker=false) {
  const appearance=referenceAppearance(p);
  const badge=`<span class="${marker?'reference-pin':'category-icon'}" style="--icon-ink:${appearance.color};--icon-tint:${appearance.tint}" aria-hidden="true">${iconSvg(appearance.icon)}</span>`;
  return marker?`<div class="reference-hit">${badge}</div>`:badge;
}
