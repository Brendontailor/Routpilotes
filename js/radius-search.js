let radiusSearchContext=null;
let radiusSearchKm=5;
let radiusSearchLayer=null;
let radiusSearchToken=0;

function openAroundArea(context=areaUnderstandingContext||currentAreaContext()) {
  if(!context)return;
  cancelMapInteraction('around');
  areaPanelMode='radius';radiusSearchContext=context;
  mapHidden=false;renderLayout();renderAreaInspector();calculateAroundArea(radiusSearchKm);
  renderDesktopShell();
}

function clearRadiusSearch({close=false}={}) {
  radiusSearchToken++;
  if(radiusSearchLayer&&map){map.removeLayer(radiusSearchLayer);radiusSearchLayer=null;}
  if(close){radiusSearchContext=null;areaPanelMode=identifiedArea?'identify':'none';renderAreaInspector();if(typeof renderDesktopShell==='function')renderDesktopShell();}
}

function renderRadiusPanel(panel) {
  if(areaPanelMode!=='radius'||!radiusSearchContext)return false;
  panel.hidden=false;
  panel.innerHTML=`<p class="panel-intro">Consulte locais e referências a partir do ponto selecionado.</p><div class="radius-options" role="group" aria-label="Raio da consulta">${[2,5,10,20].map(km=>`<button type="button" data-action="setRadius" data-value="${km}" aria-pressed="${radiusSearchKm===km}">${km} km</button>`).join('')}<label>Personalizado <input id="customRadius" type="number" min="1" max="100" step="1" value="${radiusSearchKm}"> km</label><button type="button" data-action="customRadius">Aplicar</button></div>
    <p class="straight-line-note">Distâncias em linha reta, calculadas localmente.</p>
    <div id="radiusResults" class="radius-results" aria-live="polite"><p class="empty">Calculando...</p></div>
    <div class="inspector-actions"><button type="button" data-action="clearRadius">Limpar raio</button><button type="button" data-action="shareArea">Compartilhar</button></div>`;
  return true;
}

function radiusCandidates(context,maxKm) {
  const origin=[context.lat,context.lng],items=[];
  points.filter(point=>point.kind!=='referencia').forEach(point=>{
    const km=distanceKm(origin,[point.lat,point.lon]);
    if(km<=maxKm)items.push({kind:'point',id:point.id,name:point.name,city:point.city,region:point.region,km,sub:'Bairro / localidade'});
  });
  (mapDetails.pois||[]).forEach(reference=>{
    const km=distanceKm(origin,[reference.lat,reference.lon]);
    if(km<=maxKm)items.push({kind:'reference',id:reference.id,name:reference.name,city:regionAtCoordinates(reference.lat,reference.lon)?.city||null,region:regionAtCoordinates(reference.lat,reference.lon)?.id||null,km,sub:'Referência'});
  });
  regions.forEach(region=>{
    if(regionContainsPoint(region,context.lat,context.lng))return;
    const km=distanceKm(origin,region.center);
    if(km<=maxKm)items.push({kind:'region',id:region.id,name:region.name,city:region.city,region:region.id,km,sub:'Região operacional'});
  });
  return items.sort((a,b)=>a.km-b.km||a.name.localeCompare(b.name,'pt-BR'));
}

async function calculateAroundArea(km) {
  if(!radiusSearchContext)return;
  radiusSearchKm=Math.max(1,Math.min(100,Number(km)||5));
  const token=++radiusSearchToken;
  if(radiusSearchLayer&&map)map.removeLayer(radiusSearchLayer);
  if(map){
    radiusSearchLayer=L.circle([radiusSearchContext.lat,radiusSearchContext.lng],{radius:radiusSearchKm*1000,color:'#079bbb',weight:2,fillColor:'#079bbb',fillOpacity:.08,dashArray:'7 5'}).addTo(map);
    map.flyToBounds(radiusSearchLayer.getBounds(),{padding:[30,30],maxZoom:15,duration:.4});
  }
  const panel=$('areaInspector');
  if(!renderRadiusPanel(panel))return;
  const items=radiusCandidates(radiusSearchContext,radiusSearchKm);
  let notes=[];
  try { notes=(await getNearbyNotes(radiusSearchContext.lat,radiusSearchContext.lng,radiusSearchKm*1000)).filter(note=>note.status==='validated'); } catch(error) {}
  if(token!==radiusSearchToken)return;
  const target=$('radiusResults');
  if(!target)return;
  const knownRows=items.slice(0,80).map((item,index)=>`<button type="button" class="radius-row" data-action="radiusResult" data-kind="${item.kind}" data-value="${esc(item.id)}"><span>${index+1}</span><b>${esc(item.name)}</b><small>${esc(item.sub)}${item.city?' · '+esc(cityName(item.city)):''}</small><strong>${distanceLabel(item.km)}</strong></button>`).join('');
  const noteRows=notes.map(note=>`<div class="radius-row operational-note"><span>✓</span><b>${esc(note.text)}</b><small>Informação operacional validada</small><strong>${distanceLabel(note.distanceKm)}</strong></div>`).join('');
  target.innerHTML=`<div class="section-title">DENTRO DE ${radiusSearchKm.toLocaleString('pt-BR')} KM <span>${items.length+notes.length}</span></div>${knownRows||'<p class="empty">Nenhum local cadastrado dentro deste raio.</p>'}${noteRows?`<div class="section-title">CONHECIMENTO VALIDADO <span>${notes.length}</span></div>${noteRows}`:''}`;
}

function setRadius(value) { calculateAroundArea(value); }

function applyCustomRadius() {
  const input=$('customRadius');
  if(input)calculateAroundArea(input.value);
}

function openRadiusResult(kind,id) {
  if(kind==='point')selectPoint(id);
  else if(kind==='region')selectRegion(id);
  else if(kind==='reference')openDetailPoi(id);
}
