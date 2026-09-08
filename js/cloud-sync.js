/* Sincronizacao opcional: o RoutePilot continua funcional quando o Neon esta offline. */
const RoutePilotCloudSync=(()=>{
  const ENDPOINT='/api/data',TIMEOUT_MS=5000;
  let unavailableUntil=0;

  /** Faz uma chamada curta e desativa novas tentativas por um minuto apos falha. */
  async function request(collection,options={}){
    if(!globalThis.RoutePilotAuth?.isAuthenticated())throw new Error('authentication_required');
    if(Date.now()<unavailableUntil)throw new Error('Sincronizacao temporariamente indisponivel');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      const response=await fetch(`${ENDPOINT}?collection=${encodeURIComponent(collection)}`,{...options,credentials:'same-origin',headers:{accept:'application/json','content-type':'application/json',...(options.headers||{})},signal:controller.signal});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'Falha na sincronizacao');
      return body;
    }catch(error){unavailableUntil=Date.now()+60_000;throw error;}
    finally{clearTimeout(timer);}
  }

  /** Busca os registros compartilhados de uma colecao permitida. */
  async function list(collection){return (await request(collection)).records||[];}

  /** Envia um registro ja sanitizado pelo armazenamento local. */
  async function upsert(collection,record){return request(collection,{method:'PUT',body:JSON.stringify({record})});}

  /** Exclui um registro dentro do escopo definido pelo servidor. */
  async function remove(collection,id,updatedAt=new Date().toISOString()){return request(collection,{method:'DELETE',body:JSON.stringify({id,updatedAt})});}

  /** Libera uma nova tentativa manual apos a conexao voltar. */
  function retry(){unavailableUntil=0;}

  return {list,upsert,remove,retry};
})();
globalThis.RoutePilotCloudSync=RoutePilotCloudSync;
