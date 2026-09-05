/* Recurso RoutePilot: montagem segura de mensagens geográficas. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RoutePilotLocationShare=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VALID_MODES=new Set(['quick','detailed','location']);

  /** Formata quilômetros de modo curto para mensagens operacionais. */
  function formatDistance(km){
    const value=Number(km);
    if(!Number.isFinite(value))return '';
    return value<1?`${Math.round(value*1000)} m`:`${value.toLocaleString('pt-BR',{maximumFractionDigits:1})} km`;
  }

  /** Copia somente campos geográficos permitidos e descarta qualquer dado pessoal extra. */
  function sanitizeLocation(source={}){
    const coords=Array.isArray(source.coords)?source.coords.map(Number):[];
    if(coords.length!==2||!Number.isFinite(coords[0])||!Number.isFinite(coords[1]))throw new Error('Coordenadas inválidas para compartilhamento.');
    return {
      name:String(source.name||'Ponto identificado').trim().slice(0,120),
      city:String(source.city||'').trim().slice(0,80),
      region:String(source.region||'').trim().slice(0,100),
      access:String(source.access||'').trim().slice(0,180),
      link:String(source.link||'').trim().slice(0,500),
      coords,
      landmarks:(source.landmarks||[]).slice(0,3).map(item=>({name:String(item.name||'').trim().slice(0,100),km:Number(item.km),category:String(item.category||'')})).filter(item=>item.name)
    };
  }

  /** Monta mensagem rápida, detalhada ou apenas com a localização. */
  function buildLocationMessage(source,{mode='quick'}={}){
    const location=sanitizeLocation(source),selectedMode=VALID_MODES.has(mode)?mode:'quick';
    const coordinates=`${location.coords[0].toFixed(6)}, ${location.coords[1].toFixed(6)}`;
    if(selectedMode==='location')return `📍 ${coordinates}\n${location.link}`.trim();
    const place=[location.name,location.city?`${location.city}/RS`:null].filter(Boolean).join(' – ');
    const lines=['📍 Localização do atendimento','',place];
    if(selectedMode==='quick'){
      const landmark=location.landmarks[0];
      if(landmark)lines.push('',`🧭 Próximo a ${landmark.name}${Number.isFinite(landmark.km)?` — ${formatDistance(landmark.km)}`:''}`);
    }else{
      if(location.region)lines.push('',`📌 Região: ${location.region}`);
      if(location.landmarks.length)lines.push('','🧭 Referências próximas:',...location.landmarks.map(item=>`• ${item.name}${Number.isFinite(item.km)?` — ${formatDistance(item.km)}`:''}`));
      if(location.access)lines.push('',`🛣️ Acesso: ${location.access}`);
      lines.push('',`Coordenadas: ${coordinates}`);
    }
    if(location.link)lines.push('',`📍 ${location.link}`);
    return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  return {VALID_MODES,formatDistance,sanitizeLocation,buildLocationMessage};
});
