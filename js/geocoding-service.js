/* Recurso RoutePilot: estrategia hibrida local, Photon, Geoapify e manual. */
(function(root,factory){
  const core=typeof module==='object'&&module.exports?require('./geocoding-core.js'):root.RoutePilotGeocodingCore;
  const search=typeof module==='object'&&module.exports?require('./work-order-search.js'):root.RoutePilotWorkOrderSearch;
  const api=factory(core,search);if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotGeocodingService=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(CORE,SEARCH){
  /** Cria o orquestrador sem acoplar a interface a formatos externos. */
  function create(options){
    const {config,context,localSearch,localReverse,photon,geoapify}=options,cache=new Map();let requestToken=0,activeController=null;
    const now=()=>Date.now(),cacheKey=(provider,operation,value)=>`${provider}:${operation}:${context.signature}:${value}`;
    const getCache=key=>{const entry=cache.get(key);if(!entry||now()-entry.timestamp>config.cacheTtlMs){cache.delete(key);return null;}return entry.value;};
    const putCache=(key,value)=>{cache.set(key,{timestamp:now(),value});return value;};

    /** Consulta um provider uma vez por chave e guarda somente respostas validas. */
    async function callProvider(provider,operation,value,signal){
      if(!provider?.isConfigured())return [];
      const key=cacheKey(provider.name,operation,value),cached=getCache(key);if(cached)return cached;
      const result=operation==='reverse'?await provider.reverseGeocode(value[0],value[1],context,{signal}):await provider[operation](value,context,{signal});
      return putCache(key,Array.isArray(result)?result:[]);
    }

    /** Mescla, deduplica e ordena todos os formatos pelo ranking do RoutePilot. */
    function finish(query,groups){return CORE.rankResults(query,CORE.deduplicate(groups.flat()),context,{limit:config.maximoSugestoes});}

    /** Faz busca local primeiro e economiza chamadas quando o resultado ja e forte. */
    async function search(query,{forceExternal=false}={}){
      const normalized=SEARCH.normalize(query),current=++requestToken;activeController?.abort();activeController=new AbortController();const signal=activeController.signal;
      if(!normalized)return {stale:false,results:[],sources:[],canExpand:false};
      const finalKey=cacheKey('combined',forceExternal?'expanded':'standard',normalized),cached=getCache(finalKey);if(cached)return {...cached,stale:current!==requestToken,cached:true};
      let localRaw=[];
      try{localRaw=await localSearch(query);}catch(error){localRaw=[];}
      const local=localRaw.map(CORE.normalizeLocalResult).filter(Boolean),localRanked=finish(query,[local]);if(current!==requestToken)return {stale:true,results:[]};
      const localStrong=Boolean(localRanked[0]&&!localRanked[0].partialAddress&&localRanked[0].searchScore>=config.pontuacaoLocalForte);
      if(localStrong&&!forceExternal){const result={results:localRanked,sources:['local'],localStrong:true,canExpand:true,warning:''};putCache(finalKey,result);return {...result,stale:false,cached:false};}
      if(normalized.length<config.minimoCaracteres){return {stale:false,results:localRanked,sources:['local'],localStrong:false,canExpand:false,warning:''};}

      const groups=[local],sources=['local'],errors=[];let photonResults=[];
      try{photonResults=await callProvider(photon,'autocomplete',query,signal);groups.push(photonResults);sources.push('photon');}catch(error){if(error.code!=='CANCELLED')errors.push(error);}
      if(current!==requestToken)return {stale:true,results:[]};
      const photonRanked=finish(query,[photonResults]),photonStrong=Boolean(photonRanked[0]&&photonRanked[0].searchScore>=config.pontuacaoExternaForte);
      if(geoapify?.isConfigured()&&(forceExternal||!photonStrong||!photonResults.length)){
        try{groups.push(await callProvider(geoapify,'autocomplete',query,signal));sources.push('geoapify');}catch(error){if(error.code!=='CANCELLED')errors.push(error);}
      }
      if(current!==requestToken)return {stale:true,results:[]};
      const result={results:finish(query,groups),sources,localStrong:false,canExpand:!forceExternal,warning:errors.length?'Busca externa indisponivel ou limitada — usando os resultados disponiveis.':''};
      if(!errors.length)putCache(finalKey,result);return {...result,stale:false,cached:false};
    }

    /** Complementa um ponto manual sem impedir seu uso quando a rede falha. */
    async function reverse(coords){
      const manual=CORE.createManualCandidate(coords),groups=[];if(!manual)return {result:null,warning:'Coordenadas invalidas.'};
      try{const local=await localReverse?.(coords);if(local)groups.push(CORE.normalizeLocalResult(local));}catch(error){}
      if(!groups.length){try{groups.push(...await callProvider(photon,'reverse',coords,new AbortController().signal));}catch(error){}}
      if(!groups.length&&geoapify?.isConfigured()){try{groups.push(...await callProvider(geoapify,'reverse',coords,new AbortController().signal));}catch(error){}}
      const best=CORE.rankResults('',CORE.deduplicate(groups.filter(Boolean)),context,{limit:1})[0]||null;
      return {result:best?{...best,coords:manual.coords,latitude:manual.latitude,longitude:manual.longitude,source:'manual',reverseSource:best.source,locationConfirmed:true}:manual,warning:best?'':'Endereco nao identificado; coordenadas manuais preservadas.'};
    }

    return {search,reverse,cancel(){requestToken++;activeController?.abort();},clearCache(){cache.clear();},status(){return {cacheEntries:cache.size,photonCalls:photon?.calls||0,geoapifyCalls:geoapify?.calls||0,geoapifyConfigured:Boolean(geoapify?.isConfigured())};}};
  }
  return {create};
});
