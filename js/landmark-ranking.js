/* Recurso RoutePilot: seleção das referências mais úteis para navegação. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RoutePilotLandmarks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const CATEGORY_WEIGHT={fuel:110,bridge:105,highway:100,road:98,school:92,church:88,market:86,pharmacy:82,square:80,restaurant:72,reference:68,point:62};
  const ACCESS_CATEGORIES=new Set(['bridge','highway','road','junction','access']);

  /** Normaliza texto apenas para deduplicar nomes equivalentes. */
  function normalizeName(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}

  /** Converte categorias variadas do mapa para grupos úteis ao técnico. */
  function normalizeCategory(item){
    const value=normalizeName(item.category||item.type||item.kind);
    const name=normalizeName(item.name);
    if(/posto|combustivel|fuel/.test(`${value} ${name}`))return 'fuel';
    if(/ponte|bridge/.test(`${value} ${name}`))return 'bridge';
    if(/rodovia|br |rs |highway|trevo/.test(`${value} ${name}`))return 'highway';
    if(/estrada|acesso|road|rua|avenida/.test(`${value} ${name}`))return 'road';
    if(/escola|school|campus/.test(`${value} ${name}`))return 'school';
    if(/igreja|church|templo/.test(`${value} ${name}`))return 'church';
    if(/mercado|supermercado|market/.test(`${value} ${name}`))return 'market';
    if(/farmacia|pharmacy/.test(`${value} ${name}`))return 'pharmacy';
    if(/praca|square/.test(`${value} ${name}`))return 'square';
    if(/restaurante|restaurant/.test(`${value} ${name}`))return 'restaurant';
    return item.kind==='reference'?'reference':'point';
  }

  /** Combina reconhecimento, categoria e distância sem privilegiar apenas o ponto mais perto. */
  function landmarkScore(item){
    const category=normalizeCategory(item),km=Math.max(0,Number(item.km)||0);
    const named=normalizeName(item.name).length>=4?18:-40;
    return (CATEGORY_WEIGHT[category]||50)+named-Math.min(km,12)*5;
  }

  /** Seleciona até três referências complementares e remove duplicidades. */
  function rankLandmarks(items,{limit=3}={}){
    const unique=new Map();
    for(const source of items||[]){
      if(!source?.name||!Number.isFinite(Number(source.km)))continue;
      const item={...source,km:Number(source.km),category:normalizeCategory(source)};
      const key=normalizeName(item.name);
      if(!key)continue;
      if(!unique.has(key)||landmarkScore(item)>landmarkScore(unique.get(key)))unique.set(key,item);
    }
    const ranked=[...unique.values()].sort((a,b)=>landmarkScore(b)-landmarkScore(a)||a.km-b.km);
    const result=[];
    const add=item=>{if(item&&!result.some(existing=>normalizeName(existing.name)===normalizeName(item.name)))result.push(item);};
    add(ranked[0]);
    add([...unique.values()].sort((a,b)=>a.km-b.km)[0]);
    add(ranked.find(item=>ACCESS_CATEGORIES.has(item.category)));
    ranked.forEach(item=>{if(result.length<limit)add(item);});
    return result.slice(0,limit);
  }

  return {CATEGORY_WEIGHT,normalizeName,normalizeCategory,landmarkScore,rankLandmarks};
});
