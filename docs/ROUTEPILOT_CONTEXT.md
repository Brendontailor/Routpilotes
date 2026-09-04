# RoutePilot Context

## Objective

RoutePilot is a static geographic consultation tool for locating service areas, understanding nearby places, and assisting manual planning of technical visits. It is not an automatic route optimizer.

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
- `references.js`: visible roads and references plus spatial filtering.
- `comparison.js`: straight-line comparison between places or regions.
- `streetview.js`: free Street View launcher using Google Maps URLs.
- `data-validation.js`: development/runtime data validation.
- `area-inspector.js` and `area-intelligence.js`: coordinate identification and contextual area knowledge.
- `radius-search.js`: on-demand Haversine radius consultation and map circle.
- `notes-storage.js` and `notes-ui.js`: isolated local operational-note storage and validation workflow.
- `ui-shell.js`: desktop workspace shell, contextual-panel header, toolbar state, and Layers popover.
- `osm-addresses.js`: bounded Overpass requests, address/building association, labels, cache, and request cancellation.
- `osm-address-debug.js`: optional building inspection panel and copy tools for OSM diagnostics.
- `sharing.js`: validated deep links and clipboard sharing.
- `data-review.js`: secondary data-quality interface.
- `events.js`: UI event wiring and application startup.

## Data Model

- Regions have unique IDs, city, center, polygon, roads, and nearby region IDs.
- Locations have unique stable IDs, display name, city, kind, region ID, coordinates, roads, and nearby location IDs.
- Boundary GeoJSON features link to locations through `pointId`.
- Map references and routes have their own IDs and coordinates or paths.
- Optional V2 fields must tolerate `unknown`, `null`, and empty arrays.

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
- Distances are local straight-line calculations, never presented as road routes.
- Unknown or uncertain geographic data is preserved as informational text and is not geocoded by assumption.

## Search

Search normalizes accents, supports partial and fuzzy matching, compares words, searches across cities, and covers regions, neighborhoods, rural locations, roads, and references. Duplicate display names prompt for the city.

## Comparison

The application compares two places or multiple regions using straight-line distance and links to Google Maps for a real road route.

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
- Road distances are not calculated locally.
- Operational polygons may be approximate and must be labelled as such.
- Fifteen nearby relationships remain informational because no safe target point is registered.
- Unknown access, source, confidence, or review data must not be inferred.
