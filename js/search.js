function calcularDistanciaEdicao(a,b) {
  let previous = Array.from({length:b.length+1}, (_,i) => i);
  for(let i=1;i<=a.length;i++) {
    const row = [i];
    for(let j=1;j<=b.length;j++) row[j] = Math.min(row[j-1]+1, previous[j]+1, previous[j-1]+(a[i-1]!==b[j-1]));
    previous = row;
  }
  return previous[b.length];
}
function pontuarTexto(name, context, query) {
  const q = clean(query), n = clean(name), full = clean(name+' '+context);
  if(!q) return 0;
  if(n === q) return 120;
  if(n.startsWith(q)) return 108;
  if(n.includes(q)) return 100;
  const terms = q.split(' '), words = full.split(' '), nameWords=n.split(' ');
  const correspondenciaAproximada=(termo,palavra)=>palavra===termo||(termo.length>=4&&calcularDistanciaEdicao(termo,palavra)<=(termo.length>=8?2:1));
  if(terms.every(t=>nameWords.some(w=>w.startsWith(t)))) return 96;
  if(terms.every(t=>nameWords.some(w=>correspondenciaAproximada(t,w)))) return 90;
  if(terms.every(t => words.some(w => w.startsWith(t)))) return 85;
  if(terms.every(t => words.some(w => correspondenciaAproximada(t,w)))) return 65;
  return 0;
}
const INDICE_PESQUISA = [
  ...(typeof priorityMapAreas!=='undefined'?priorityMapAreas.map(area=>({kind:'priority',id:area.id,name:area.name,city:area.city,region:null,context:`${area.city} área verificada`,sub:'Área com números verificados'})):[]),
  ...regions.map(r => ({kind:'region', id:r.id, name:r.name, city:r.city, region:r.id, context:r.city, sub:'Região '+regionCode(r)})),
  ...points.map(p => ({kind:'point', id:p.id, name:p.name, aliases:pointAliases(p), city:p.city, region:p.region, context:p.city+' '+byRegion[p.region].name, sub:p.kind === 'referencia' ? 'Referência' : 'Bairro / localidade'})),
  ...boundaries.features.filter(f=>!linkedPoint(f)).map(f=>({kind:'boundary',id:f.properties.id,name:f.properties.name,city:f.properties.city,region:f.properties.region,context:f.properties.city,sub:'Contorno · '+f.properties.category+' · '+f.properties.source})),
  ...points.flatMap(p => streetNames(p).map(road => ({kind:'road', id:p.id, name:road, city:p.city, region:p.region, context:p.city+' '+p.name, sub:'Via / acesso · '+p.name}))),
  ...regions.flatMap(r => r.roads.map(road => ({kind:'road', id:'', name:road, city:r.city, region:r.id, context:r.city+' '+r.name, sub:'Via / acesso · '+r.name})))
];
/** Pesquisa cidades, regiões, localidades e vias com tolerância a pequenas diferenças. */
function searchAll(query) {
  const seen = new Set();
  return INDICE_PESQUISA.map(e => ({...e,score:Math.max(...(e.aliases||[e.name]).map(n=>pontuarTexto(n,e.context,query)))})).filter(e => {
    const key = [e.kind,e.name,e.id,e.region].join('|');
    if(!e.score || seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b) => b.score-a.score || (a.kind==='road')-(b.kind==='road') || a.name.length-b.name.length || a.name.localeCompare(b.name,'pt-BR')).slice(0,CONFIGURACAO_PESQUISA.limiteResultados);
}
function actionButton(action, value, title, subtitle='', extra='') {
  const city=action==='city'?cityStyles[value]:null;
  return `<button type="button" class="nav-row ${city?'city-option':''}" data-action="${action}" data-value="${esc(value)}" ${extra}>${city?`<span class="city-monogram" style="--city-color:${city.color}" aria-hidden="true">${city.initials}</span>`:''}<span class="nav-copy">${esc(title)}${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</span><span class="chevron" aria-hidden="true">›</span></button>`;
}
function nearButtons(ids=[], unresolved=[]) {
  const linked=ids.map(id=>{
    const region=byRegion[id],point=pointFor(id);
    if(region)return `<button data-action="region" data-value="${esc(region.id)}">${esc(region.name)}</button>`;
    if(point)return `<button data-action="point" data-value="${esc(point.id)}">${esc(point.name)}</button>`;
    return `<span class="near-unmapped">${esc(id)} <small>(ID não encontrado)</small></span>`;
  });
  const informative=unresolved.map(name=>`<span class="near-unmapped">${esc(name)} <small>(sem ponto cadastrado)</small></span>`);
  return [...linked,...informative].join('');
}
