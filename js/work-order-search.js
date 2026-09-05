/* Recurso RoutePilot: busca tolerante de endereços e localidades para OS. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotWorkOrderSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ABBREVIATIONS={r:'rua',rda:'rua',av:'avenida',avda:'avenida',estr:'estrada',rod:'rodovia',lot:'loteamento',vl:'vila'};
  const NUMBER_WORDS={
    'trinta e nove':'39','trinta e oito':'38','trinta e sete':'37','trinta e seis':'36','trinta e cinco':'35','trinta e quatro':'34','trinta e tres':'33','trinta e dois':'32','trinta e um':'31','vinte e nove':'29','vinte e oito':'28','vinte e sete':'27','vinte e seis':'26','vinte e cinco':'25','vinte e quatro':'24','vinte e tres':'23','vinte e dois':'22','vinte e um':'21',trinta:'30',vinte:'20',dezenove:'19',dezoito:'18',dezessete:'17',dezesseis:'16',quinze:'15',quatorze:'14',treze:'13',doze:'12',onze:'11',dez:'10',nove:'9',oito:'8',sete:'7',seis:'6',cinco:'5',quatro:'4',tres:'3',dois:'2',um:'1'
  };
  /** Normaliza somente para comparação, preservando o texto original na interface. */
  function normalize(value){
    let text=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    text=text.split(' ').map(token=>ABBREVIATIONS[token]||token).join(' ');
    Object.entries(NUMBER_WORDS).sort((a,b)=>b[0].length-a[0].length).forEach(([words,number])=>{text=text.replace(new RegExp(`\\b${words}\\b`,'g'),number);});
    return text.replace(/\s+/g,' ').trim();
  }
  /** Calcula a distância de edição usada na tolerância a erros de digitação. */
  function editDistance(a,b){let previous=Array.from({length:b.length+1},(_,index)=>index);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]!==b[j-1]));previous=row;}return previous[b.length];}
  /** Mede quanto um termo digitado se parece com uma palavra candidata. */
  function tokenSimilarity(queryToken,candidateToken){if(queryToken===candidateToken)return 1;if(/^\d+[a-z]?$/.test(queryToken)||/^\d+[a-z]?$/.test(candidateToken))return 0;if(candidateToken.startsWith(queryToken)||queryToken.startsWith(candidateToken))return .9;const longest=Math.max(queryToken.length,candidateToken.length);if(longest<4)return 0;const distance=editDistance(queryToken,candidateToken),limit=longest>=8?2:1;return distance<=limit?Math.max(.55,1-distance/longest):0;}
  /** Pontua um candidato combinando cobertura dos termos, nome e prioridade local. */
  function scoreCandidate(query,candidate){
    const normalizedQuery=normalize(query),name=normalize(candidate.name),full=normalize([candidate.name,candidate.context,candidate.cityName,candidate.locality].filter(Boolean).join(' '));if(!normalizedQuery||!full)return 0;
    if(name===normalizedQuery)return 1000+(candidate.localPriority||0);
    const queryTokens=normalizedQuery.split(' '),candidateTokens=full.split(' '),scores=queryTokens.map(token=>Math.max(0,...candidateTokens.map(word=>tokenSimilarity(token,word))));
    const coverage=scores.filter(score=>score>=.55).length/queryTokens.length,average=scores.reduce((sum,score)=>sum+score,0)/queryTokens.length;if(coverage<.4)return 0;
    const nameTokens=name.split(' '),nameBonus=name.includes(normalizedQuery)?120:queryTokens.every(token=>nameTokens.some(word=>tokenSimilarity(token,word)>=.9))?80:0;
    const matchedName=nameTokens.filter(word=>queryTokens.some(token=>tokenSimilarity(token,word)>=.9)).length,precisionBonus=nameTokens.length?matchedName/nameTokens.length*80:0;
    return Math.round(coverage*520+average*300+nameBonus+precisionBonus+(candidate.localPriority||0));
  }
  /** Pontua uma via sem deixar o número da casa reduzir a semelhança do nome. */
  function scoreStreetCandidate(query,candidate){
    const normalizedQuery=normalize(query),streetTokens=new Set(normalize(candidate.name).split(' '));
    const streetQuery=normalizedQuery.split(' ').filter(token=>!/^\d+[a-z]?$/.test(token)||streetTokens.has(token)).join(' ');
    return Math.max(scoreCandidate(normalizedQuery,candidate),scoreCandidate(streetQuery,candidate));
  }
  /** Ordena resultados locais da maior para a menor probabilidade. */
  function rank(query,candidates,{limit=5}={}){return candidates.map(candidate=>({...candidate,searchScore:scoreCandidate(query,candidate)})).filter(candidate=>candidate.searchScore>0).sort((a,b)=>b.searchScore-a.searchScore||String(a.name).localeCompare(String(b.name),'pt-BR')).slice(0,limit);}
  /** Coordena cache e descarta respostas assíncronas que ficaram antigas. */
  function createCoordinator(provider){
    const cache=new Map();let token=0;
    return {async search(query){const normalized=normalize(query),current=++token;if(!normalized)return {stale:false,results:[]};if(cache.has(normalized))return {stale:current!==token,cached:true,results:cache.get(normalized)};const results=await provider(query);if(current!==token)return {stale:true,results:[]};cache.set(normalized,results);return {stale:false,cached:false,results};},cancel(){token++;},cache};
  }
  return {normalize,editDistance,tokenSimilarity,scoreCandidate,scoreStreetCandidate,rank,createCoordinator};
});
