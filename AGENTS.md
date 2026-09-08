# RoutePilot — Permanent Project Rules

These rules are permanent and must be respected in every change made to the RoutePilot project.

## 1. Project Architecture

* RoutePilot is a static PWA deployed manually to Netlify.
* Current usage prioritizes desktop and notebook computers.
* Preserve the existing static architecture whenever possible.
* Do not introduce React, Vue, Angular, or another frontend framework.
* Do not concentrate the application logic back into `index.html`.
* Keep JavaScript modular, organized, and separated by responsibility.
* Avoid unnecessary large-scale refactors.
* Preserve existing behavior unless a change explicitly requires modifying it.

## 2. Maps

* Use Leaflet as the map library.
* Use OpenStreetMap tiles.
* Keep Leaflet stored locally inside `vendor/`.
* Do not require paid map APIs.
* Do not use the paid Google Maps JavaScript API.
* Street View must remain available through a regular Google Maps URL.
* Never mass-cache OpenStreetMap tiles.
* Never invent geographic information.
* Geographic data added to the project must come from a real and verifiable source.

## 3. Identifiers and Data Modeling

* Every location, region, block, point, work order, or other internal entity must use a unique internal ID.
* Never identify an internal entity only by its display name.
* Display names may change and are not reliable identifiers.
* Prefer stable identifiers independent from labels shown in the interface.

Example:

```js
{
  id: "location_001",
  name: "COHAB Duque",
  lat: -31.7392,
  lng: -52.3884
}
```

Do not rely on:

```js
locations["COHAB Duque"]
```

as the only internal identifier.

## 4. Customer Privacy

* Do not store customers' personal data unless explicitly required by an approved future architecture change.

* Never store:

  * passwords;
  * authentication tokens;
  * API keys;
  * customer login credentials;
  * secrets;
  * sensitive credentials.

* Operational notes must never be associated directly with customers.

## 5. Operational Notes

Operational notes must be associated with:

* locations;
* coordinates;
* geographic points;
* regions;
* blocks;
* map entities.

They must never be associated directly with customer identities.

Example:

```js
{
  locationId: "location_001",
  lat: -31.7392,
  lng: -52.3884,
  note: "Access through the side road."
}
```

Operational notes must remain behind an isolated persistence abstraction.

New operational notes must start with a pending state.

Example:

```js
status: "pending"
```

Validation or approval of operational notes must never automatically modify structural map data.

A note may suggest a correction, but structural geographic data must only change through an explicit and controlled process.

## 6. IndexedDB and Offline Operation

* Keep IndexedDB as the local and offline persistence layer.
* IndexedDB access should remain isolated behind a dedicated abstraction/module.
* Do not scatter direct IndexedDB calls throughout the application.
* RoutePilot must remain useful when connectivity is unavailable whenever technically possible.
* Local offline data must synchronize safely when connectivity returns.
* Synchronization must avoid accidental duplication or silent overwrites.
* Conflicts should be handled explicitly when necessary.

## 7. Backend and Database Rules

The core RoutePilot application must not depend on a backend or database to operate.

Cloud persistence is allowed only when necessary for shared authenticated features.

Allowed cloud data includes:

* work orders;
* daily agendas;
* user preferences;
* operational notes.

When cloud persistence is used:

* use Neon Postgres;
* access Neon only through Netlify Functions;
* Netlify Functions must require authentication;
* authorization must also be enforced server-side;
* the browser must never connect directly to Neon;
* database credentials must never be exposed to frontend code;
* user preferences must be associated with the authenticated user;
* operational notes stored in the cloud must also be associated with the authenticated user where applicable.

The architecture should follow:

```text
Browser
   |
   v
Authenticated Netlify Function
   |
   v
Neon Postgres
```

Never:

```text
Browser
   |
   v
Neon Postgres
```

## 8. Security

All displayed or externally supplied content must be treated as untrusted by default.

Sanitize:

* user-entered text;
* URL parameters;
* imported data;
* operational notes;
* external URLs;
* dynamically generated HTML.

Avoid unsafe use of:

```js
innerHTML
```

Prefer safe DOM APIs such as:

```js
textContent
```

When HTML rendering is necessary, sanitize the content before inserting it.

Untrusted URL data must also be validated before being opened or rendered.

## 9. Existing Features That Must Be Preserved

Do not remove or break the following features unless explicitly requested:

* visual identity;
* fuzzy search;
* comparison features;
* nearby-region behavior;
* Street View;
* A4 printing;
* PWA functionality;
* offline behavior;
* existing map interactions.

When refactoring these features, preserve their current external behavior.

## 10. PWA and Service Worker

RoutePilot must remain a PWA.

Whenever application files involved in the offline cache change:

* review the service worker;
* update cache versioning when necessary;
* ensure modified assets are correctly refreshed.

Do not create aggressive caching strategies for OpenStreetMap tiles.

OpenStreetMap tiles must not be mass-downloaded or mass-cached.

## 11. Code Organization

Prefer:

* small modules;
* clear responsibilities;
* descriptive function names;
* descriptive variable names;
* reusable utilities;
* explicit dependencies;
* minimal global state.

Avoid:

* giant files;
* duplicated logic;
* unnecessary abstractions;
* hidden side effects;
* mixing persistence, UI, map logic, and business rules in the same module.

A preferred structure is conceptually similar to:

```text
src/
  map/
  search/
  storage/
  sync/
  ui/
  utils/
  services/
```

The exact folder structure may evolve, but responsibilities should remain separated.

## 12. Dependencies

Before adding a dependency:

1. verify whether the feature can reasonably be implemented with the existing stack;
2. prefer lightweight solutions;
3. avoid dependencies that introduce a backend requirement;
4. avoid dependencies requiring paid APIs;
5. avoid frontend frameworks;
6. avoid unnecessarily increasing bundle size.

Do not replace Leaflet without an explicit project decision.

## 13. Geographic Integrity

Never fabricate:

* addresses;
* house numbers;
* block numbers;
* coordinates;
* neighborhood boundaries;
* road names;
* geographic relationships.

When geographic information is uncertain:

* mark it as unknown;
* leave it pending;
* or require manual validation.

Do not infer geographic facts solely because they appear visually plausible on the map.

Operational observations may be stored separately without modifying authoritative structural map data.

## 14. Authentication and Authorization

Any feature that accesses shared cloud data must require authentication.

Authentication alone is not sufficient.

Netlify Functions must also verify whether the authenticated user is authorized to access or modify the requested resource.

Never rely exclusively on frontend checks for authorization.

Frontend restrictions are user-interface conveniences, not security boundaries.

## 15. Synchronization

When synchronizing IndexedDB with Neon:

* use stable unique IDs;
* avoid duplicate records;
* preserve local unsynchronized changes;
* detect conflicts when necessary;
* avoid destructive automatic merges;
* handle failures gracefully;
* allow synchronization to resume after connectivity returns.

Structural geographic data must never be silently changed as a consequence of syncing operational notes.

## 16. Documentation

After meaningful changes to the project, update:

```text
docs/ROUTEPILOT_STATE.md
```

The document should reflect relevant changes to:

* architecture;
* modules;
* features;
* persistence;
* synchronization;
* authentication;
* map data;
* known limitations;
* important technical decisions.

Do not leave the state documentation inconsistent with the current codebase.

## 17. Change Strategy

Before modifying RoutePilot:

1. understand the existing implementation;
2. identify the smallest safe change;
3. preserve existing functionality;
4. avoid unnecessary rewrites;
5. respect the architecture described in this document;
6. verify related features after the modification;
7. update the service worker when cached application files change;
8. update `docs/ROUTEPILOT_STATE.md` after meaningful changes.

## 18. Core Principle

RoutePilot should remain:

* simple;
* maintainable;
* modular;
* privacy-conscious;
* usable offline;
* inexpensive to operate;
* independent from paid APIs;
* based on verifiable geographic data;
* safe for operational use.

When there is a conflict between a new implementation idea and these rules, these permanent project rules take priority unless the project owner explicitly changes them.
