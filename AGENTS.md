# RoutePilot — Permanent Project Rules

These rules are permanent and must be respected in every change made to the RoutePilot project.

## 1. Project Architecture

* RoutePilot is a static PWA deployed manually to Netlify.
* Current usage prioritizes desktop and notebook computers.
* Preserve the existing static architecture whenever possible.
* The core mapping, search, comparison, navigation, printing, and PWA functionality should remain usable independently from cloud persistence whenever technically possible.
* Backend services may be used for authenticated shared features such as work orders, daily agendas, user preferences, operational notes, synchronization, and related operational data.
* When backend functionality is required, use Netlify Functions as the server-side layer.
* Do not connect the frontend directly to the database.
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

* Every location, region, block, point, work order, agenda entry, operational note, or other internal entity must use a unique internal ID.
* Never identify an internal entity only by its display name.
* Display names may change and are not reliable identifiers.
* Prefer stable identifiers independent from labels shown in the interface.
* IDs used for offline synchronization must remain stable between IndexedDB and Neon.

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

## 4. Customer Privacy and Operational Data

Customer-related information may only be stored when it is necessary for legitimate RoutePilot operational features, such as:

* work orders;
* daily agendas;
* scheduling;
* route organization;
* information necessary to identify or execute an authorized service order.

Do not collect or persist customer information that is unnecessary for those operational purposes.

Cloud customer-related operational data must:

* be stored only in the approved Neon Postgres database;
* be accessed only through authenticated Netlify Functions;
* require server-side authorization;
* only be available to authorized users;
* never be exposed through public frontend configuration or static files.

Never store:

* passwords;
* customer passwords;
* authentication tokens;
* API keys;
* customer login credentials;
* private keys;
* database credentials;
* secrets;
* sensitive authentication credentials.

Operational notes about geographic conditions must never be associated directly with customer identities.

Location-related observations belong to locations or coordinates, not to customers.

## 5. Operational Notes

Operational notes must be associated with:

* locations;
* coordinates;
* geographic points;
* regions;
* blocks;
* map entities.

They must never be associated directly with customer identities.

When operational notes are stored in the cloud, they must also be associated with the authenticated user responsible for creating or maintaining them.

Example:

```js
{
  id: "note_001",
  userId: "authenticated_user_id",
  locationId: "location_001",
  lat: -31.7392,
  lng: -52.3884,
  note: "Access through the side road.",
  status: "pending"
}
```

Operational notes must remain behind an isolated persistence abstraction.

Do not scatter direct IndexedDB, synchronization, or remote persistence logic throughout UI or map modules.

New operational notes must start with:

```js
status: "pending"
```

Validation or approval of operational notes must never automatically modify structural map data.

A note may suggest a correction, but structural geographic data must only change through an explicit and controlled process.

Validation of a note means validating the operational observation. It does not make that observation authoritative geographic map data.

## 6. IndexedDB and Offline Operation

* Keep IndexedDB as the local offline persistence and fallback layer.
* IndexedDB access must remain isolated behind a dedicated abstraction/module.
* Do not scatter direct IndexedDB calls throughout the application.
* RoutePilot should remain useful when connectivity is unavailable whenever technically possible.
* Data created while offline must synchronize safely when connectivity returns.
* Synchronization must avoid accidental duplication.
* Synchronization must avoid silent destructive overwrites.
* Conflicts must be handled explicitly when necessary.
* Failed synchronization must not cause local data loss.
* Remote service failure must not unnecessarily break unrelated local mapping functionality.

IndexedDB is an offline fallback and synchronization layer, not a replacement for Neon when data is intended to be shared between authorized users.

## 7. Backend and Database Rules

RoutePilot may use backend and database functionality for authenticated shared operational features.

The approved database is:

```text
Neon Postgres
```

Cloud persistence may be used for:

* work orders;
* daily agendas;
* authorized operational scheduling data;
* user preferences;
* operational notes;
* synchronization metadata necessary for these features.

Neon must only be accessed through authenticated Netlify Functions.

Required architecture:

```text
Browser / RoutePilot PWA
        |
        v
Authenticated Netlify Function
        |
        v
Server-side authorization
        |
        v
Neon Postgres
```

Never use:

```text
Browser
   |
   v
Neon Postgres
```

The frontend must never contain:

* Neon database connection strings;
* database passwords;
* privileged database credentials;
* server API secrets;
* authentication secrets.

Netlify environment variables must be used for server-side secrets.

Secrets must only be read by server-side Netlify Functions.

Authentication and authorization must be checked before accessing shared protected data.

## 8. Security

All displayed or externally supplied content must be treated as untrusted by default.

Sanitize or safely handle:

* user-entered text;
* URL parameters;
* imported data;
* work-order data;
* agenda data;
* operational notes;
* external URLs;
* dynamically generated HTML;
* database-returned content.

Avoid unsafe use of:

```js
innerHTML
```

Prefer safe DOM APIs such as:

```js
textContent
```

When HTML rendering is necessary, sanitize the content before inserting it.

Untrusted URL data must be validated before being opened or rendered.

Never trust authorization information provided only by the frontend.

Never use a client-controlled `userId` as sufficient proof that a user owns a resource.

The authenticated server-side identity must determine authorization.

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

New backend functionality must not unnecessarily couple unrelated map functionality to network availability.

## 10. PWA and Service Worker

RoutePilot must remain a PWA.

Whenever application files involved in the offline cache change:

* review the service worker;
* update cache versioning when necessary;
* ensure modified assets are correctly refreshed.

Do not create aggressive caching strategies for OpenStreetMap tiles.

OpenStreetMap tiles must not be mass-downloaded or mass-cached.

Do not cache:

* authentication tokens;
* sensitive authenticated API responses;
* database credentials;
* secrets.

Carefully evaluate caching of authenticated operational data before adding it to service-worker caches.

## 11. Code Organization

Prefer:

* small modules;
* clear responsibilities;
* descriptive function names;
* descriptive variable names;
* reusable utilities;
* explicit dependencies;
* minimal global state;
* isolated persistence;
* isolated authentication logic;
* isolated synchronization logic;
* isolated API access.

Avoid:

* giant files;
* duplicated logic;
* unnecessary abstractions;
* hidden side effects;
* mixing persistence, UI, map logic, authentication, synchronization, and business rules in the same module.

A preferred structure is conceptually similar to:

```text
src/
  map/
  search/
  storage/
  sync/
  auth/
  api/
  ui/
  utils/
  services/
```

Netlify Functions should remain separated from frontend modules.

For example:

```text
netlify/
  functions/
```

The exact folder structure may evolve, but responsibilities must remain separated.

## 12. Dependencies

Before adding a dependency:

1. verify whether the feature can reasonably be implemented with the existing stack;
2. prefer lightweight solutions;
3. avoid unnecessary dependencies;
4. avoid dependencies requiring paid APIs;
5. avoid frontend frameworks;
6. avoid unnecessarily increasing bundle size;
7. verify browser compatibility;
8. verify security implications.

Do not replace Leaflet without an explicit project decision.

Backend dependencies are allowed when necessary for approved Netlify Function or Neon functionality, but they must not unnecessarily affect the frontend bundle.

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

Customer or work-order information must never automatically become structural geographic data.

## 14. Authentication and Authorization

Any feature that accesses shared protected cloud data must require authentication.

Authentication alone is not sufficient.

Netlify Functions must verify whether the authenticated user is authorized to access or modify the requested resource.

Never rely exclusively on frontend checks for authorization.

Frontend restrictions are user-interface conveniences, not security boundaries.

User preferences must be associated with the authenticated user.

Operational notes stored remotely must be associated with the authenticated user.

Where appropriate, records should contain stable ownership or authorship identifiers.

For example:

```js
{
  id: "note_001",
  userId: "authenticated_user_id"
}
```

The server must derive or validate the authenticated user identity.

Do not trust an arbitrary `userId` sent by the client.

Shared work orders and agendas may be accessible by multiple authorized users when this behavior is intentionally defined by RoutePilot.

Authorization rules must be enforced server-side.

## 15. Synchronization

When synchronizing IndexedDB with Neon:

* use stable unique IDs;
* avoid duplicate records;
* preserve local unsynchronized changes;
* detect conflicts when necessary;
* avoid destructive automatic merges;
* handle failures gracefully;
* allow synchronization to resume after connectivity returns;
* keep synchronization retry-safe where practical;
* avoid creating duplicate server records after retries.

Synchronization should distinguish between:

* local-only records;
* pending synchronization;
* successfully synchronized records;
* conflicts;
* failed synchronization.

Structural geographic data must never be silently changed as a consequence of syncing operational notes.

Remote validation of an operational note must never automatically mutate the structural map dataset.

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
* authorization;
* Netlify Functions;
* Neon;
* map data;
* known limitations;
* important technical decisions.

Do not leave the state documentation inconsistent with the current codebase.

Changes involving database schemas, authentication, synchronization, or Netlify Functions are considered meaningful changes and must be documented.

## 17. Change Strategy

Before modifying RoutePilot:

1. understand the existing implementation;
2. identify the smallest safe change;
3. preserve existing functionality;
4. avoid unnecessary rewrites;
5. respect the architecture described in this document;
6. verify related features after the modification;
7. verify offline behavior when relevant;
8. verify authentication and authorization when relevant;
9. update the service worker when cached application files change;
10. update `docs/ROUTEPILOT_STATE.md` after meaningful changes.

Do not perform a broad architectural rewrite simply because a smaller change would be less elegant.

Prefer incremental, testable changes.

## 18. Core Principle

RoutePilot should remain:

* simple;
* maintainable;
* modular;
* privacy-conscious;
* offline-capable;
* inexpensive to operate;
* independent from paid APIs;
* based on verifiable geographic data;
* secure for authenticated shared data;
* safe for operational use.

Static frontend functionality and authenticated cloud functionality may coexist.

The intended architecture is:

```text
Static PWA
   |
   +-- Local/offline features
   |      |
   |      +-- IndexedDB
   |
   +-- Authenticated shared features
          |
          +-- Netlify Functions
                 |
                 +-- Neon Postgres
```

When there is a conflict between a new implementation idea and these rules, these permanent project rules take priority unless the project owner explicitly changes them.
