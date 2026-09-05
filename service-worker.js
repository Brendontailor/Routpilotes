/* Recurso RoutePilot: instalação e cache offline da PWA. */
const CACHE_NAME='routepilot-shell-v26';
const CACHE_PREFIX='routepilot-shell-';
const APP_SHELL=[
  './',
  './index.html',
  './css/routepilot.css',
  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png',
  './data/regions.js',
  './data/locations.js',
  './data/routes.js',
  './data/boundaries.js',
  './data/map-details.js',
  './data/v2-metadata.js',
  './data/priority-areas.js',
  './data/coab-duque-addresses.js',
  './data/osm-address-snapshot.js',
  './data/open-address-tiles-index.js',
  './data/routing-index.js',
  './js/runtime-config.js',
  './js/config.js',
  './js/icons.js',
  './js/data-validation.js',
  './js/app.js',
  './js/search.js',
  './js/work-order-search.js',
  './js/work-order-import.js',
  './js/geocoding-core.js',
  './js/geocoding-providers.js',
  './js/navigation.js',
  './js/references.js',
  './js/route-distance.js',
  './js/route-optimizer.js',
  './js/landmark-ranking.js',
  './js/location-share-core.js',
  './js/local-routing.js',
  './js/geocoding-service.js',
  './js/comparison.js',
  './js/route-map.js',
  './js/route-planner.js',
  './js/scheduling-config.js',
  './js/scheduling-core.js',
  './js/agenda-filters.js',
  './js/agenda-storage.js',
  './js/agenda-map.js',
  './js/agenda-ui.js',
  './js/notes-storage.js',
  './js/area-inspector.js',
  './js/area-intelligence.js',
  './js/radius-search.js',
  './js/address-radius.js',
  './js/sharing.js',
  './js/map-point-actions.js',
  './js/notes-ui.js',
  './js/data-review.js',
  './js/open-address-tiles.js',
  './js/osm-addresses.js',
  './js/osm-address-debug.js',
  './js/map.js',
  './js/streetview.js',
  './js/ui-shell.js',
  './js/events.js',
  './routepilot-logo.svg',
  './routepilot-icon.svg',
  './routepilot-icon-180.png',
  './routepilot-icon-192.png',
  './routepilot-icon-512.png',
  './manifest.webmanifest'
];

// Guarda o núcleo estático necessário para abrir o sistema sem conexão.
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

// Remove versões antigas do cache após uma atualização.
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

/** Tenta atualizar pela rede e usa o cache quando a conexão falha. */
async function networkFirst(request,fallback) {
  const cache=await caches.open(CACHE_NAME);
  try {
    const response=await fetch(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  } catch(error) {
    return (await caches.match(request))||(fallback?await caches.match(fallback):undefined)||Response.error();
  }
}

// Intercepta somente arquivos locais; os blocos do OpenStreetMap não são armazenados em massa.
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(networkFirst(request,request.mode==='navigate'?'./index.html':null));
});
