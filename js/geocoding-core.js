/* Recurso RoutePilot: modelo interno, ranking e deduplicacao de geocodificacao. */
(function(root,factory){
  const search=typeof module==='object'&&module.exports?require('./work-order-search.js'):root.RoutePilotWorkOrderSearch;
  const api=factory(search);if(typeof module==='object'&&module.exports)module.exports=api;root.RoutePilotGeocodingCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(SEARCH){
  const SOURCE_BONUS={local:190,photon:55,geoapify:45,manual:20};

  /** Confirma e converte coordenadas para o formato interno [latitude, longitude]. */
  function coordinates(latitude,longitude){
    const lat=Number(latitude),lon=Number(longitude);
    return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180?[lat,lon]:null;
  }

  /** Monta um rotulo legivel sem repetir partes iguais do endereco. */
  function addressLabel(parts){
    const seen=new Set();return parts.filter(Boolean).map(String).filter(part=>{const key=SEARCH.normalize(part);if(!key||seen.has(key))return false;seen.add(key);return true;}).join(', ');
  }

  /** Cria um identificador estavel apenas para o ciclo da sugestao. */
  function resultId(source,parts){return `${source}:${SEARCH.normalize(parts.filter(Boolean).join(':'))}`;}

  /** Converte uma feature GeoJSON do Photon para o modelo unico do RoutePilot. */
  function normalizePhotonFeature(feature){
    const properties=feature?.properties||{},coords=coordinates(feature?.geometry?.coordinates?.[1],feature?.geometry?.coordinates?.[0]);if(!coords)return null;
    const street=properties.street||properties.name||'',houseNumber=String(properties.housenumber||properties.house_number||''),locality=properties.locality||properties.suburb||properties.district||'',city=properties.city||properties.town||properties.village||properties.county||'';
    const label=addressLabel([houseNumber&&street?`${street}, ${houseNumber}`:street||properties.name,locality,city,properties.state]);
    return {id:resultId('photon',[properties.osm_type,properties.osm_id,label,...coords]),source:'photon',label,name:label,formattedAddress:label,street,houseNumber,locality,district:properties.district||properties.suburb||'',city,cityName:city,state:properties.state||'',country:properties.country||'',postcode:properties.postcode||'',latitude:coords[0],longitude:coords[1],coords,confidence:Number(properties.importance)||0,approximate:!houseNumber,raw:feature};
  }

  /** Converte uma feature GeoJSON do Geoapify para o modelo unico do RoutePilot. */
  function normalizeGeoapifyFeature(feature){
    const properties=feature?.properties||{},coords=coordinates(properties.lat??feature?.geometry?.coordinates?.[1],properties.lon??feature?.geometry?.coordinates?.[0]);if(!coords)return null;
    const street=properties.street||properties.name||'',houseNumber=String(properties.housenumber||''),locality=properties.suburb||properties.district||properties.city_district||'',city=properties.city||properties.town||properties.village||properties.county||'',label=properties.formatted||addressLabel([houseNumber&&street?`${street}, ${houseNumber}`:street||properties.name,locality,city,properties.state]);
    return {id:resultId('geoapify',[properties.place_id,label,...coords]),source:'geoapify',label,name:label,formattedAddress:label,street,houseNumber,locality,district:properties.district||properties.suburb||'',city,cityName:city,state:properties.state||'',country:properties.country||'',postcode:properties.postcode||'',latitude:coords[0],longitude:coords[1],coords,confidence:Number(properties.rank?.confidence)||0,approximate:!houseNumber,raw:feature};
  }

  /** Adapta um resultado local existente sem expor detalhes dos arquivos fragmentados. */
  function normalizeLocalResult(item){
    const coords=coordinates(item?.coords?.[0],item?.coords?.[1]);if(!coords)return null;
    const formattedAddress=item.formattedAddress||item.name||'',match=formattedAddress.match(/,\s*([0-9]+[a-z]?)\s*$/i),street=match?formattedAddress.slice(0,match.index).trim():formattedAddress;
    return {...item,id:item.id||resultId('local',[formattedAddress,...coords]),source:'local',label:formattedAddress,name:formattedAddress,formattedAddress,street,houseNumber:match?.[1]||'',cityName:item.cityName||item.city||'',latitude:coords[0],longitude:coords[1],coords,confidence:item.approximate?.55:1,approximate:Boolean(item.approximate),raw:null};
  }

  /** Mede a distancia entre dois candidatos para eliminar repeticoes entre providers. */
  function distanceMeters(a,b){
    const toRad=value=>value*Math.PI/180,dLat=toRad(b[0]-a[0]),dLon=toRad(b[1]-a[1]),lat1=toRad(a[0]),lat2=toRad(b[0]);
    const value=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 6371000*2*Math.atan2(Math.sqrt(value),Math.sqrt(Math.max(0,1-value)));
  }

  /** Verifica se um ponto esta dentro do retangulo operacional. */
  function insideBoundingBox(coords,bbox){return Boolean(coords&&bbox&&coords[0]>=bbox.south&&coords[0]<=bbox.north&&coords[1]>=bbox.west&&coords[1]<=bbox.east);}

  /** Testa o ponto nos contornos operacionais sem criar nova informacao geografica. */
  function pointInsidePolygon(coords,polygon){
    let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const yi=polygon[i][0],xi=polygon[i][1],yj=polygon[j][0],xj=polygon[j][1];
      if((yi>coords[0])!==(yj>coords[0])&&coords[1]<(xj-xi)*(coords[0]-yi)/(yj-yi)+xi)inside=!inside;
    }return inside;
  }

  /** Centraliza cidades, centro e limites usados como contexto pelos providers. */
  function createOperationContext(regions,cityNames,preferredCenter){
    const allCoordinates=regions.flatMap(region=>region.polygon?.length?region.polygon:[region.center]).filter(Boolean),latitudes=allCoordinates.map(item=>item[0]),longitudes=allCoordinates.map(item=>item[1]);
    const bbox={south:Math.min(...latitudes),west:Math.min(...longitudes),north:Math.max(...latitudes),east:Math.max(...longitudes)},cities=[...new Set(regions.map(region=>region.city))].map(id=>({id,name:cityNames[id]||id,normalized:SEARCH.normalize(cityNames[id]||id)}));
    return {regions,cityNames,cities,preferredCities:cities.map(item=>item.name),center:preferredCenter||[(bbox.south+bbox.north)/2,(bbox.west+bbox.east)/2],bbox,signature:cities.map(item=>item.id).sort().join('|')};
  }

  /** Associa um resultado externo a uma regiao somente quando o ponto cai no poligono. */
  function applyOperationContext(candidate,context){
    const region=context.regions.filter(item=>pointInsidePolygon(candidate.coords,item.polygon||[])).sort((a,b)=>distanceMeters(candidate.coords,a.center)-distanceMeters(candidate.coords,b.center))[0]||null;
    const namedCity=context.cities.find(item=>item.normalized===SEARCH.normalize(candidate.city));
    return {...candidate,region:region?.id||candidate.region||null,city:region?.city||namedCity?.id||candidate.city||'',cityName:region?(context.cityNames[region.city]||region.city):(namedCity?.name||candidate.cityName||candidate.city||''),locality:candidate.locality||region?.name||'',insideOperation:insideBoundingBox(candidate.coords,context.bbox)};
  }

  /** Marca quando a rua foi localizada, mas o numero digitado nao foi confirmado. */
  function annotateNumberMatch(query,candidate){
    const queryNumbers=SEARCH.normalize(query).match(/\b\d+[a-z]?\b/g)||[],streetNumbers=new Set(SEARCH.normalize(candidate.street||'').match(/\b\d+[a-z]?\b/g)||[]),requested=queryNumbers.filter(number=>!streetNumbers.has(number)).at(-1)||'',houseNumber=SEARCH.normalize(candidate.houseNumber||'');
    const numberConfirmed=!requested||requested===houseNumber;
    return {...candidate,requestedHouseNumber:requested,numberConfirmed,partialAddress:Boolean(requested&&!numberConfirmed),approximate:Boolean(candidate.approximate||requested&&!numberConfirmed)};
  }

  /** Calcula relevancia textual, geografica, de origem e completude. */
  function scoreResult(query,candidate,context){
    const annotated=annotateNumberMatch(query,candidate),textScore=SEARCH.normalize(query)?SEARCH.scoreCandidate(query,{name:annotated.formattedAddress||annotated.name,context:[annotated.street,annotated.locality,annotated.cityName,annotated.state].join(' '),localPriority:0}):200;
    const cityMatch=context.cities.some(city=>SEARCH.tokenSimilarity(city.normalized,SEARCH.normalize(annotated.cityName||annotated.city))>=.9),complete=[annotated.street,annotated.houseNumber,annotated.locality,annotated.cityName].filter(Boolean).length;
    const queryTokens=SEARCH.normalize(query).split(' ').filter(Boolean),streetTokens=SEARCH.normalize(annotated.street).split(' ').filter(Boolean),streetPrecision=streetTokens.length?streetTokens.filter(token=>queryTokens.some(queryToken=>SEARCH.tokenSimilarity(queryToken,token)>=.9)).length/streetTokens.length:0;
    return textScore+(SOURCE_BONUS[annotated.source]||0)+(annotated.insideOperation?120:-260)+(cityMatch?90:0)+(annotated.numberConfirmed&&annotated.requestedHouseNumber?150:0)+Math.round(streetPrecision*240)+complete*12+Math.round((annotated.confidence||0)*40);
  }

  /** Ordena candidatos de qualquer origem pelo mesmo criterio interno. */
  function rankResults(query,candidates,context,{limit=5}={}){
    return candidates.filter(Boolean).map(candidate=>applyOperationContext(annotateNumberMatch(query,candidate),context)).map(candidate=>({...candidate,searchScore:scoreResult(query,candidate,context)})).filter(candidate=>candidate.searchScore>0&&candidate.insideOperation).sort((a,b)=>b.searchScore-a.searchScore||String(a.formattedAddress).localeCompare(String(b.formattedAddress),'pt-BR')).slice(0,limit);
  }

  /** Une sugestoes equivalentes sem esconder numeros diferentes da mesma rua. */
  function deduplicate(candidates){
    const unique=[];for(const candidate of candidates){
      const label=SEARCH.normalize(candidate.formattedAddress||candidate.name),street=SEARCH.normalize(candidate.street),city=SEARCH.normalize(candidate.cityName||candidate.city),number=SEARCH.normalize(candidate.houseNumber);
      const duplicate=unique.some(item=>{
        const sameLabel=label&&label===SEARCH.normalize(item.formattedAddress||item.name)&&city===SEARCH.normalize(item.cityName||item.city);
        const sameAddress=street&&street===SEARCH.normalize(item.street)&&city===SEARCH.normalize(item.cityName||item.city)&&number&&number===SEARCH.normalize(item.houseNumber);
        const close=distanceMeters(candidate.coords,item.coords)<=15&&(sameAddress||sameLabel);
        return sameLabel||sameAddress||close;
      });
      if(!duplicate)unique.push(candidate);
    }return unique;
  }

  /** Cria um ponto manual valido mesmo quando o reverse geocoding falha. */
  function createManualCandidate(coords,label='Ponto selecionado no mapa'){
    const valid=coordinates(coords?.[0],coords?.[1]);if(!valid)return null;
    return {id:resultId('manual',[...valid]),source:'manual',label,name:label,formattedAddress:label,street:'',houseNumber:'',locality:'Ponto selecionado',district:'',city:'',cityName:'',state:'',country:'',latitude:valid[0],longitude:valid[1],coords:valid,confidence:1,approximate:false,raw:null,locationConfirmed:true};
  }

  return {coordinates,addressLabel,normalizePhotonFeature,normalizeGeoapifyFeature,normalizeLocalResult,distanceMeters,insideBoundingBox,createOperationContext,applyOperationContext,annotateNumberMatch,scoreResult,rankResults,deduplicate,createManualCandidate};
});
