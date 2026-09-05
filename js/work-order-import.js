/* Recurso RoutePilot: leitura segura de OS copiadas de outros sistemas. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotWorkOrderImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const MONTHS={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  /** Remove somente a marcação visual comum do texto copiado. */
  function cleanText(text){return String(text||'').replace(/\*\*/g,'').replace(/&#x20;|&nbsp;/gi,' ').replace(/\\@/g,'@').replace(/^\s*#+\s*/gm,'').replace(/\u00a0/g,' ').trim();}
  /** Converte uma data extensa em português para AAAA-MM-DD. */
  function parseDate(value){
    const match=normalize(value).match(/(?:[a-z-]+,?\s*)?(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);if(!match)return null;
    const month=MONTHS[match[2]];if(!month)return null;return `${match[3]}-${String(month).padStart(2,'0')}-${String(Number(match[1])).padStart(2,'0')}`;
  }
  /** Relaciona o assunto externo com um tipo de serviço conhecido. */
  function serviceTypeFromSubject(subject){const value=normalize(subject);if(value.includes('instal'))return 'installation';if(value.includes('mudanca')&&value.includes('endereco'))return 'address_change';if(value.includes('equipamento'))return 'equipment_pickup';if(value.includes('conector'))return 'connector_pickup';return 'maintenance';}
  /** Reconhece somente cidades que fazem parte da área operacional atual. */
  function cityFromAddress(rawAddress){return String(rawAddress||'').match(/\b(Pelotas|Cap[aã]o do Le[aã]o|Morro Redondo|Cangu[cç]u|Cerrito)\b/i)?.[1]||'';}
  /** Simplifica o endereço externo mantendo rua, número, bairro e cidade. */
  function formatAddress(rawAddress,neighborhood){
    const raw=String(rawAddress||'').trim(),city=cityFromAddress(raw);
    const street=raw.includes(' - ')?raw.split(/\s+-\s+/).at(-1).trim():raw.replace(/^RS\s+/i,'').replace(/^\S+\s+\d{5}-\d{3}\s+/,'').trim();
    return [street,neighborhood,city,'RS'].filter((value,index,array)=>value&&array.findIndex(item=>normalize(item)===normalize(value))===index).join(', ');
  }
  /** Extrai apenas os campos usados pelo RoutePilot e ignora login e metadados extras. */
  function parse(text){
    const fields={};cleanText(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).forEach(line=>{const match=line.match(/^([^:]+):\s*(.*)$/);if(match)fields[normalize(match[1])]=match[2].trim();});
    const time=String(fields.horario||'').match(/(\d{1,2}:\d{2})\s*(?:-|–|a)\s*(\d{1,2}:\d{2})/),start=time?.[1]||null,end=time?.[2]||null,startHour=start?Number(start.split(':')[0]):null,neighborhood=fields.bairro||'';
    return {externalId:fields.d||null,customerName:fields.cliente||'',serviceType:serviceTypeFromSubject(fields.assunto),technicianName:String(fields['colaborador(a)']||fields.colaborador||'').replace(/\s+-\s+(?:FUNCION[AÁ]RIO|TERCEIRIZADO).*$/i,'').trim(),date:parseDate(fields.data),shift:startHour===null?'any':startHour<12?'morning':'afternoon',timeConstraint:start&&end?{type:'window',start,end}:{type:'free',start:null,end:null},address:formatAddress(fields.endereco,neighborhood),locality:neighborhood,city:cityFromAddress(fields.endereco),ignoredFields:['login']};
  }
  return {cleanText,parseDate,serviceTypeFromSubject,cityFromAddress,formatAddress,parse};
});
