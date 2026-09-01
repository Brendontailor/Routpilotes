const byRegion = Object.fromEntries(regions.map(r => [r.id, r]));
const byPoint = Object.fromEntries(points.map(p => [p.id, p]));
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
const clean = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cityName = city => cityNames[city] || city;
const regionCode = r => (r.name.match(/Zona\s*(\d+)/i) || [])[1] || regions.filter(x => x.city === r.city).findIndex(x => x.id === r.id) + 1;
const pointFor = id => byPoint[id];
const ruralPoint=p=>p&&['localidade','distrito','centro','estrada'].includes(p.kind);
const streetNames = p => p.roads.split(',').map(s => s.trim()).filter(Boolean);
const boundaryById=Object.fromEntries(boundaries.features.map(f=>[f.properties.id,f]));
const boundaryForPoint=p=>p && boundaries.features.find(f=>f.properties.pointId===p.id);
const linkedPoint=f=>pointFor(f.properties.pointId);
const pointAliases=p=>[...new Set([p.name,...(p.aliases||[]),boundaryForPoint(p)?.properties.name].filter(Boolean))];
function iconSvg(type) {
  const shapes=(mapIcons[type]||mapIcons.pin).map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([key,value])=>`${key}="${esc(value)}"`).join(' ')}></${tag}>`).join('');
  return `<svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes}</svg>`;
}
function refType(p) { return /shopping/i.test(p.name) ? 'shop' : /rodoviaria/i.test(p.name) ? 'bus' : /campus|ufpel|embrapa/i.test(p.name) ? 'campus' : 'pin'; }
function referenceAppearance(p) {
  const kind=p.type||(refType(p)==='campus'?'school':refType(p));
  const appearance=detailKinds[kind]||detailKinds.landmark;
  return /museu/i.test(p.name)?{...appearance,icon:'civic'}:appearance;
}
function referenceIcon(p,marker=false) {
  const appearance=referenceAppearance(p);
  const badge=`<span class="${marker?'reference-pin':'category-icon'}" style="--icon-ink:${appearance.color};--icon-tint:${appearance.tint}" aria-hidden="true">${iconSvg(appearance.icon)}</span>`;
  return marker?`<div class="reference-hit">${badge}</div>`:badge;
}
