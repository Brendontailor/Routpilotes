/* Preferencia visual clara ou escura, mantida somente neste computador. */
const RoutePilotTheme=(()=>{
  const STORAGE_KEY='routepilot-theme';

  /** Escolhe a preferencia salva ou acompanha o sistema operacional no primeiro uso. */
  function initialTheme(){const saved=localStorage.getItem(STORAGE_KEY);return ['light','dark'].includes(saved)?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}

  /** Aplica cores e atualiza o nome acessivel do controle. */
  function apply(theme,{persist=false}={}){
    const value=theme==='dark'?'dark':'light';document.documentElement.dataset.theme=value;if(persist)localStorage.setItem(STORAGE_KEY,value);
    const button=document.getElementById('themeButton');if(button){const dark=value==='dark';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Usar modo claro':'Usar modo escuro');button.title=dark?'Usar modo claro':'Usar modo escuro';button.querySelector('span').textContent=dark?'Modo claro':'Modo escuro';}
  }

  /** Alterna o tema sem alterar dados operacionais ou geograficos. */
  function toggle(){apply(document.documentElement.dataset.theme==='dark'?'light':'dark',{persist:true});}

  apply(initialTheme());document.getElementById('themeButton')?.addEventListener('click',toggle);
  return {apply,toggle,current:()=>document.documentElement.dataset.theme};
})();
globalThis.RoutePilotTheme=RoutePilotTheme;
