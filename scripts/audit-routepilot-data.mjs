import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = process.argv[2] || 'outputs/sistema_mapa_por_cidade_com_busca.html';
const html = fs.readFileSync(sourcePath, 'utf8');
const scriptMatch = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);

if (!scriptMatch) {
  throw new Error(`Inline application script not found in ${sourcePath}`);
}

const dataEnd = scriptMatch[1].indexOf('const detailKinds=');
if (dataEnd < 0) {
  throw new Error('Could not find the end of the RoutePilot data block.');
}

const context = {};
vm.createContext(context);
vm.runInContext(scriptMatch[1].slice(0, dataEnd).replace(/^const /gm, 'var '), context);

const clean = value => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const { regions, points, boundaries, mapDetails, routes } = context;
const duplicateNames = new Map();
for (const point of points) {
  const key = clean(point.name);
  if (!duplicateNames.has(key)) duplicateNames.set(key, []);
  duplicateNames.get(key).push(`${point.city} / ${point.region}`);
}

const duplicatesAcrossCities = [...duplicateNames]
  .filter(([, entries]) => new Set(entries.map(entry => entry.split(' / ')[0])).size > 1)
  .map(([name, entries]) => ({ name, entries }));

const classifyNearby = (owner, name, kind) => {
  const collection = kind === 'region' ? regions : points;
  const sameCity = collection.filter(item => item.city === owner.city && clean(item.name) === clean(name));
  const global = collection.filter(item => clean(item.name) === clean(name));
  if (sameCity.length === 1) return { status: 'A', target: `${sameCity[0].city} / ${sameCity[0].name}` };
  if (global.length === 1) return { status: 'A', target: `${global[0].city} / ${global[0].name}` };
  if (global.length > 1) return { status: 'B', target: global.map(item => `${item.city} / ${item.name}`).join(' | ') };
  return { status: 'C/D', target: null };
};

const unresolved = [];
for (const region of regions) {
  for (const name of region.near || []) {
    const match = classifyNearby(region, name, 'region');
    if (match.status !== 'A') unresolved.push({ owner: `${region.city} / ${region.name}`, name, kind: 'region', ...match });
  }
}
for (const point of points) {
  for (const name of point.near || []) {
    const match = classifyNearby(point, name, 'point');
    if (match.status !== 'A') unresolved.push({ owner: `${point.city} / ${point.name}`, name, kind: 'point', ...match });
  }
}

const summary = {
  sourcePath,
  counts: {
    regions: regions.length,
    points: points.length,
    boundaries: boundaries.features.length,
    references: mapDetails.pois.length,
    routes: routes.length,
  },
  duplicatesAcrossCities,
  unresolvedNearbyCount: unresolved.length,
  unresolvedNearby: unresolved,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
