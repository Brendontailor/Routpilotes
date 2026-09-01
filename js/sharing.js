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

function showCopyFallback(url) {
  const panel=$('toolsPanel');
  panel.hidden=false;toolsOpen=true;$('toolsButton')?.setAttribute('aria-pressed','true');
  panel.innerHTML=`<div class="inspector-heading"><div><small>COMPARTILHAR</small><h2>Copiar link</h2></div><button data-action="closeTools" aria-label="Fechar">&times;</button></div><p class="empty">Selecione e copie este endereço:</p><input id="copyFallback" class="copy-fallback" readonly value="${esc(url)}">`;
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
