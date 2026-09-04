let toastTimer;

function googleMapsPointUrl(lat,lng) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function citySlug(city) { return clean(city).replace(/\s+/g,'_'); }

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

function coordinateDeepLink(lat,lng) {
  const url=new URL(location.href);
  url.search='';url.hash='';
  url.searchParams.set('lat',Number(lat).toFixed(6));
  url.searchParams.set('lng',Number(lng).toFixed(6));
  return url.toString();
}

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
  return [...unique.values()].sort((a,b)=>a.km-b.km).slice(0,3);
}

function coordinateShareText(lat,lng) {
  const area=analyzeCoordinates(lat,lng);
  const nearby=nearbyShareItems(lat,lng);
  const lines=['Localização no RoutePilot',`Coordenadas: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`];
  if(area.region)lines.push(`Região: ${area.region.name} · ${cityName(area.region.city)}`);
  if(nearby.length)lines.push(`Próximo de: ${nearby.map(item=>`${item.name} (${distanceLabel(item.km)})`).join(', ')}`);
  lines.push(`Link: ${coordinateDeepLink(lat,lng)}`);
  return lines.join('\n');
}

function showToast(message) {
  const toast=$('appToast');
  clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;
  toastTimer=setTimeout(()=>{toast.hidden=true;},2600);
}

async function shareArea() {
  const url=routePilotDeepLink();
  try { await navigator.clipboard.writeText(url);showToast('Link copiado'); }
  catch(error) { showCopyFallback(url); }
}

async function shareMapCoordinates(lat,lng) {
  const text=coordinateShareText(lat,lng),url=coordinateDeepLink(lat,lng);
  if(navigator.share&&window.matchMedia('(pointer:coarse)').matches){
    try { await navigator.share({title:'Localização no RoutePilot',text,url});return; }
    catch(error) { if(error?.name==='AbortError')return; }
  }
  try { await navigator.clipboard.writeText(text);showToast('Localização e referências copiadas'); }
  catch(error) { showCopyFallback(text,'Compartilhar localização'); }
}

async function copyMapCoordinates(lat,lng) {
  const text=`${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  try { await navigator.clipboard.writeText(text);showToast('Coordenadas copiadas'); }
  catch(error) { showCopyFallback(text,'Copiar coordenadas'); }
}

function showCopyFallback(value,title='Copiar link') {
  const panel=$('toolsPanel');
  panel.hidden=false;toolsOpen=true;$('toolsButton')?.setAttribute('aria-pressed','true');
  const field=String(value).includes('\n')?`<textarea id="copyFallback" class="copy-fallback" rows="7" readonly>${esc(value)}</textarea>`:`<input id="copyFallback" class="copy-fallback" readonly value="${esc(value)}">`;
  panel.innerHTML=`<div class="inspector-heading"><div><small>COMPARTILHAR</small><h2>${esc(title)}</h2></div><button data-action="closeTools" aria-label="Fechar">&times;</button></div><p class="empty">Selecione e copie o conteúdo:</p>${field}`;
  requestAnimationFrame(()=>{$('copyFallback')?.select();});
}

function resolveCityParam(value) {
  const normalized=clean(value).replace(/\s+/g,'_');
  return Object.keys(cityNames).find(city=>citySlug(city)===normalized)||null;
}

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
