# RoutePilot Context

## Objective

RoutePilot is a static geographic consultation tool for locating service areas, understanding nearby places, comparing appointments, and planning multi-stop technical visits locally in the browser.

## Architecture

- Static HTML, CSS, and modular JavaScript.
- Manual folder or ZIP deployment to Netlify.
- Installable PWA with a versioned service worker.
- Leaflet 1.9.4 stored locally; OpenStreetMap supplies online map tiles.
- No mandatory backend, database, build step, API key, or paid API.

## Directories

- `index.html`: application HTML shell.
- `css/`: visual styles.
- `js/`: application modules.
- `data/`: regions, locations, routes, boundaries, and map references.
- `vendor/`: local Leaflet distribution and license.
- `manifest.webmanifest`: PWA manifest.
- `service-worker.js`: PWA cache and update strategy.
- `docs/`: permanent architecture context and development checkpoint.
- `scripts/`: reusable audit and validation tools.
- `outputs/`: ignored local deploy artifacts and historical exports; not source code.

## Modules

- `app.js`: shared state and core helpers.
- `search.js`: normalized, partial, fuzzy, and multi-city search.
- `navigation.js`: city, region, place, road, and panel navigation.
- `map.js`: Leaflet map, layers, markers, focus, and visibility.
- `config.js`: centralized map, search, Overpass, cache, and address-focus settings.
- `references.js`: visible roads and references plus spatial filtering.
- `comparison.js`: dynamic comparison of 2-24 places on desktop, two-place mobile flow, proximity result, and overlay.
- `local-routing.js`: lazy local address lookup and in-browser shortest-path calculation.
- `route-distance.js`: reusable distance provider and cached matrix.
- `route-optimizer.js`: nearest-neighbor and 2-opt ordering with fixed-position constraints.
- `route-planner.js`: isolated multi-stop planner state, manual ordering, recalculation, restore, and undo.
- `route-map.js`: dedicated Leaflet layer for the planned route.
- `location-share-core.js` and `landmark-ranking.js`: geographic-only messages and nearby-reference selection.
- `streetview.js`: free Street View launcher using Google Maps URLs.
- `data-validation.js`: development/runtime data validation.
- `area-inspector.js` and `area-intelligence.js`: coordinate identification and contextual area knowledge.
- `radius-search.js`: on-demand Haversine radius consultation and map circle.
- `address-radius.js`: focused 100-500 m address and reference consultation.
- `notes-storage.js` and `notes-ui.js`: isolated local operational-note storage and validation workflow.
- `ui-shell.js`: desktop workspace shell, contextual-panel header, toolbar state, and Layers popover.
- `osm-addresses.js`: bounded Overpass requests, address/building association, labels, cache, and request cancellation.
- `open-address-tiles.js`: lazy bbox loading and in-memory cache for tiled IBGE/Overture addresses.
- `osm-address-debug.js`: optional building inspection panel and copy tools for OSM diagnostics.
- `sharing.js`: validated deep links, clipboard sharing, and concise nearby-place summaries.
- `map-point-actions.js`: left-click point focus and right-click coordinate/share actions.
- `data-review.js`: secondary data-quality interface.
- `events.js`: UI event wiring and application startup.

## Data Model

- Regions have unique IDs, city, center, polygon, roads, and nearby region IDs.
- Locations have unique stable IDs, display name, city, kind, region ID, coordinates, roads, and nearby location IDs.
- Boundary GeoJSON features link to locations through `pointId`.
- Map references and routes have their own IDs and coordinates or paths.
- Optional V2 fields must tolerate `unknown`, `null`, and empty arrays.
- Open addresses are stored in `data/open-address-tiles/`, indexed by `data/open-address-tiles-index.js`, and never loaded as one global dataset.
- The local road graph and sharded address lookup live in `data/routing/`; the graph is fetched only when a road comparison is requested.

## ID Convention

Location IDs use normalized city and place names, for example `pelotas_cascata` and `morro_redondo_cascata`. Display names are never used as internal identity.

## Coverage

- Cities: Pelotas, Capao do Leao, Morro Redondo, Cangucu, and Cerrito.
- 11 operational regions.
- 105 registered locations.
- 25 boundary features.
- 260 detailed map references.
- 444 detailed road records.

## Geographic Behavior

- Region membership uses point-in-polygon when a valid polygon exists.
- Bounds are fallback only when no valid polygon exists.
- Two-place comparison uses the embedded road graph. Desktop place comparison accepts 2-24 stops and uses a cached straight-line matrix for quick proximity analysis. The route planner then uses the embedded graph when available, with a clearly identified straight-line fallback.
- Unknown or uncertain geographic data is preserved as informational text and is not geocoded by assumption.

## Search

Search normalizes accents, supports partial and fuzzy matching, compares words, searches across cities, and covers regions, neighborhoods, rural locations, roads, and references. Duplicate display names prompt for the city.

## Direct Map Interaction

At detailed zoom, clicking the map identifies the exact coordinate and exposes the address-radius action. Right-clicking any map coordinate opens focus, share, and coordinate-copy actions. Shared coordinate text includes the operational region and up to three nearby registered localities or references when available.

Point identification preserves the current zoom when it is already closer than the configured minimum. Overpass failures may reuse an expired local response for the same map section so known numbers remain visible during temporary service outages.

## Comparison

The application compares registered places or exact local addresses using local data. Address resolution uses the sharded copy of the 122,919 integrated addresses. Two-place comparison and the multi-stop planner can use the embedded Overture road graph; no address or route is sent to a geocoding or routing service. If the graph is unavailable or disconnected, the interface explicitly falls back to straight-line distance. Multiple-region comparison remains a straight-line estimate.

## Route Planner

The desktop planner accepts a separate origin and up to 24 appointments. It builds a cached distance matrix, suggests an order with nearest-neighbor plus 2-opt, and keeps the route layer separate from structural map layers. The user can drag appointments, recalculate the exact manual order, restore the recommendation, undo one change, and lock positions before reoptimizing. There are no automatic priority levels: list order is authoritative.

## Work Orders And Daily Agenda

Desktop navigation also provides `Criar rota` and `Agenda`. Work orders use normalized per-shift capacity, optional time constraints, an optional required technician, locking and fixed route positions. Distribution first assigns work orders, then reuses the local distance matrix and route optimizer for each technician. A technician's base is a preference only: travel to another city remains allowed and produces a non-blocking reminder.

Technicians, work orders and daily agendas are stored locally through `js/agenda-storage.js`. Existing days require a preview before reoptimization or fitting only new work orders. The mobile interface remains unchanged.

## Geographic Sharing

The sharing panel creates quick, detailed, or location-only messages from sanitized geographic fields. It can include up to three ranked nearby landmarks and open WhatsApp Web without selecting a recipient. Customer data is neither requested nor stored.

## Street View

Street View uses `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=LAT,LNG`. It has a custom technician control, supports click or desktop drag, opens Google Maps in a new tab/app, uses no API key, and is cancelled with Escape.

## PWA

The app shell is cached locally. HTML and same-origin assets use a network-first strategy. Old versioned caches are removed during activation. OpenStreetMap tiles are not mass-cached.

## Validation

Validation checks IDs, regions, cities, coordinates, nearby IDs, boundaries, references, and optional informational relationships. Validation messages remain in the console or developer tools rather than the main interface unless explicitly shown by the data-review tool.

## Operational Knowledge

Operational notes belong to coordinates, not customers. They are stored locally in IndexedDB through an isolated abstraction, begin as `pending`, and can be validated or rejected. Only validated notes are treated as trusted operational knowledge. Validation never changes polygons, boundaries, official coordinates, cities, regions, or OpenStreetMap data.

The desktop Tools menu includes **Anotar ponto**. It activates point identification and opens the pending-note form after the user selects a map coordinate.

## Desktop Workspace

The desktop workspace keeps map actions in one compact toolbar and keeps the contextual sidebar focused on the current city, region, location, coordinate, or operational tool. The sidebar header owns the breadcrumb and Back/Escape affordance; navigation, details, comparison, area understanding, radius consultation, and notes reuse that same context rather than rendering competing headers.

## Known Limitations

- OpenStreetMap tiles, Google Maps, and Street View require internet access.
- The local graph does not model every temporary closure, complex turn restriction, traffic condition, or travel time.
- Operational polygons may be approximate and must be labelled as such.
- Fifteen nearby relationships remain informational because no safe target point is registered.
- Unknown access, source, confidence, or review data must not be inferred.
