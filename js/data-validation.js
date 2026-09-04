/* Recurso RoutePilot: validação dos dados geográficos. */
/** Guia: Verifica as condições necessárias em validação dos dados geográficos (`validateRoutePilotData`). */
function validateRoutePilotData({log=true}={}) {
  const issues={errors:[],warnings:[],info:[]};
  /** Guia: Registra um novo item em validação dos dados geográficos (`add`). */
  const add=(level,code,message,entity=null)=>issues[level].push({code,message,entity});
  /** Guia: Executa uma etapa auxiliar em validação dos dados geográficos (`duplicateValues`). */
  const duplicateValues=values=>[...new Set(values.filter((value,index)=>values.indexOf(value)!==index))];
  /** Guia: Executa uma etapa auxiliar em validação dos dados geográficos (`validCoordinates`). */
  const validCoordinates=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
  /** Guia: Executa uma etapa auxiliar em validação dos dados geográficos (`normalized`). */
  const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const regionIds=new Set(regions.map(region=>region.id));
  const cityIds=new Set(regions.map(region=>region.city));
  const pointIds=new Set(points.map(point=>point.id));
  const boundaryIds=new Set(boundaries.features.map(feature=>feature.properties.id));

  duplicateValues(regions.map(region=>region.id)).forEach(id=>add('errors','duplicate_region_id',`ID de região duplicado: ${id}`,id));
  duplicateValues(points.map(point=>point.id)).forEach(id=>add('errors','duplicate_point_id',`ID de localidade duplicado: ${id}`,id));
  duplicateValues(boundaries.features.map(feature=>feature.properties.id)).forEach(id=>add('errors','duplicate_boundary_id',`ID de contorno duplicado: ${id}`,id));

  for(const region of regions){
    if(!region.id)add('errors','region_without_id',`Região sem ID: ${region.name||'(sem nome)'}`);
    if(!region.city)add('errors','region_without_city',`Região sem cidade: ${region.id||region.name}`,region.id);
    if(!validCoordinates(...(region.center||[])))add('errors','invalid_region_center',`Centro inválido: ${region.id}`,region.id);
    if(!Array.isArray(region.polygon)||region.polygon.length<3)add('warnings','region_without_polygon',`Região sem polígono válido: ${region.id}`,region.id);
    for(const id of region.nearby||[])if(!regionIds.has(id))add('errors','invalid_nearby_region',`Região próxima inexistente: ${region.id} -> ${id}`,region.id);
    for(const text of region.nearbyText||[])add('warnings','informative_nearby',`Proximidade informativa sem região: ${region.id} -> ${text}`,region.id);
    if(region.dataQuality?.confidence==='approximate')add('info','approximate_boundary',`Contorno operacional aproximado: ${region.id}`,region.id);
  }

  const aliasOwners=new Map();
  for(const point of points){
    if(!point.id)add('errors','point_without_id',`Localidade sem ID: ${point.city}/${point.name}`);
    if(!cityIds.has(point.city))add('errors','invalid_city',`Cidade inexistente: ${point.id} -> ${point.city}`,point.id);
    if(!regionIds.has(point.region))add('errors','invalid_region',`Região inexistente: ${point.id} -> ${point.region}`,point.id);
    if(!validCoordinates(point.lat,point.lon))add('errors','invalid_coordinates',`Coordenadas inválidas: ${point.id}`,point.id);
    for(const id of point.nearby||[])if(!pointIds.has(id))add('errors','invalid_nearby_point',`Localidade próxima inexistente: ${point.id} -> ${id}`,point.id);
    for(const text of point.nearbyText||[])add('warnings','informative_nearby',`Proximidade informativa sem ponto: ${point.id} -> ${text}`,point.id);

    const localAliases=new Set();
    for(const alias of point.aliases||[]){
      const key=normalized(alias);
      if(!key)continue;
      if(localAliases.has(key))add('warnings','duplicate_alias',`Alias duplicado em ${point.id}: ${alias}`,point.id);
      localAliases.add(key);
      const cityKey=`${point.city}|${key}`;
      if(!aliasOwners.has(cityKey))aliasOwners.set(cityKey,[]);
      aliasOwners.get(cityKey).push(point.id);
    }
    if(point.access?.type==='unknown'||point.access?.surface==='unknown'||point.access?.difficulty==='unknown')add('info','access_unknown',`Acesso não classificado: ${point.id}`,point.id);
    if(!point.dataQuality?.source)add('info','source_missing',`Local sem fonte informada: ${point.id}`,point.id);
    if(point.dataQuality?.confidence==='unknown')add('info','confidence_unknown',`Confiança não informada: ${point.id}`,point.id);
    if(!point.dataQuality?.reviewed)add('info','not_reviewed',`Local ainda não revisado: ${point.id}`,point.id);
  }

  for(const [key,owners] of aliasOwners)if(new Set(owners).size>1)add('warnings','ambiguous_alias',`Alias compartilhado na mesma cidade: ${key} -> ${[...new Set(owners)].join(', ')}`);
  duplicateValues(points.map(point=>`${point.city}|${normalized(point.name)}`)).forEach(key=>add('warnings','duplicate_point_name',`Nome de ponto duplicado na mesma cidade: ${key}`));

  for(const feature of boundaries.features){
    const item=feature.properties||{};
    if(!item.id)add('errors','boundary_without_id','Contorno sem ID.');
    if(!cityIds.has(item.city))add('errors','invalid_boundary_city',`Cidade de contorno inexistente: ${item.id} -> ${item.city}`,item.id);
    if(!regionIds.has(item.region))add('errors','invalid_boundary_region',`Região de contorno inexistente: ${item.id} -> ${item.region}`,item.id);
    if(item.pointId&&!pointIds.has(item.pointId))add('errors','invalid_boundary_point',`Ponto de contorno inexistente: ${item.id} -> ${item.pointId}`,item.id);
  }

  for(const reference of mapDetails.pois||[]){
    if(!reference.id)add('errors','reference_without_id',`Referência sem ID: ${reference.name||'(sem nome)'}`);
    if(!validCoordinates(reference.lat,reference.lon))add('errors','invalid_reference_coordinates',`Referência com coordenadas inválidas: ${reference.id}`,reference.id);
  }

  /** Guia: Executa uma etapa auxiliar em validação dos dados geográficos (`count`). */
  const count=code=>Object.values(issues).flat().filter(issue=>issue.code===code).length;
  const report={
    ...issues,
    counts:{points:points.length,regions:regions.length,boundaries:boundaryIds.size,references:(mapDetails.pois||[]).length},
    summary:{
      errors:issues.errors.length,
      warnings:issues.warnings.length,
      information:issues.info.length,
      informativeNearby:count('informative_nearby'),
      unknownAccess:count('access_unknown'),
      unknownConfidence:count('confidence_unknown'),
      missingSource:count('source_missing'),
      notReviewed:count('not_reviewed'),
      approximateBoundaries:count('approximate_boundary')
    }
  };

  if(log){
    console.groupCollapsed('[RoutePilot Data Validation]');
    console.info(`${points.length} locations checked`);
    console.info(`${regions.length} regions checked`);
    console.info(`${issues.errors.length} errors`);
    console.info(`${issues.warnings.length} warnings`);
    console.info(`${issues.info.length} information items`);
    issues.errors.forEach(issue=>console.error(issue.message));
    issues.warnings.forEach(issue=>console.warn(issue.message));
    console.groupEnd();
  }
  return report;
}

window.validateRoutePilotData=validateRoutePilotData;
window.routePilotValidation=validateRoutePilotData();
