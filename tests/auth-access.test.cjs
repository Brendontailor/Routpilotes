const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

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
  assert.match(auth,/REMEMBER_SESSION_SECONDS=30\*24\*60\*60/);
  assert.match(auth,/max-age=\$\{REMEMBER_SESSION_SECONDS\}/);
  assert.match(auth,/IDENTITY_STORAGE_KEY='gotrue\.user'/);
  assert.match(auth,/restorePersistedSessionCookies\(\);\s*user=await provider\.getUser\(\)/);
  assert.match(auth,/token\?\.access_token/);
});

test('sessao persistida restaura os cookies antes de consultar o usuario',async()=>{
  const cookies=new Map(),writes=[];
  const document={
    get cookie(){return [...cookies].map(([name,value])=>`${name}=${value}`).join('; ');},
    set cookie(value){writes.push(value);const pair=value.split(';',1)[0],separator=pair.indexOf('='),name=pair.slice(0,separator),content=pair.slice(separator+1);cookies.set(name,content);},
    getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}
  };
  let cookieAtGetUser='';
  const context={
    document,location:{protocol:'https:'},localStorage:{getItem:key=>key==='gotrue.user'?JSON.stringify({token:{access_token:'header.payload.signature',refresh_token:'refresh-token'}}):null},
    fetch:async()=>({ok:true,json:async()=>({permissions:{canUseSharedOperations:true}})}),console,URL,
    RoutePilotIdentityProvider:{handleAuthCallback:async()=>null,getUser:async()=>{cookieAtGetUser=document.cookie;return{id:'user-1',email:'user@example.com'};},refreshSession:async()=>null,onAuthChange(){}},
    setTimeout,clearTimeout
  };
  vm.runInNewContext(read('js/auth.js'),context);
  const user=await context.RoutePilotAuth.init();
  assert.equal(user.id,'user-1');
  assert.match(cookieAtGetUser,/nf_jwt=header\.payload\.signature/);
  assert.match(cookieAtGetUser,/nf_refresh=refresh-token/);
  assert.ok(writes.some(value=>/nf_jwt=.*max-age=2592000/.test(value)));
});

test('permissoes geograficas sao consultadas no servidor',()=>{
  const auth=read('js/auth.js'),config=read('netlify.toml');
  assert.match(auth,/fetch\('\/api\/session'/);
  assert.match(auth,/hasCapability/);
  assert.match(config,/from = "\/api\/session"/);
  assert.match(config,/to = "\/\.netlify\/functions\/session"/);
});

test('tema escuro e miniaturas cartograficas usam arquivos locais',()=>{
  const html=read('index.html'),theme=read('js/theme.js'),app=read('js/app.js'),styles=read('css/routepilot.css');
  assert.match(html,/id="themeButton"/);
  assert.match(html,/src="js\/theme\.js"/);
  assert.match(theme,/routepilot-theme/);
  assert.match(app,/function cityMapThumbnail\(city\)/);
  assert.match(styles,/html\[data-theme="dark"\] \.leaflet-tile-pane/);
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
