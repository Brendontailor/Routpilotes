let areaPanelMode='identify';
let areaUnderstandingContext=null;

const accessLabels={
  type:{urban:'Área urbana',rural:'Área rural',highway:'Rodovia',mixed:'Área mista',unknown:'Não informado'},
  surface:{asphalt:'Asfalto',paved:'Pavimentada',unpaved:'Estrada de chão',mixed:'Mista',unknown:'Não informado'},
  difficulty:{easy:'Fácil',medium:'Média',difficult:'Difícil',unknown:'Não informado'},
  confidence:{high:'Alta',medium:'Média',approximate:'Aproximada',unknown:'Não informado'}
};

function currentAreaContext() {
  if(identifiedArea)return {kind:'coordinate',lat:identifiedArea.lat,lng:identifiedArea.lng,city:identifiedArea.city,region:identifiedArea.region,point:identifiedArea.nearestPoint?.item||null,name:identifiedArea.region?.name||'Ponto identificado'};
  const point=pointFor(state.point),region=byRegion[state.region];
  if(point)return {kind:'point',lat:point.lat,lng:point.lon,city:point.city,region,point,name:point.name};
  if(region)return {kind:'region',lat:region.center[0],lng:region.center[1],city:region.city,region,point:null,name:region.name};
  if(state.city){
    const cityRegions=regions.filter(item=>item.city===state.city);
    if(!cityRegions.length)return null;
    const lat=cityRegions.reduce((sum,item)=>sum+item.center[0],0)/cityRegions.length;
    const lng=cityRegions.reduce((sum,item)=>sum+item.center[1],0)/cityRegions.length;
    return {kind:'city',lat,lng,city:state.city,region:null,point:null,name:cityName(state.city)};
  }
  return null;
}

function openUnderstandArea(context=currentAreaContext()) {
  if(!context)return;
  areaPanelMode='understand';areaUnderstandingContext=context;
  renderAreaInspector();
}

function closeAreaTool() {
  areaPanelMode='identify';areaUnderstandingContext=null;
  if(identifiedArea)renderAreaInspector();else $('areaInspector').hidden=true;
}

function areaRoads(context) {
  return context.point?streetNames(context.point):context.region?.roads||[];
}

function contextReferences(context) {
  const pool=mapDetails.pois||[];
  return pool.map(item=>({...item,_km:distanceKm([context.lat,context.lng],[item.lat,item.lon])}))
    .filter(item=>context.region?regionContainsPoint(context.region,item.lat,item.lon):item._km<=10)
    .sort((a,b)=>a._km-b._km).slice(0,6);
}

function areaNearbyNames(context) {
  if(context.point){
    const resolved=(context.point.nearby||[]).map(pointFor).filter(Boolean).map(item=>item.name);
    return [...new Set([...resolved,...(context.point.nearbyText||[])])];
  }
  if(context.region){
    const resolved=(context.region.nearby||[]).map(id=>byRegion[id]).filter(Boolean).map(item=>item.name);
    return [...new Set([...resolved,...(context.region.nearbyText||[])])];
  }
  return regions.filter(item=>item.city===context.city).map(item=>item.name);
}

function qualityFor(context) {
  return context.point?.dataQuality||context.region?.dataQuality||{confidence:'unknown',source:null,sourceDate:null,reviewed:false};
}

function accessFor(context) {
  return context.point?.access||context.region?.access||{type:'unknown',surface:'unknown',difficulty:'unknown',mainAccess:null};
}

function operationalNotesFor(context) {
  return [...(context.region?.notes||[]),...(context.point?.notes||[])].filter(note=>note?.text);
}

function areaTypeFor(context,access) {
  if(context.kind==='coordinate'&&identifiedArea?.areaType)return identifiedArea.areaType;
  if(context.point)return areaTypeLabels[context.point.kind]||accessLabels.type[access.type]||'Não informado';
  return accessLabels.type[access.type]||'Não informado';
}

function labeledValue(label,value) {
  return `<div><dt>${esc(label)}</dt><dd>${esc(value??'Não informado')}</dd></div>`;
}

function renderAreaIntelligencePanel(panel) {
  if(areaPanelMode!=='understand'||!areaUnderstandingContext)return false;
  const context=areaUnderstandingContext,access=accessFor(context),quality=qualityFor(context);
  const roads=areaRoads(context),nearby=areaNearbyNames(context),refs=contextReferences(context),notes=operationalNotesFor(context);
  panel.hidden=false;
  panel.innerHTML=`<div class="inspector-heading"><div><small>ENTENDER ESTA ÁREA</small><h2>${esc(context.name)}</h2></div><button type="button" data-action="closeAreaTool" aria-label="Fechar painel">&times;</button></div>
    <dl class="inspection-grid area-knowledge-grid">
      ${labeledValue('Cidade',cityName(context.city)||'Não informado')}
      ${labeledValue('Região operacional',context.region?.name||'Não informado')}
      ${labeledValue('Tipo de área',areaTypeFor(context,access))}
      ${labeledValue('Tipo de acesso',accessLabels.type[access.type]||'Não informado')}
      ${labeledValue('Pavimentação',accessLabels.surface[access.surface]||'Não informado')}
      ${labeledValue('Dificuldade',accessLabels.difficulty[access.difficulty]||'Não informado')}
      ${labeledValue('Principal acesso',access.mainAccess||'Não informado')}
      ${labeledValue('Qualidade',accessLabels.confidence[quality.confidence]||'Não informado')}
      ${labeledValue('Fonte',quality.source||'Não informado')}
      ${labeledValue('Atualização',quality.sourceDate||'Não informado')}
    </dl>
    <div class="knowledge-section"><h3>Localidades próximas</h3>${nearby.length?`<p>${nearby.map(esc).join(' · ')}</p>`:'<p>Não informado</p>'}</div>
    <div class="knowledge-section"><h3>Principais vias e acessos</h3>${roads.length?`<p>${roads.map(esc).join(' · ')}</p>`:'<p>Não informado</p>'}</div>
    <div class="knowledge-section"><h3>Referências próximas</h3>${refs.length?refs.map(item=>`<button class="reference-row" data-action="detailPoi" data-value="${esc(item.id)}">${referenceIcon(item)}<span>${esc(item.name)}<small>${distanceLabel(item._km)}</small></span></button>`).join(''):'<p>Não informado</p>'}</div>
    <div class="knowledge-section"><h3>Observações</h3>${notes.length?notes.map(note=>`<p><b>${esc(note.type||'general')}:</b> ${esc(note.text)}</p>`).join(''):'<p>Não informado</p>'}</div>
    <div id="areaValidatedKnowledge" class="knowledge-section"></div>
    <div class="inspector-actions"><button type="button" data-action="aroundArea">Ver ao redor</button><button type="button" data-action="streetViewContext">Street View</button><a href="${googleMapsPointUrl(context.lat,context.lng)}" target="_blank" rel="noopener noreferrer">Google Maps</a><button type="button" data-action="shareArea">Compartilhar</button></div>`;
  loadValidatedAreaKnowledge(context);
  return true;
}

async function loadValidatedAreaKnowledge(context) {
  const target=$('areaValidatedKnowledge');
  if(!target)return;
  try {
    const notes=(await getNearbyNotes(context.lat,context.lng,500)).filter(note=>note.status==='validated');
    target.innerHTML=`<h3>Conhecimento operacional validado</h3>${notes.length?notes.map(note=>`<p class="note-summary is-validated">${esc(note.text)} <small>${distanceLabel(note.distanceKm)}</small></p>`).join(''):'<p>Nenhuma informação validada próxima.</p>'}`;
  } catch(error) { target.innerHTML='<h3>Conhecimento operacional validado</h3><p>Armazenamento local indisponível.</p>'; }
}

function streetViewContext() {
  const context=areaUnderstandingContext||currentAreaContext();
  if(context)openStreetViewAt(L.latLng(context.lat,context.lng));
}
