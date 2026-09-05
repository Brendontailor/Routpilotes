/* Recurso RoutePilot: compartilhamento de coordenadas. */
let toastTimer;
let pendingShareLocation=null;
let shareMessageMode='quick';

/** Guia: Executa uma etapa auxiliar em compartilhamento de coordenadas (`googleMapsPointUrl`). */
function googleMapsPointUrl(lat,lng) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

/** Guia: Executa uma etapa auxiliar em compartilhamento de coordenadas (`citySlug`). */
function citySlug(city) { return clean(city).replace(/\s+/g,'_'); }

/** Guia: Executa uma etapa auxiliar em compartilhamento de coordenadas (`routePilotDeepLink`). */
function routePilotDeepLink(context=areaUnderstandingContext||currentAreaContext()) {
  const url=new URL(location.href);
  url.search='';url.hash='';
  if(context?.kind==='coordinate'||identifiedArea) {
    const source=context?.kind==='coordinate'?context:identifiedArea;
    url.searchParams.set('lat',Number(source.lat).toFixed(6));url.searchParams.set('lng',Number(source.lng).toFixed(6));
  } else if(state.point)url.searchParams.set('place',state.point);
  else if(state.region)url.searchParams.set('region',state.region);
  else if(state.city)url.searchParams.set('city',citySlug(state.city));
  return url.toString();
}

/** Guia: Executa uma etapa auxiliar em compartilhamento de coordenadas (`coordinateDeepLink`). */
function coordinateDeepLink(lat,lng) {
  const url=new URL(location.href);
  url.search='';url.hash='';
  url.searchParams.set('lat',Number(lat).toFixed(6));
  url.searchParams.set('lng',Number(lng).toFixed(6));
  return url.toString();
}

/** Guia: Executa uma etapa auxiliar em compartilhamento de coordenadas (`nearbyShareItems`). */
function nearbyShareItems(lat,lng,maxKm=5) {
  const context={lat,lng};
  const candidates=typeof radiusCandidates==='function'?radiusCandidates(context,maxKm):[];
  const extra=typeof addressRadiusStatus!=='undefined'?(addressRadiusStatus.references||[]).map(item=>({
    kind:'reference',name:item.name,km:distanceKm([lat,lng],[item.lat,item.lng]),sub:item.category||'Referência'
  })).filter(item=>item.km<=maxKm):[];
  const unique=new Map();
  [...candidates.filter(item=>item.kind==='point'||item.kind==='reference'),...extra].forEach(item=>{
    const key=clean(item.name);
    if(!unique.has(key)||item.km<unique.get(key).km)unique.set(key,item);
  });
  const items=[...unique.values()];
  return typeof RoutePilotLandmarks!=='undefined'?RoutePilotLandmarks.rankLandmarks(items,{limit:3}):items.sort((a,b)=>a.km-b.km).slice(0,3);
}

/** Guia: Executa uma etapa auxiliar em compartilhamento de coordenadas (`coordinateShareText`). */
function coordinateShareText(lat,lng) {
  return RoutePilotLocationShare.buildLocationMessage(locationShareContext(lat,lng),{mode:shareMessageMode});
}

/** Constrói um contexto estritamente geográfico para o serviço de mensagens. */
function locationShareContext(lat,lng,overrides={}) {
  const area=analyzeCoordinates(lat,lng),nearest=area.nearestPoint?.item;
  const access=nearest?.access&&!['unknown','desconhecido'].includes(clean(nearest.access))?nearest.access:'';
  const name=overrides.name||nearest?.name||area.region?.name||'Ponto identificado';
  const landmarks=(overrides.landmarks||nearbyShareItems(lat,lng)).filter(item=>clean(item.name)!==clean(name));
  return {
    name,
    city:overrides.city||cityName(nearest?.city||area.region?.city||''),
    region:overrides.region||area.region?.name||'',
    access:overrides.access||access,
    coords:[Number(lat),Number(lng)],
    landmarks,
    link:overrides.link||coordinateDeepLink(lat,lng)
  };
}

/** Abre as opções de compartilhamento reutilizadas em todo o sistema. */
function openLocationShare(location) {
  pendingShareLocation=RoutePilotLocationShare.sanitizeLocation(location);
  shareMessageMode='quick';
  renderLocationSharePanel();
}

/** Atualiza a prévia e os três modos de mensagem no painel contextual. */
function renderLocationSharePanel() {
  if(!pendingShareLocation)return;
  const panel=$('toolsPanel'),message=RoutePilotLocationShare.buildLocationMessage(pendingShareLocation,{mode:shareMessageMode});
  toolsOpen=true;panel.hidden=false;$('toolsButton')?.setAttribute('aria-pressed','true');
  panel.innerHTML=`<div class="inspector-heading"><div><small>COMPARTILHAR LOCAL</small><h2>${esc(pendingShareLocation.name)}</h2></div><button data-action="closeSharePanel" aria-label="Fechar">&times;</button></div><div class="share-mode-tabs" role="group" aria-label="Formato da mensagem"><button data-action="shareMode" data-value="quick" aria-pressed="${shareMessageMode==='quick'}">Mensagem rápida</button><button data-action="shareMode" data-value="detailed" aria-pressed="${shareMessageMode==='detailed'}">Detalhada</button><button data-action="shareMode" data-value="location" aria-pressed="${shareMessageMode==='location'}">Somente localização</button></div><pre class="share-preview">${esc(message)}</pre><div class="share-actions"><button class="whatsapp-share" data-action="shareWhatsApp">Compartilhar no WhatsApp</button><button data-action="copyLocationMessage">Copiar mensagem</button></div><p class="map-caution">A mensagem contém somente localização, referências e acesso. Nenhum dado de cliente é incluído.</p>`;
  if(typeof renderDesktopShell==='function')renderDesktopShell();
}

/** Troca o formato sem reconstruir ou consultar novamente as referências. */
function setLocationShareMode(mode) {
  if(!RoutePilotLocationShare.VALID_MODES.has(mode)||!pendingShareLocation)return;
  shareMessageMode=mode;renderLocationSharePanel();
}

/** Copia a mensagem atual e oferece seleção manual se o clipboard falhar. */
async function copyLocationMessage() {
  if(!pendingShareLocation)return;
  const message=RoutePilotLocationShare.buildLocationMessage(pendingShareLocation,{mode:shareMessageMode});
  try{await navigator.clipboard.writeText(message);showToast('Mensagem copiada');}
  catch(error){showCopyFallback(message,'Copiar mensagem');}
}

/** Abre o WhatsApp Web sem escolher contato e detecta bloqueio de popup. */
function shareLocationToWhatsApp() {
  if(!pendingShareLocation)return;
  const message=RoutePilotLocationShare.buildLocationMessage(pendingShareLocation,{mode:shareMessageMode});
  const opened=window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank');
  if(opened)opened.opener=null;
  if(!opened){showToast('O navegador bloqueou o WhatsApp. Copie a mensagem.');showCopyFallback(message,'Compartilhar no WhatsApp');}
}

/** Fecha somente o painel de compartilhamento. */
function closeLocationShare() {
  pendingShareLocation=null;
  if(typeof closeTools==='function')closeTools();
}

/** Guia: Exibe o conteúdo solicitado em compartilhamento de coordenadas (`showToast`). */
function showToast(message) {
  const toast=$('appToast');
  clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;
  toastTimer=setTimeout(()=>{toast.hidden=true;},2600);
}

/** Prepara os dados para compartilhamento em compartilhamento de coordenadas (`shareArea`). */
async function shareArea() {
  const context=currentAreaContext();
  if(!context)return;
  if(window.matchMedia('(max-width:900px)').matches){
    const url=routePilotDeepLink();
    try{await navigator.clipboard.writeText(url);showToast('Link copiado');}catch(error){showCopyFallback(url);}
    return;
  }
  openLocationShare(locationShareContext(context.lat,context.lng));
}

/** Prepara os dados para compartilhamento em compartilhamento de coordenadas (`shareMapCoordinates`). */
async function shareMapCoordinates(lat,lng) {
  if(window.matchMedia('(max-width:900px)').matches){
    const area=analyzeCoordinates(lat,lng),nearby=nearbyShareItems(lat,lng),url=coordinateDeepLink(lat,lng);
    const lines=['Localização no RoutePilot',`Coordenadas: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`];
    if(area.region)lines.push(`Região: ${area.region.name} · ${cityName(area.region.city)}`);
    if(nearby.length)lines.push(`Próximo de: ${nearby.map(item=>`${item.name} (${distanceLabel(item.km)})`).join(', ')}`);
    lines.push(`Link: ${url}`);const text=lines.join('\n');
    if(navigator.share){try{await navigator.share({title:'Localização no RoutePilot',text,url});return;}catch(error){if(error?.name==='AbortError')return;}}
    try{await navigator.clipboard.writeText(text);showToast('Localização e referências copiadas');}catch(error){showCopyFallback(text,'Compartilhar localização');}
    return;
  }
  openLocationShare(locationShareContext(lat,lng));
}

/** Prepara os dados para compartilhamento em compartilhamento de coordenadas (`copyMapCoordinates`). */
async function copyMapCoordinates(lat,lng) {
  const text=`${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  try { await navigator.clipboard.writeText(text);showToast('Coordenadas copiadas'); }
  catch(error) { showCopyFallback(text,'Copiar coordenadas'); }
}

/** Guia: Exibe o conteúdo solicitado em compartilhamento de coordenadas (`showCopyFallback`). */
function showCopyFallback(value,title='Copiar link') {
  const panel=$('toolsPanel');
  panel.hidden=false;toolsOpen=true;$('toolsButton')?.setAttribute('aria-pressed','true');
  const field=String(value).includes('\n')?`<textarea id="copyFallback" class="copy-fallback" rows="7" readonly>${esc(value)}</textarea>`:`<input id="copyFallback" class="copy-fallback" readonly value="${esc(value)}">`;
  panel.innerHTML=`<div class="inspector-heading"><div><small>COMPARTILHAR</small><h2>${esc(title)}</h2></div><button data-action="closeTools" aria-label="Fechar">&times;</button></div><p class="empty">Selecione e copie o conteúdo:</p>${field}`;
  requestAnimationFrame(()=>{$('copyFallback')?.select();});
}

/** Guia: Localiza o item correspondente em compartilhamento de coordenadas (`resolveCityParam`). */
function resolveCityParam(value) {
  const normalized=clean(value).replace(/\s+/g,'_');
  return Object.keys(cityNames).find(city=>citySlug(city)===normalized)||null;
}

/** Guia: Executa uma etapa auxiliar em compartilhamento de coordenadas (`applyDeepLink`). */
function applyDeepLink() {
  const params=new URLSearchParams(location.search);
  const latValue=params.get('lat'),lngValue=params.get('lng');
  if(latValue!==null||lngValue!==null){
    if(latValue===null||lngValue===null)return;
    const parsed=parseCoordinateQuery(`${latValue},${lngValue}`);
    if(parsed.valid)identifyCoordinates(parsed.lat,parsed.lng,{source:'link'});
    return;
  }
  const place=params.get('place'),region=params.get('region'),city=params.get('city');
  if(place&&pointFor(place)){selectPoint(place);return;}
  if(region&&byRegion[region]){selectRegion(region);return;}
  const resolvedCity=city&&resolveCityParam(city);
  if(resolvedCity)selectCity(resolvedCity);
}
