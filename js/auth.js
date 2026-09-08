/* Login Google do RoutePilot, isolado da Agenda, do mapa e da persistencia. */
const RoutePilotAuth=(()=>{
  let user=null,initialized=false,menuOpen=false,providerPromise=null;
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

  /** Notifica modulos dependentes e atualiza somente os controles de login. */
  function notify(){render();listeners.forEach(listener=>listener(currentUser()));}

  /** Desenha o botao e o menu compacto do usuario no cabecalho. */
  function render(){
    const button=document.getElementById('authButton'),menu=document.getElementById('authMenu');
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
    let provider;try{provider=await loadProvider();}catch(error){render();return null;}
    if(!provider){render();return null;}
    try{await provider.handleAuthCallback();}catch(error){console.warn('Não foi possível concluir o login',error?.message||error);}
    user=await provider.getUser();
    provider.onAuthChange((_event,nextUser)=>{user=nextUser||null;menuOpen=false;notify();});
    notify();return currentUser();
  }

  /** Inicia o fluxo OAuth oficial do Google configurado no Netlify. */
  async function signIn(){
    try{const provider=await loadProvider();if(!provider){showToast('Login indisponível neste ambiente');return;}await provider.oauthLogin('google');}
    catch(error){showToast('Ative o Google em Identity no Netlify');}
  }

  /** Encerra a sessao e fecha imediatamente as areas protegidas. */
  async function signOut(){
    try{await globalThis.RoutePilotIdentityProvider?.logout();user=null;menuOpen=false;globalThis.RoutePilotAgenda?.open?.('map');notify();}
    catch(error){showToast('Não foi possível sair agora');}
  }

  /** Registra eventos do pequeno menu de conta apenas uma vez. */
  function bind(){
    const button=document.getElementById('authButton'),menu=document.getElementById('authMenu');
    if(!button||button.dataset.ready)return;
    button.dataset.ready='true';button.addEventListener('click',()=>{if(!user){signIn();return;}menuOpen=!menuOpen;render();});
    menu.addEventListener('click',event=>{if(event.target.closest('[data-auth-action="logout"]'))signOut();});
    document.addEventListener('click',event=>{if(!menuOpen||event.target.closest('#authButton,#authMenu'))return;menuOpen=false;render();});
  }

  /** Permite que a persistencia atualize seu estado apos login ou logout. */
  function onChange(listener){listeners.add(listener);return()=>listeners.delete(listener);}

  return {init,currentUser,isAuthenticated,signIn,signOut,onChange};
})();
globalThis.RoutePilotAuth=RoutePilotAuth;
