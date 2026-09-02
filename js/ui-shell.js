let layersOpen=false;

const toolbarLabels={
  identify:'Identificar ponto',
  annotate:'Anotar ponto',
  around:'Ver ao redor',
  compare:'Comparar',
  layers:'Camadas',
  tools:'Ferramentas',
  streetview:'Street View'
};

function initDesktopShell() {
  document.querySelectorAll('[data-icon]').forEach(button=>{
    if(!button.querySelector('.app-icon'))button.insertAdjacentHTML('afterbegin',iconSvg(button.dataset.icon));
  });
  renderDesktopShell();
}

function activeToolbarMode() {
  if(typeof annotatePointMode!=='undefined'&&annotatePointMode)return 'annotate';
  if(typeof identifyPointMode!=='undefined'&&identifyPointMode)return 'identify';
  if(typeof streetViewMode!=='undefined'&&streetViewMode)return 'streetview';
  if(typeof areaPanelMode!=='undefined'&&areaPanelMode==='radius')return 'around';
  if(typeof comparisonActive==='function'&&comparisonActive())return 'compare';
  if(layersOpen)return 'layers';
  if(typeof toolsOpen!=='undefined'&&toolsOpen)return 'tools';
  return null;
}

function closeLayers(renderNow=true) {
  layersOpen=false;
  if(renderNow)renderDesktopShell();
}

function toggleLayers() {
  layersOpen=!layersOpen;
  if(layersOpen&&typeof closeTools==='function')closeTools(false);
  renderDesktopShell();
}

function focusGlobalSearch() {
  if(typeof comparisonActive==='function'&&comparisonActive())goBack();
  if(typeof closeTools==='function')closeTools(false);
  closeLayers(false);
  renderDesktopShell();
  $('q').focus();
}

function cancelMapInteraction(except=null) {
  if(except!=='identify'&&typeof identifyPointMode!=='undefined'&&identifyPointMode){
    if(typeof cancelAnnotatePoint==='function')cancelAnnotatePoint(false);
    setIdentifyPointMode(false,false);
  }
  if(except!=='streetview'&&typeof streetViewMode!=='undefined'&&streetViewMode)setStreetViewMode(false,false);
  if(except!=='layers')closeLayers(false);
  if(except!=='tools'&&typeof closeTools==='function')closeTools(false);
  if(except!=='around'&&typeof areaPanelMode!=='undefined'&&areaPanelMode==='radius')clearRadiusSearch({close:true});
  if(except!=='understand'&&typeof areaPanelMode!=='undefined'&&areaPanelMode==='understand')closeAreaTool();
}

function contextDescriptor() {
  const compare=typeof comparisonActive==='function'&&comparisonActive();
  const area=typeof identifiedArea!=='undefined'?identifiedArea:null;
  const region=byRegion[state.region]||area?.region||null;
  const point=pointFor(state.point);
  const boundary=boundaryById[state.boundary]?.properties;
  if(typeof toolsOpen!=='undefined'&&toolsOpen)return {eyebrow:'CENTRAL DE FERRAMENTAS',title:'Ferramentas',kind:'tools',region,point};
  if(compare)return {eyebrow:'PLANEJAMENTO DE VISITAS',title:placeComparison()?'Comparar dois locais':'Comparar regiões',kind:'compare',region:null,point:null};
  if(area?.note)return {eyebrow:'CONHECIMENTO OPERACIONAL',title:'Anotação operacional',kind:'note',region:area.region,point:null};
  if(area?.reference)return {eyebrow:'PONTO DE REFERÊNCIA',title:area.reference.name,kind:'reference',region:area.region,point:null};
  if(area)return {eyebrow:'COORDENADA CONSULTADA',title:area.insideCoverage?(area.nearestPoint?.item?.name||'Ponto identificado'):'Ponto fora da cobertura',kind:'coordinate',region:area.region,point:null};
  if(state.road)return {eyebrow:'VIA SELECIONADA',title:state.road,kind:'road',region,point};
  if(point)return {eyebrow:point.kind==='referencia'?'PONTO DE REFERÊNCIA':'LOCALIDADE SELECIONADA',title:point.name,kind:'point',region,point};
  if(boundary)return {eyebrow:'BAIRRO SELECIONADO',title:boundary.name,kind:'boundary',region,point:null};
  if(region)return {eyebrow:'REGIÃO OPERACIONAL',title:region.name,kind:'region',region,point:null};
  if(state.city)return {eyebrow:'CIDADE SELECIONADA',title:cityName(state.city),kind:'city',region:null,point:null};
  if(state.overview)return {eyebrow:'ÁREA DE ATENDIMENTO',title:'Mapa geral',kind:'overview',region:null,point:null};
  return null;
}

function breadcrumbHtml(descriptor) {
  const area=typeof identifiedArea!=='undefined'?identifiedArea:null;
  const region=descriptor.region;
  const point=descriptor.point;
  const city=region?.city||point?.city||area?.city||state.city;
  const parts=['<button type="button" data-action="home">Cidades</button>'];
  if(descriptor.kind==='overview')parts.push('<span aria-hidden="true">›</span><span aria-current="page">Mapa geral</span>');
  if(descriptor.kind==='compare')parts.push('<span aria-hidden="true">›</span><button type="button" data-action="general">Mapa geral</button><span aria-hidden="true">›</span><span aria-current="page">Comparação</span>');
  if(descriptor.kind==='tools')parts.push('<span aria-hidden="true">›</span><span aria-current="page">Ferramentas</span>');
  if(city){
    const current=descriptor.kind==='city';
    parts.push('<span aria-hidden="true">›</span>'+`${current?'<span aria-current="page">':'<button type="button" data-action="city" data-value="'+esc(city)+'">'}${esc(cityName(city))}${current?'</span>':'</button>'}`);
  }
  if(region){
    const current=descriptor.kind==='region';
    parts.push('<span aria-hidden="true">›</span>'+`${current?'<span aria-current="page">':'<button type="button" data-action="region" data-value="'+esc(region.id)+'">'}Região ${regionCode(region)}${current?'</span>':'</button>'}`);
  }
  if(point&&descriptor.kind!=='point')parts.push(`<span aria-hidden="true">›</span><button type="button" data-action="point" data-value="${esc(point.id)}">${esc(point.name)}</button>`);
  if(['point','boundary','road','coordinate','reference','note'].includes(descriptor.kind))parts.push(`<span aria-hidden="true">›</span><span aria-current="page">${esc(descriptor.kind==='coordinate'?'Ponto identificado':descriptor.kind==='note'?'Anotação':descriptor.title)}</span>`);
  return parts.join('');
}

function panelBackAction(descriptor) {
  if(descriptor.kind==='tools')return 'closeTools';
  if(typeof areaPanelMode!=='undefined'&&areaPanelMode==='radius')return 'clearRadiusClose';
  if(typeof areaPanelMode!=='undefined'&&areaPanelMode==='understand')return 'closeAreaTool';
  if(['coordinate','reference','note'].includes(descriptor.kind))return 'clearIdentifiedArea';
  return 'back';
}

function renderContextHeader() {
  const target=$('mapContext'),descriptor=contextDescriptor();
  const start=!state.city&&!state.region&&!state.overview&&!(typeof comparisonActive==='function'&&comparisonActive())&&!(typeof toolsOpen!=='undefined'&&toolsOpen)&&!(typeof identifiedArea!=='undefined'&&identifiedArea);
  target.hidden=start||!descriptor;
  if(target.hidden){target.innerHTML='';return;}
  const active=activeToolbarMode();
  const backAction=panelBackAction(descriptor);
  target.innerHTML=`<div class="context-toolbar"><button type="button" class="panel-back" data-action="${backAction}" title="Voltar um nível (Esc)">${iconSvg('arrow')}<span>Voltar</span><kbd>Esc</kbd></button>${active?`<span class="active-tool-status"><i aria-hidden="true"></i>${esc(toolbarLabels[active])} ativo</span>`:''}</div><nav class="context-breadcrumb" aria-label="Localização atual">${breadcrumbHtml(descriptor)}</nav><div class="context-heading"><div><small>${esc(descriptor.eyebrow)}</small><h2>${esc(descriptor.title)}</h2></div>${descriptor.region?`<button class="region-badge" data-action="region" data-value="${esc(descriptor.region.id)}" style="--region-color:${descriptor.region.color}" title="Abrir região inteira">${regionCode(descriptor.region)}</button>`:''}</div>`;
}

function renderDesktopShell() {
  const active=activeToolbarMode();
  const pressed={identify:'identifyPointButton',annotate:'annotatePointButton',around:'aroundToolButton',compare:'compareButton',layers:'layersButton',tools:'toolsButton'};
  Object.entries(pressed).forEach(([mode,id])=>{
    const button=$(id);if(button)button.setAttribute('aria-pressed',String(active===mode));
  });
  const layerPanel=$('mapToggles');
  if(layerPanel)layerPanel.hidden=!layersOpen;
  const around=$('aroundToolButton');
  if(around)around.disabled=!currentAreaContext();
  const sidebar=$('contextSidebar');
  const focused=(typeof toolsOpen!=='undefined'&&toolsOpen)||(typeof comparisonActive==='function'&&comparisonActive())||(typeof identifiedArea!=='undefined'&&Boolean(identifiedArea))||(typeof areaPanelMode!=='undefined'&&['understand','radius'].includes(areaPanelMode));
  sidebar.classList.toggle('is-focused-context',Boolean(focused));
  sidebar.dataset.panel=typeof toolsOpen!=='undefined'&&toolsOpen?'tools':typeof comparisonActive==='function'&&comparisonActive()?'comparison':typeof identifiedArea!=='undefined'&&identifiedArea?'area':typeof areaPanelMode!=='undefined'&&['understand','radius'].includes(areaPanelMode)?'area':'navigation';
  renderContextHeader();
}
