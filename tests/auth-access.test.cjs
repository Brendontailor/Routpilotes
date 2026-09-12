const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('interface inicia bloqueada e oferece login Google',()=>{
  const html=read('index.html');
  assert.match(html,/<body class="auth-pending">/);
  assert.match(html,/id="authGateButton"[^>]*>Entrar com Google/);
  assert.match(html,/<main[^>]+id="app"[^>]+inert/);
});

test('mapa inicia somente depois da autenticacao',()=>{
  const events=read('js/events.js');
  assert.match(events,/RoutePilotAuth\.onChange\(user=>\{if\(user\)initializeRoutePilot\(\);\}\)/);
  assert.doesNotMatch(events,/initStreetViewLauncher\(\);render\(\);applyDeepLink\(\);RoutePilotAuth\.init/);
});

test('rotas protegidas precedem o fallback de navegacao do Netlify',()=>{
  const config=read('netlify.toml');
  const data=config.indexOf('from = "/api/data"');
  const status=config.indexOf('from = "/api/database-status"');
  const fallback=config.indexOf('from = "/*"');
  assert.ok(data>=0&&status>data&&fallback>status);
  assert.match(config,/to = "\/\.netlify\/functions\/operational-data"/);
  assert.match(config,/to = "\/index\.html"\s+status = 200/);
});

test('sessao autenticada usa renovacao oficial ao retomar a aplicacao',()=>{
  const entry=read('scripts/auth-provider-entry.mjs'),auth=read('js/auth.js');
  assert.match(entry,/refreshSession/);
  assert.match(auth,/SESSION_REFRESH_INTERVAL_MS/);
  assert.match(auth,/visibilitychange/);
  assert.match(auth,/window\.addEventListener\('online',refreshConnectedSession\)/);
  assert.match(auth,/\['nf_jwt','nf_refresh'\]/);
  assert.match(auth,/finally\{/);
});

test('Netlify envia cabecalhos defensivos sem liberar scripts externos',()=>{
  const config=read('netlify.toml');
  assert.match(config,/Content-Security-Policy = "[^"]*script-src 'self'/);
  assert.match(config,/frame-ancestors 'none'/);
  assert.match(config,/X-Content-Type-Options = "nosniff"/);
  assert.match(config,/Permissions-Policy = "camera=\(\), microphone=\(\), geolocation=\(self\)"/);
});

test('comparacao aceita coordenadas validadas sem servico externo',()=>{
  const comparison=read('js/comparison.js');
  assert.match(comparison,/function coordinateComparisonEntry\(query\)/);
  assert.match(comparison,/parseCoordinateQuery\(query\)/);
  assert.match(comparison,/coordinateComparisonEntry\(compareDrafts\[slot\]\)\|\|await resolveLocalRouteAddress/);
});
