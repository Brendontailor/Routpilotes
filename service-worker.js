const CACHE_NAME='routepilot-shell-v7';
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
  './js/icons.js',
  './js/data-validation.js',
  './js/app.js',
  './js/search.js',
  './js/navigation.js',
  './js/references.js',
  './js/comparison.js',
  './js/notes-storage.js',
  './js/area-inspector.js',
  './js/area-intelligence.js',
  './js/radius-search.js',
  './js/sharing.js',
  './js/notes-ui.js',
  './js/data-review.js',
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

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

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

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(networkFirst(request,request.mode==='navigate'?'./index.html':null));
});
