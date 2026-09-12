/* Login Google do RoutePilot, isolado da Agenda, do mapa e da persistencia. */
const RoutePilotAuth=(()=>{
  let user=null,initialized=false,menuOpen=false,providerPromise=null,accessState='checking',accessMessage='',lastSessionRefresh=0,sessionRefreshPromise=null;
  const listeners=new Set();
  const SESSION_REFRESH_INTERVAL_MS=5*60*1000;
  const REMEMBER_SESSION_SECONDS=30*24*60*60;

  /** Le um cookie de autenticacao sem expor seu valor fora deste modulo. */
  function authCookie(name){const match=document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}=([^;]*)`));return match?.[1]||'';}

  /** Mantem a sessao renovavel por 30 dias neste computador. */
  function rememberSessionCookies(){if(location.protocol!=='https:')return;['nf_jwt','nf_refresh'].forEach(name=>{const value=authCookie(name);if(value)document.cookie=`${name}=${value}; path=/; secure; samesite=lax; max-age=${REMEMBER_SESSION_SECONDS}`;});}

  /** Consulta capacidades calculadas pelo servidor para esta conta. */
  async function loadPermissions(){
    try{const response=await fetch('/api/session',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'}),body=await response.json().catch(()=>({}));return response.ok?body.permissions||{}:{};}
    catch{return {};}
  }

  /** Carrega a biblioteca local de identidade somente em HTTPS, como exigido pelo provedor. */
  function loadProvider(){
    if(globalThis.RoutePilotIdentityProvider)return Promise.resolve(globalThis.RoutePilotIdentityProvider);
    if(location.protocol!=='https:')return Promise.resolve(null);
    if(!providerPromise)providerPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/netlify-identity.js',document.baseURI).href;script.onload=()=>resolve(globalThis.RoutePilotIdentityProvider||null);script.onerror=()=>reject(new Error('identity_client_unavailable'));document.head.append(script);});
    return providerPromise;
  }

  /** Informa o usuario atual sem permitir alteracao do estado interno. */
  function currentUser(){return user?{...user}:null;}

  /** Indica se existe uma sessao autenticada neste navegador. */
  function isAuthenticated(){return Boolean(user?.id);}

  /** Confirma uma permissao recebida do servidor. */
  function hasCapability(name){return Boolean(user?.permissions?.[name]);}

  /** Bloqueia todos os recursos do sistema ate a autenticacao ser confirmada. */
  function setApplicationLocked(locked){
    ['header','app','operationsWorkspace','.system-footer'].forEach(selector=>{
      const element=selector.startsWith('.')?document.querySelector(selector):document.getElementById(selector)||document.querySelector(selector);
      if(!element)return;
      element.inert=locked;
      element.setAttribute('aria-hidden',String(locked));
    });
  }

  /** Atualiza a tela de acesso sem expor a interface durante a verificacao. */
  function renderAccessGate(){
    const gate=document.getElementById('authGate'),message=document.getElementById('authGateMessage'),button=document.getElementById('authGateButton'),help=document.getElementById('authGateHelp');
    if(!gate)return;
    const locked=accessState!=='authenticated';
    document.body.classList.toggle('auth-pending',accessState==='checking');
    document.body.classList.toggle('auth-required',locked&&accessState!=='checking');
    gate.hidden=!locked;
    setApplicationLocked(locked);
    if(!locked)return;
    message.textContent=accessState==='checking'?'Verificando sua sessão...':accessMessage||'Entre com sua conta Google para continuar.';
    button.hidden=accessState==='checking';
    button.disabled=accessState==='checking';
    help.textContent=location.protocol==='https:'?'A agenda e o mapa são restritos aos usuários autorizados.':'O login está disponível somente na versão HTTPS publicada no Netlify.';
  }

  /** Notifica modulos dependentes e atualiza os controles de acesso. */
  function notify(){accessState=user?'authenticated':'required';render();listeners.forEach(listener=>listener(currentUser()));}

  /** Desenha o botao e o menu compacto do usuario no cabecalho. */
  function render(){
    const button=document.getElementById('authButton'),menu=document.getElementById('authMenu');
    renderAccessGate();
    const sharedOperations=Boolean(user?.permissions?.canUseSharedOperations);
    document.querySelectorAll('[data-main-tab="create"],[data-main-tab="agenda"]').forEach(tab=>{tab.hidden=Boolean(user)&&!sharedOperations;});
    if(!button||!menu)return;
    button.textContent=user?(user.name||user.email||'Minha conta'):'Entrar com Google';
    button.setAttribute('aria-expanded',String(Boolean(user&&menuOpen)));
    button.classList.toggle('is-authenticated',Boolean(user));
    if(!user){menu.hidden=true;menu.innerHTML='';return;}
    menu.hidden=!menuOpen;
    const role=user.permissions?.canManageSharedMap?'Administrador do mapa':sharedOperations?'Operador':'Usuário do mapa';
    menu.innerHTML=`<strong>${esc(user.name||'Usuário RoutePilot')}</strong><small>${esc(user.email||'')}</small><small>${esc(role)}</small><button type="button" data-auth-action="logout">Sair</button>`;
  }

  /** Conclui retornos OAuth e recupera a sessao mantida pelo Netlify Identity. */
  async function init(){
    if(initialized)return currentUser();
    initialized=true;
    bind();
    let provider;try{provider=await loadProvider();}catch(error){accessState='required';accessMessage='Não foi possível carregar o login. Atualize a página e tente novamente.';render();return null;}
    if(!provider){accessState='required';accessMessage='Abra a versão HTTPS publicada no Netlify para entrar.';render();return null;}
    try{await provider.handleAuthCallback();rememberSessionCookies();}catch(error){accessState='required';accessMessage='O retorno do Google não pôde ser concluído. Tente entrar novamente.';console.warn('Não foi possível concluir o login',error?.message||error);}
    user=await provider.getUser();
    if(user){await provider.refreshSession?.();rememberSessionCookies();user={...user,permissions:await loadPermissions()};}
    provider.onAuthChange(async (_event,nextUser)=>{user=nextUser?{...nextUser,permissions:await loadPermissions()}:null;if(nextUser)rememberSessionCookies();menuOpen=false;notify();});
    notify();return currentUser();
  }

  /** Inicia o fluxo OAuth oficial do Google configurado no Netlify. */
  async function signIn(){
    accessState='checking';accessMessage='';render();
    try{const provider=await loadProvider();if(!provider){accessState='required';accessMessage='Abra a versão HTTPS publicada no Netlify para entrar.';render();return;}await provider.oauthLogin('google');}
    catch(error){if(/Redirecting to OAuth provider/i.test(error?.message||''))return;accessState='required';accessMessage='Não foi possível abrir o login Google. Confira o provedor no Netlify.';render();}
  }

  /** Encerra a sessao e fecha imediatamente as areas protegidas. */
  async function signOut(){
    try{await globalThis.RoutePilotIdentityProvider?.logout();}
    catch(error){showToast('A sessão foi encerrada neste computador, mas o servidor não respondeu.');}
    finally{
      ['nf_jwt','nf_refresh'].forEach(name=>{document.cookie=`${name}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;});
      user=null;menuOpen=false;globalThis.RoutePilotAgenda?.open?.('map');notify();
    }
  }

  /** Renova silenciosamente o token ao retomar a aba sem desconectar por falha de rede. */
  async function refreshConnectedSession(){
    if(!user||Date.now()-lastSessionRefresh<SESSION_REFRESH_INTERVAL_MS)return;
    if(sessionRefreshPromise)return sessionRefreshPromise;
    lastSessionRefresh=Date.now();
    sessionRefreshPromise=(async()=>{try{const provider=await loadProvider();await provider?.refreshSession?.();rememberSessionCookies();}catch(error){console.warn('Não foi possível renovar a sessão agora',error?.message||error);}finally{sessionRefreshPromise=null;}})();
    return sessionRefreshPromise;
  }

  /** Registra eventos do pequeno menu de conta apenas uma vez. */
  function bind(){
    const button=document.getElementById('authButton'),gateButton=document.getElementById('authGateButton'),menu=document.getElementById('authMenu');
    if(!button||button.dataset.ready)return;
    button.dataset.ready='true';button.addEventListener('click',()=>{if(!user){signIn();return;}menuOpen=!menuOpen;render();});
    gateButton?.addEventListener('click',signIn);
    menu.addEventListener('click',event=>{if(event.target.closest('[data-auth-action="logout"]'))signOut();});
    document.addEventListener('click',event=>{if(!menuOpen||event.target.closest('#authButton,#authMenu'))return;menuOpen=false;render();});
    window.addEventListener('online',refreshConnectedSession);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshConnectedSession();});
  }

  /** Permite que a persistencia atualize seu estado apos login ou logout. */
  function onChange(listener){listeners.add(listener);return()=>listeners.delete(listener);}

  renderAccessGate();
  return {init,currentUser,isAuthenticated,hasCapability,signIn,signOut,onChange};
})();
globalThis.RoutePilotAuth=RoutePilotAuth;
