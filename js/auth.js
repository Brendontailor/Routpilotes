/* Login Google do RoutePilot, isolado da Agenda, do mapa e da persistencia. */
const RoutePilotAuth=(()=>{
  let user=null,initialized=false,menuOpen=false,providerPromise=null,accessState='checking',accessMessage='';
  const listeners=new Set();

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
    if(!button||!menu)return;
    button.textContent=user?(user.name||user.email||'Minha conta'):'Entrar com Google';
    button.setAttribute('aria-expanded',String(Boolean(user&&menuOpen)));
    button.classList.toggle('is-authenticated',Boolean(user));
    if(!user){menu.hidden=true;menu.innerHTML='';return;}
    menu.hidden=!menuOpen;
    menu.innerHTML=`<strong>${esc(user.name||'Usuário RoutePilot')}</strong><small>${esc(user.email||'')}</small><button type="button" data-auth-action="logout">Sair</button>`;
  }

  /** Conclui retornos OAuth e recupera a sessao mantida pelo Netlify Identity. */
  async function init(){
    if(initialized)return currentUser();
    initialized=true;
    bind();
    let provider;try{provider=await loadProvider();}catch(error){accessState='required';accessMessage='Não foi possível carregar o login. Atualize a página e tente novamente.';render();return null;}
    if(!provider){accessState='required';accessMessage='Abra a versão HTTPS publicada no Netlify para entrar.';render();return null;}
    try{await provider.handleAuthCallback();}catch(error){accessState='required';accessMessage='O retorno do Google não pôde ser concluído. Tente entrar novamente.';console.warn('Não foi possível concluir o login',error?.message||error);}
    user=await provider.getUser();
    provider.onAuthChange((_event,nextUser)=>{user=nextUser||null;menuOpen=false;notify();});
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
    try{await globalThis.RoutePilotIdentityProvider?.logout();user=null;menuOpen=false;globalThis.RoutePilotAgenda?.open?.('map');notify();}
    catch(error){showToast('Não foi possível sair agora');}
  }

  /** Registra eventos do pequeno menu de conta apenas uma vez. */
  function bind(){
    const button=document.getElementById('authButton'),gateButton=document.getElementById('authGateButton'),menu=document.getElementById('authMenu');
    if(!button||button.dataset.ready)return;
    button.dataset.ready='true';button.addEventListener('click',()=>{if(!user){signIn();return;}menuOpen=!menuOpen;render();});
    gateButton?.addEventListener('click',signIn);
    menu.addEventListener('click',event=>{if(event.target.closest('[data-auth-action="logout"]'))signOut();});
    document.addEventListener('click',event=>{if(!menuOpen||event.target.closest('#authButton,#authMenu'))return;menuOpen=false;render();});
  }

  /** Permite que a persistencia atualize seu estado apos login ou logout. */
  function onChange(listener){listeners.add(listener);return()=>listeners.delete(listener);}

  renderAccessGate();
  return {init,currentUser,isAuthenticated,signIn,signOut,onChange};
})();
globalThis.RoutePilotAuth=RoutePilotAuth;
