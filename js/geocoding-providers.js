/* Recurso RoutePilot: adaptadores HTTP para Photon e Geoapify. */
(function(root,factory){
  const core=typeof module==='object'&&module.exports?require('./geocoding-core.js'):root.RoutePilotGeocodingCore;
  const api=factory(core);if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotGeocodingProviders=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(CORE){
  class ProviderError extends Error{constructor(code,message,provider){super(message);this.name='ProviderError';this.code=code;this.provider=provider;}}

  /** Executa uma requisicao com timeout e cancelamento compartilhado. */
  async function fetchJson(url,{fetchImpl=globalThis.fetch,timeoutMs=6500,signal,provider='provider'}={}){
    const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});
    try{
      const response=await fetchImpl(url,{signal:controller.signal,headers:{Accept:'application/json'}});
      if(response.status===429)throw new ProviderError('RATE_LIMIT','Limite temporario de consultas atingido.',provider);
      if(!response.ok)throw new ProviderError('HTTP_ERROR',`Servico respondeu ${response.status}.`,provider);
      const data=await response.json();if(!data||typeof data!=='object')throw new ProviderError('INVALID_RESPONSE','Resposta geografica invalida.',provider);return data;
    }catch(error){
      if(error instanceof ProviderError)throw error;
      if(controller.signal.aborted)throw new ProviderError(signal?.aborted?'CANCELLED':'TIMEOUT',signal?.aborted?'Consulta cancelada.':'Tempo limite da consulta excedido.',provider);
      throw new ProviderError('NETWORK_ERROR','Falha de rede ao consultar o servico.',provider);
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }

  class BaseProvider{
    constructor(name,config={},fetchImpl=globalThis.fetch){this.name=name;this.config=config;this.fetchImpl=fetchImpl;this.cooldownUntil=0;this.calls=0;}
    isConfigured(){return Boolean(this.config.habilitado);}
    /** Protege o servidor de repeticoes imediatas depois de rate limit. */
    async request(url,signal){
      if(Date.now()<this.cooldownUntil)throw new ProviderError('RATE_LIMIT','Servico temporariamente em pausa.',this.name);
      try{this.calls++;return await fetchJson(url,{fetchImpl:this.fetchImpl,timeoutMs:this.config.timeoutMs,signal,provider:this.name});}
      catch(error){if(error.code==='RATE_LIMIT')this.cooldownUntil=Date.now()+(this.config.pausaAposLimiteMs||120000);throw error;}
    }
  }

  class PhotonProvider extends BaseProvider{
    constructor(config,fetchImpl){super('photon',config,fetchImpl);}
    /** Monta parametros comuns com bias e limite da area operacional. */
    url(path,params,context){
      const url=new URL(path,this.config.urlBase.endsWith('/')?this.config.urlBase:`${this.config.urlBase}/`);Object.entries(params).forEach(([key,value])=>value!==''&&value!=null&&url.searchParams.set(key,String(value)));
      if(this.config.idioma)url.searchParams.set('lang',this.config.idioma);url.searchParams.set('limit',String(this.config.limiteResultados||8));
      if(context?.center){url.searchParams.set('lat',String(context.center[0]));url.searchParams.set('lon',String(context.center[1]));}
      if(context?.bbox)url.searchParams.set('bbox',[context.bbox.west,context.bbox.south,context.bbox.east,context.bbox.north].join(','));
      return url.toString();
    }
    async search(query,context,{signal}={}){const data=await this.request(this.url('api',{q:query},context),signal);return (data.features||[]).map(CORE.normalizePhotonFeature).filter(Boolean);}
    autocomplete(query,context,options){return this.search(query,context,options);}
    async reverseGeocode(lat,lon,context,{signal}={}){const data=await this.request(this.url('reverse',{lat,lon},context),signal);return (data.features||[]).map(CORE.normalizePhotonFeature).filter(Boolean);}
  }

  class GeoapifyProvider extends BaseProvider{
    constructor(config,fetchImpl){super('geoapify',config,fetchImpl);}
    isConfigured(){return Boolean(this.config.habilitado&&(this.config.apiKey||this.config.proxyUrl));}
    /** Usa chave centralizada ou um proxy futuro, nunca uma chave espalhada pela UI. */
    url(operation,params,context){
      const proxy=this.config.proxyUrl,url=proxy?new URL(proxy,globalThis.location?.origin||'http://localhost'):new URL(`${this.config.urlBase.replace(/\/$/,'')}/${operation}`);if(proxy)url.searchParams.set('operation',operation);
      Object.entries(params).forEach(([key,value])=>value!==''&&value!=null&&url.searchParams.set(key,String(value)));url.searchParams.set('format','geojson');url.searchParams.set('lang','pt');url.searchParams.set('limit',String(this.config.limiteResultados||8));
      if(context?.bbox)url.searchParams.set('filter',`rect:${context.bbox.west},${context.bbox.south},${context.bbox.east},${context.bbox.north}`);
      if(context?.center)url.searchParams.set('bias',`proximity:${context.center[1]},${context.center[0]}`);
      if(!proxy)url.searchParams.set('apiKey',this.config.apiKey);return url.toString();
    }
    async search(query,context,{signal}={}){if(!this.isConfigured())return [];const data=await this.request(this.url('search',{text:query},context),signal);return (data.features||[]).map(CORE.normalizeGeoapifyFeature).filter(Boolean);}
    async autocomplete(query,context,{signal}={}){if(!this.isConfigured())return [];const data=await this.request(this.url('autocomplete',{text:query},context),signal);return (data.features||[]).map(CORE.normalizeGeoapifyFeature).filter(Boolean);}
    async reverseGeocode(lat,lon,context,{signal}={}){if(!this.isConfigured())return [];const data=await this.request(this.url('reverse',{lat,lon},context),signal);return (data.features||[]).map(CORE.normalizeGeoapifyFeature).filter(Boolean);}
  }

  return {ProviderError,fetchJson,PhotonProvider,GeoapifyProvider};
});
